import { _electron as electron, expect } from "@playwright/test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const base = resolve(".work");
await mkdir(base, { recursive: true });
const profile = await mkdtemp(join(base, "smoke-profile-"));
const output = resolve("docs/screenshots");
await mkdir(output, { recursive: true });
const packaged = process.argv.includes("--packaged");
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const options = packaged
  ? {
      executablePath: resolve("delivery/win-unpacked/RoutePilot.exe"),
      args: [`--user-data-dir=${profile}`],
      env,
    }
  : { args: [".", `--user-data-dir=${profile}`], env };
const errors = [];
const log = [];
let application;
const record = (text) => {
  log.push(text);
  console.log(text);
};
async function open() {
  application = await electron.launch(options);
  const page = await application.firstWindow();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.waitForLoadState("domcontentloaded");
  await expect(
    page.getByRole("heading", { name: "Baixa o teu ping" }),
  ).toBeVisible();
  return page;
}
try {
  let page = await open();
  const configured = await application.evaluate(({ app }) =>
    app.getPath("userData"),
  );
  expect(resolve(configured)).toBe(resolve(profile));
  expect(await page.evaluate(() => typeof window.require)).toBe("undefined");
  expect(await page.evaluate(() => typeof window.routepilot.startSession)).toBe(
    "function",
  );
  await page.screenshot({
    path: join(output, packaged ? "packaged-home.png" : "home.png"),
  });
  record("Application starts with isolated data and a restricted preload.");
  await page
    .getByRole("button", { name: "Adicionar aplicação", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Nome da aplicação", { exact: true })
    .fill("Ligação local");
  await page
    .getByLabel("Nome do destino 1", { exact: true })
    .fill("Este computador");
  await page.getByLabel("Host do destino 1", { exact: true }).fill("127.0.0.1");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Adicionar aplicação", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Definições", exact: true }).click();
  await page
    .getByRole("spinbutton", { name: "Número de sondas", exact: true })
    .fill("3");
  await page
    .getByRole("spinbutton", { name: "Intervalo entre sondas", exact: true })
    .fill("250");
  await page
    .getByRole("button", { name: "Guardar definições", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Definições guardadas");
  await page.getByRole("button", { name: "Aplicações", exact: true }).click();
  await page
    .getByRole("button", { name: "Abrir ligação", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Iniciar diagnóstico", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Terminar diagnóstico", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Concluído", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await expect(
    page.getByText("3 respostas · 3 observações", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: join(output, packaged ? "packaged-details.png" : "details.png"),
    fullPage: true,
  });
  record("Real loopback ping completed: 3/3 replies.");
  await page
    .getByRole("button", { name: "Analisar caminho", exact: true })
    .click();
  await expect(
    page.getByText("Destino observado", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: join(output, "route.png"), fullPage: true });
  record("Real loopback traceroute confirmed the destination.");
  await page
    .getByRole("button", { name: "Iniciar diagnóstico", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Terminar diagnóstico", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Terminar diagnóstico", exact: true })
    .click();
  await expect(page.getByText("Cancelado", { exact: true })).toBeVisible();
  record("Live diagnostic cancellation completed.");
  await page.getByRole("button", { name: "Histórico", exact: true }).click();
  await expect(page.locator(".history-item")).toHaveCount(2);
  await page.locator(".history-row").first().click();
  await page.screenshot({ path: join(output, "history.png"), fullPage: true });
  await application.evaluate(({ dialog }, directory) => {
    dialog.showSaveDialog = async (_window, options) => ({
      canceled: false,
      filePath: joinPath(directory, options.defaultPath),
    });
    function joinPath(a, b) {
      return a + "/" + b;
    }
  }, profile);
  await page
    .getByRole("button", { name: "JSON completo", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Histórico exportado");
  expect(
    JSON.parse(
      await readFile(join(profile, "RoutePilot-historico.json"), "utf8"),
    ),
  ).toHaveLength(2);
  await page.getByRole("button", { name: "CSV", exact: true }).click();
  await expect
    .poll(async () => {
      try {
        return (
          await readFile(join(profile, "RoutePilot-historico.csv"), "utf8")
        ).length;
      } catch {
        return 0;
      }
    })
    .toBeGreaterThan(50);
  record("History exports JSON and CSV through the main-process save dialog.");
  await page.getByRole("button", { name: "Ajuda", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "A tua rede, sem mistérios." }),
  ).toBeVisible();
  await page.screenshot({ path: join(output, "help.png"), fullPage: true });
  await page.setViewportSize({ width: 1080, height: 700 });
  await page.getByRole("button", { name: "Início", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: join(output, "home-small.png"),
    fullPage: true,
  });
  const invalid = await page.evaluate(() =>
    window.routepilot.exportSessions("exe"),
  );
  expect(invalid.ok).toBe(false);
  await application.close();
  application = null;
  page = await open();
  const state = await page.evaluate(() => window.routepilot.getState());
  expect(state.ok).toBe(true);
  expect(state.value.store.games).toHaveLength(1);
  expect(state.value.store.sessions).toHaveLength(2);
  expect(state.value.store.settings.sampleCount).toBe(3);
  record("Restart preserved games, settings and both sessions.");
  await page.getByRole("button", { name: "Aplicações", exact: true }).click();
  await page
    .getByRole("button", { name: "Abrir ligação", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Iniciar diagnóstico", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Terminar diagnóstico", exact: true }),
  ).toBeVisible();
  await application.close();
  application = null;
  const stored = JSON.parse(
    await readFile(join(profile, "state.json"), "utf8"),
  );
  expect(stored.sessions).toHaveLength(3);
  expect(stored.sessions[0].state).toBe("cancelled");
  expect(errors).toEqual([]);
  record(
    "Closing during live diagnostics persisted the cancelled session; no renderer errors.",
  );
  await writeFile(
    join(base, packaged ? "smoke-packaged.json" : "smoke.json"),
    JSON.stringify(
      {
        profile,
        packaged,
        checks: log,
        errors,
        sessionStates: stored.sessions.map((s) => s.state),
      },
      null,
      2,
    ),
  );
} catch (e) {
  if (application) {
    const page = await application.firstWindow().catch(() => null);
    await page
      ?.screenshot({ path: join(base, "smoke-failure.png") })
      .catch(() => {});
  }
  throw e;
} finally {
  if (application) await application.close();
}
