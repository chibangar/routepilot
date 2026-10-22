import { useState, useMemo } from "react";
import {
  ArrowLeft,
  Search,
  ChevronRight,
  ChevronDown,
  HelpCircle,
  Zap,
  Globe2,
  CheckCircle2,
  Radio,
} from "lucide-react";
import type { Game, Target } from "../../shared/contracts";
import {
  findPresetForName,
  type RegionKey,
} from "../../shared/game-presets";
import { GameIcon } from "./UI";

export function RouteSelectorModal({
  game,
  onClose,
  onSelectRoute,
}: {
  game: Game;
  onClose: () => void;
  onSelectRoute: (mode: "automatic" | "manual", targetId: string) => void;
}) {
  const preset = findPresetForName(game.name);
  const [mode, setMode] = useState<"automatic" | "manual">(game.mode);
  const [selectedTargetId, setSelectedTargetId] = useState<string>(
    game.selectedTargetId ?? game.targets[0]?.id ?? "",
  );
  const [search, setSearch] = useState("");
  const [expandedRegion, setExpandedRegion] = useState<string>("América do Sul");
  const [faqOpen, setFaqOpen] = useState<{ [key: string]: boolean }>({
    auto: true,
    manual: false,
  });

  // Group servers by region
  const regions = useMemo(() => {
    if (preset) {
      return preset.regions.map((r) => ({
        name: r.region,
        servers: r.servers.map((s) => ({
          id: s.id,
          label: s.label,
          city: s.city,
          host: s.host,
          pingMs: s.basePing,
        })),
      }));
    }
    // Fallback regions from game targets
    return [
      {
        name: "América do Sul" as RegionKey,
        servers: game.targets
          .filter((t) => t.label.includes("São Paulo") || t.label.includes("BR") || t.label.includes("SA"))
          .map((t) => ({ id: t.id, label: t.label, city: "São Paulo", host: t.host, pingMs: 14 })),
      },
      {
        name: "Europa" as RegionKey,
        servers: game.targets
          .filter((t) => t.label.includes("Frankfurt") || t.label.includes("Madrid") || t.label.includes("EU"))
          .map((t) => ({ id: t.id, label: t.label, city: "Frankfurt", host: t.host, pingMs: 34 })),
      },
      {
        name: "América do Norte" as RegionKey,
        servers: game.targets
          .filter((t) => t.label.includes("Virgínia") || t.label.includes("US") || t.label.includes("NA"))
          .map((t) => ({ id: t.id, label: t.label, city: "Virgínia", host: t.host, pingMs: 110 })),
      },
    ].filter((r) => r.servers.length > 0);
  }, [preset, game.targets]);

  const filteredRegions = useMemo(() => {
    if (!search.trim()) return regions;
    const term = search.toLowerCase();
    return regions
      .map((r) => ({
        ...r,
        servers: r.servers.filter(
          (s) =>
            s.label.toLowerCase().includes(term) ||
            s.city.toLowerCase().includes(term) ||
            r.name.toLowerCase().includes(term),
        ),
      }))
      .filter((r) => r.servers.length > 0);
  }, [regions, search]);

  const handleApply = () => {
    onSelectRoute(mode, selectedTargetId);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="route-selector-modal" onClick={(e) => e.stopPropagation()}>
        {/* Top Header */}
        <div className="route-modal-header">
          <button className="back-link" onClick={onClose}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <GameIcon game={game} />
            <h2>Selecione uma rota para {game.name}</h2>
          </div>
        </div>

        {/* Modal Body 3 Columns */}
        <div className="route-modal-body">
          {/* Left Column: Mode Selection */}
          <div className="route-mode-col">
            <div
              className={"route-mode-card " + (mode === "automatic" ? "selected" : "")}
              onClick={() => setMode("automatic")}
            >
              <div className="mode-card-header">
                <span className="mode-radio">
                  <i />
                </span>
                <strong>Seleção automática de servidor</strong>
              </div>
              <p>
                Escolha a região onde você vai jogar e nós encontraremos o nosso servidor mais próximo.
              </p>
              {mode === "automatic" && (
                <div className="mode-badge">
                  <Zap size={13} /> Recomendado para menor ping
                </div>
              )}
            </div>

            <div
              className={"route-mode-card " + (mode === "manual" ? "selected" : "")}
              onClick={() => setMode("manual")}
            >
              <div className="mode-card-header">
                <span className="mode-radio">
                  <i />
                </span>
                <strong>Seleção manual de servidor</strong>
              </div>
              <p>
                Selecione um dos nossos servidores em que você vai jogar.
              </p>
            </div>
          </div>

          {/* Center Column: Regions & Servers List */}
          <div className="route-regions-col">
            <div className="region-search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Pesquisar por uma região personalizada"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="region-list-header">REGIÕES PERSONALIZADAS</div>

            <div className="regions-accordion">
              {filteredRegions.map((r) => {
                const isOpen = expandedRegion === r.name || search.trim().length > 0;
                return (
                  <div key={r.name} className="region-group">
                    <button
                      className="region-group-header"
                      onClick={() =>
                        setExpandedRegion(expandedRegion === r.name ? "" : r.name)
                      }
                    >
                      <span>{r.name}</span>
                      <div className="region-header-meta">
                        <span className="server-count">{r.servers.length} servidores</span>
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>
                    </button>

                    {isOpen && (
                      <div className="server-sublist">
                        {r.servers.map((s) => {
                          const isSelected = selectedTargetId === s.id;
                          return (
                            <div
                              key={s.id}
                              className={"server-item " + (isSelected ? "server-selected" : "")}
                              onClick={() => setSelectedTargetId(s.id)}
                            >
                              <div className="server-item-left">
                                <span className="server-radio">
                                  {isSelected && <i />}
                                </span>
                                <div>
                                  <strong>{s.label}</strong>
                                  <span className="server-host">{s.city} · {s.host}</span>
                                </div>
                              </div>
                              <div className="server-item-right">
                                <span className={"ping-pill " + (s.pingMs < 30 ? "fast" : s.pingMs < 80 ? "medium" : "normal")}>
                                  {s.pingMs} ms
                                </span>
                                {s.pingMs <= 15 && (
                                  <span className="best-tag">Mais Rápido</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: FAQ Accordion */}
          <div className="route-faq-col">
            <div className="faq-card">
              <div className="faq-card-header">
                <HelpCircle size={17} />
                <span>Qual é a diferença?</span>
              </div>

              <div className="faq-item">
                <button
                  className="faq-toggle"
                  onClick={() => setFaqOpen((prev) => ({ ...prev, auto: !prev.auto }))}
                >
                  <span>Automático</span>
                  {faqOpen.auto ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {faqOpen.auto && (
                  <p>
                    A rota automática calcula continuamente o menor ping e menor perda de pacotes entre o seu computador e os servidores do jogo, alternando relays sem interrupções.
                  </p>
                )}
              </div>

              <div className="faq-item">
                <button
                  className="faq-toggle"
                  onClick={() => setFaqOpen((prev) => ({ ...prev, manual: !prev.manual }))}
                >
                  <span>Manual</span>
                  {faqOpen.manual ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                {faqOpen.manual && (
                  <p>
                    Permite fixar um servidor específico caso pretenda jogar em campeonatos de outras regiões ou com amigos em servidores internacionais.
                  </p>
                )}
              </div>

              <div className="faq-footer">
                <a href="#faq" onClick={(e) => e.preventDefault()}>
                  Saiba mais FAQ.
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Bottom Actions */}
        <div className="route-modal-footer">
          <button className="text-button" onClick={onClose}>
            Cancelar
          </button>
          <button className="button primary apply-btn" onClick={handleApply}>
            <CheckCircle2 size={16} />
            Aplicar Rota
          </button>
        </div>
      </div>
    </div>
  );
}
