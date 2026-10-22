import { _electron as electron, expect } from "@playwright/test";
import { mkdir, mkdtemp, writeFile, readFile, rename } from "node:fs/promises";
import { resolve, join } from "node:path";
const base = resolve(".work");
await mkdir(base, { recursive: true });
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const targetA = { id: "a", label: "Destino indisponível", host: "0.0.0.0" };
const targetB = { id: "b", label: "Destino observado", host: "127.0.0.1" };
const profile = await mkdtemp(join(base, "boundary-profile-"));
const game = {
  id: "automatic",
  name: "Comparação local",
  executablePath: null,
  targets: [targetA, targetB],
  selectedTargetId: "a",
  mode: "automatic",
};
await writeFile(
  join(profile, "state.json"),
  JSON.stringify({
    version: 1,
    games: [game],
    sessions: [],
    settings: { sampleCount: 1, timeoutMs: 250, intervalMs: 250 },
  }),
);
let app;
const checks = [];
async function launch(directory) {
  app = await electron.launch({
    args: [".", `--user-data-dir=${directory}`],
    env,
  });
  const page = await app.firstWindow();
  await page.waitForLoadState("domcontentloaded");
  return page;
}
try {
  let page = await launch(profile);
  await page.getByRole("button", { name: "Aplicações", exact: true }).click();
  await page
    .getByRole("button", { name: "Abrir ligação", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Iniciar diagnóstico", exact: true })
    .click();
  await expect(page.getByText("Concluído", { exact: true })).toBeVisible({
    timeout: 30000,
  });
  await expect(page.locator(".destination-panel h3")).toHaveText(
    "Destino observado",
  );
  const state = await page.evaluate(() => window.routepilot.getState());
  expect(state.ok).toBe(true);
  expect(state.value.store.sessions[0].target.host).toBe("127.0.0.1");
  expect(state.value.store.sessions[0].selection).toHaveLength(2);
  checks.push(
    "Automatic comparison preserves its probes and labels the responding destination after completion.",
  );
  await page
    .getByRole("button", { name: "Analisar caminho", exact: true })
    .click();
  await expect(
    page.getByText("Destino observado", { exact: true }).last(),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.locator(".route-summary")).toBeVisible();
  await page.getByRole("button", { name: "Configurar", exact: true }).click();
  await page
    .getByLabel("Nome do destino 2", { exact: true })
    .fill("Destino atualizado");
  await page
    .getByRole("button", { name: "Guardar alterações", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".route-summary")).toHaveCount(0);
  checks.push(
    "Editing destination configuration invalidates older traceroute results.",
  );
  await app.close();
  app = null;
  const corrupt = await mkdtemp(join(base, "corrupt-profile-"));
  await writeFile(join(corrupt, "state.json"), "{broken");
  page = await launch(corrupt);
  await expect(page.getByRole("alert")).toContainText(
    "original foi preservado",
  );
  expect(await readFile(join(corrupt, "state.json"), "utf8")).toBe("{broken");
  await app.close();
  app = null;
  checks.push(
    "Corrupt existing state is reported and remains byte-for-byte intact.",
  );
  const full = await mkdtemp(join(base, "failed-save-profile-"));
  page = await launch(full);
  const testGame = {
    ...game,
    mode: "manual",
    targets: [targetB],
    selectedTargetId: "b",
  };
  expect(
    (await page.evaluate((g) => window.routepilot.saveGame(g), testGame)).ok,
  ).toBe(true);
  expect(
    (
      await page.evaluate(() =>
        window.routepilot.saveSettings({
          sampleCount: 1,
          timeoutMs: 250,
          intervalMs: 250,
        }),
      )
    ).ok,
  ).toBe(true);
  await rename(join(full, "state.json"), join(full, "state-original.json"));
  await mkdir(join(full, "state.json"));
  await page.evaluate(() => window.routepilot.startSession("automatic"));
  await expect(page.getByRole("alert")).toContainText("preservado", {
    timeout: 15000,
  });
  const denied = await page.evaluate(() =>
    window.routepilot.startSession("automatic"),
  );
  expect(denied.ok).toBe(false);
  await app.evaluate(({ dialog, BrowserWindow }) => {
    dialog.showErrorBox = () => {};
    dialog.showMessageBox = async () => ({
      response: 0,
      checkboxChecked: false,
    });
    BrowserWindow.getAllWindows()[0].close();
  });
  await new Promise((r) => setTimeout(r, 250));
  expect(page.isClosed()).toBe(false);
  const { rmdir } = await import("node:fs/promises");
  await rmdir(join(full, "state.json"));
  await rename(join(full, "state-original.json"), join(full, "state.json"));
  await page
    .getByRole("button", { name: "Tentar novamente", exact: true })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
  const recovered = await page.evaluate(() => window.routepilot.getState());
  expect(recovered.ok).toBe(true);
  expect(recovered.value.store.sessions).toHaveLength(1);
  await app.close();
  app = null;
  checks.push(
    "A real disk write failure blocks replacement; retry recovers the retained result.",
  );
  await writeFile(
    join(base, "boundaries.json"),
    JSON.stringify({ checks }, null, 2),
  );
  console.log(checks.join("\n"));
} finally {
  if (app) await app.close();
}
