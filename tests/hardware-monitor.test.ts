import { expect, test, vi } from "vitest";
import { createHardwareMonitor } from "../src/renderer/hardware-monitor";
import type { Hardware } from "../src/shared/contracts";
const hardware = (n: number): Hardware => ({
  cpuPercent: n,
  cpuName: "CPU",
  cpuCount: 1,
  memoryUsedBytes: n,
  memoryTotalBytes: 100,
});
test("economy mode samples on demand and creates no recurring work", async () => {
  vi.useFakeTimers();
  try {
    let n = 0;
    const values: Hardware[] = [];
    const monitor = createHardwareMonitor(
      async () => ({ ok: true, value: hardware(++n) }),
      (value) => values.push(value),
      () => {},
      true,
    );
    monitor.setActive(true);
    await monitor.refresh();
    await vi.advanceTimersByTimeAsync(20000);
    expect(values.map((v) => v.memoryUsedBytes)).toEqual([1]);
    expect(vi.getTimerCount()).toBe(0);
    await monitor.refresh();
    expect(values.map((v) => v.memoryUsedBytes)).toEqual([1, 2]);
    monitor.dispose();
  } finally {
    vi.useRealTimers();
  }
});
test("automatic updates stop when the page is inactive and dispose ignores late replies", async () => {
  vi.useFakeTimers();
  try {
    let n = 0;
    const values: Hardware[] = [];
    const monitor = createHardwareMonitor(
      async () => ({ ok: true, value: hardware(++n) }),
      (value) => values.push(value),
      () => {},
      false,
    );
    monitor.setActive(true);
    await monitor.refresh();
    await vi.advanceTimersByTimeAsync(10000);
    expect(values).toHaveLength(3);
    monitor.setActive(false);
    await vi.advanceTimersByTimeAsync(20000);
    expect(values).toHaveLength(3);
    expect(vi.getTimerCount()).toBe(0);
    monitor.dispose();
    let finish!: (r: any) => void;
    const late = createHardwareMonitor(
      () => new Promise((r) => (finish = r)),
      (value) => values.push(value),
      () => {},
      true,
    );
    const pending = late.refresh();
    late.dispose();
    finish({ ok: true, value: hardware(90) });
    await pending;
    expect(values).toHaveLength(3);
  } finally {
    vi.useRealTimers();
  }
});
