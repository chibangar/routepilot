import type { Sample, Metrics } from "../../shared/contracts";
export function computeMetrics(samples: Sample[]): Metrics {
  const sent = samples.filter((s) => s.status !== "error").length;
  const values = samples
    .filter((s) => s.status === "reply" && s.rttMs !== null)
    .map((s) => s.rttMs!);
  const diffs: number[] = [];
  for (let i = 1; i < samples.length; i++)
    if (samples[i].status === "reply" && samples[i - 1].status === "reply")
      diffs.push(Math.abs(samples[i].rttMs! - samples[i - 1].rttMs!));
  return {
    sent,
    received: values.length,
    minMs: values.length ? Math.min(...values) : null,
    meanMs: values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null,
    jitterMs: diffs.length
      ? diffs.reduce((a, b) => a + b, 0) / diffs.length
      : null,
    noReplyPercent: sent ? ((sent - values.length) / sent) * 100 : null,
  };
}
