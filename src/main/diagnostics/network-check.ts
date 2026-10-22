import type { NetworkCheck, NetworkPhase } from "../../shared/contracts";
import { probeHost } from "./ping";
import { runProcess, systemCommand } from "./process";

const PING_HOST = "1.1.1.1";
const LOAD_MS = 8000;
const STREAMS = 4;
const DOWN_URL = "https://speed.cloudflare.com/__down?bytes=50000000";
const UP_URL = "https://speed.cloudflare.com/__up";

type Adapter = {
  name: string | null;
  description: string | null;
  wifi: boolean | null;
  linkSpeed: string | null;
  gateway: string | null;
};

// O adaptador da rota por defeito, em JSON, independente da língua do Windows.
const ADAPTER_SCRIPT = `
$r = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Sort-Object RouteMetric | Select-Object -First 1
if ($r) {
  $a = Get-NetAdapter -InterfaceIndex $r.ifIndex -ErrorAction SilentlyContinue
  [pscustomobject]@{ name=$a.Name; description=$a.InterfaceDescription; media=$a.PhysicalMediaType; ndis=[string]$a.NdisPhysicalMedium; speed=$a.LinkSpeed; gateway=$r.NextHop } | ConvertTo-Json -Compress
}`;

export function parseAdapter(stdout: string): Adapter {
  const empty: Adapter = { name: null, description: null, wifi: null, linkSpeed: null, gateway: null };
  try {
    const a = JSON.parse(stdout.trim());
    const media = `${a.media ?? ""} ${a.ndis ?? ""}`;
    return {
      name: typeof a.name === "string" ? a.name : null,
      description: typeof a.description === "string" ? a.description : null,
      // NdisPhysicalMedium 9 = Native 802.11
      wifi: /802\.11|wireless/i.test(media) || /\b9\b/.test(String(a.ndis ?? "")),
      linkSpeed: typeof a.speed === "string" ? a.speed : null,
      gateway:
        typeof a.gateway === "string" && a.gateway !== "0.0.0.0" ? a.gateway : null,
    };
  } catch {
    return empty;
  }
}

export function parseWifiSignal(stdout: string): number | null {
  const m = stdout.match(/^\s*(?:Signal|Sinal|Señal)\s*:\s*(\d{1,3})\s*%/im);
  return m ? Math.min(100, Number(m[1])) : null;
}

function stats(samples: (number | null)[]): NetworkPhase {
  const ok = samples.filter((s): s is number => s !== null).sort((a, b) => a - b);
  const median = ok.length ? ok[Math.floor(ok.length / 2)] : null;
  let jitter: number | null = null;
  const seq = samples.filter((s): s is number => s !== null);
  if (seq.length > 1) {
    let sum = 0;
    for (let i = 1; i < seq.length; i++) sum += Math.abs(seq[i] - seq[i - 1]);
    jitter = sum / (seq.length - 1);
  }
  return {
    sent: samples.length,
    received: ok.length,
    medianMs: median,
    jitterMs: jitter === null ? null : Math.round(jitter * 10) / 10,
  };
}

export function grade(increaseMs: number | null): NetworkCheck["bufferbloatGrade"] {
  if (increaseMs === null) return null;
  if (increaseMs < 5) return "A+";
  if (increaseMs < 30) return "A";
  if (increaseMs < 60) return "B";
  if (increaseMs < 200) return "C";
  if (increaseMs < 400) return "D";
  return "F";
}

async function pingSeries(host: string, ms: number, signal: AbortSignal) {
  const out: (number | null)[] = [];
  const end = Date.now() + ms;
  while (Date.now() < end && !signal.aborted) {
    const s = await probeHost(host, 1000, signal);
    out.push(s.status === "reply" ? s.rttMs : null);
    await new Promise((r) => setTimeout(r, 150));
  }
  return out;
}

async function pingCount(host: string, n: number, signal: AbortSignal) {
  const out: (number | null)[] = [];
  for (let i = 0; i < n && !signal.aborted; i++) {
    const s = await probeHost(host, 1000, signal);
    out.push(s.status === "reply" ? s.rttMs : null);
  }
  return out;
}

// Gera carga durante `ms`; devolve Mbit/s observados.
async function load(kind: "down" | "up", ms: number, signal: AbortSignal) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  signal.addEventListener("abort", stop);
  const timer = setTimeout(stop, ms);
  let bytes = 0;
  const started = performance.now();
  const chunk = new Uint8Array(4 * 1024 * 1024);
  const worker = async () => {
    while (!controller.signal.aborted) {
      try {
        if (kind === "down") {
          const res = await fetch(DOWN_URL, { signal: controller.signal, cache: "no-store" });
          const reader = res.body?.getReader();
          if (!reader) return;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
          }
        } else {
          await fetch(UP_URL, { method: "POST", body: chunk, signal: controller.signal });
          bytes += chunk.byteLength;
        }
      } catch {
        return;
      }
    }
  };
  await Promise.all(Array.from({ length: STREAMS }, worker));
  clearTimeout(timer);
  signal.removeEventListener("abort", stop);
  const seconds = (performance.now() - started) / 1000;
  return seconds > 0 && bytes > 0 ? Math.round(((bytes * 8) / seconds / 1e6) * 10) / 10 : null;
}

