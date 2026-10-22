import { createSocket } from "node:dgram";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import type { Relay, RelayResult, RouteComparison, Target } from "../../shared/contracts";
import { probeHost } from "./ping";

const ECHO_COUNT = 3;

export function sign(token: string, fields: string[]) {
  return createHmac("sha256", token).update(fields.join("|")).digest("hex");
}

type Reply = {
  ok: boolean;
  rttMs: number | null;
  error: string | null;
  session: string | null;
};

function sameMac(expected: string, actual: unknown) {
  return (
    typeof actual === "string" &&
    actual.length === expected.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
  );
}

const relayErrors: Record<string, string> = {
  clock_skew: "Relógio do PC e do relay com mais de 30 s de diferença.",
  invalid_host: "O relay recusou o destino.",
  busy: "O relay está ocupado.",
  no_reply: "O destino não respondeu ao ping a partir do relay.",
};

async function resolveRelay(host: string) {
  if (isIP(host)) return { address: host, family: isIP(host) };
  const r = await lookup(host);
  return { address: r.address, family: r.family };
}

// Envia um pedido assinado e espera pela resposta com o mesmo id e MAC válido.
export async function relayRequest(
  relay: Relay,
  op: "echo" | "probe" | "open",
  target: string,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<{ reply: Reply; elapsedMs: number }> {
  const { address, family } = await resolveRelay(relay.host);
  const socket = createSocket(family === 6 ? "udp6" : "udp4");
  const id = randomBytes(16).toString("hex");
  const t = Date.now();
  const body = JSON.stringify({
    v: 1,
    id,
    t,
    op,
    host: op === "probe" ? target : undefined,
    mac: sign(relay.token, [id, String(t), op, op === "probe" ? target : ""]),
  });
  return new Promise((resolve, reject) => {
    let started = 0;
    const finish = (error: Error | null, value?: { reply: Reply; elapsedMs: number }) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      socket.close();
      if (error) reject(error);
      else resolve(value!);
    };
    const abort = () => finish(new Error("Cancelado."));
    const timer = setTimeout(
      () => finish(new Error("O relay não respondeu dentro do prazo.")),
      timeoutMs,
    );
    if (signal.aborted) return abort();
    signal.addEventListener("abort", abort);
    socket.on("error", (e) => finish(e));
    socket.on("message", (data) => {
      const elapsedMs = performance.now() - started;
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(data.toString("utf8"));
      } catch {
        return;
      }
      if (msg.id !== id) return;
      const ok = msg.ok === true;
      const rttMs = typeof msg.rttMs === "number" ? msg.rttMs : null;
      const error = typeof msg.error === "string" ? msg.error : null;
      const session =
        typeof msg.session === "string" && /^[0-9a-f]{32}$/.test(msg.session)
          ? msg.session
          : null;
      const fields = [
        "reply",
        id,
        String(ok),
        rttMs === null ? "" : String(rttMs),
        error ?? "",
      ];
      if (session) fields.push(session);
      if (!sameMac(sign(relay.token, fields), msg.mac)) return;
      finish(null, { reply: { ok, rttMs, error, session }, elapsedMs });
    });
    started = performance.now();
    socket.send(body, relay.port, address, (e) => {
      if (e) finish(e);
    });
  });
}

export async function measureRelay(
  relay: Relay,
  target: Target,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<RelayResult> {
  const result: RelayResult = {
    relayId: relay.id,
    label: relay.label,
    relayRttMs: null,
    targetRttMs: null,
    totalMs: null,
    error: null,
  };
  try {
    let best: number | null = null;
    let lastError: unknown = null;
    for (let i = 0; i < ECHO_COUNT && !signal.aborted; i++) {
      try {
        const { reply, elapsedMs } = await relayRequest(relay, "echo", "", timeoutMs, signal);
        if (!reply.ok) throw new Error(relayErrors[reply.error ?? ""] ?? reply.error ?? "Erro do relay.");
        best = best === null ? elapsedMs : Math.min(best, elapsedMs);
      } catch (e) {
        lastError = e;
      }
    }
    if (best === null) throw lastError ?? new Error("Cancelado.");
    result.relayRttMs = best === null ? null : Math.round(best * 10) / 10;
    const { reply } = await relayRequest(relay, "probe", target.host, timeoutMs + 4000, signal);
    if (!reply.ok || reply.rttMs === null)
      throw new Error(relayErrors[reply.error ?? ""] ?? reply.error ?? "Erro do relay.");
    result.targetRttMs = reply.rttMs;
    if (result.relayRttMs !== null)
      result.totalMs = Math.round((result.relayRttMs + reply.rttMs) * 10) / 10;
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  }
  return result;
}

export async function compareRoutes(
  target: Target,
  relays: Relay[],
  timeoutMs: number,
  signal: AbortSignal,
): Promise<RouteComparison> {
  const directProbes = async () => {
    const samples = [];
    for (let i = 0; i < ECHO_COUNT && !signal.aborted; i++)
      samples.push(await probeHost(target.host, timeoutMs, signal));
    return samples;
  };
  const [directSamples, viaRelays] = await Promise.all([
    directProbes(),
    Promise.all(relays.map((r) => measureRelay(r, target, timeoutMs, signal))),
  ]);
  const replies = directSamples.flatMap((s) =>
    s.status === "reply" && s.rttMs !== null ? [s.rttMs] : [],
  );
  const directMs = replies.length ? Math.min(...replies) : null;
  const direct = directSamples.at(-1);
  let best: RouteComparison["best"] = directMs === null ? null : { kind: "direct", ms: directMs };
  for (const r of viaRelays)
    if (r.totalMs !== null && (best === null || r.totalMs < best.ms))
      best = { kind: "relay", relayId: r.relayId, ms: r.totalMs };
  return {
    target,
    measuredAt: new Date().toISOString(),
    directMs,
    directError:
      directMs === null
        ? (direct?.reason?.split("\n")[0] ?? "Sem resposta.")
        : null,
    relays: viaRelays,
    best,
  };
}
