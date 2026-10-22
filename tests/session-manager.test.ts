import { expect, test } from "vitest";
import { SessionManager } from "../src/main/diagnostics/session-manager";
import type { Game, Sample, Session } from "../src/shared/contracts";
test("overlapping persistence retries share ownership until the write settles", async () => {
  let attempts = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const saved: Session[] = [];
  const manager = new SessionManager(
    () => {},
    async (s) => {
      if (attempts++ === 0) throw new Error("disk full");
      await gate;
      saved.push(s);
    },
    async () => ({
      index: 0,
      at: new Date().toISOString(),
      status: "reply",
      rttMs: 1,
      reason: null,
    }),
  );
  manager.start(
    {
      id: "g",
      name: "Game",
      executablePath: null,
      targets: [{ id: "t", label: "Local", host: "127.0.0.1" }],
      mode: "manual",
      selectedTargetId: "t",
    },
    { sampleCount: 1, timeoutMs: 250, intervalMs: 250 },
  );
  await manager.stopAll();
  const first = manager.retryPersistence();
  const second = manager.retryPersistence();
  let stopped = false;
  const stop = manager.stopAll().then(() => {
    stopped = true;
  });
  await new Promise((r) => setTimeout(r, 5));
  expect(stopped).toBe(false);
  release();
  await Promise.all([first, second, stop]);
  expect(saved).toHaveLength(1);
  expect(manager.pendingSession).toBeNull();
});
const game: Game = {
  id: "g",
  name: "Game",
  executablePath: null,
  targets: [{ id: "t", label: "Local", host: "127.0.0.1" }],
  mode: "manual",
  selectedTargetId: "t",
};
const settings = { sampleCount: 2, timeoutMs: 250, intervalMs: 250 };
const reply: Sample = {
  index: 0,
  at: new Date().toISOString(),
  status: "reply",
  rttMs: 1,
  reason: null,
};
test("cancels an active probe, prevents duplicates and saves only observed samples", async () => {
  const saved: Session[] = [];
  const manager = new SessionManager(
    () => {},
    async (s) => {
      saved.push(s);
    },
    async (_h, _t, signal) =>
      new Promise((resolve) =>
        signal.addEventListener(
          "abort",
          () => resolve({ ...reply, status: "error" }),
          { once: true },
        ),
      ),
  );
  const started = manager.start(game, settings);
  expect(started.ok).toBe(true);
  if (!started.ok) return;
  expect(manager.start(game, settings).ok).toBe(false);
  await manager.cancel(started.value.id);
  await manager.cancel(started.value.id);
  expect(manager.active).toBeNull();
  expect(saved).toHaveLength(1);
  expect(saved[0].state).toBe("cancelled");
  expect(saved[0].samples).toHaveLength(0);
});
test("awaits final persistence and stopAll is safe during finalization", async () => {
  let release!: () => void;
  const saved = new Promise<void>((r) => {
    release = r;
  });
  const manager = new SessionManager(
    () => {},
    () => saved,
    async () => reply,
  );
  manager.start(game, { ...settings, sampleCount: 1 });
  await new Promise((r) => setTimeout(r, 5));
  expect(manager.start(game, settings).ok).toBe(false);
  const stopping = manager.stopAll();
  release();
  await stopping;
  expect(manager.active).toBeNull();
});
test("automatic selection chooses responsive destination and preserves probes", async () => {
  let finish!: () => void;
  const done = new Promise<void>((r) => (finish = r));
  let output!: Session;
  const manager = new SessionManager(
    () => {},
    async (s) => {
      output = s;
      finish();
    },
    async (host) => ({ ...reply, rttMs: host === "fast.local" ? 5 : 40 }),
  );
  manager.start(
    {
      ...game,
      mode: "automatic",
      targets: [
        game.targets[0],
        { id: "fast", host: "fast.local", label: "Fast" },
      ],
    },
    { ...settings, sampleCount: 1 },
  );
  await done;
  await manager.stopAll();
  expect(output.target.host).toBe("fast.local");
  expect(output.samples).toHaveLength(1);
  expect(output.selection).toHaveLength(2);
});
test("a failed final save retains ownership and blocks new sessions", async () => {
  const updates: Session[] = [];
  const manager = new SessionManager(
    (s) => updates.push(s),
    async () => {
      throw new Error("disk full");
    },
    async () => reply,
  );
  manager.start(game, { ...settings, sampleCount: 1 });
  await manager.stopAll();
  expect(manager.persistenceError).toContain("disk full");
  expect(manager.start(game, settings).ok).toBe(false);
});
test("retry saves the retained result and releases the next session", async () => {
  let failure = true;
  const saved: Session[] = [];
  const manager = new SessionManager(
    () => {},
    async (s) => {
      if (failure) throw new Error("disk unavailable");
      saved.push(s);
    },
    async () => reply,
  );
  manager.start(game, { ...settings, sampleCount: 1 });
  await manager.stopAll();
  expect(manager.pendingSession).not.toBeNull();
  failure = false;
  expect((await manager.retryPersistence()).ok).toBe(true);
  expect(saved).toHaveLength(1);
  expect(manager.pendingSession).toBeNull();
  expect(manager.persistenceError).toBeNull();
  expect(manager.start(game, { ...settings, sampleCount: 1 }).ok).toBe(true);
  await manager.stopAll();
});
