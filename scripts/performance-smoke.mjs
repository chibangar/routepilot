import { _electron as electron, expect } from "@playwright/test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { performance } from "node:perf_hooks";
import { cpus, release } from "node:os";
const label = process.argv[2] ?? "run";
const base = resolve(".work");
await mkdir(base, { recursive: true });
const profile = await mkdtemp(join(base, "performance-profile-"));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const packaged = process.argv.includes("--packaged");
const options = packaged
  ? {
      executablePath: resolve("delivery/win-unpacked/RoutePilot.exe"),
      args: [`--user-data-dir=${profile}`],
      env,
    }
  : { args: [".", `--user-data-dir=${profile}`], env };
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const output = {
  label,
  version,
  platform: process.platform,
  windowsRelease: release(),
  logicalProcessors: cpus().length,
  profile,
  method:
    "Electron app.getAppMetrics; sum working sets includes shared pages more than once; privateBytes is private committed memory. KiB units. OS file cache uncontrolled. No network diagnostics or discovery running.",
  runs: [],
};
async function metrics(app) {
  return app.evaluate(({ app }) =>
    app
      .getAppMetrics()
      .map((m) => ({
        id: m.pid,
        created: m.creationTime,
        type: m.type,
        cpuSeconds: m.cpu.cumulativeCPUUsage ?? null,
        workingSetKiB: m.memory.workingSetSize,
        privateKiB: m.memory.privateBytes ?? null,
      })),
  );
}
async function observe(app, scenario) {
  const start = performance.now();
  const first = await metrics(app);
  const snapshots = [first];
  while (performance.now() - start < 5000) {
    await new Promise((r) => setTimeout(r, 500));
    snapshots.push(await metrics(app));
  }
  const elapsedMs = performance.now() - start;
  const initial = new Map(
    first.map((p) => [p.id + ":" + p.created, p.cpuSeconds]),
  );
  const last = new Map();
  for (const sample of snapshots)
    for (const p of sample) last.set(p.id + ":" + p.created, p);
  const cpuSeconds = [...last].reduce(
    (sum, [key, p]) =>
      sum +
      (p.cpuSeconds === null
        ? 0
        : Math.max(0, p.cpuSeconds - (initial.get(key) ?? 0))),
    0,
  );
  const ws = snapshots.map((s) => s.reduce((a, p) => a + p.workingSetKiB, 0));
  const priv = snapshots.map((s) =>
    s.reduce((a, p) => a + (p.privateKiB ?? 0), 0),
  );
  return {
    scenario,
    elapsedMs,
    cpuSeconds,
    cpuPercentOfOneCore: (cpuSeconds / (elapsedMs / 1000)) * 100,
    cpuPercentOfMachine:
      (cpuSeconds / ((elapsedMs / 1000) * output.logicalProcessors)) * 100,
    peakSummedWorkingSetMiB: Math.max(...ws) / 1024,
    meanSummedWorkingSetMiB: ws.reduce((a, b) => a + b, 0) / ws.length / 1024,
    peakPrivateCommittedMiB: Math.max(...priv) / 1024,
    processes: last.size,
    samples: snapshots.length,
    raw: snapshots,
  };
}
for (const kind of ["fresh-profile", "restart-same-profile"]) {
  const start = performance.now();
  const app = await electron.launch(options);
  try {
    const page = await app.firstWindow();
    await expect(
      page.getByRole("heading", { name: "Baixa o teu ping" }),
    ).toBeVisible();
    const startupMs = performance.now() - start;
    await page.bringToFront();
    await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows()[0];
      w.show();
      w.focus();
    });
    await new Promise((r) => setTimeout(r, 1000));
    const scenarios = [];
    scenarios.push(await observe(app, "home-visible-focused"));
    await page.getByRole("button", { name: "Histórico", exact: true }).click();
    scenarios.push(await observe(app, "history-visible-focused"));
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].minimize(),
    );
    scenarios.push(await observe(app, "minimized"));
    output.runs.push({ kind, startupMs, scenarios });
    console.log(
      JSON.stringify({
        label,
        kind,
        startupMs,
        scenarios: scenarios.map(({ raw, ...s }) => s),
      }),
    );
  } finally {
    await app.close();
  }
}
await writeFile(
  join(base, `performance-${label}.json`),
  JSON.stringify(output, null, 2),
);
