import type { LolRegionPing, LolScan } from "../../shared/contracts";
import { LOL_REGIONS } from "../../shared/lol-regions";
import { loadPops, measure } from "./cs2";

// Ordena as regiões do LoL pelo RTT até à cidade de cada datacenter.
export async function scanLol(timeoutMs: number, signal: AbortSignal): Promise<LolScan> {
  const pops = await loadPops(signal);
  const byCode = new Map(pops.map((p) => [p.code, p]));
  const cache = new Map<string, Promise<number | null>>();
  const ping = (code: string) => {
    if (!cache.has(code)) {
      const pop = byCode.get(code);
      cache.set(
        code,
        pop ? measure(pop, Math.min(timeoutMs, 1000), signal).then((d) => d.pingMs) : Promise.resolve(null),
      );
    }
    return cache.get(code)!;
  };
  const regions: LolRegionPing[] = await Promise.all(
    LOL_REGIONS.map(async (r) => ({
      code: r.code,
      name: r.name,
      city: r.city,
      via: r.probe?.via ?? null,
      match: r.probe?.match ?? null,
      pingMs: r.probe ? await ping(r.probe.pop) : null,
    })),
  );
  if (signal.aborted) throw new Error("Cancelado.");
  regions.sort((a, b) => (a.pingMs ?? Infinity) - (b.pingMs ?? Infinity));
  return { measuredAt: new Date().toISOString(), regions };
}
