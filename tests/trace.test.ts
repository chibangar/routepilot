import { expect, test } from "vitest";
import { parseTrace } from "../src/main/diagnostics/trace";
const target = { id: "t", host: "1.1.1.1", label: "Destino" };
test("retains reply, timeout and unknown hops with raw evidence", () => {
  const raw =
    "Tracing route to 1.1.1.1\n  1    <1 ms    2 ms    3 ms  192.168.1.1\n  2     *        *        *     Request timed out.\n  3   unexpected\n";
  const result = parseTrace(target, raw);
  expect(result.complete).toBe(false);
  expect(result.raw).toBe(raw);
  expect(result.hops.map((h) => h.status)).toEqual([
    "reply",
    "timeout",
    "unparsed",
  ]);
  expect(result.hops[0].rttMs).toBeCloseTo(1.833333);
});
test("only a destination observed at the final hop establishes completion", () => {
  expect(parseTrace(target, " 1   8 ms  9 ms  10 ms  1.1.1.1").complete).toBe(
    true,
  );
  expect(
    parseTrace(
      { ...target, host: "example.com" },
      "Tracing route to example.com [1.1.1.1]\n 1 8 ms 9 ms 10 ms 1.1.1.1",
    ).complete,
  ).toBe(true);
  expect(
    parseTrace({ ...target, host: "::1" }, " 1 <1 ms <1 ms <1 ms ::1").complete,
  ).toBe(true);
  expect(
    parseTrace(
      { ...target, host: "0:0:0:0:0:0:0:1" },
      " 1 <1 ms <1 ms <1 ms ::1",
    ).complete,
  ).toBe(true);
});
