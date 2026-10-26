import { ChevronRight, Plus, X, Zap } from "lucide-react";
import { useApp } from "../context";
import { GameIcon } from "../components/UI";
import { PingBreakdownPanel } from "../components/PingBreakdown";
import type { Game } from "../../shared/contracts";

export function Home() {
  const { runtime, active, navigate, edit, act, refresh, notify, toggleGame, autoDetect } =
    useApp();
  const games = runtime?.store.games ?? [];

  const removeTile = async (game: Game) => {
    if (!window.confirm(`Remover ${game.name} das conexões?`)) return;
    if (await act(() => window.routepilot.removeGame(game.id))) {
      await refresh();
      notify(`${game.name} foi removido.`);
    }
  };

  return (
    <div className="home-page">
      <PingBreakdownPanel busy={!!active || !!runtime?.traceActive} hero />

      {/* SECTION: CONEXÕES */}
      <section className="dashboard-section">
        <div className="section-header-row">
          <h2>Os teus jogos</h2>
          <button
            className="section-link"
            onClick={() => navigate("connections")}
          >
            Ver todos <ChevronRight size={16} />
          </button>
        </div>

        <div className="connections-carousel-bar">
          {games.slice(0, 5).map((game) => {
            const isEnabled = game.enabled !== false;
            return (
              <div
                key={game.id}
                className={"connection-tile " + (isEnabled ? "tile-enabled" : "tile-disabled")}
                onClick={() => navigate("details", game.id)}
              >
                <button
                  className="tile-close-btn"
                  title="Remover ligação"
                  aria-label={`Remover ${game.name}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    void removeTile(game);
                  }}
                >
                  <X size={13} />
                </button>

                <div className="tile-content">
                  <GameIcon game={game} />
                  <div className="tile-text">
                    <strong>{game.name}</strong>
                    <span>
                      {game.mode === "automatic" ? "Automático" : "Manual"}
                    </span>
                  </div>
                </div>

                <div
                  className={"tile-switch " + (isEnabled ? "switch-on" : "switch-off")}
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleGame(game.id, !isEnabled);
                  }}
                  title={isEnabled ? "Desativar rota" : "Ativar rota"}
                >
                  <div className="switch-knob" />
                </div>
              </div>
            );
          })}

          <button
            className="add-connection-tile"
            aria-label="Adicionar aplicação"
            onClick={() => edit()}
            title="Adicionar nova aplicação"
          >
            <Plus size={20} />
          </button>

          {games.length < 3 && (
            <button
              className="quick-detect-tile"
              onClick={() => void autoDetect()}
              title="Detetar jogos instalados no PC"
            >
              <Zap size={16} />
              <span>Detetar jogos</span>
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
