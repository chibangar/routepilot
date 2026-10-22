import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { afterAll, beforeAll, expect, test } from "vitest";
import {
  compareRoutes,
  measureRelay,
  relayRequest,
} from "../src/main/diagnostics/relay";
import type { Relay } from "../src/shared/contracts";
import { createSocket } from "node:dgram";
import { decodeFrame, encodeFrame } from "../src/main/tunnel/frame";

const token = randomBytes(32).toString("hex");
let child: ChildProcess;
let relay: Relay;

beforeAll(async () => {
  child = spawn(process.execPath, [join(__dirname, "../relay/server.mjs")], {
    env: { ...process.env, RELAY_TOKEN: token, RELAY_PORT: "0", RELAY_HOST: "127.0.0.1", RELAY_ALLOW_PRIVATE: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const port = await new Promise<number>((resolve, reject) => {
    child.stdout!.on("data", (d: Buffer) => {
      const m = d.toString().match(/:(\d+)\/udp/);
      if (m) resolve(Number(m[1]));
    });
    child.once("exit", (code) => reject(new Error(`relay saiu (${code})`)));
  });
  relay = { id: "local", label: "Local", host: "127.0.0.1", port, token };
});

afterAll(() => {
  child?.kill();
});

const signal = () => new AbortController().signal;

test("echo autenticado responde", async () => {
  const { reply, elapsedMs } = await relayRequest(relay, "echo", "", 2000, signal());
  expect(reply.ok).toBe(true);
  expect(elapsedMs).toBeGreaterThanOrEqual(0);
});

test("token errado é ignorado sem resposta", async () => {
  await expect(
    relayRequest({ ...relay, token: "x".repeat(64) }, "echo", "", 500, signal()),
  ).rejects.toThrow(/prazo/);
});

test("relay recusa destinos com opções", async () => {
  const { reply } = await relayRequest(relay, "probe", "-n 200", 2000, signal());
  expect(reply).toMatchObject({ ok: false, error: "invalid_host" });
});

test("mede PC→relay e relay→destino", async () => {
  const r = await measureRelay(
    relay,
    { id: "lo", label: "Loopback", host: "127.0.0.1" },
    2000,
    signal(),
  );
  expect(r.error).toBeNull();
  expect(r.relayRttMs).not.toBeNull();
  expect(r.targetRttMs).not.toBeNull();
  expect(r.totalMs).toBeCloseTo((r.relayRttMs ?? 0) + (r.targetRttMs ?? 0), 0);
}, 20000);

test("encaminha UDP do jogo pelo relay e devolve a resposta", async () => {
  // "Servidor do jogo" local que responde com eco.
  const game = createSocket("udp4");
  game.on("message", (m, r) => game.send(Buffer.concat([Buffer.from("eco:"), m]), r.port, r.address));
  await new Promise<void>((r) => game.bind(0, "127.0.0.1", () => r()));
  const gamePort = game.address().port;

  const { reply } = await relayRequest(relay, "open", "", 2000, signal());
  expect(reply.ok).toBe(true);
  const session = Buffer.from(reply.session!, "hex");

  const client = createSocket("udp4");
  await new Promise<void>((r) => client.bind(0, "127.0.0.1", () => r()));
  const answer = new Promise<ReturnType<typeof decodeFrame>>((resolve) =>
    client.on("message", (m) => resolve(decodeFrame(m))),
  );
  client.send(encodeFrame(session, "127.0.0.1", gamePort, Buffer.from("ola")), relay.port, "127.0.0.1");
  const frame = await answer;
  expect(frame?.payload.toString()).toBe("eco:ola");
  expect(frame?.port).toBe(gamePort);
  expect(frame?.session.equals(session)).toBe(true);

  // Sessão inventada é ignorada.
  const silent = new Promise((resolve) => {
    client.removeAllListeners("message");
    client.on("message", () => resolve("resposta"));
    setTimeout(() => resolve("silêncio"), 400);
  });
  client.send(encodeFrame(randomBytes(16), "127.0.0.1", gamePort, Buffer.from("x")), relay.port, "127.0.0.1");
  expect(await silent).toBe("silêncio");
  client.close();
  game.close();
});

test("compara rota direta com relay", async () => {
  const c = await compareRoutes(
    { id: "lo", label: "Loopback", host: "127.0.0.1" },
    [relay],
    1000,
    signal(),
  );
  expect(c.directMs).not.toBeNull();
  expect(c.relays).toHaveLength(1);
  expect(c.best).not.toBeNull();
}, 20000);

test("relay recusa encaminhar para redes privadas por defeito", async () => {
  const { forwardable } = await import("../relay/server.mjs" as string);
  expect(forwardable("192.168.0.1")).toBe(false);
  expect(forwardable("127.0.0.1")).toBe(false);
  expect(forwardable("10.1.2.3")).toBe(false);
  expect(forwardable("185.40.64.1")).toBe(true);
});
