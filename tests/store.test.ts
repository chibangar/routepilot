import { expect, test } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadStore, saveStore } from "../src/main/store";
test("missing store yields defaults and saves/reopens games", async () => {
  const path = join(await mkdtemp(join(tmpdir(), "routepilot-")), "state.json");
  const loaded = await loadStore(path);
  expect(loaded.ok).toBe(true);
  if (!loaded.ok) return;
  loaded.value.games.push({
    id: "a",
    name: "Jogo",
    executablePath: null,
    targets: [],
    mode: "manual",
    selectedTargetId: null,
  });
  expect((await saveStore(path, loaded.value)).ok).toBe(true);
  expect(await loadStore(path)).toEqual(loaded);
  loaded.value.games = [];
  await saveStore(path, loaded.value);
  expect(JSON.parse(await readFile(path + ".bak", "utf8")).games).toHaveLength(
    1,
  );
});
test("malformed existing state is preserved", async () => {
  const path = join(await mkdtemp(join(tmpdir(), "routepilot-")), "state.json");
  await writeFile(path, "{broken");
  expect((await loadStore(path)).ok).toBe(false);
  expect(await readFile(path, "utf8")).toBe("{broken");
});
test("retention respects the byte budget so a saved store always reopens", async () => {
  const path = join(
    await mkdtemp(join(tmpdir(), "routepilot-capacity-")),
    "state.json",
  );
  const loaded = await loadStore(path);
  if (!loaded.ok) throw new Error("defaults");
  const sample = {
    index: 0,
    at: "2026-10-22T10:00:00.000Z",
    status: "reply" as const,
    rttMs: 1,
    reason: "x".repeat(1700),
  };
  loaded.value.sessions = Array.from({ length: 100 }, (_, i) => ({
    id: String(i),
    gameId: "g",
    target: { id: "t", label: "Local", host: "127.0.0.1" },
    startedAt: sample.at,
    endedAt: sample.at,
    state: "completed" as const,
    samples: Array.from({ length: 120 }, (_, index) => ({ ...sample, index })),
    metrics: {
      sent: 120,
      received: 120,
      minMs: 1,
      meanMs: 1,
      jitterMs: 0,
      noReplyPercent: 0,
    },
  }));
  const saved = await saveStore(path, loaded.value);
  expect(saved.ok).toBe(true);
  const reopened = await loadStore(path);
  expect(reopened.ok).toBe(true);
  if (reopened.ok) {
    expect(reopened.value.sessions.length).toBeLessThan(100);
    expect(reopened.value.sessions[0].id).toBe("0");
    expect(reopened).toEqual(saved);
  }
});
