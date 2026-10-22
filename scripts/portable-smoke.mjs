import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { chromium, expect } from "@playwright/test";
const base = resolve(".work");
await mkdir(base, { recursive: true });
const profile = await mkdtemp(join(base, "portable-profile-"));
const server = createServer();
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
await new Promise((r) => server.close(r));
const { version } = JSON.parse(await readFile("package.json", "utf8"));
const executable = resolve(`delivery/RoutePilot-${version}-Windows.exe`);
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(
  executable,
  [
    `--user-data-dir=${profile}`,
    `--remote-debugging-port=${port}`,
    "--remote-debugging-address=127.0.0.1",
  ],
  { env, windowsHide: true, stdio: "ignore" },
);
const exit = new Promise((resolveExit) => {
  child.once("close", (code) => resolveExit(code));
  child.once("error", (e) => resolveExit(String(e)));
});
let browser;
try {
  const deadline = Date.now() + 45000;
  while (!browser && Date.now() < deadline) {
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`, {
        timeout: 1000,
      });
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  if (!browser)
    throw new Error(
      "Portable wrapper did not expose the test instance within 45 seconds.",
    );
  let page;
  await expect
    .poll(
      () => {
        page = browser
          .contexts()
          .flatMap((c) => c.pages())
          .find((p) => p.url().startsWith("file:"));
        return !!page;
      },
      { timeout: 15000 },
    )
    .toBe(true);
  await expect(
    page.getByRole("heading", { name: "A tua ligação, em perspetiva." }),
  ).toBeVisible();
  expect(
    (
      await page.evaluate(() =>
        window.routepilot.saveSettings({
          sampleCount: 3,
          timeoutMs: 1000,
          intervalMs: 250,
        }),
      )
    ).ok,
  ).toBe(true);
  await page
    .getByRole("button", { name: "Testar ligação local", exact: true })
    .click();
  await expect(page.getByText("Concluído", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await expect(
    page.getByText("3 respostas · 3 observações", { exact: true }),
  ).toBeVisible();
  const state = await page.evaluate(() => window.routepilot.getState());
  expect(state.ok).toBe(true);
  expect(state.value.store.sessions[0].metrics.received).toBe(3);
  await page.getByRole("button", { name: "Início", exact: true }).click();
  await page.locator("main").evaluate((el) => el.scrollTo({ top: 0 }));
  await page.screenshot({ path: resolve("docs/screenshots/portable.png") });
  await page.close();
  await browser.close();
  browser = null;
  const code = await Promise.race([
    exit,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error("Portable did not exit after window close.")),
        15000,
      ),
    ),
  ]);
  expect(code).toBe(0);
  const saved = JSON.parse(await readFile(join(profile, "state.json"), "utf8"));
  expect(saved.sessions[0].metrics.received).toBe(3);
  await writeFile(
    join(base, "portable-smoke.json"),
    JSON.stringify(
      {
        executable,
        profile,
        exitCode: code,
        checks: [
          "Portable wrapper extracted and launched the packaged application.",
          "Real loopback diagnostic received 3/3 replies.",
          "Window close exited the wrapper with code zero and persisted history.",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "Portable EXE: launched, real ping 3/3, persisted history, closed with exit 0.",
  );
} finally {
  if (browser) await browser.close();
}
