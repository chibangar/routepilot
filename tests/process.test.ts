import { expect, test } from "vitest";
import { runProcess } from "../src/main/diagnostics/process";
test("keeps diagnostic stderr separate from machine-readable stdout", async () => {
  const result = await runProcess(
    process.execPath,
    [
      "-e",
      `process.stdout.write('{"ok":true}');process.stderr.write('diagnostic')`,
    ],
    new AbortController().signal,
    3000,
    4096,
    "utf8",
  );
  expect(result.stdout).toBe('{"ok":true}');
  expect(result.stderr).toBe("diagnostic");
});
test("aborted process is awaited until close", async () => {
  const controller = new AbortController();
  const work = runProcess(
    process.execPath,
    ["-e", "setInterval(()=>{},1000)"],
    controller.signal,
    5000,
    1024,
  );
  controller.abort();
  const result = await work;
  expect(result.cancelled).toBe(true);
  expect(result.error).toBeNull();
});
test("missing executable reports process failure", async () => {
  const result = await runProcess(
    "C:/routepilot-missing/no.exe",
    [],
    new AbortController().signal,
    1000,
    1024,
  );
  expect(result.error).toMatch(/ENOENT/);
});
