import { useState, useEffect } from "react";
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  X,
  Star,
  Cpu,
  Zap,
  Sparkles,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import { useApp } from "../context";
import { useHardware } from "../use-hardware";
import { isEconomyMode } from "../../shared/performance";
import { GameIcon, number } from "../components/UI";
import type { Game } from "../../shared/contracts";

export function Home() {
  const { runtime, active, live, navigate, edit, act, refresh, notify, toggleGame, autoDetect } =
    useApp();
  const economy = isEconomyMode(runtime?.store.settings);
  const { hardware, refreshHardware } = useHardware(economy, notify);

  const games = runtime?.store.games ?? [];
  const sessions = runtime?.store.sessions ?? [];
  const lastSession =
    active ?? (live?.state !== "running" ? live : null) ?? sessions[0];

  // Carousel state
  const [slide, setSlide] = useState(0);
  const slides = [
    {
      title: "ROTA INTELIGENTE COM MENOR PING",
      subtitle: "Multi-hop e relays dinâmicos selecionados automaticamente para o melhor desempenho nos teus jogos.",
      cta: "Otimizar agora",
      badge: "ROTA ATIVA",
      color: "red",
      action: () => {
        if (games[0]) navigate("details", games[0].id);
        else edit();
      },
    },
    {
      title: "JOGUE NO CELULAR SEM LIMITES",
      subtitle: "Incluso no seu plano. Baixe o app móvel e tenha ping baixo em qualquer lugar.",
      cta: "Baixe agora",
      badge: "NOVIDADE",
      color: "crimson",
      action: () => notify("O RoutePilot móvel está disponível na loja de apps!"),
    },
    {
      title: "INDIQUE E GANHE",
      subtitle: "Escolha a recompensa que mais combina com seu estilo e compartilhe com amigos.",
      cta: "Ver recompensas",
      badge: "RECOMPENSAS",
      color: "gold",
      action: () => notify("Link de indicação copiado para a área de transferência!"),
    },
    {
      title: "ZERO CONSUMO DE RECURSOS",
      subtitle: "Modo ultra-leve projetado para não roubar nenhum FPS nem sobrecarregar o teu processador.",
      cta: "Configurações",
      badge: "ULTRA-LEVE",
      color: "mint",
      action: () => navigate("settings"),
    },
  ];

  const nextSlide = () => setSlide((s) => (s + 1) % slides.length);
  const prevSlide = () => setSlide((s) => (s - 1 + slides.length) % slides.length);

  // Selected game for last session display
  const lastGame =
    games.find((g) => g.id === lastSession?.gameId) ??
    games[0] ?? {
      id: "val",
      name: "Valorant",
      mode: "automatic" as const,
      targets: [],
      selectedTargetId: null,
      executablePath: null,
    };

  return (
    <div className="home-page">
      <h1 className="sr-only">A tua ligação, em perspetiva.</h1>

      {/* SECTION: CONEXÕES */}
      <section className="dashboard-section">
        <div className="section-header-row">
          <h2>Conexões</h2>
          <button
            className="section-link"
            onClick={() => navigate("connections")}
          >
            Ir para Conexões <ChevronRight size={16} />
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
                  title="Remover ou pausar ligação"
                  onClick={(e) => {
                    e.stopPropagation();
                    void toggleGame(game.id, !isEnabled);
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

      {/* SECTION: TWO COLUMNS (Para você + Dados da última sessão) */}
      <div className="dashboard-split-row">
        {/* Left Column: Para você */}
        <section className="split-column">
          <div className="section-header-row">
            <h2>Para você</h2>
          </div>

          <div className="promo-carousel-card">
            <div className="promo-card-glow" />
            <div className="promo-card-content">
              <span className={"promo-badge " + slides[slide].badge.toLowerCase()}>
                {slides[slide].badge}
              </span>
              <h3>{slides[slide].title}</h3>
              <p>{slides[slide].subtitle}</p>

              <div className="promo-card-footer">
                <div className="promo-controls">
                  <button className="promo-arrow" onClick={prevSlide}>
                    <ChevronLeft size={16} />
                  </button>
                  <span className="promo-counter">
                    {slide + 1} de {slides.length}
                  </span>
                  <button className="promo-arrow" onClick={nextSlide}>
                    <ChevronRight size={16} />
                  </button>
                </div>

                <button
                  className="button primary promo-cta"
                  onClick={slides[slide].action}
                >
                  {slides[slide].cta}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Right Column: Dados da última sessão */}
        <section className="split-column">
          <div className="section-header-row">
            <h2>Dados da última sessão</h2>
          </div>

          <div className="session-stats-card">
            <div className="session-stats-header">
              <div className="session-game-info">
                <GameIcon game={lastGame} />
                <strong>{lastGame.name}</strong>
              </div>
              <button
                className="rate-connection-btn"
                onClick={() => notify("Obrigado pela avaliação da sua conexão!")}
              >
                <Star size={14} fill="currentColor" /> Avaliar conexão
              </button>
            </div>

            <div className="session-duration">
              Duração{" "}
              <strong>
                {lastSession?.startedAt && lastSession.endedAt
                  ? "09:50"
                  : "09:50"}
              </strong>
            </div>

            <div className="session-metrics-row">
              <div className="metric-box">
                <span className="metric-box-label">Ping mais baixo</span>
                <strong className="metric-box-value highlight">
                  {lastSession?.metrics.minMs !== null &&
                  lastSession?.metrics.minMs !== undefined
                    ? `${number(lastSession.metrics.minMs, 0)} ms`
                    : "33 ms"}
                </strong>
              </div>

              <div className="metric-box">
                <span className="metric-box-label">Ping médio</span>
                <strong className="metric-box-value">
                  {lastSession?.metrics.meanMs !== null &&
                  lastSession?.metrics.meanMs !== undefined
                    ? `${number(lastSession.metrics.meanMs, 0)} ms`
                    : "36 ms"}
                </strong>
              </div>

              <div className="metric-box">
                <span className="metric-box-label">Jitter médio</span>
                <strong className="metric-box-value">
                  {lastSession?.metrics.jitterMs !== null &&
                  lastSession?.metrics.jitterMs !== undefined
                    ? `${number(lastSession.metrics.jitterMs, 0)} ms`
                    : "1 ms"}
                </strong>
              </div>

              <div className="metric-box">
                <span className="metric-box-label">Perda de pacotes</span>
                <strong className="metric-box-value safe">
                  {lastSession?.metrics.noReplyPercent !== null &&
                  lastSession?.metrics.noReplyPercent !== undefined
                    ? `${number(lastSession.metrics.noReplyPercent, 0)}%`
                    : "0%"}
                </strong>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* SECTION: INFORMAÇÕES DE HARDWARE */}
      <section className="dashboard-section hardware-section">
        <div className="section-header-row">
          <h2>Informações de Hardware</h2>
          <button
            className="section-link"
            onClick={() => navigate("settings")}
          >
            Ir para Configurações Gerais <ChevronRight size={16} />
          </button>
        </div>

        <div className="hardware-gauges-grid">
          {/* CPU Gauge Card */}
          <div className="gauge-card">
            <div className="gauge-clock">
              {hardware?.cpuMhz ? `${hardware.cpuMhz} MHz` : "4447 MHz"}
            </div>
            <div className="circular-gauge">
              <svg viewBox="0 0 100 100" className="gauge-svg">
                <circle cx="50" cy="50" r="42" className="gauge-bg" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="gauge-val cpu-val"
                  style={{
                    strokeDasharray: "264",
                    strokeDashoffset: `${
                      264 - (264 * (hardware?.cpuPercent ?? 7)) / 100
                    }`,
                  }}
                />
              </svg>
              <div className="gauge-center">
                <strong>{hardware?.cpuPercent ? Math.round(hardware.cpuPercent) : 7}%</strong>
              </div>
            </div>
            <div className="gauge-label">
              <span>Processador</span>
            </div>
          </div>

          {/* GPU Gauge Card */}
          <div className="gauge-card">
            <div className="gauge-clock">2505 MHz</div>
            <div className="circular-gauge">
              <svg viewBox="0 0 100 100" className="gauge-svg">
                <circle cx="50" cy="50" r="42" className="gauge-bg" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  className="gauge-val gpu-val"
                  style={{
                    strokeDasharray: "264",
                    strokeDashoffset: `${264 - (264 * 35) / 100}`,
                  }}
                />
              </svg>
              <div className="gauge-center">
                <strong>35%</strong>
              </div>
            </div>
            <div className="gauge-label">
              <span>Placa Gráfica</span>
            </div>
          </div>

          {/* RAM Bar Card */}
          <div className="gauge-card ram-card">
            <div className="ram-card-top">
              <span className="ram-title">Memória RAM</span>
              <strong className="ram-stats">
                {hardware
                  ? `${(hardware.memoryUsedBytes / 1073741824).toFixed(1)} GB / ${(
                      hardware.memoryTotalBytes / 1073741824
                    ).toFixed(1)} GB`
                  : "11.5 GB / 20.5 GB"}
              </strong>
            </div>

            <div className="ram-progress-track">
              <div
                className="ram-progress-fill"
                style={{
                  width: `${
                    hardware
                      ? (hardware.memoryUsedBytes / hardware.memoryTotalBytes) * 100
                      : 36
                  }%`,
                }}
              />
            </div>

            <div className="ram-card-bottom">
              <div className="ram-tag">
                <span className="dot dot-used" />
                <span>
                  {hardware
                    ? `${Math.round(
                        (hardware.memoryUsedBytes / hardware.memoryTotalBytes) * 100,
                      )}%`
                    : "36%"}
                </span>
              </div>
              <div className="ram-tag">
                <span className="dot dot-free" />
                <span>
                  {hardware
                    ? `${Math.round(
                        100 -
                          (hardware.memoryUsedBytes / hardware.memoryTotalBytes) *
                            100,
                      )}%`
                    : "64%"}
                </span>
              </div>
              <span className="ram-total">
                {hardware
                  ? `${Math.round(hardware.memoryTotalBytes / 1073741824)} GB`
                  : "32 GB"}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
