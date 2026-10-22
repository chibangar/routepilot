import type { QosLimit, QosRule } from "../../shared/contracts";
import { psQuote, runElevated, runPsJson } from "./powershell";

// Todas as políticas criadas pelo RoutePilot começam por este prefixo; só
// essas são alteradas ou removidas.
export const QOS_PREFIX = "RoutePilot - ";

// Apps que costumam ocupar o upload enquanto se joga.
export const QOS_APPS: { exe: string; label: string }[] = [
  { exe: "OneDrive.exe", label: "OneDrive" },
  { exe: "Dropbox.exe", label: "Dropbox" },
  { exe: "GoogleDriveFS.exe", label: "Google Drive" },
  { exe: "steam.exe", label: "Steam" },
  { exe: "steamwebhelper.exe", label: "Steam (web)" },
  { exe: "EpicGamesLauncher.exe", label: "Epic Games" },
  { exe: "Discord.exe", label: "Discord" },
  { exe: "chrome.exe", label: "Google Chrome" },
  { exe: "msedge.exe", label: "Microsoft Edge" },
  { exe: "firefox.exe", label: "Firefox" },
  { exe: "qbittorrent.exe", label: "qBittorrent" },
  { exe: "uTorrent.exe", label: "µTorrent" },
  { exe: "obs64.exe", label: "OBS Studio" },
];
const KNOWN = new Map(QOS_APPS.map((a) => [a.exe.toLowerCase(), a]));

export function qosScript(limits: QosLimit[]): string {
  const lines = [
    "$ErrorActionPreference = 'Stop'",
    `Get-NetQosPolicy -ErrorAction SilentlyContinue | Where-Object { $_.Name -like ${psQuote(QOS_PREFIX + "*")} } | Remove-NetQosPolicy -Confirm:$false`,
  ];
  for (const l of limits) {
    const app = KNOWN.get(l.exe.toLowerCase());
    if (!app) throw new Error(`App desconhecida: ${l.exe}`);
    if (!Number.isInteger(l.mbps) || l.mbps < 1 || l.mbps > 1000)
      throw new Error("Limite inválido (1 a 1000 Mbit/s).");
    lines.push(
      `New-NetQosPolicy -Name ${psQuote(QOS_PREFIX + app.label)} -AppPathNameMatchCondition ${psQuote(app.exe)} -ThrottleRateActionBitsPerSecond ${l.mbps * 1_000_000} | Out-Null`,
    );
  }
  return lines.join("\r\n");
}

export async function readQos(signal: AbortSignal): Promise<QosRule[]> {
  const raw = await runPsJson<Record<string, unknown>[] | Record<string, unknown>>(
    `Get-NetQosPolicy -ErrorAction SilentlyContinue | Where-Object { $_.Name -like ${psQuote(QOS_PREFIX + "*")} } | ForEach-Object { [pscustomobject]@{ name = $_.Name; exe = $_.AppPathName; bps = $_.ThrottleRate } } | ConvertTo-Json -Compress`,
    signal,
  ).catch(() => null);
  const list = raw === null ? [] : Array.isArray(raw) ? raw : [raw];
  return list.map((r) => ({
    exe: String(r.exe ?? ""),
    label: String(r.name ?? "").replace(QOS_PREFIX, ""),
    mbps: Math.round(Number(r.bps ?? 0) / 1_000_000),
  }));
}

export async function applyQos(limits: QosLimit[], signal: AbortSignal) {
  await runElevated(qosScript(limits), signal);
  return readQos(signal);
}
