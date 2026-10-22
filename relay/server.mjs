#!/usr/bin/env node
// RoutePilot relay: medição e encaminhamento autenticados por UDP.
// Controlo (JSON assinado com HMAC): "echo" mede o RTT cliente↔relay, "probe"
// mede relay↔destino e "open" abre uma sessão de encaminhamento.
// Dados (binário, byte 0 = 0x01): pacotes UDP do jogo, encapsulados com o id
// da sessão e o endereço do servidor do jogo; o relay reenvia-os e devolve as
// respostas pelo mesmo caminho.
import { createSocket } from "node:dgram";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { execFile } from "node:child_process";
import { BlockList, isIP } from "node:net";

const VERSION = 1;
const MAX_SKEW_MS = 30_000;
const RATE_WINDOW_MS = 10_000;
const RATE_LIMIT = 40;
const MAX_CONCURRENT_PROBES = 8;
const PROBE_TIMEOUT_MS = 2000;
const DATA = 0x01;
const SESSION_IDLE_MS = 120_000;
const MAX_SESSIONS = 256;
const MAX_DESTS_PER_SESSION = 64;
const MAX_PPS_PER_SESSION = 3000;

// Destinos que um relay nunca deve alcançar em nome de um cliente.
const blocked = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.168.0.0", 16],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
]) blocked.addSubnet(net, bits, "ipv4");

export function forwardable(address, allowPrivate = false) {
  return isIP(address) === 4 && (allowPrivate || !blocked.check(address, "ipv4"));
}

// Cabeçalho de dados: 0x01 | sessão (16) | IPv4 (4) | porta (2) | payload.
export function encodeData(session, address, port, payload) {
  const header = Buffer.alloc(23);
  header[0] = DATA;
  session.copy(header, 1);
  address.split(".").forEach((o, i) => (header[17 + i] = Number(o)));
  header.writeUInt16BE(port, 21);
  return Buffer.concat([header, payload]);
}

export function decodeData(buf) {
  if (buf.length < 23 || buf[0] !== DATA) return null;
  return {
    session: buf.subarray(1, 17),
    address: `${buf[17]}.${buf[18]}.${buf[19]}.${buf[20]}`,
    port: buf.readUInt16BE(21),
    payload: buf.subarray(23),
  };
}

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

export function startRelay({
  token,
  port = 7400,
  host = "0.0.0.0",
  log = console.log,
  allowPrivate = false,
}) {
  if (typeof token !== "string" || token.length < 32)
    throw new Error("RELAY_TOKEN tem de ter pelo menos 32 caracteres.");
  const socket = createSocket(isIP(host) === 6 ? "udp6" : "udp4");
  const seen = new Map();
  const rates = new Map();
  let probes = 0;
  const sessions = new Map();

  const reply = (rinfo, id, ok, rttMs, error, session) => {
    const rtt = rttMs === null || rttMs === undefined ? "" : String(rttMs);
    const fields = ["reply", id, String(ok), rtt, error ?? ""];
    if (session) fields.push(session);
    const body = {
      v: VERSION,
      id,
      ok,
      rttMs: rttMs ?? null,
      error: error ?? null,
      session: session ?? undefined,
      mac: sign(token, fields),
    };
    socket.send(JSON.stringify(body), rinfo.port, rinfo.address);
  };

  const closeSession = (key) => {
    const s = sessions.get(key);
    if (!s) return;
    sessions.delete(key);
    try {
      s.out.close();
    } catch {}
  };

  const openSession = (rinfo) => {
    if (sessions.size >= MAX_SESSIONS) return null;
    const id = randomBytes(16);
    const key = id.toString("hex");
    const out = createSocket("udp4");
    const s = {
      id,
      out,
      client: { address: rinfo.address, port: rinfo.port },
      lastSeen: Date.now(),
      dests: new Set(),
      window: Date.now(),
      packets: 0,
    };
    out.on("message", (payload, from) => {
      // Só respostas de destinos que este cliente contactou voltam para ele.
      if (!s.dests.has(`${from.address}:${from.port}`)) return;
      s.lastSeen = Date.now();
      socket.send(encodeData(s.id, from.address, from.port, payload), s.client.port, s.client.address);
    });
    out.on("error", () => closeSession(key));
    out.bind(0);
    sessions.set(key, s);
    return key;
  };

  const handleData = (data, rinfo) => {
    const pkt = decodeData(data);
    if (!pkt) return;
    const s = sessions.get(pkt.session.toString("hex"));
    // A sessão está ligada ao IP do cliente; a porta pode mudar (NAT).
    if (!s || s.client.address !== rinfo.address) return;
    const now = Date.now();
    if (now - s.window >= 1000) {
      s.window = now;
      s.packets = 0;
    }
    if (++s.packets > MAX_PPS_PER_SESSION) return;
    s.client.port = rinfo.port;
    s.lastSeen = now;
    if (pkt.port === 0 && pkt.payload.length === 0) return; // keepalive
    if (!forwardable(pkt.address, allowPrivate) || pkt.port === 0) return;
    const dest = `${pkt.address}:${pkt.port}`;
    if (!s.dests.has(dest)) {
      if (s.dests.size >= MAX_DESTS_PER_SESSION) return;
      s.dests.add(dest);
    }
    s.out.send(pkt.payload, pkt.port, pkt.address);
  };

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [k, at] of seen) if (now - at > MAX_SKEW_MS * 2) seen.delete(k);
    for (const [k, r] of rates) if (now - r.start > RATE_WINDOW_MS) rates.delete(k);
    for (const [k, s] of sessions) if (now - s.lastSeen > SESSION_IDLE_MS) closeSession(k);
  }, RATE_WINDOW_MS);
  cleanup.unref();

  socket.on("message", (data, rinfo) => {
    if (data[0] === DATA) return handleData(data, rinfo);
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
    if (req.op !== "echo" && req.op !== "probe" && req.op !== "open") return;
    const expected = sign(token, [req.id, String(req.t), req.op, target ?? ""]);
    // Pedidos sem MAC válido são ignorados em silêncio (não ajudam varrimentos).
    if (!sameMac(expected, req.mac)) return;
    if (Math.abs(now - req.t) > MAX_SKEW_MS)
      return reply(rinfo, req.id, false, null, "clock_skew");
    if (seen.has(req.id)) return;
    seen.set(req.id, now);

    if (req.op === "echo") return reply(rinfo, req.id, true, null, null);
    if (req.op === "open") {
      const session = openSession(rinfo);
      return session
        ? reply(rinfo, req.id, true, null, null, session)
        : reply(rinfo, req.id, false, null, "busy");
    }
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
            for (const k of [...sessions.keys()]) closeSession(k);
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
    allowPrivate: process.env.RELAY_ALLOW_PRIVATE === "1",
  }).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
