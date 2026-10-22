import { expect, test } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportSessions } from "../src/main/export";
import type { Session } from "../src/shared/contracts";
const session: Session = {
  id: "s",
  gameId: "g",
  target: { id: "t", host: "127.0.0.1", label: '=SUM(1,2)\n"Local"' },
  startedAt: "2026-10-22T10:00:00.000Z",
  endedAt: null,
  state: "cancelled",
  samples: [],
  metrics: {
    sent: 0,
    received: 0,
    minMs: null,
    meanMs: null,
    jitterMs: null,
    noReplyPercent: null,
  },
};
test("exports source values in JSON and escaped safe spreadsheet cells in CSV", async () => {
  const dir = await mkdtemp(join(tmpdir(), "routepilot-export-"));
  expect(
    (await exportSessions([session], "json", join(dir, "out.json"))).ok,
  ).toBe(true);
  expect(JSON.parse(await readFile(join(dir, "out.json"), "utf8"))).toEqual([
    session,
  ]);
  expect(
    (await exportSessions([session], "csv", join(dir, "out.csv"))).ok,
  ).toBe(true);
  expect(await readFile(join(dir, "out.csv"), "utf8")).toContain(
    '"\'=SUM(1,2)\n""Local"""',
  );
});
