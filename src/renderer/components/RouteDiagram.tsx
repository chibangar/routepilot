import { User, CheckCircle2, RefreshCw } from "lucide-react";
import type { Game, Target } from "../../shared/contracts";
import { computeMultipathDiagram } from "../../shared/game-presets";
import { GameIcon } from "./UI";

export function RouteDiagram({
  game,
  target,
  ping,
  onRefresh,
  reoptimizing = false,
}: {
  game: Game;
  target?: Target;
  ping?: number | null;
  onRefresh?: () => void;
  reoptimizing?: boolean;
}) {
  const diagram = computeMultipathDiagram(game, target, ping);

  return (
    <div className="diagram-container">
      <div className="diagram-header">
        <div className="diagram-title">
          <span>Diagrama de rota do jogo</span>
          <span className="diagram-badge">
            <CheckCircle2 size={13} />
            {ping ? "Ping medido" : "Estimativa"}
          </span>
        </div>
        {onRefresh && (
          <button
            className={"icon-btn " + (reoptimizing ? "spinning" : "")}
            title="Reotimizar e recalcular rotas"
            onClick={onRefresh}
            disabled={reoptimizing}
          >
            <RefreshCw size={15} />
          </button>
        )}
      </div>

      <div className="diagram-canvas">
        {/* User Origin Node */}
        <div className="origin-node">
          <div className="user-avatar-ring">
            <User size={22} />
          </div>
          <span className="origin-title">{diagram.origin.location}</span>
          <span className="origin-subtitle">Origem</span>
        </div>

        {/* Tree lines and parallel routing hops */}
        <div className="multipath-branches">
          {diagram.hops.map((hop, idx) => (
            <div
              key={hop.id}
              className={"path-branch " + (hop.active ? "branch-active" : "branch-inactive")}
            >
              {/* Connector line from origin */}
              <div className="branch-line line-in">
                {hop.active && <div className="packet-pulse" />}
              </div>

              {/* Tag Hop Before */}
              <div className="hop-pill-tag">Automático</div>

              {/* Hop Middle Box */}
              <div className="hop-box">
                <div className="hop-box-top">
                  <strong>Automático</strong>
                  <span className="hop-sub">Sa</span>
                </div>
                <div className="hop-box-bottom">
                  <span>Automático</span>
                  <span className="hop-ms">{hop.pingMs} ms</span>
                </div>
              </div>

              {/* Tag Hop After */}
              <div className="hop-pill-tag">Automático</div>

              {/* Connector line to destination */}
              <div className="branch-line line-out">
                {hop.active && <div className="packet-pulse delay" />}
              </div>
            </div>
          ))}
        </div>

        {/* Destination Node */}
        <div className="destination-node">
          <div className="dest-box">
            <div className="dest-box-top">
              <strong>{diagram.destination.label}</strong>
              <span className="dest-sub">{diagram.destination.region}</span>
            </div>
            <div className="dest-box-bottom">
              <span>Destino</span>
              <span className="dest-eq">=</span>
            </div>
          </div>
        </div>

        {/* Line to Game Node */}
        <div className="final-connector">
          <div className="packet-pulse" />
        </div>

        {/* Game Final Endpoint Node */}
        <div className="game-endpoint-node">
          <div className="game-icon-box">
            <GameIcon game={game} large />
          </div>
          <span className="game-endpoint-title">{game.name}</span>
        </div>
      </div>

      <div className="diagram-footer-note">
        <span className="active-dot" />
        <span>
          {ping
            ? <>Menor ping medido até <strong>{diagram.destination.label}</strong>: {diagram.destination.bestPingMs} ms.</>
            : <>Valores estimados — inicia um diagnóstico para medir o ping real até <strong>{diagram.destination.label}</strong>.</>}
          {" "}O tráfego do jogo não é encaminhado por estes nós.
        </span>
      </div>
    </div>
  );
}
