import type { MonitorState, MonitorTarget } from "../../shared/contracts";
import { LOL_REGIONS } from "../../shared/lol-regions";
import { loadPops } from "../diagnostics/cs2";
import { probeHost } from "../diagnostics/ping";
import { runPs } from "./powershell";

const WINDOW = 300; // últimas 5 minutos a 1 amostra/s
const SPIKE_MS = 30;

// Alvos úteis para monitorizar: router, internet, datacenters do CS2 e
// cidades das regiões do LoL (via relays da Valve na mesma cidade).
export async function monitorTargets(signal: AbortSignal): Promise<MonitorTarget[]> {
  const targets: MonitorTarget[] = [];
  const gw = await runPs(
    "(Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Sort-Object RouteMetric | Select-Object -First 1).NextHop",
    signal,
  ).catch(() => null);
  const gateway = gw?.stdout.trim();
  if (gateway && /^\d{1,3}(\.\d{1,3}){3}$/.test(gateway) && gateway !== "0.0.0.0")
    targets.push({ id: "router", group: "Casa", label: `Router (${gateway})`, host: gateway });
  targets.push({ id: "internet", group: "Casa", label: "Internet (Cloudflare 1.1.1.1)", host: "1.1.1.1" });
  try {
    const pops = await loadPops(signal);
    const byCode = new Map(pops.map((p) => [p.code, p]));
    for (const p of pops)
      targets.push({ id: `cs2-${p.code}`, group: "CS2", label: p.name, host: p.relays[0] });
    for (const r of LOL_REGIONS) {
      const pop = r.probe && byCode.get(r.probe.pop);
      if (pop)
        targets.push({
          id: `lol-${r.code}`,
          group: "League of Legends",
          label: `${r.code} — ${r.city}${r.probe!.match === "near" ? ` (via ${r.probe!.via})` : ""}`,
          host: pop.relays[0],
        });
    }
  } catch {
    // Sem a lista da Valve continuam disponíveis os alvos de casa.
  }
  return targets;
}

export function summarize(target: MonitorTarget, samples: (number | null)[], running: boolean): MonitorState {
  const ok = samples.filter((s): s is number => s !== null);
  const mean = ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null;
  let jitter: number | null = null;
  if (ok.length > 1) {
    let sum = 0;
    for (let i = 1; i < ok.length; i++) sum += Math.abs(ok[i] - ok[i - 1]);
    jitter = sum / (ok.length - 1);
  }
  const spikes = mean === null ? 0 : ok.filter((v) => v >= mean + SPIKE_MS).length;
  const round = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
  return {
    target,
    running,
    samples: samples.slice(-WINDOW),
    sent: samples.length,
    lost: samples.length - ok.length,
    minMs: ok.length ? Math.min(...ok) : null,
    meanMs: round(mean),
    jitterMs: round(jitter),
    spikes,
    lastMs: samples.length ? samples[samples.length - 1] : null,
  };
}

// Monitor contínuo: uma sonda por segundo até ser parado (máx. 2 horas).
export class LiveMonitor {
  private controller: AbortController | null = null;
  private samples: (number | null)[] = [];
  private target: MonitorTarget | null = null;
  constructor(private emit: (state: MonitorState) => void) {}

  get active() {
    return this.controller !== null;
  }

  state(): MonitorState | null {
    return this.target ? summarize(this.target, this.samples, this.active) : null;
  }

  start(target: MonitorTarget) {
    this.stop();
    const controller = new AbortController();
    this.controller = controller;
    this.target = target;
    this.samples = [];
    const deadline = Date.now() + 2 * 60 * 60 * 1000;
    void (async () => {
      while (!controller.signal.aborted && Date.now() < deadline) {
        const started = Date.now();
        const s = await probeHost(target.host, 1000, controller.signal);
        if (controller.signal.aborted) break;
        this.samples.push(s.status === "reply" ? s.rttMs : null);
        if (this.samples.length > WINDOW * 4) this.samples = this.samples.slice(-WINDOW * 4);
        this.emit(summarize(target, this.samples, true));
        const wait = 1000 - (Date.now() - started);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      }
      if (this.controller === controller) this.controller = null;
      this.emit(summarize(target, this.samples, false));
    })();
  }

  stop() {
    this.controller?.abort();
    this.controller = null;
  }
}
