import { expect, test } from "vitest";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseVdf, scanGameSources } from "../src/main/discovery";
test("shares one 64-library bound across registered roots and discovered libraries", async () => {
  const base = await mkdtemp(join(tmpdir(), "routepilot-library-bound-"));
  const roots = Array.from({ length: 64 }, (_, i) => join(base, "Root" + i));
  const extras = Array.from({ length: 63 }, (_, i) => join(base, "Extra" + i));
  for (const [index, root] of [...roots, ...extras].entries()) {
    await mkdir(join(root, "steamapps", "common", "Game"), { recursive: true });
    await writeFile(
      join(root, "steamapps", `appmanifest_${index + 1}.acf`),
      `"AppState" { "appid" "${index + 1}" "name" "Game ${index + 1}" "installdir" "Game" }`,
    );
  }
  await writeFile(
    join(roots[0], "steamapps", "libraryfolders.vdf"),
    '"libraryfolders" { ' +
      extras
        .map((path, i) => `"${i}" { "path" ${JSON.stringify(path)} }`)
        .join(" ") +
      " }",
  );
  const result = await scanGameSources(
    { steamRoots: roots, epicManifestDir: join(base, "missing"), gogGames: [] },
    new AbortController().signal,
  );
  expect(result.games).toHaveLength(64);
  expect(result.partial).toBe(true);
  expect(result.warnings.some((w) => w.includes("64 bibliotecas"))).toBe(true);
});
test("parses nested Steam KeyValues including escaped paths and comments", () => {
  expect(
    parseVdf('"libraryfolders" { // local\n "0" { "path" "D:\\\\Games" } }'),
  ).toEqual({ libraryfolders: { "0": { path: "D:\\Games" } } });
  expect(() => parseVdf('"app" { "name" "Broken"')).toThrow();
  expect(() => parseVdf('"app" { "name" "A" "name" "B" }')).toThrow();
});
test("finds real manifest installations and preserves source identities", async () => {
  const root = await mkdtemp(join(tmpdir(), "routepilot-discovery-"));
  const steam = join(root, "Steam");
  const library = join(root, "Library");
  const epic = join(root, "EpicManifests");
  const epicGame = join(root, "EpicGame");
  await mkdir(join(steam, "steamapps"), { recursive: true });
  await mkdir(join(library, "steamapps", "common", "Local Game"), {
    recursive: true,
  });
  await mkdir(epic, { recursive: true });
  await mkdir(epicGame);
  const vdfPath = JSON.stringify(library);
  await writeFile(
    join(steam, "steamapps", "libraryfolders.vdf"),
    `"libraryfolders" { "0" { "path" ${vdfPath} } }`,
  );
  await writeFile(
    join(library, "steamapps", "appmanifest_123.acf"),
    '"AppState" { "appid" "123" "name" "Local Game" "installdir" "Local Game" }',
  );
  await writeFile(join(epicGame, "Game.exe"), "fixture only");
  await writeFile(
    join(epic, "local.item"),
    JSON.stringify({
      AppName: "local-epic",
      DisplayName: "Jogo Épico",
      InstallLocation: epicGame,
      LaunchExecutable: "Game.exe",
      bIsIncompleteInstall: false,
    }),
  );
  const report = await scanGameSources(
    { steamRoots: [steam], epicManifestDir: epic, gogGames: [] },
    new AbortController().signal,
  );
  expect(report.games.map((g) => g.name).sort()).toEqual([
    "Jogo Épico",
    "Local Game",
  ]);
  const steamResult = report.games.find((g) => g.source === "Steam")!;
  expect(steamResult.installPath).toBe(
    join(library, "steamapps", "common", "Local Game"),
  );
  expect(steamResult.executablePath).toBeNull();
  expect(steamResult.evidencePath).toContain("appmanifest_123.acf");
  expect(
    report.games.find((g) => g.source === "Epic Games")?.executablePath,
  ).toBe(join(epicGame, "Game.exe"));
});
test("rejects escaped installation paths and reports malformed records without stopping discovery", async () => {
  const root = await mkdtemp(join(tmpdir(), "routepilot-discovery-bad-"));
  const steam = join(root, "Steam");
  const epic = join(root, "Epic");
  await mkdir(join(steam, "steamapps"), { recursive: true });
  await mkdir(epic);
  await writeFile(
    join(steam, "steamapps", "appmanifest_1.acf"),
    '"AppState" { "appid" "1" "name" "Bad" "installdir" "../../outside" }',
  );
  await writeFile(join(epic, "broken.item"), "{broken");
  const report = await scanGameSources(
    { steamRoots: [steam], epicManifestDir: epic, gogGames: [] },
    new AbortController().signal,
  );
  expect(report.games).toHaveLength(0);
  expect(report.partial).toBe(true);
  expect(report.warnings.length).toBeGreaterThan(0);
});
test("GOG requires an existing install directory and preserves unknown executable", async () => {
  const root = await mkdtemp(join(tmpdir(), "routepilot-gog-"));
  const report = await scanGameSources(
    {
      steamRoots: [],
      epicManifestDir: join(root, "missing"),
      gogGames: [
        {
          id: "42",
          name: "GOG Local",
          path: root,
          exe: join(root, "missing.exe"),
          evidencePath: "HKLM/GOG/42",
        },
      ],
    },
    new AbortController().signal,
  );
  expect(report.games).toHaveLength(1);
  expect(report.games[0].executablePath).toBeNull();
  expect(report.games[0].source).toBe("GOG");
});
test("cancellation returns explicit partial coverage", async () => {
  const controller = new AbortController();
  controller.abort();
  const report = await scanGameSources(
    { steamRoots: [], epicManifestDir: "C:/missing", gogGames: [] },
    controller.signal,
  );
  expect(report.partial).toBe(true);
  expect(report.cancelled).toBe(true);
});
