import type { PerfProcess, PerfStatus } from "../../shared/contracts";
import { runProcess, systemCommand } from "../diagnostics/process";
import { psQuote, runPs, runPsJson } from "./powershell";

// GUIDs dos planos de energia do Windows.
export const BALANCED = "381b4222-f694-41f0-9685-ff5bb260df2e";
export const HIGH_PERFORMANCE = "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c";
export const ULTIMATE = "e9a42b02-d5df-448d-aa00-03f14749eb61";
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Processos de jogos conhecidos (nome sem .exe) a que se pode dar prioridade.
export const GAME_PROCESSES = [
  "cs2",
  "League of Legends",
  "VALORANT-Win64-Shipping",
  "FortniteClient-Win64-Shipping",
  "r5apex",
  "r5apex_dx12",
  "dota2",
  "RustClient",
  "GTA5",
  "GTA5_Enhanced",
  "FC26",
  "FC25",
];

// Processos que nunca se oferecem para fechar.
const PROTECTED = new Set(
  [
    "System", "Idle", "Registry", "smss", "csrss", "wininit", "winlogon", "services",
    "lsass", "svchost", "dwm", "explorer", "fontdrvhost", "Memory Compression",
    "MsMpEng", "SecurityHealthService", "ctfmon", "sihost", "taskhostw", "RuntimeBroker",
    "StartMenuExperienceHost", "SearchHost", "ShellExperienceHost", "TextInputHost",
    "audiodg", "spoolsv", "WmiPrvSE", "dllhost", "conhost", "electron", "RoutePilot",
    "powershell", "Claude", "node", "msedgewebview2", "WidgetService", "Widgets",
    "NVDisplay.Container", "nvcontainer", "RadeonSoftware", "AMDRSServ", "igfxEM",
  ].map((n) => n.toLowerCase()),
);

export function parsePowerScheme(stdout: string) {
  const m = stdout.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s+\(([^)]*)\)/i);
  return m ? { guid: m[1].toLowerCase(), name: m[2] } : null;
}

export function parseSchemes(stdout: string) {
  return [...stdout.matchAll(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s+\(([^)]*)\)/gi)].map(
    (m) => ({ guid: m[1].toLowerCase(), name: m[2] }),
  );
}

const powercfg = (args: string[], signal: AbortSignal) =>
  runProcess(systemCommand("powercfg.exe"), args, signal, 15000, 65536);

export async function readPerformance(signal: AbortSignal): Promise<PerfStatus> {
  const [active, list, gameMode, procs, games] = await Promise.all([
    powercfg(["/getactivescheme"], signal),
    powercfg(["/list"], signal),
    runPs(
      "(Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\GameBar' -Name AutoGameModeEnabled -ErrorAction SilentlyContinue).AutoGameModeEnabled",
      signal,
    ),
    runPsJson<Record<string, unknown>[] | Record<string, unknown>>(
      "Get-Process | Where-Object { $_.SessionId -ne 0 } | Group-Object ProcessName | ForEach-Object { [pscustomobject]@{ name = $_.Name; count = $_.Count; memoryMb = [math]::Round((($_.Group | Measure-Object WorkingSet64 -Sum).Sum) / 1MB); cpuSeconds = [math]::Round((($_.Group | Measure-Object CPU -Sum).Sum), 1) } } | Sort-Object memoryMb -Descending | Select-Object -First 25 | ConvertTo-Json -Compress",
      signal,
    ),
    runPsJson<Record<string, unknown>[] | Record<string, unknown>>(
      `Get-Process -Name ${GAME_PROCESSES.map(psQuote).join(",")} -ErrorAction SilentlyContinue | ForEach-Object { [pscustomobject]@{ name = $_.ProcessName; priority = [string]$_.PriorityClass } } | ConvertTo-Json -Compress`,
      signal,
    ),
  ]);
  const scheme = parsePowerScheme(active.stdout);
  const schemes = parseSchemes(list.stdout);
  const gm = gameMode.stdout.trim();
  const arr = <T,>(v: T | T[] | null): T[] => (v === null ? [] : Array.isArray(v) ? v : [v]);
  const heavy: PerfProcess[] = arr(procs)
    .map((p) => ({
      name: String(p.name ?? ""),
      count: Number(p.count ?? 1),
      memoryMb: Number(p.memoryMb ?? 0),
      cpuSeconds: Number(p.cpuSeconds ?? 0),
      closable: !PROTECTED.has(String(p.name ?? "").toLowerCase()),
    }))
    .filter((p) => p.name);
  return {
    powerScheme: scheme,
    highPerformanceAvailable: schemes.some((s) => s.guid === HIGH_PERFORMANCE || s.guid === ULTIMATE),
    gameModeOn: gm === "" ? true : gm === "1",
    heavy,
    runningGames: arr(games).map((g) => ({ name: String(g.name), priority: String(g.priority) })),
  };
}

// Plano de energia: não precisa de administrador.
export async function setPowerScheme(guid: string, signal: AbortSignal) {
  if (!GUID.test(guid)) throw new Error("Plano de energia inválido.");
  const list = parseSchemes((await powercfg(["/list"], signal)).stdout);
  let target = guid.toLowerCase();
  if (!list.some((s) => s.guid === target)) {
    if (target !== HIGH_PERFORMANCE) throw new Error("Esse plano de energia não existe neste PC.");
    // Alguns portáteis escondem o plano de alto desempenho: cria uma cópia.
    const dup = await powercfg(["/duplicatescheme", HIGH_PERFORMANCE], signal);
    const created = parsePowerScheme(dup.stdout);
    if (!created) throw new Error("Este PC não permite o plano de alto desempenho.");
    target = created.guid;
  }
  const r = await powercfg(["/setactive", target], signal);
  if (r.code !== 0) throw new Error("O Windows recusou mudar o plano de energia.");
}

export async function setGameMode(on: boolean, signal: AbortSignal) {
  const r = await runPs(
    `New-Item -Path 'HKCU:\\Software\\Microsoft\\GameBar' -Force | Out-Null; Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\GameBar' -Name AutoGameModeEnabled -Type DWord -Value ${on ? 1 : 0}`,
    signal,
  );
  if (r.code !== 0) throw new Error("Não foi possível alterar o Modo de Jogo.");
}

export async function closeProcess(name: string, signal: AbortSignal) {
  if (!/^[\w .()+-]{1,64}$/.test(name) || PROTECTED.has(name.toLowerCase()))
    throw new Error("Este processo não pode ser fechado pelo RoutePilot.");
  await runPs(`Get-Process -Name ${psQuote(name)} -ErrorAction SilentlyContinue | Where-Object { $_.SessionId -ne 0 } | Stop-Process -ErrorAction SilentlyContinue`, signal);
}

// Prioridade alta para os jogos em execução (volta ao normal quando o jogo fecha).
export async function boostGames(signal: AbortSignal) {
  const r = await runPs(
    `$n = 0; Get-Process -Name ${GAME_PROCESSES.map(psQuote).join(",")} -ErrorAction SilentlyContinue | ForEach-Object { try { $_.PriorityClass = 'High'; $n++ } catch {} }; $n`,
    signal,
  );
  return Number(r.stdout.trim()) || 0;
}
