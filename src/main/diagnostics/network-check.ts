import type { NetworkCheck, NetworkPhase } from "../../shared/contracts";
import { probeHost } from "./ping";
import { runProcess, systemCommand } from "./process";

const PING_HOST = "1.1.1.1";
const LOAD_MS = 8000;
const STREAMS = 3;
// Limites de dados por fase: chegam para saturar a maioria das ligações
// durante uns segundos sem gastar centenas de MB.
const DOWN_CAP_BYTES = 60 * 1024 * 1024;
const UP_CAP_BYTES = 20 * 1024 * 1024;
const DOWN_URL = "https://speed.cloudflare.com/__down?bytes=25000000";
const UP_URL = "https://speed.cloudflare.com/__up";
// Sondas seguidas sem resposta que fazem parar a carga.
const DROP_AFTER = 3;
const RECOVERY_MS = 20000;

type Adapter = {
  name: string | null;
  description: string | null;
  wifi: boolean | null;
  linkSpeed: string | null;
  gateway: string | null;
  metered: boolean;
};

// O adaptador da rota por defeito e o custo da ligação (tarifada ou não),
// em JSON, independente da língua do Windows.
const ADAPTER_SCRIPT = `
$cost = $null
try {
  [void][Windows.Networking.Connectivity.NetworkInformation, Windows.Networking.Connectivity, ContentType = WindowsRuntime]
  $profile = [Windows.Networking.Connectivity.NetworkInformation]::GetInternetConnectionProfile()
  if ($profile) { $cost = [string]$profile.GetConnectionCost().NetworkCostType }
} catch {}
$r = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Sort-Object RouteMetric | Select-Object -First 1
if ($r) {
  $a = Get-NetAdapter -InterfaceIndex $r.ifIndex -ErrorAction SilentlyContinue
  [pscustomobject]@{ name=$a.Name; description=$a.InterfaceDescription; media=$a.PhysicalMediaType; ndis=[string]$a.NdisPhysicalMedium; speed=$a.LinkSpeed; gateway=$r.NextHop; cost=$cost } | ConvertTo-Json -Compress
}`;

const MOBILE = /mobile|wwan|broadband|\blte\b|\b[345]g\b|remote ndis|rndis|tether|android|iphone|hotspot|cellular/i;

