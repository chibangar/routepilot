import type { NetLink } from "../../shared/contracts";
import { parsePing } from "../diagnostics/ping";
import { runProcess, systemCommand } from "../diagnostics/process";
import { runElevated, runPsJson } from "./powershell";

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
const PREFERRED_METRIC = 5;
const OTHER_METRIC = 50;

// Ligações com gateway IPv4 ativas (cabo, Wi-Fi, 4G/USB…).
const LIST_SCRIPT = `Get-NetIPConfiguration -ErrorAction SilentlyContinue | Where-Object { $_.IPv4DefaultGateway -and $_.NetAdapter.Status -eq 'Up' } | ForEach-Object {
  $i = Get-NetIPInterface -InterfaceIndex $_.InterfaceIndex -AddressFamily IPv4
  [pscustomobject]@{ index = $_.InterfaceIndex; alias = $_.InterfaceAlias; description = $_.InterfaceDescription; ip = [string]($_.IPv4Address | Select-Object -First 1).IPAddress; gateway = [string]($_.IPv4DefaultGateway | Select-Object -First 1).NextHop; metric = $i.InterfaceMetric; automatic = [string]$i.AutomaticMetric; media = [string]$_.NetAdapter.PhysicalMediaType }
} | ConvertTo-Json -Compress`;

async function pingFrom(source: string, signal: AbortSignal) {
  const values: number[] = [];
  for (let i = 0; i < 3 && !signal.aborted; i++) {
    const r = await runProcess(
      systemCommand("ping.exe"),
      ["-n", "1", "-w", "1000", "-S", source, "1.1.1.1"],
      signal,
      5000,
      65536,
    );
    const s = parsePing(r.stdout, r.code);
    if (s.status === "reply" && s.rttMs !== null) values.push(s.rttMs);
  }
  return values.length ? Math.min(...values) : null;
}

export async function readLinks(signal: AbortSignal): Promise<NetLink[]> {
  const raw = await runPsJson<Record<string, unknown>[] | Record<string, unknown>>(LIST_SCRIPT, signal);
  const list = raw === null ? [] : Array.isArray(raw) ? raw : [raw];
  const links = list
    .map((l) => ({
      index: Number(l.index),
      alias: String(l.alias ?? ""),
      description: String(l.description ?? ""),
      ip: String(l.ip ?? ""),
      gateway: String(l.gateway ?? ""),
      metric: Number(l.metric ?? 0),
      automaticMetric: String(l.automatic ?? "") === "Enabled",
      wifi: /802\.11|wireless/i.test(String(l.media ?? "")),
    }))
    .filter((l) => Number.isInteger(l.index) && IPV4.test(l.ip));
  const pings = await Promise.all(links.map((l) => pingFrom(l.ip, signal)));
  return links
    .map((l, i) => ({ ...l, pingMs: pings[i] }))
    .sort((a, b) => a.metric - b.metric);
}

export function preferScript(index: number, others: number[]): string {
  if (!Number.isInteger(index) || others.some((o) => !Number.isInteger(o)))
    throw new Error("Ligação inválida.");
  return [
    "$ErrorActionPreference = 'Stop'",
    `Set-NetIPInterface -InterfaceIndex ${index} -AddressFamily IPv4 -InterfaceMetric ${PREFERRED_METRIC}`,
    ...others.map((o) => `Set-NetIPInterface -InterfaceIndex ${o} -AddressFamily IPv4 -InterfaceMetric ${OTHER_METRIC}`),
  ].join("\r\n");
}

export function automaticScript(indexes: number[]): string {
  if (indexes.some((o) => !Number.isInteger(o))) throw new Error("Ligação inválida.");
  return [
    "$ErrorActionPreference = 'Stop'",
    ...indexes.map((o) => `Set-NetIPInterface -InterfaceIndex ${o} -AddressFamily IPv4 -AutomaticMetric Enabled`),
  ].join("\r\n");
}

// Passa a ligação escolhida a ser a preferida do Windows para todo o tráfego.
export async function preferLink(index: number, signal: AbortSignal) {
  const links = await readLinks(signal);
  if (!links.some((l) => l.index === index)) throw new Error("Essa ligação já não está ativa.");
  await runElevated(
    preferScript(index, links.filter((l) => l.index !== index).map((l) => l.index)),
    signal,
  );
  return readLinks(signal);
}

// Devolve ao Windows a escolha automática entre ligações.
export async function automaticLinks(signal: AbortSignal) {
  const links = await readLinks(signal);
  await runElevated(automaticScript(links.map((l) => l.index)), signal);
  return readLinks(signal);
}
