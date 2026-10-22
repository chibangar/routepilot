import type { Cs2Datacenter, Cs2Scan } from "../../shared/contracts";
import { validateHost } from "../../shared/validation";
import { probeHost } from "./ping";

// Lista oficial de datacenters/relays da Valve (Steam Datagram Relay) do CS2.
const SDR_URL = "https://api.steampowered.com/ISteamApps/GetSDRConfig/v1/?appid=730";
const CONCURRENCY = 8;
const PROBES = 2;
const CACHE_MS = 6 * 60 * 60 * 1000;

export type Pop = { code: string; name: string; relays: string[] };
let cache: { at: number; pops: Pop[] } | null = null;

export function parseSdrConfig(json: unknown): Pop[] {
  const pops = (json as { pops?: Record<string, unknown> })?.pops;
  if (!pops || typeof pops !== "object") return [];
  const out: Pop[] = [];
  for (const [code, raw] of Object.entries(pops)) {
    const p = raw as { desc?: unknown; relays?: unknown };
    if (!Array.isArray(p.relays) || !p.relays.length) continue;
    const relays = p.relays
      .map((r) => (r as { ipv4?: unknown }).ipv4)
      .filter((ip): ip is string => typeof ip === "string" && validateHost(ip).ok);
    if (!relays.length) continue;
    out.push({
      code,
      name: typeof p.desc === "string" ? p.desc : code.toUpperCase(),
      relays,
    });
  }
  return out;
}

export async function loadPops(signal: AbortSignal): Promise<Pop[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.pops;
  const res = await fetch(SDR_URL, { signal });
  if (!res.ok) throw new Error(`A Valve respondeu ${res.status} ao pedir a lista de servidores.`);
  const pops = parseSdrConfig(await res.json());
  if (!pops.length) throw new Error("A lista de servidores da Valve veio vazia.");
  cache = { at: Date.now(), pops };
  return pops;
}

export async function measure(pop: Pop, timeoutMs: number, signal: AbortSignal): Promise<Cs2Datacenter> {
  const values: number[] = [];
  // Até dois relays por datacenter; o melhor RTT representa o datacenter.
  for (const ip of pop.relays.slice(0, 2)) {
    for (let i = 0; i < PROBES && !signal.aborted; i++) {
      const s = await probeHost(ip, timeoutMs, signal);
      if (s.status === "reply" && s.rttMs !== null) values.push(s.rttMs);
    }
    if (values.length) break;
  }
  return {
    code: pop.code,
    name: pop.name,
    relays: pop.relays,
    pingMs: values.length ? Math.min(...values) : null,
  };
}

export async function scanCs2(timeoutMs: number, signal: AbortSignal): Promise<Cs2Scan> {
  const pops = await loadPops(signal);
  const results: Cs2Datacenter[] = [];
  let next = 0;
  const worker = async () => {
    while (next < pops.length && !signal.aborted) {
      const pop = pops[next++];
      results.push(await measure(pop, Math.min(timeoutMs, 1000), signal));
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (signal.aborted) throw new Error("Cancelado.");
  results.sort((a, b) => (a.pingMs ?? Infinity) - (b.pingMs ?? Infinity));
  return { measuredAt: new Date().toISOString(), datacenters: results };
}