export function parseAdapter(stdout: string): Adapter {
  const empty: Adapter = { name: null, description: null, wifi: null, linkSpeed: null, gateway: null, metered: false };
  try {
    const a = JSON.parse(stdout.trim());
    const media = `${a.media ?? ""} ${a.ndis ?? ""}`;
    const description = typeof a.description === "string" ? a.description : null;
    const cost = typeof a.cost === "string" ? a.cost : "";
    return {
      name: typeof a.name === "string" ? a.name : null,
      description,
      // NdisPhysicalMedium 9 = Native 802.11
      wifi: /802\.11|wireless/i.test(media) || /\b9\b/.test(String(a.ndis ?? "")),
      linkSpeed: typeof a.speed === "string" ? a.speed : null,
      gateway:
        typeof a.gateway === "string" && a.gateway !== "0.0.0.0" ? a.gateway : null,
      // Ligação tarifada no Windows (Fixed/Variable) ou adaptador móvel/partilhado.
      metered: /fixed|variable/i.test(cost) || MOBILE.test(`${description ?? ""} ${a.name ?? ""} ${media}`),
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

async function pingCount(host: string, n: number, signal: AbortSignal) {
  const out: (number | null)[] = [];
  for (let i = 0; i < n && !signal.aborted; i++) {
    const s = await probeHost(host, 1000, signal);
    out.push(s.status === "reply" ? s.rttMs : null);
  }
  return out;
}

// Verdadeiro quando `n` sondas seguidas no fim da série não tiveram resposta.
export function droppedAt(samples: (number | null)[], n = DROP_AFTER) {
  return samples.length >= n && samples.slice(-n).every((s) => s === null);
}

// Gera carga até `ms` ou `capBytes`; devolve Mbit/s observados e bytes usados.
async function load(kind: "down" | "up", ms: number, capBytes: number, signal: AbortSignal) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  if (signal.aborted) stop();
  signal.addEventListener("abort", stop);
  const timer = setTimeout(stop, ms);
  let bytes = 0;
  const started = performance.now();
  const chunk = new Uint8Array(1024 * 1024);
  const worker = async () => {
    while (!controller.signal.aborted && bytes < capBytes) {
      try {
        if (kind === "down") {
          const res = await fetch(DOWN_URL, { signal: controller.signal, cache: "no-store" });
          const reader = res.body?.getReader();
          if (!reader) return;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes >= capBytes) {
              stop();
              break;
            }
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
  return {
    mbps: seconds > 0 && bytes > 0 ? Math.round(((bytes * 8) / seconds / 1e6) * 10) / 10 : null,
    bytes,
  };
}

// Mede o ping durante a carga; se a ligação deixar de responder, pára a
// carga de imediato em vez de continuar a sobrecarregar o router.
async function underLoad(kind: "down" | "up", signal: AbortSignal) {
  const phase = new AbortController();
  const abort = () => phase.abort();
  signal.addEventListener("abort", abort);
  const samples: (number | null)[] = [];
  let dropped = false;
  const pinger = (async () => {
    const end = Date.now() + LOAD_MS;
    while (Date.now() < end && !phase.signal.aborted) {
      const s = await probeHost(PING_HOST, 1000, phase.signal);
      if (phase.signal.aborted) break;
      samples.push(s.status === "reply" ? s.rttMs : null);
      if (droppedAt(samples)) {
        dropped = true;
        phase.abort();
        break;
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    phase.abort();
  })();
  const result = await load(kind, LOAD_MS, kind === "down" ? DOWN_CAP_BYTES : UP_CAP_BYTES, phase.signal);
  phase.abort();
  await pinger;
  signal.removeEventListener("abort", abort);
  return { phase: stats(samples), mbps: result.mbps, bytes: result.bytes, dropped };
}

// Depois de uma queda, espera que a internet volte a responder.
async function waitForRecovery(signal: AbortSignal) {
  const end = Date.now() + RECOVERY_MS;
  while (Date.now() < end && !signal.aborted) {
    const s = await probeHost(PING_HOST, 1000, signal);
    if (s.status === "reply") return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

export function advice(c: Omit<NetworkCheck, "advice">): string[] {
  const tips: string[] = [];
  if (c.dropped) {
    tips.push(
      c.recovered
        ? `A ligação deixou de responder durante o teste de ${c.dropped === "download" ? "download" : "upload"} e o RoutePilot parou a carga logo. Já voltou. O router ou a operadora não aguentam a ligação cheia: é exatamente o que causa lag quando alguém faz downloads.`
        : "A ligação deixou de responder durante o teste e ainda não voltou. O RoutePilot já parou toda a carga. Espera uns segundos; se não voltar, desliga e liga o Wi-Fi/cabo ou reinicia o router.",
    );
  }
  if (c.loadSkipped) tips.push(c.loadSkipped);
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

// Adaptador da rota por defeito e, em Wi-Fi, a força do sinal.
export async function readAdapter(signal: AbortSignal) {
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
  return { adapter, wifiSignal };
}

export async function runNetworkCheck(
  signal: AbortSignal,
  onProgress: (step: string) => void,
  options: { withLoad?: boolean } = {},
): Promise<NetworkCheck> {
  onProgress("A identificar a ligação…");
  const { adapter, wifiSignal } = await readAdapter(signal);

  onProgress("A medir o router…");
  const gateway = adapter.gateway
    ? stats(await pingCount(adapter.gateway, 10, signal))
    : stats([]);

  onProgress("A medir o ping com a ligação parada…");
  const idle = stats(await pingCount(PING_HOST, 15, signal));

  // O teste com carga só corre em ligações não tarifadas e com internet.
  let loadSkipped: string | null = null;
  if (options.withLoad === false)
    loadSkipped = "Teste com carga desligado: o bufferbloat não foi medido.";
  else if (adapter.metered)
    loadSkipped =
      "Ligação tarifada ou móvel (4G/5G, hotspot): o teste com download/upload não foi feito para não gastar dados. O bufferbloat não foi medido.";
  else if (idle.received === 0)
    loadSkipped = "Sem resposta da internet com a ligação parada: o teste com carga não foi feito.";

  const empty: Awaited<ReturnType<typeof underLoad>> = { phase: stats([]), mbps: null, bytes: 0, dropped: false };
  let down = empty;
  let up = empty;
  let dropped: NetworkCheck["dropped"] = null;
  if (!loadSkipped) {
    onProgress("A medir o ping durante um download…");
    down = await underLoad("down", signal);
    if (down.dropped) dropped = "download";
    else {
      onProgress("A medir o ping durante um upload…");
      up = await underLoad("up", signal);
      if (up.dropped) dropped = "upload";
    }
  }
  if (signal.aborted) throw new Error("Cancelado.");
  let recovered: boolean | null = null;
  if (dropped) {
    onProgress("A ligação caiu durante o teste. A carga foi parada; a esperar que volte…");
    recovered = await waitForRecovery(signal);
  }

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
    bufferbloatGrade: dropped ? "F" : grade(worst),
    metered: adapter.metered,
    loadSkipped,
    dropped,
    recovered,
    dataUsedMb: Math.round((down.bytes + up.bytes) / (1024 * 1024)),
  } satisfies Omit<NetworkCheck, "advice">;
  return { ...base, advice: advice(base) };
}
