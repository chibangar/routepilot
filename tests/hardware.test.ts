import { expect, test } from "vitest";
import { cpuDelta, readHardware } from "../src/main/hardware";
test("CPU needs two observations and memory stays in bytes", () => {
  expect(cpuDelta(null, { idle: 30, total: 100 })).toBeNull();
  expect(cpuDelta({ idle: 30, total: 100 }, { idle: 80, total: 200 })).toBe(50);
  const hw = readHardware();
  expect(hw.memoryTotalBytes).toBeGreaterThan(0);
  expect(hw.memoryUsedBytes).toBeLessThanOrEqual(hw.memoryTotalBytes);
});
