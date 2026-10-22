import { _electron as electron, expect } from "@playwright/test";
import { mkdir, mkdtemp, writeFile, readFile } from "node:fs/promises";
import { resolve, join } from "node:path";
const base = resolve(".work");
await mkdir(base, { recursive: true });
const profile = await mkdtemp(join(base, "discovery-profile-"));
const library = join(profile, "FixtureLibrary");
await mkdir(join(library, "steamapps", "common", "FixtureGame"), {
  recursive: true,
});
await writeFile(
  join(library, "steamapps", "appmanifest_99999123.acf"),
  '"AppState" { "appid" "99999123" "name" "Teste deteção Steam" "installdir" "FixtureGame" }',
);
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
let app;
let actualSummary;
const errors = [];
try {
  app = await electron.launch(options);
  let page = await app.firstWindow();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("button", { name: "Aplicações", exact: true }).click();
  await page
    .getByRole("button", { name: "Detetar jogos instalados", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Procurar novamente", exact: true }),
  ).toBeVisible({ timeout: 30000 });
  actualSummary = await page.locator(".discovery-modal").innerText();
  await page.screenshot({
    path: resolve("docs/screenshots/discovery-real.png"),
  });
  await app.evaluate(({ dialog }, folder) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [folder],
    });
  }, library);
  await page
    .getByRole("button", { name: "Escolher biblioteca", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", {
      name: "Selecionar Teste deteção Steam",
      exact: true,
    }),
  ).toBeVisible({ timeout: 30000 });
  for (const checkbox of await page
    .getByRole("dialog")
    .getByRole("checkbox")
    .all())
    if (await checkbox.isEnabled()) await checkbox.uncheck();
  await page
    .getByRole("checkbox", {
      name: "Selecionar Teste deteção Steam",
      exact: true,
    })
    .check();
  await page.screenshot({ path: resolve("docs/screenshots/discovery.png") });
  await page
    .getByRole("button", { name: "Adicionar selecionados (1)", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", {
      name: "Selecionar Teste deteção Steam",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Procurar novamente", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", {
      name: "Selecionar Teste deteção Steam",
      exact: true,
    }),
  ).toBeDisabled({ timeout: 30000 });
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Teste deteção Steam", exact: true }),
  ).toBeVisible();
  const before = await page.evaluate(() => window.routepilot.getState());
  expect(before.ok).toBe(true);
  expect(before.value.store.games).toHaveLength(1);
  expect(before.value.store.games[0].targets).toEqual([]);
  expect(before.value.store.discovery.steamLibraries).toEqual([library]);
  const forged = await page.evaluate(() =>
    window.routepilot.importDiscoveredGames(["not-a-current-candidate"]),
  );
  expect(forged.ok).toBe(false);
  await app.close();
  app = null;
  app = await electron.launch(options);
  page = await app.firstWindow();
  await page.getByRole("button", { name: "Aplicações", exact: true }).click();
  await page
    .getByRole("button", { name: "Detetar jogos instalados", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", {
      name: "Selecionar Teste deteção Steam",
      exact: true,
    }),
  ).toBeDisabled({ timeout: 30000 });
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await app.close();
  app = null;
  expect(errors).toEqual([]);
  const result = {
    packaged,
    profile,
    actualSourceScanSummary: actualSummary,
    checks: [
      "Actual Windows registry/default metadata scan completed.",
      "Native folder picker path selected a fixture Steam library.",
      "Fixture manifest parsed through production filesystem scanner and imported from UI.",
      "Duplicate import disabled; custom library survives repeat scan and restart.",
      "Imported game preserves provenance and has no invented network target.",
      "Forged candidate ID rejected.",
    ],
    errors,
  };
  await writeFile(
    join(
      base,
      packaged ? "discovery-smoke-packaged.json" : "discovery-smoke.json",
    ),
    JSON.stringify(result, null, 2),
  );
  console.log(result.checks.join("\n"));
} finally {
  if (app) await app.close();
}
