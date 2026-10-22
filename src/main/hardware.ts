import { cpus, totalmem, freemem } from "node:os";
import type { Hardware } from "../shared/contracts";
type Counters = { idle: number; total: number };
export function cpuDelta(
  previous: Counters | null,
  next: Counters,
): number | null {
  if (!previous || next.total <= previous.total) return null;
  return Math.min(
    100,
    Math.max(
      0,
      100 * (1 - (next.idle - previous.idle) / (next.total - previous.total)),
    ),
  );
}
let previous: Counters | null = null;
let previousAt: number | null = null;
export function readHardware(): Hardware {
  const processors = cpus();
  const next = processors.reduce(
    (a, c) => ({
      idle: a.idle + c.times.idle,
      total: a.total + Object.values(c.times).reduce((x, y) => x + y, 0),
    }),
    { idle: 0, total: 0 },
  );
  const cpuPercent = cpuDelta(previous, next);
  const at = performance.now();
  const sampleWindowMs = previousAt === null ? null : at - previousAt;
  previousAt = at;
  previous = next;
  const memoryTotalBytes = totalmem();
  const speed = processors[0]?.speed;
  return {
    sampledAt: new Date().toISOString(),
    sampleWindowMs,
    cpuPercent,
    cpuName: processors[0]?.model ?? "Processador desconhecido",
    cpuCount: processors.length,
    cpuMhz: speed && speed > 0 ? speed : null,
    gpuPercent: null,
    gpuMhz: null,
    memoryTotalBytes,
    memoryUsedBytes: memoryTotalBytes - freemem(),
  };
}
