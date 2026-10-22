import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import type { Cs2Mode, Cs2Status } from "../../shared/contracts";
import { runProcess, systemCommand } from "./process";
import { runElevated } from "../system/powershell";

// Todas as regras criadas pelo RoutePilot ficam neste grupo; só estas são
// alteradas ou removidas.
export const RULE_GROUP = "RoutePilot CS2";
export const TASK_NAME = "RoutePilot CS2";
const programData = () =>
  join(process.env.ProgramData || "C:/ProgramData", "RoutePilot");
const userDir = () =>
  join(
    process.env.APPDATA ||
      join(process.env.USERPROFILE || "", "AppData", "Roaming"),
    "RoutePilot",
  );
const requestPath = () => join(userDir(), "cs2-request.json");
const resultPath = () => join(userDir(), "cs2-result.json");

// Script que a tarefa agendada corre com privilégios elevados. Do pedido só
// usa o modo e códigos de datacenter validados; os IPs vêm sempre da lista
// oficial da Valve. Bloqueia só UDP, para o ping (ICMP) continuar a medir
// todos os servidores e o modo automático poder mudar de servidor.
export const AUTO_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  `$group = '${RULE_GROUP}'`,
  "$dir = Join-Path $env:APPDATA 'RoutePilot'",
  "$reqPath = Join-Path $dir 'cs2-request.json'",
  "$resPath = Join-Path $dir 'cs2-result.json'",
  "function Save($obj) { New-Item -ItemType Directory -Force -Path $dir | Out-Null; $obj | ConvertTo-Json -Depth 5 -Compress | Set-Content -Path $resPath -Encoding UTF8 }",
  "$id = ''",
  "try {",
  "  $mode = 'off'; $allow = @()",
  "  if (Test-Path $reqPath) {",
  "    $req = Get-Content $reqPath -Raw | ConvertFrom-Json",
  "    if (@('auto','manual','off') -contains $req.mode) { $mode = [string]$req.mode }",
  "    if ($req.id -is [string] -and $req.id -match '^[0-9a-f]{32}$') { $id = $req.id }",
  "    $allow = @($req.allow | Where-Object { $_ -is [string] -and $_ -match '^[a-z0-9]{2,8}$' })",
  "  }",
  "  if ($mode -eq 'off') {",
  "    Get-NetFirewallRule -Group $group -ErrorAction SilentlyContinue | Remove-NetFirewallRule",
  "    Save @{ ok = $true; id = $id; mode = 'off'; allowed = @(); blocked = 0; at = (Get-Date).ToUniversalTime().ToString('o') }",
  "    exit 0",
  "  }",
  "  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12",
  "  $cfg = Invoke-RestMethod -Uri 'https://api.steampowered.com/ISteamApps/GetSDRConfig/v1/?appid=730' -UseBasicParsing -TimeoutSec 20",
  "  $pops = @()",
  "  foreach ($p in $cfg.pops.PSObject.Properties) {",
  "    $ips = @($p.Value.relays | ForEach-Object { [string]$_.ipv4 } | Where-Object { $_ -match '^\\d{1,3}(\\.\\d{1,3}){3}$' })",
  "    if ($ips.Count) { $pops += [pscustomobject]@{ code = $p.Name; ips = $ips } }",
  "  }",
  "  if (-not $pops.Count) { throw 'A lista de servidores da Valve veio vazia.' }",
  "  $pings = @{}",
  "  if ($mode -eq 'auto') {",
  "    $jobs = foreach ($p in $pops) { foreach ($n in 1..2) { [pscustomobject]@{ code = $p.code; task = (New-Object Net.NetworkInformation.Ping).SendPingAsync($p.ips[0], 1000) } } }",
  "    try { [Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($jobs | ForEach-Object { $_.task })) } catch {}",
  "    foreach ($j in $jobs) {",
  "      if ($j.task.Status -eq 'RanToCompletion' -and $j.task.Result.Status -eq 'Success') {",
  "        $ms = [double]$j.task.Result.RoundtripTime",
  "        if (-not $pings.ContainsKey($j.code) -or $ms -lt $pings[$j.code]) { $pings[$j.code] = $ms }",
  "      }",
  "    }",
  "    if (-not $pings.Count) { throw 'Nenhum servidor do CS2 respondeu. Nada foi alterado.' }",
  "    $min = ($pings.Values | Measure-Object -Minimum).Minimum",
  "    $allow = @($pings.Keys | Where-Object { $pings[$_] -le $min + 10 })",
  "  }",
  "  $allowed = @($pops | Where-Object { $allow -contains $_.code })",
  "  if (-not $allowed.Count) { throw 'Nenhum servidor válido para ativar.' }",
  "  $blockIps = @($pops | Where-Object { $allow -notcontains $_.code } | ForEach-Object { $_.ips } | Select-Object -Unique)",
  "  Get-NetFirewallRule -Group $group -ErrorAction SilentlyContinue | Remove-NetFirewallRule",
  "  if ($blockIps.Count) { New-NetFirewallRule -DisplayName 'RoutePilot CS2 - servidores bloqueados' -Group $group -Direction Outbound -Action Block -Protocol UDP -Profile Any -RemoteAddress $blockIps | Out-Null }",
  "  Save @{ ok = $true; id = $id; mode = $mode; allowed = @($allowed | ForEach-Object { $_.code }); blocked = ($pops.Count - $allowed.Count); pings = $pings; at = (Get-Date).ToUniversalTime().ToString('o') }",
  "} catch {",
  "  Save @{ ok = $false; id = $id; error = $_.Exception.Message; at = (Get-Date).ToUniversalTime().ToString('o') }",
  "  exit 1",
  "}",
].join("\r\n");

