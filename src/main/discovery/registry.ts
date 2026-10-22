import { join } from "node:path";
import { z } from "zod";
import { runProcess, systemCommand } from "../diagnostics/process";
import type { DiscoverySources } from "../discovery";
const script = String.raw`
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$steam = @(); $gog = @(); $riot = @(); $issues = @()
foreach ($keyPath in @('HKCU:\Software\Valve\Steam','HKLM:\SOFTWARE\WOW6432Node\Valve\Steam','HKLM:\SOFTWARE\Valve\Steam')) {
  try { if (Test-Path -LiteralPath $keyPath) { $data=Get-ItemProperty -LiteralPath $keyPath; if ($data.SteamPath) {$steam += [string]$data.SteamPath}; if ($data.InstallPath) {$steam += [string]$data.InstallPath} } } catch { $issues += "Steam: $($_.Exception.Message)" }
}
foreach ($d in @('C','D','E','F','G','H')) {
  try {
    $sp = $d + ':\steam\steamapps'
    if (Test-Path -LiteralPath $sp) { $steam += ($d + ':\steam') }
  } catch {}
  try {
    $v = $d + ':\Riot Games\VALORANT\live'
    if (Test-Path -LiteralPath $v) { $riot += @{id='valorant';name='Valorant';path=$v;exe='VALORANT.exe';evidencePath=($v + '\VALORANT.exe')} }
    $l = $d + ':\Riot Games\League of Legends'
    if (Test-Path -LiteralPath $l) { $riot += @{id='league-of-legends';name='League of Legends';path=$l;exe='LeagueClient.exe';evidencePath=($l + '\LeagueClient.exe')} }
  } catch {}
}
foreach ($root in @('HKLM:\SOFTWARE\GOG.com\Games','HKLM:\SOFTWARE\WOW6432Node\GOG.com\Games','HKCU:\SOFTWARE\GOG.com\Games')) {
  try { if (Test-Path -LiteralPath $root) { $keys=@(Get-ChildItem -LiteralPath $root | Select-Object -First 513); if ($keys.Count -gt 512) {$issues += "GOG: limite de 512 registos atingido em $root; cobertura parcial."}; foreach ($key in @($keys | Select-Object -First 512)) {
    try { $data=Get-ItemProperty -LiteralPath $key.PSPath; if ($data.gameName -and $data.path) { $gog += @{id=[string]$key.PSChildName;name=[string]$data.gameName;path=[string]$data.path;exe=$(if ($data.exe) {[string]$data.exe} else {$null});evidencePath=[string]$key.Name} } } catch { $issues += "GOG: $($_.Exception.Message)" }
  } } } catch { $issues += "GOG: $($_.Exception.Message)" }
}
@{steamRoots=@($steam | Select-Object -Unique);gogGames=@($gog);riotGames=@($riot);warnings=@($issues)} | ConvertTo-Json -Depth 5 -Compress
`;
const registrySchema = z.strictObject({
  steamRoots: z.array(z.string().max(4096)).max(64),
  gogGames: z
    .array(
      z.strictObject({
        id: z.string().min(1).max(4096),
        name: z.string().min(1).max(4096),
        path: z.string().min(1).max(4096),
        exe: z.string().max(4096).nullable(),
        evidencePath: z.string().max(4096),
      }),
    )
    .max(1536),
  riotGames: z
    .array(
      z.strictObject({
        id: z.string().min(1).max(4096),
        name: z.string().min(1).max(4096),
        path: z.string().min(1).max(4096),
        exe: z.string().max(4096).nullable(),
        evidencePath: z.string().max(4096),
      }),
    )
    .max(512)
    .optional(),
  warnings: z.array(z.string()).max(200),
});
export async function installedSources(
  signal: AbortSignal,
): Promise<DiscoverySources> {
  const fallbacks = [
    join(process.env["ProgramFiles(x86)"] || "C:/Program Files (x86)", "Steam"),
    join(process.env.ProgramFiles || "C:/Program Files", "Steam"),
  ];
  const epicManifestDir = join(
    process.env.ProgramData || "C:/ProgramData",
    "Epic",
    "EpicGamesLauncher",
    "Data",
    "Manifests",
  );
  const result = await runProcess(
    systemCommand("WindowsPowerShell/v1.0/powershell.exe"),
    [
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      Buffer.from(script, "utf16le").toString("base64"),
    ],
    signal,
    10000,
    1024 * 1024,
    "utf8",
  );
  const warnings: string[] = [];
  let roots: string[] = [];
  let games: DiscoverySources["gogGames"] = [];
  let riot: DiscoverySources["riotGames"] = [];
  if (result.error || result.timedOut || result.cancelled || result.code !== 0)
    warnings.push(
      "Não foi possível consultar todos os registos Steam/GOG. " +
        (result.error ??
          (result.cancelled
            ? "Consulta cancelada."
            : result.timedOut
              ? "Tempo limite atingido."
              : "Falha do PowerShell.")),
    );
  else
    try {
      const parsed = registrySchema.safeParse(
        JSON.parse(result.stdout.replace(/^\uFEFF/, "")),
      );
      if (parsed.success) {
        roots = parsed.data.steamRoots;
        games = parsed.data.gogGames;
        riot = parsed.data.riotGames ?? [];
        warnings.push(...parsed.data.warnings);
      } else
        warnings.push(
          "Formato de registos não reconhecido; cobertura parcial.",
        );
    } catch {
      warnings.push("Resposta do registo não interpretada; cobertura parcial.");
    }
  return {
    steamRoots: [...new Set([...roots, ...fallbacks])],
    epicManifestDir,
    gogGames: games,
    riotGames: riot,
    warnings,
  };
}
