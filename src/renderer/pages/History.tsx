import { useState } from "react";
import {
  Clock3,
  Download,
  ChevronDown,
  ChevronUp,
  Activity,
} from "lucide-react";
import { useApp } from "../context";
import {
  Empty,
  GameIcon,
  MetricGrid,
  PageHeading,
  PingChart,
  SessionEvidence,
  date,
  number,
  stateName,
} from "../components/UI";
export function History() {
  const { runtime, act, notify } = useApp();
  const [expanded, setExpanded] = useState<string | null>(null);
  const sessions = runtime?.store.sessions ?? [];
  async function download(format: "json" | "csv") {
    const path = await act(() => window.routepilot.exportSessions(format));
    if (path) notify(`Histórico exportado para ${path}`);
  }
  return (
    <>
      <PageHeading
        eyebrow="CADA MEDIÇÃO, GUARDADA"
        title="Histórico de diagnósticos"
        subtitle="Revê os resultados e acompanha a estabilidade das tuas ligações."
        action={
          <div className="heading-actions">
            <button
              className="button"
              disabled={!sessions.length}
              onClick={() => void download("csv")}
            >
              <Download size={16} />
              CSV
            </button>
            <button
              className="button"
              disabled={!sessions.length}
              onClick={() => void download("json")}
            >
              <Download size={16} />
              JSON completo
            </button>
          </div>
        }
      />
      <div className="history-summary">
        <div>
          <Clock3 size={20} />
          <strong>{sessions.length}</strong>
          <span>sessões guardadas</span>
        </div>
        <div>
          <Activity size={20} />
          <strong>{sessions.reduce((n, s) => n + s.metrics.sent, 0)}</strong>
          <span>sondas enviadas</span>
        </div>
        <p>Até 200 sessões / 16 MiB · apenas neste computador</p>
      </div>
      {!sessions.length ? (
        <section className="panel">
          <Empty
            title="Ainda não há histórias para contar"
            text="Os diagnósticos concluídos, cancelados e com falhas ficam guardados aqui."
            icon={<Clock3 size={30} />}
          />
        </section>
      ) : (
        <section className="panel history-panel">
          <div className="history-table-head">
            <span>Aplicação / destino</span>
            <span>Data</span>
            <span>Ping médio</span>
            <span>Sem resposta</span>
            <span>Estado</span>
            <span />
          </div>
          {sessions.map((session) => (
            <div className="history-item" key={session.id}>
              <button
                className="history-row"
                aria-expanded={expanded === session.id}
                onClick={() =>
                  setExpanded(expanded === session.id ? null : session.id)
                }
              >
                <div className="history-game">
                  <GameIcon
                    game={
                      runtime?.store.games.find(
                        (g) => g.id === session.gameId,
                      ) ?? { name: "Aplicação removida" }
                    }
                  />
                  <div>
                    <strong>
                      {runtime?.store.games.find((g) => g.id === session.gameId)
                        ?.name ?? "Aplicação removida"}
                    </strong>
                    <span>
                      {session.target.label} · {session.target.host}
                    </span>
                  </div>
                </div>
                <span>{date(session.startedAt)}</span>
                <strong className="mint">
                  {number(session.metrics.meanMs)}
                  {session.metrics.meanMs !== null ? " ms" : ""}
                </strong>
                <span>
                  {number(session.metrics.noReplyPercent)}
                  {session.metrics.noReplyPercent !== null ? "%" : ""}
                </span>
                <span
                  className={
                    "status-tag " + (session.state === "failed" ? "failed" : "")
                  }
                >
                  {stateName(session.state)}
                </span>
                {expanded === session.id ? (
                  <ChevronUp size={17} />
                ) : (
                  <ChevronDown size={17} />
                )}
              </button>
              {expanded === session.id && (
                <div className="history-expanded">
                  <MetricGrid metrics={session.metrics} />
                  <PingChart samples={session.samples} />
                  <SessionEvidence session={session} />
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
