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

const token = randomBytes(32).toString("hex");
let child: ChildProcess;
let relay: Relay;

beforeAll(async () => {
  child = spawn(process.execPath, [join(__dirname, "../relay/server.mjs")], {
    env: { ...process.env, RELAY_TOKEN: token, RELAY_PORT: "0", RELAY_HOST: "127.0.0.1" },
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