const psQuote = (s: string) => `'${s.replace(/'/g, "''")}'`;

// Instalação única (elevada): o script fica numa pasta que só
// administradores alteram, e a tarefa corre ao iniciar sessão e a cada 6 h.
export function installScript(user: string): string {
  if (!/^[^'"`$;\r\n]{1,256}$/.test(user)) throw new Error("Utilizador inválido.");
  const encoded = Buffer.from(AUTO_SCRIPT, "utf8").toString("base64");
  return [
    "$ErrorActionPreference = 'Stop'",
    `$dir = ${psQuote(programData())}`,
    "New-Item -ItemType Directory -Force -Path $dir | Out-Null",
    "icacls $dir /inheritance:r /grant:r '*S-1-5-32-544:(OI)(CI)F' '*S-1-5-18:(OI)(CI)F' '*S-1-5-32-545:(OI)(CI)RX' | Out-Null",
    "$script = Join-Path $dir 'cs2-auto.ps1'",
    `[IO.File]::WriteAllText($script, [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')), (New-Object Text.UTF8Encoding $true))`,
    "$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ('-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File \"' + $script + '\"')",
    `$logon = New-ScheduledTaskTrigger -AtLogOn -User ${psQuote(user)}`,
    "$logon.Delay = 'PT1M'",
    "$repeat = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Hours 6) -RepetitionDuration (New-TimeSpan -Days 3650)",
    `$principal = New-ScheduledTaskPrincipal -UserId ${psQuote(user)} -LogonType Interactive -RunLevel Highest`,
    "$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -MultipleInstances IgnoreNew",
    `Register-ScheduledTask -TaskName ${psQuote(TASK_NAME)} -Description 'RoutePilot: escolhe o servidor do CS2 com menor ping (Firewall do Windows).' -Action $action -Trigger $logon,$repeat -Principal $principal -Settings $settings -Force | Out-Null`,
  ].join("\r\n");
}

export function uninstallScript(): string {
  return [
    "$ErrorActionPreference = 'Continue'",
    `Unregister-ScheduledTask -TaskName ${psQuote(TASK_NAME)} -Confirm:$false -ErrorAction SilentlyContinue`,
    `Get-NetFirewallRule -Group ${psQuote(RULE_GROUP)} -ErrorAction SilentlyContinue | Remove-NetFirewallRule`,
    `Remove-Item -Recurse -Force ${psQuote(programData())} -ErrorAction SilentlyContinue`,
    "exit 0",
  ].join("\r\n");
}

async function taskInstalled(signal: AbortSignal) {
  const r = await runProcess(
    systemCommand("schtasks.exe"),
    ["/Query", "/TN", TASK_NAME],
    signal,
    15000,
    65536,
  );
  return r.code === 0;
}

const readJson = async (path: string) => {
  try {
    return JSON.parse((await readFile(path, "utf8")).replace(/^\uFEFF/, "")) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export function parseStatus(
  installed: boolean,
  request: Record<string, unknown> | null,
  result: Record<string, unknown> | null,
): Cs2Status {
  const mode = request?.mode === "auto" || request?.mode === "manual" ? request.mode : "off";
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const pings =
    result?.pings && typeof result.pings === "object"
      ? Object.fromEntries(
          Object.entries(result.pings as Record<string, unknown>).filter(
            (e): e is [string, number] => typeof e[1] === "number",
          ),
        )
      : {};
  return {
    installed,
    mode,
    ok: result?.ok === true ? true : result?.ok === false ? false : null,
    allowed: Array.isArray(result?.allowed)
      ? (result.allowed as unknown[]).filter((x): x is string => typeof x === "string")
      : [],
    blocked: typeof result?.blocked === "number" ? result.blocked : 0,
    pings,
    error: str(result?.error),
    checkedAt: str(result?.at),
  };
}

export async function readStatus(signal: AbortSignal): Promise<Cs2Status> {
  const [installed, request, result] = await Promise.all([
    taskInstalled(signal),
    readJson(requestPath()),
    readJson(resultPath()),
  ]);
  return parseStatus(installed, request, result);
}

// Instala a tarefa (um pedido de administrador) se ainda não existir, grava o
// pedido e corre a tarefa; espera pelo resultado com o mesmo id.
export async function requestMode(
  mode: Cs2Mode,
  allow: string[],
  signal: AbortSignal,
): Promise<Cs2Status> {
  if (!(await taskInstalled(signal))) {
    if (mode === "off") return readStatus(signal);
    const user = `${process.env.USERDOMAIN ?? ""}\\${process.env.USERNAME ?? ""}`;
    await runElevated(installScript(user), signal);
    if (!(await taskInstalled(signal)))
      throw new Error("A tarefa do RoutePilot não ficou instalada.");
  }
  const id = randomBytes(16).toString("hex");
  await mkdir(userDir(), { recursive: true });
  await writeFile(requestPath(), JSON.stringify({ id, mode, allow }), "utf8");
  const run = await runProcess(
    systemCommand("schtasks.exe"),
    ["/Run", "/TN", TASK_NAME],
    signal,
    15000,
    65536,
  );
  if (run.code !== 0)
    throw new Error("Não foi possível iniciar a tarefa do RoutePilot.");
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline && !signal.aborted) {
    await new Promise((r) => setTimeout(r, 400));
    const result = await readJson(resultPath());
    if (result?.id === id) {
      if (result.ok !== true)
        throw new Error(typeof result.error === "string" ? result.error : "A tarefa falhou.");
      return readStatus(signal);
    }
  }
  throw new Error("A tarefa não respondeu a tempo.");
}

// Remove a tarefa, as regras e o script (um pedido de administrador).
export async function uninstall(signal: AbortSignal): Promise<Cs2Status> {
  await runElevated(uninstallScript(), signal);
  await mkdir(userDir(), { recursive: true });
  await writeFile(requestPath(), JSON.stringify({ mode: "off" }), "utf8");
  await writeFile(resultPath(), JSON.stringify({ ok: true, mode: "off" }), "utf8");
  return readStatus(signal);
}
