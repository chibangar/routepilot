#!/usr/bin/env node
// RoutePilot relay: medição autenticada por UDP.
// Responde a "echo" (RTT cliente↔relay) e a "probe" (o relay faz ping ao
// destino e devolve o RTT relay↔destino). Não encaminha tráfego de jogos.
import { createSocket } from "node:dgram";
import { createHmac, timingSafeEqual } from "node:crypto";
import { execFile } from "node:child_process";
import { isIP } from "node:net";

const VERSION = 1;
const MAX_SKEW_MS = 30_000;
const RATE_WINDOW_MS = 10_000;
const RATE_LIMIT = 40;
const MAX_CONCURRENT_PROBES = 8;
const PROBE_TIMEOUT_MS = 2000;

export function sign(token, fields) {
  return createHmac("sha256", token).update(fields.join("|")).digest("hex");
}

function sameMac(expected, actual) {
  if (typeof actual !== "string" || actual.length !== expected.length)
    return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

export function validHost(host) {
  if (typeof host !== "string" || !host || host.length > 253) return false;
  if (isIP(host)) return true;
  if (/^[\d.]+$/.test(host)) return false;
  return host
    .split(".")
    .every((l) => /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(l));
}

export function parsePingMs(output) {
  const m = output.match(/(?:time|tempo)\s*([=<])\s*(\d+(?:[.,]\d+)?)\s*ms/i);
  if (!m) return null;
  const value = Number(m[2].replace(",", "."));
  return m[1] === "<" ? value / 2 : value;
}

function ping(host) {
  const windows = process.platform === "win32";
  const args = windows
    ? ["-n", "1", "-w", String(PROBE_TIMEOUT_MS), host]
    : ["-n", "-c", "1", "-W", String(Math.ceil(PROBE_TIMEOUT_MS / 1000)), host];
  return new Promise((resolve) => {
    execFile(
      "ping",
      args,
      { timeout: PROBE_TIMEOUT_MS + 2000, windowsHide: true, maxBuffer: 65536 },
      (_error, stdout) => resolve(parsePingMs(String(stdout ?? ""))),
    );
  });
}

export function startRelay({ token, port = 7400, host = "0.0.0.0", log = console.log }) {
  if (typeof token !== "string" || token.length < 32)
    throw new Error("RELAY_TOKEN tem de ter pelo menos 32 caracteres.");
  const socket = createSocket(isIP(host) === 6 ? "udp6" : "udp4");
  const seen = new Map();
  const rates = new Map();
  let probes = 0;

  const reply = (rinfo, id, ok, rttMs, error) => {
    const rtt = rttMs === null || rttMs === undefined ? "" : String(rttMs);
    const body = {
      v: VERSION,
      id,
      ok,
      rttMs: rttMs ?? null,
      error: error ?? null,
      mac: sign(token, ["reply", id, String(ok), rtt, error ?? ""]),
    };
    socket.send(JSON.stringify(body), rinfo.port, rinfo.address);
  };

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [k, at] of seen) if (now - at > MAX_SKEW_MS * 2) seen.delete(k);
    for (const [k, r] of rates) if (now - r.start > RATE_WINDOW_MS) rates.delete(k);
  }, RATE_WINDOW_MS);
  cleanup.unref();

  socket.on("message", (data, rinfo) => {
    if (data.length > 1024) return;
    const now = Date.now();
    const rate = rates.get(rinfo.address);
    if (!rate || now - rate.start > RATE_WINDOW_MS)
      rates.set(rinfo.address, { start: now, count: 1 });
    else if (++rate.count > RATE_LIMIT) return;

    let req;
    try {
      req = JSON.parse(data.toString("utf8"));
    } catch {
      return;
    }
    if (!req || req.v !== VERSION || typeof req.id !== "string") return;
    if (!/^[0-9a-f]{32}$/.test(req.id) || typeof req.t !== "number") return;
    const target = req.op === "probe" ? req.host : "";
    if (req.op !== "echo" && req.op !== "probe") return;
    const expected = sign(token, [req.id, String(req.t), req.op, target ?? ""]);
    // Pedidos sem MAC válido são ignorados em silêncio (não ajudam varrimentos).
    if (!sameMac(expected, req.mac)) return;
    if (Math.abs(now - req.t) > MAX_SKEW_MS)
      return reply(rinfo, req.id, false, null, "clock_skew");
    if (seen.has(req.id)) return;
    seen.set(req.id, now);

    if (req.op === "echo") return reply(rinfo, req.id, true, null, null);
    if (!validHost(target)) return reply(rinfo, req.id, false, null, "invalid_host");
    if (probes >= MAX_CONCURRENT_PROBES)
      return reply(rinfo, req.id, false, null, "busy");
    probes++;
    void ping(target)
      .then((ms) =>
        ms === null
          ? reply(rinfo, req.id, false, null, "no_reply")
          : reply(rinfo, req.id, true, ms, null),
      )
      .finally(() => probes--);
  });

  return new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.bind(port, host, () => {
      socket.off("error", reject);
      socket.on("error", (e) => log(`erro: ${e.message}`));
      const address = socket.address();
      log(`RoutePilot relay a ouvir em ${address.address}:${address.port}/udp`);
      resolve({
        port: address.port,
        close: () =>
          new Promise((done) => {
            clearInterval(cleanup);
            socket.close(() => done());
          }),
      });
    });
  });
}

const isMain =
  process.argv[1] &&
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, "/").split("/").pop());
if (isMain) {
  startRelay({
    token: process.env.RELAY_TOKEN,
    port: Number(process.env.RELAY_PORT ?? 7400),
    host: process.env.RELAY_HOST ?? "0.0.0.0",
  }).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
