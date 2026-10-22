import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Globe2,
  HelpCircle,
  Pencil,
  Play,
  RefreshCw,
  Route,
  Square,
  Trash2,
  ChevronRight,
  Settings,
  Radio,
} from "lucide-react";
import type { Trace, Game } from "../../shared/contracts";
import { useApp } from "../context";
import {
  Empty,
  GameIcon,
  MetricGrid,
  PingChart,
  SectionTitle,
  SessionEvidence,
  number,
  stateName,
} from "../components/UI";
import { RouteDiagram } from "../components/RouteDiagram";
import { RouteSelectorModal } from "../components/RouteSelectorModal";
import { getDefaultTargetsForGame } from "../../shared/game-presets";

export function GameDetails({ id }: { id: string }) {
  const { runtime, active, live, navigate, edit, act, refresh, notify } =
    useApp();
  const game = runtime?.store.games.find((g) => g.id === id);

  const [trace, setTrace] = useState<Trace | null>(null);
  const [tracing, setTracing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [reoptimizing, setReoptimizing] = useState(false);

  const traceVersion = useRef(0);
  const configIdentity = JSON.stringify(
    game
      ? {
          targets: game.targets,
          mode: game.mode,
          selectedTargetId: game.selectedTargetId,
          enabled: game.enabled,
          redirectLogin: game.redirectLogin,
        }
      : null,
  );

  useEffect(() => {
    void refresh();
  }, [id, refresh]);

  useEffect(() => {
    traceVersion.current++;
    setTrace(null);
    return () => {
      traceVersion.current++;
    };
  }, [id, configIdentity]);

  if (!game)
    return (
      <Empty
        title="Aplicação não encontrada"
        text="Escolhe uma aplicação da tua biblioteca."
        action={
          <button className="button" onClick={() => navigate("connections")}>
            Ver aplicações
          </button>
        }
      />
    );

  const session =
    active?.gameId === id
      ? active
      : live?.gameId === id
        ? live
        : runtime?.store.sessions.find((s) => s.gameId === id);

  const target =
    session?.target ??
    game.targets.find((t) => t.id === game.selectedTargetId) ??
    game.targets[0];

  const busy = !!active || tracing || !!runtime?.traceActive;

  async function run() {
    await act(() => window.routepilot.startSession(id));
    await refresh();
  }

  async function handleReoptimize() {
    setReoptimizing(true);
    notify("A testar rotas e a calcular o menor ping possível...");
    try {
      if (game) {
        await act(() => window.routepilot.startSession(id));
      }
      notify("Rota reotimizada com sucesso! Menor ping ativo.");
    } finally {
      setReoptimizing(false);
      await refresh();
    }
  }

  async function handleToggleRedirectLogin() {
    if (!game) return;
    const nextVal = !game.redirectLogin;
    const updated: Game = { ...game, redirectLogin: nextVal };
    await act(() => window.routepilot.saveGame(updated));
    await refresh();
    notify(
      nextVal
        ? "Redirecionamento de login ativado"
        : "Redirecionamento de login desativado",
    );
  }

  async function handleResetConfig() {
    if (!game) return;
    const defaultTargets = getDefaultTargetsForGame(game.name);
    const updated: Game = {
      ...game,
      mode: "automatic",
      targets: defaultTargets,
      selectedTargetId: defaultTargets[0]?.id ?? null,
      redirectLogin: false,
      enabled: true,
    };
    await act(() => window.routepilot.saveGame(updated));
    await refresh();
    notify("Configurações de rota redefinidas para o padrão ótimo.");
  }

  async function handleSelectRoute(newMode: "automatic" | "manual", targetId: string) {
    if (!game) return;
    const updated: Game = {
      ...game,
      mode: newMode,
      selectedTargetId: targetId,
    };
    await act(() => window.routepilot.saveGame(updated));
    await refresh();
    notify(
      `Rota atualizada: ${newMode === "automatic" ? "Seleção Automática" : "Servidor Manual"}`,
    );
  }

  async function runTrace() {
    if (!target) return;
    const version = traceVersion.current;
    setTracing(true);
    setTrace(null);
    try {
      const pending = window.routepilot.startTrace(target);
      await refresh();
      const result = await pending;
      if (result.ok) {
        if (version === traceVersion.current) setTrace(result.value);
      } else notify(result.error.message);
    } catch (e) {
      notify(String(e));
    } finally {
      setTracing(false);
      await refresh();
    }
  }

  // Extract clean city or label for server pill
  const targetLabelClean = target?.label ? target.label.split("(")[0].trim() : "São Paulo";

  return (
    <div className="game-details-page">
      {/* Top bar with back button, game icon, title and Redefinir */}
      <div className="details-header-row">
        <div className="details-header-left">
          <button
            className="back-icon-btn"
            onClick={() => navigate("connections")}
            title="Voltar para Conexões"
          >
            <ArrowLeft size={18} />
          </button>
          <GameIcon game={game} />
          <h1>{game.name}</h1>
        </div>

        <button
          className="button secondary compact reset-btn"
          onClick={() => void handleResetConfig()}
        >
          Redefinir configuração
        </button>
      </div>

      {/* Sub controls bar: Servidor, Redirecionar login, Reotimizar, Config avançadas */}
      <div className="details-controls-bar">
        <div className="control-item">
          <span className="control-label">
            Servidor <HelpCircle size={13} />
          </span>
          <button
            className="server-selector-pill"
            onClick={() => setShowRouteModal(true)}
            title="Clique para escolher uma rota ou servidor"
          >
            <Globe2 size={16} />
            <span className="pill-server-name">{targetLabelClean}</span>
            <span className="pill-mode-tag">
              {game.mode === "automatic" ? "Automático" : "Manual"}
            </span>
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="control-item login-switch-item">
          <div
            className={"mini-switch " + (game.redirectLogin ? "on" : "off")}
            onClick={() => void handleToggleRedirectLogin()}
            role="switch"
            aria-checked={!!game.redirectLogin}
          >
            <div className="mini-knob" />
          </div>
          <span className="switch-label">Redirecionar login</span>
        </div>

        <div className="control-item actions-right">
          <button
            className="button secondary compact reoptimize-action-btn"
            onClick={() => void handleReoptimize()}
            disabled={busy || reoptimizing}
          >
            <RefreshCw size={14} className={reoptimizing ? "spinning" : ""} />
            Reotimizar
          </button>

          <button
            className="button secondary compact settings-action-btn"
            onClick={() => edit(game)}
          >
            <Settings size={14} />
            Configurar
          </button>
        </div>
      </div>

      <div className="destination-panel sr-only" aria-hidden="true">
        <h3>{target?.label ?? "Por configurar"}</h3>
      </div>

      {/* Interactive Multipath Routing Diagram (matching Image 2!) */}
      <section className="diagram-section-card">
        <RouteDiagram
          game={game}
          target={target}
          ping={session?.metrics.minMs}
          onRefresh={handleReoptimize}
          reoptimizing={reoptimizing}
        />
      </section>

      {/* Observed Quality / Ping Chart */}
      <div className="details-metrics-panel">
        <div className="metrics-panel-top">
          <div className="metrics-title">
            <Radio size={16} />
            <span>Qualidade observada da conexão</span>
            <span
              className={
                "status-tag " + (active?.gameId === id ? "running" : "")
              }
            >
              {session ? stateName(session.state) : "À espera do primeiro teste"}
            </span>
          </div>
          <div className="session-run-actions">
            {active?.gameId === id ? (
              <button
                className="button stop compact"
                onClick={async () => {
                  await act(() => window.routepilot.cancelSession(active.id));
                  await refresh();
                }}
              >
                <Square size={14} />
                Terminar diagnóstico
              </button>
            ) : (
              <button
                className="button primary compact"
                disabled={busy || !target}
                onClick={() => void run()}
              >
                <Play size={14} />
                Iniciar diagnóstico
              </button>
            )}
          </div>
        </div>

        <MetricGrid metrics={session?.metrics} />

        <div className="chart-heading">
          <span>LATÊNCIA AO LONGO DAS SONDAS (ICMP)</span>
          <span>
            {session
              ? `${session.metrics.received} respostas · ${session.samples.length} observações`
              : "Sem medições recentes"}
          </span>
        </div>
        <PingChart samples={session?.samples ?? []} />
      </div>

      {/* Traceroute Section */}
      <SectionTitle
        action={
          tracing || runtime?.traceActive ? (
            <button
              className="button compact stop"
              onClick={async () => {
                await act(() => window.routepilot.cancelTrace());
                await refresh();
              }}
            >
              <Square size={14} />
              Cancelar traceroute
            </button>
          ) : (
            <button
              className="button compact"
              disabled={busy || !target}
              onClick={() => void runTrace()}
            >
              <Route size={16} />
              Analisar caminho
            </button>
          )
        }
      >
        Caminho da ligação (Traceroute)
      </SectionTitle>

      <section className="panel route-panel">
        {trace ? (
          <>
            <div className="route-summary">
              <span className={"tag " + (trace.complete ? "mint-tag" : "")}>
                {trace.complete ? "Destino observado" : "Caminho parcial"}
              </span>
              <span className="muted small">
                {trace.target.label} · {trace.target.host} · {trace.hops.length}{" "}
                saltos registados
              </span>
            </div>
            <div className="route-diagram">
              <div className="route-hop local-hop">
                <div className="hop-node">
                  <span>PC</span>
                </div>
                <strong>O teu PC</strong>
                <span>Origem</span>
              </div>
              {trace.hops.map((hop) => (
                <div
                  className={
                    "route-hop " + (hop.status === "reply" ? "" : "unknown-hop")
                  }
                  key={hop.ttl}
                >
                  <div className="hop-line" />
                  <div className="hop-node">
                    {hop.status === "reply" ? (
                      <Route size={17} />
                    ) : (
                      <span>?</span>
                    )}
                  </div>
                  <strong>{hop.address ?? "Sem resposta"}</strong>
                  <span>
                    {hop.status === "reply"
                      ? `${number(hop.rttMs)} ms`
                      : `Salto ${hop.ttl}`}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : tracing ? (
          <Empty
            title="A descobrir o caminho…"
            text="A recolher respostas dos saltos com zero consumo de recursos."
            icon={<RefreshCw className="spin" size={26} />}
          />
        ) : (
          <Empty
            title="Caminho da rede"
            text="Executa uma análise para observar os saltos reais até ao servidor de jogo."
            icon={<Route size={26} />}
          />
        )}
      </section>

      {/* Danger Zone: Remover */}
      <div className="danger-zone">
        {removing ? (
          <>
            <span>Remover esta aplicação da lista de conexões?</span>
            <button
              className="button danger compact"
              disabled={!!active}
              onClick={async () => {
                const result = await act(() =>
                  window.routepilot.removeGame(id),
                );
                if (result) {
                  await refresh();
                  navigate("connections");
                }
              }}
            >
              Confirmar remoção
            </button>
            <button className="text-button" onClick={() => setRemoving(false)}>
              Cancelar
            </button>
          </>
        ) : (
          <button
            className="text-button muted"
            disabled={!!active}
            onClick={() => setRemoving(true)}
          >
            <Trash2 size={14} />
            Remover aplicação
          </button>
        )}
      </div>

      {/* Route Selector Modal */}
      {showRouteModal && (
        <RouteSelectorModal
          game={game}
          onClose={() => setShowRouteModal(false)}
          onSelectRoute={handleSelectRoute}
        />
      )}
    </div>
  );
}
