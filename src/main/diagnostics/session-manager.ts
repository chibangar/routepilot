import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import {
  ok,
  fail,
  type Game,
  type Settings,
  type Session,
  type Sample,
  type Result,
} from "../../shared/contracts";
import { gameSchema, settingsSchema } from "../../shared/validation";
import { computeMetrics } from "./metrics";
import { probeHost } from "./ping";
export class SessionManager {
  active: Session | null = null;
  selecting = false;
  persistenceError: string | null = null;
  private unsaved: Session | null = null;
  get pendingSession(): Session | null {
    return this.unsaved ? structuredClone(this.unsaved) : null;
  }
  private controller: AbortController | null = null;
  private work: Promise<void> | null = null;
  private retryWork: Promise<Result<void>> | null = null;
  constructor(
    private update: (s: Session) => void,
    private finish: (s: Session) => Promise<void>,
    private probe: typeof probeHost = probeHost,
  ) {}
  start(game: Game, settings: Settings): Result<{ id: string }> {
    if (this.unsaved)
      return fail(
        "unsaved_session",
        "A sessão anterior não foi guardada. Tente guardar novamente antes de iniciar outra sessão.",
      );
    if (this.active || this.work || this.retryWork)
      return fail("busy", "Já existe um diagnóstico ativo ou a finalizar.");
    if (
      !gameSchema.safeParse(game).success ||
      !settingsSchema.safeParse(settings).success
    )
      return fail("invalid_input", "Configuração de diagnóstico inválida.");
    const target =
      game.mode === "manual"
        ? game.targets.find((t) => t.id === game.selectedTargetId)
        : game.targets[0];
    if (!target)
      return fail(
        "no_target",
        "Adicione e selecione um destino de diagnóstico.",
      );
    const session: Session = {
      id: randomUUID(),
      gameId: game.id,
      target: structuredClone(target),
      startedAt: new Date().toISOString(),
      endedAt: null,
      state: "running",
      samples: [],
      metrics: computeMetrics([]),
    };
    this.active = session;
    this.controller = new AbortController();
    this.persistenceError = null;
    this.selecting = game.mode === "automatic";
    this.emit(session);
    this.work = this.run(
      session,
      structuredClone(game),
      settings,
      this.controller.signal,
    ).finally(() => {
      this.work = null;
      this.controller = null;
      this.active = null;
      this.selecting = false;
    });
    return ok({ id: session.id });
  }
  private emit(s: Session) {
    this.update(structuredClone(s));
  }
  private async run(
    session: Session,
    game: Game,
    settings: Settings,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      if (game.mode === "automatic") {
        const selection = game.targets.map((target) => ({
          target,
          samples: [] as Sample[],
        }));
        session.selection = selection;
        // Todos os destinos são sondados em paralelo: um destino sem resposta
        // deixa de atrasar os restantes.
        await Promise.all(
          selection.map(async (candidate) => {
            for (let i = 0; i < 3 && !signal.aborted; i++) {
              const sample = await this.probe(
                candidate.target.host,
                settings.timeoutMs,
                signal,
              );
              if (!signal.aborted)
                candidate.samples.push({ ...sample, index: i });
            }
          }),
        );
        if (!signal.aborted) {
          const candidates = session.selection
            .map((c) => ({
              target: c.target,
              metrics: computeMetrics(c.samples),
            }))
            .filter((c) => c.metrics.meanMs !== null)
            .sort((a, b) => a.metrics.meanMs! - b.metrics.meanMs!);
          if (!candidates.length)
            throw new Error(
              "Nenhum destino respondeu às sondas de seleção. Consulte os resultados parciais.",
            );
          session.target = candidates[0].target;
        }
        this.selecting = false;
        this.emit(session);
      }
      for (let i = 0; i < settings.sampleCount && !signal.aborted; i++) {
        const sample = await this.probe(
          session.target.host,
          settings.timeoutMs,
          signal,
        );
        if (signal.aborted) break;
        session.samples.push({ ...sample, index: i });
        session.metrics = computeMetrics(session.samples);
        this.emit(session);
        if (sample.status === "error")
          throw new Error(sample.reason ?? "Falha ao executar o diagnóstico.");
        if (i < settings.sampleCount - 1)
          await delay(settings.intervalMs, undefined, { signal });
      }
      session.state = signal.aborted ? "cancelled" : "completed";
    } catch (e) {
      session.state = signal.aborted ? "cancelled" : "failed";
      if (!signal.aborted && session.samples.at(-1)?.status !== "error")
        session.samples.push({
          index: session.samples.length,
          at: new Date().toISOString(),
          status: "error",
          rttMs: null,
          reason: String(e).slice(0, 1800),
        });
    } finally {
      session.endedAt = new Date().toISOString();
      session.metrics = computeMetrics(session.samples);
      this.selecting = false;
      this.emit(session);
      this.unsaved = structuredClone(session);
      try {
        await this.finish(structuredClone(this.unsaved));
        this.unsaved = null;
        this.persistenceError = null;
      } catch (e) {
        this.persistenceError = String(e);
      }
      this.emit(session);
    }
  }
  async cancel(id: string): Promise<Result<void>> {
    if (this.active && this.active.id !== id)
      return fail("unknown_session", "A sessão indicada não está ativa.");
    if (this.active?.state === "running") this.controller?.abort();
    await this.work;
    await this.retryWork;
    return this.persistenceError
      ? fail("store_write", this.persistenceError)
      : ok(undefined);
  }
  async stopAll(): Promise<void> {
    if (this.active?.state === "running") this.controller?.abort();
    await Promise.all([this.work, this.retryWork]);
  }
  retryPersistence(): Promise<Result<void>> {
    if (this.retryWork) return this.retryWork;
    const attempt = async (): Promise<Result<void>> => {
      await this.work;
      if (!this.unsaved) return ok(undefined);
      const pending = structuredClone(this.unsaved);
      try {
        await this.finish(pending);
        if (this.unsaved?.id === pending.id) {
          this.unsaved = null;
          this.persistenceError = null;
        }
        this.emit(pending);
        return ok(undefined);
      } catch (e) {
        this.persistenceError = String(e);
        this.emit(pending);
        return fail("store_write", this.persistenceError);
      }
    };
    const work = attempt();
    this.retryWork = work;
    void work.finally(() => {
      if (this.retryWork === work) this.retryWork = null;
    });
    return work;
  }
}
