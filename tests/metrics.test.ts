import { expect, test } from "vitest";
import { computeMetrics } from "../src/main/diagnostics/metrics";
import type { Sample } from "../src/shared/contracts";
const samples = (values: (number | null)[]): Sample[] =>
  values.map((rttMs, index) => ({
    index,
    at: new Date().toISOString(),
    rttMs,
    status: rttMs === null ? "timeout" : "reply",
    reason: null,
  }));
test("computes real metrics and excludes gaps from jitter", () => {
  expect(computeMetrics(samples([30, 40, 35, null]))).toEqual({
    sent: 4,
    received: 3,
    minMs: 30,
    meanMs: 35,
    jitterMs: 7.5,
    noReplyPercent: 25,
  });
  expect(computeMetrics(samples([30, null, 90])).jitterMs).toBeNull();
});
test("unobserved latency stays unknown", () => {
  expect(computeMetrics(samples([null, null])).meanMs).toBeNull();
  expect(computeMetrics(samples([30])).jitterMs).toBeNull();
  expect(computeMetrics([]).noReplyPercent).toBeNull();
});