async function underLoad(kind: "down" | "up", signal: AbortSignal) {
  const [samples, mbps] = await Promise.all([
    pingSeries(PING_HOST, LOAD_MS, signal),
    load(kind, LOAD_MS, signal),
  ]);
  return { phase: stats(samples), mbps };
}

export function advice(c: Omit<NetworkCheck, "advice">): string[] {
  const tips: string[] = [];
  if (c.wifi) {
    tips.push(
      "Estás em Wi-Fi. Um cabo de rede elimina a maior parte dos picos de ping e da perda de pacotes.",
    );
    if (c.wifiSignal !== null && c.wifiSignal < 70)
      tips.push(
        `Sinal Wi-Fi a ${c.wifiSignal}%. Aproxima o PC do router ou usa a banda de 5 GHz.`,
      );
  }
  if (c.gateway.medianMs !== null && c.gateway.medianMs > 5)
    tips.push(
      `O router demora ${Math.round(c.gateway.medianMs)} ms a responder (o normal é 1–2 ms). O problema está na rede de casa.`,
    );
  if (c.gateway.jitterMs !== null && c.gateway.jitterMs > 3)
    tips.push("Ping instável até ao router: interferência no Wi-Fi ou router sobrecarregado.");
  const worst = Math.max(c.downloadIncreaseMs ?? 0, c.uploadIncreaseMs ?? 0);
  if (worst >= 30)
    tips.push(
      `Bufferbloat: o ping sobe ${Math.round(worst)} ms quando a ligação está ocupada. Ativa SQM/QoS (fq_codel ou CAKE) no router, limitado a ~90% da velocidade contratada, ou evita downloads enquanto jogas.`,
    );
  if (c.idle.received < c.idle.sent)
    tips.push("Houve pings sem resposta com a ligação parada: pode haver perda de pacotes na operadora.");
  if (!tips.length) tips.push("A tua rede de casa está em bom estado para jogar.");
  return tips;
}

export async function runNetworkCheck(
  signal: AbortSignal,
  onProgress: (step: string) => void,
): Promise<NetworkCheck> {
  onProgress("A identificar a ligação…");
  const ps = await runProcess(
    systemCommand("WindowsPowerShell/v1.0/powershell.exe"),
    ["-NoProfile", "-NonInteractive", "-Command", ADAPTER_SCRIPT],
    signal,
    15000,
    65536,
    "utf8",
  );
  const adapter = parseAdapter(ps.stdout);
  let wifiSignal: number | null = null;
  if (adapter.wifi) {
    const w = await runProcess(
      systemCommand("netsh.exe"),
      ["wlan", "show", "interfaces"],
      signal,
      10000,
      65536,
    );
    wifiSignal = parseWifiSignal(w.stdout);
  }

  onProgress("A medir o router…");
  const gateway = adapter.gateway
    ? stats(await pingCount(adapter.gateway, 10, signal))
    : stats([]);

  onProgress("A medir o ping com a ligação parada…");
  const idle = stats(await pingCount(PING_HOST, 15, signal));

  onProgress("A medir o ping durante um download…");
  const down = await underLoad("down", signal);
  onProgress("A medir o ping durante um upload…");
  const up = await underLoad("up", signal);
  if (signal.aborted) throw new Error("Cancelado.");

  const inc = (p: NetworkPhase) =>
    p.medianMs !== null && idle.medianMs !== null
      ? Math.max(0, Math.round((p.medianMs - idle.medianMs) * 10) / 10)
      : null;
  const downloadIncreaseMs = inc(down.phase);
  const uploadIncreaseMs = inc(up.phase);
  const worst =
    downloadIncreaseMs === null && uploadIncreaseMs === null
      ? null
      : Math.max(downloadIncreaseMs ?? 0, uploadIncreaseMs ?? 0);
  const base = {
    measuredAt: new Date().toISOString(),
    adapterName: adapter.name,
    adapterDescription: adapter.description,
    wifi: adapter.wifi,
    wifiSignal,
    linkSpeed: adapter.linkSpeed,
    gatewayAddress: adapter.gateway,
    gateway,
    idle,
    download: down.phase,
    upload: up.phase,
    downloadMbps: down.mbps,
    uploadMbps: up.mbps,
    downloadIncreaseMs,
    uploadIncreaseMs,
    bufferbloatGrade: grade(worst),
  };
  return { ...base, advice: advice(base) };
}
