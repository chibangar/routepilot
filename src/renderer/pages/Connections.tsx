import {
  ArrowRight,
  ArrowUpDown,
  Plus,
  Rocket,
  Search,
  Zap,
  FolderSearch,
  Pencil,
  Sparkles,
} from "lucide-react";
import { useState, useCallback } from "react";
import { GameDiscovery } from "../components/GameDiscovery";
import { useApp } from "../context";
import { GameIcon } from "../components/UI";

export function Connections() {
  const [discovering, setDiscovering] = useState(false);
  const closeDiscovery = useCallback(() => setDiscovering(false), []);
  const { runtime, active, search, setSearch, edit, navigate, toggleGame, autoDetect } =
    useApp();

  const games = (runtime?.store.games ?? []).filter((g) =>
    g.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );

  return (
    <div className="connections-page">
      {/* Page Title */}
      <div className="page-simple-header">
        <h1>Conexões</h1>
      </div>

      {/* Hero Red Banner: "Pronto para otimizar?..." */}
      <div className="optimize-cta-banner">
        <div className="banner-left">
          <div className="rocket-circle">
            <Rocket size={20} />
          </div>
          <div>
            <h3>Pronto para otimizar?</h3>
            <p>Adicione um jogo ou aplicativo e garanta a melhor rota de conexão.</p>
          </div>
        </div>
        <div className="banner-actions">
          <button
            className="button secondary compact auto-detect-btn"
            onClick={() => setDiscovering(true)}
            title="Detetar jogos instalados no PC"
          >
            <FolderSearch size={15} />
            Detetar jogos instalados
          </button>
          <button
            className="button secondary compact auto-detect-btn"
            onClick={() => void autoDetect()}
            title="Deteção rápida com melhores rotas"
          >
            <Zap size={15} />
            Auto-otimizar
          </button>
          <button className="button primary compact" onClick={() => edit()}>
            <Plus size={16} /> Adicionar
          </button>
        </div>
      </div>

      {/* Main Content: Game Grid or Empty State */}
      {games.length > 0 ? (
        <div className="connections-grid-wrapper">
          <div className="connections-toolbar">
            <span className="count-label">
              Total configurado: <strong>{games.length}</strong>
            </span>
            <div className="search-pill">
              <Search size={15} />
              <input
                placeholder="Procurar aplicações"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="connections-cards-grid">
            {games.map((game) => {
              const isEnabled = game.enabled !== false;
              const target =
                game.targets.find((t) => t.id === game.selectedTargetId) ??
                game.targets[0];
              const isRunning = active?.gameId === game.id;

              return (
                <div
                  key={game.id}
                  className={"connection-full-card " + (isRunning ? "is-running" : "")}
                  onClick={() => navigate("details", game.id)}
                >
                  <div className="card-top-row">
                    <GameIcon large game={game} />
                    <div className="card-top-actions">
                      <div
                        className={"card-switch " + (isEnabled ? "on" : "off")}
                        onClick={(e) => {
                          e.stopPropagation();
                          void toggleGame(game.id, !isEnabled);
                        }}
                        title={isEnabled ? "Otimização ligada" : "Otimização desligada"}
                      >
                        <div className="knob" />
                      </div>
                      <button
                        className="card-edit-btn"
                        title="Configurar jogo"
                        onClick={(e) => {
                          e.stopPropagation();
                          edit(game);
                        }}
                      >
                        <Pencil size={15} />
                      </button>
                    </div>
                  </div>

                  <div className="card-body-info">
                    <h3>{game.name}</h3>
                    <span className="card-server-name">
                      {target?.label ?? "Seleção Automática"}
                    </span>
                  </div>

                  <div className="card-bottom-row">
                    <div className="card-route-badge">
                      <span className="badge-dot" />
                      <span>{game.mode === "automatic" ? "Automático" : "Manual"}</span>
                    </div>

                    <button
                      className="button card-open-btn"
                      aria-label="Abrir ligação"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate("details", game.id);
                      }}
                    >
                      <span>Abrir ligação</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Add connection tile */}
            <div className="add-connection-card" onClick={() => edit()}>
              <div className="add-card-circle">
                <Plus size={24} />
              </div>
              <strong>Adicionar jogo</strong>
              <span>Configurar rota otimizada</span>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State matching Image 1 */
        <div className="empty-connections-state">
          <div className="empty-arrows-circle">
            <ArrowUpDown size={28} />
          </div>
          <h3>Nenhum app configurado</h3>
          <p>
            Adicione um app para configurar uma rota otimizada, melhorando a estabilidade e o ping.
          </p>
          <div className="empty-quick-setup">
            <span>Precisas de ajuda? Usa a </span>
            <button
              className="quick-setup-link"
              onClick={() => void autoDetect()}
            >
              Configuração rápida
            </button>
          </div>
        </div>
      )}

      {discovering && <GameDiscovery onClose={closeDiscovery} />}
    </div>
  );
}
