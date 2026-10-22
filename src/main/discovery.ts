import { open, stat, opendir, realpath } from "node:fs/promises";
import { join, resolve, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import type {
  DiscoveredGame,
  DiscoveryReport,
  GameSource,
} from "../shared/contracts";
import { parseVdf, vdfObject, vdfField } from "./discovery/vdf";
export { parseVdf } from "./discovery/vdf";
export type GogRecord = {
  id: string;
  name: string;
  path: string;
  exe: string | null;
  evidencePath: string;
};
export type DiscoverySources = {
  steamRoots: string[];
  epicManifestDir: string;
  gogGames: GogRecord[];
  riotGames?: GogRecord[];
  warnings?: string[];
};
const MAX_FILE = 1024 * 1024;
const keyPath = (path: string) => resolve(path).toLocaleLowerCase("en-US");
export async function readManifest(
  path: string,
  maxBytes = MAX_FILE,
): Promise<string> {
  const file = await open(path, "r");
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size > Math.min(MAX_FILE, maxBytes))
      throw new Error("Manifesto inválido ou superior a 1 MiB.");
    const buffer = Buffer.alloc(info.size + 1);
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    if (bytesRead > info.size)
      throw new Error("Manifesto alterado durante a leitura.");
    return buffer
      .subarray(0, bytesRead)
      .toString("utf8")
      .replace(/^\uFEFF/, "");
  } finally {
    await file.close();
  }
}
function requiredString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value || value.length > 4096)
    throw new Error(`Campo ${name} inválido.`);
  return value;
}
export async function localDirectory(path: string): Promise<boolean> {
  if (!isAbsolute(path) || path.startsWith("\\\\") || path.startsWith("//"))
    throw new Error("A deteção automática só lê pastas locais absolutas.");
  try {
    const resolved = await realpath(path);
    if (resolved.startsWith("\\\\") || resolved.startsWith("//"))
      throw new Error("Pasta redirecionada para uma localização remota.");
    return (await stat(resolved)).isDirectory();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw e;
  }
}
export async function knownExecutable(
  install: string,
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const candidate = resolve(install, path);
  const rel = relative(resolve(install), candidate);
  if (
    rel.startsWith("..") ||
    isAbsolute(rel) ||
    !candidate.toLowerCase().endsWith(".exe")
  )
    return null;
  try {
    const actual = await realpath(candidate);
    const resolvedInstall = await realpath(install);
    const contained = relative(resolvedInstall, actual);
    if (contained.startsWith("..") || isAbsolute(contained)) return null;
    return (await stat(actual)).isFile() ? candidate : null;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
export async function scanGameSources(
  sources: DiscoverySources,
  signal: AbortSignal,
): Promise<DiscoveryReport> {
  const report: DiscoveryReport = {
    games: [],
    warnings: [...(sources.warnings ?? [])],
    partial: !!sources.warnings?.length,
    cancelled: false,
    scannedAt: new Date().toISOString(),
    sources: ["Steam", "Epic Games", "GOG"],
  };
  const warn = (text: string) => {
    report.partial = true;
    if (report.warnings.length < 100) report.warnings.push(text);
  };
  let bytesRead = 0,
    entries = 0,
    limited = false;
  const deadline = Date.now() + 20000;
  const stopped = () => {
    if (!limited && Date.now() > deadline) {
      limited = true;
      warn(
        "Limite de tempo da leitura de manifestos atingido; cobertura parcial.",
      );
    }
    return signal.aborted || limited;
  };
  const readBudgeted = async (path: string) => {
    const remaining = 64 * 1024 * 1024 - bytesRead;
    if (remaining <= 0) {
      limited = true;
      warn("Limite total de 64 MiB de manifestos atingido; cobertura parcial.");
      throw new Error("Orçamento de leitura esgotado.");
    }
    const text = await readManifest(path, remaining);
    bytesRead += Buffer.byteLength(text, "utf8");
    return text;
  };
  const seen = new Set<string>();
  const add = async (
    source: GameSource,
    externalId: string,
    name: string,
    installPath: string,
    exe: string | null,
    evidencePath: string,
  ) => {
    if (report.games.length >= 512) {
      limited = true;
      warn("Limite de 512 candidatos atingido.");
      return;
    }
    requiredString(name, "nome");
    requiredString(externalId, "identidade");
    requiredString(installPath, "pasta");
    if (!(await localDirectory(installPath))) return;
    const id = createHash("sha256")
      .update(`${source}\0${externalId}`)
      .digest("hex")
      .slice(0, 40);
    if (seen.has(id)) return;
    seen.add(id);
    let executablePath: string | null = null;
    try {
      executablePath = await knownExecutable(installPath, exe);
    } catch (e) {
      warn(`${evidencePath}: executável não verificado: ${String(e)}`);
    }
    report.games.push({
      id,
      discoveryId: id,
      source,
      externalId,
      sourceName: name,
      name,
      installPath: resolve(installPath),
      executablePath,
      evidencePath,
    });
  };
  const files = async function* (directory: string, extension: string) {
    let count = 0;
    try {
      if (!(await localDirectory(directory))) return;
      const handle = await opendir(directory);
      for await (const entry of handle) {
        if (stopped()) break;
        if (++count > 4096 || ++entries > 4096) {
          limited = true;
          warn(
            `Pasta com mais de 4096 entradas; cobertura parcial: ${directory}`,
          );
          break;
        }
        if (entry.isFile() && entry.name.toLowerCase().endsWith(extension))
          yield join(directory, entry.name);
      }
    } catch (e) {
      warn(`${directory}: ${String(e)}`);
    }
  };
  const libraries = new Map<string, string>();
  const insertLibrary = async (
    path: string,
  ): Promise<"added" | "present" | "missing" | "limit"> => {
    const key = keyPath(path);
    if (libraries.has(key)) return "present";
    if (libraries.size >= 64) {
      warn("Limite de 64 bibliotecas Steam atingido; cobertura parcial.");
      return "limit";
    }
    if (!(await localDirectory(path)) || stopped()) return "missing";
    libraries.set(key, path);
    return "added";
  };
  for (const root of sources.steamRoots.slice(0, 64)) {
    if (stopped()) break;
    try {
      const inserted = await insertLibrary(root);
      if (inserted === "limit") break;
      if (inserted === "missing") continue;
      const manifest = join(root, "steamapps", "libraryfolders.vdf");
      let text: string;
      try {
        text = await readBudgeted(manifest);
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw e;
      }
      const folders = vdfObject(vdfField(parseVdf(text), "libraryfolders"));
      for (const [id, value] of Object.entries(folders)) {
        if (stopped()) break;
        if (!/^\d+$/.test(id)) continue;
        const path =
          typeof value === "string" ? value : vdfField(value, "path");
        if (typeof path === "string") {
          if ((await insertLibrary(path)) === "limit") break;
        }
      }
    } catch (e) {
      warn(`Steam ${root}: ${String(e)}`);
    }
  }
  for (const library of libraries.values()) {
    if (stopped()) break;
    for await (const manifest of files(join(library, "steamapps"), ".acf")) {
      if (stopped()) break;
      try {
        const state = vdfObject(
          vdfField(parseVdf(await readBudgeted(manifest)), "AppState"),
        );
        const externalId = requiredString(vdfField(state, "appid"), "appid");
        if (!/^\d+$/.test(externalId)) throw new Error("AppID Steam inválido.");
        const install = requiredString(
          vdfField(state, "installdir"),
          "installdir",
        );
        if (
          install === "." ||
          install === ".." ||
          /[\\/]/.test(install) ||
          isAbsolute(install)
        )
          throw new Error("Pasta do jogo sai da biblioteca Steam.");
        await add(
          "Steam",
          externalId,
          requiredString(vdfField(state, "name"), "nome"),
          join(library, "steamapps", "common", install),
          null,
          manifest,
        );
      } catch (e) {
        warn(`${manifest}: ${String(e)}`);
      }
    }
  }
  if (!stopped())
    for await (const manifest of files(sources.epicManifestDir, ".item")) {
      try {
        const item: unknown = JSON.parse(await readBudgeted(manifest));
        if (!item || typeof item !== "object" || Array.isArray(item))
          throw new Error("Manifesto Epic inválido.");
        const record = item as Record<string, unknown>;
        if (record.bIsIncompleteInstall === true) {
          warn(`Instalação Epic incompleta: ${manifest}`);
          continue;
        }
        await add(
          "Epic Games",
          requiredString(record.AppName, "AppName"),
          requiredString(record.DisplayName, "DisplayName"),
          requiredString(record.InstallLocation, "InstallLocation"),
          typeof record.LaunchExecutable === "string"
            ? record.LaunchExecutable
            : null,
          manifest,
        );
      } catch (e) {
        warn(`${manifest}: ${String(e)}`);
      }
    }
  for (const record of sources.gogGames.slice(0, 512)) {
    if (stopped()) break;
    try {
      await add(
        "GOG",
        record.id,
        record.name,
        record.path,
        record.exe,
        record.evidencePath,
      );
    } catch (e) {
      warn(`${record.evidencePath}: ${String(e)}`);
    }
  }
  for (const record of (sources.riotGames ?? []).slice(0, 512)) {
    if (stopped()) break;
    try {
      await add(
        "Riot Games",
        record.id,
        record.name,
        record.path,
        record.exe,
        record.evidencePath,
      );
    } catch (e) {
      warn(`${record.evidencePath}: ${String(e)}`);
    }
  }
  if (sources.steamRoots.length > 64 || sources.gogGames.length > 512)
    warn("Fontes acima do limite; cobertura parcial.");
  if (signal.aborted) {
    report.cancelled = true;
    warn("Deteção cancelada; resultados parciais.");
  }
  report.games.sort((a, b) => a.name.localeCompare(b.name, "pt-PT"));
  return report;
}
