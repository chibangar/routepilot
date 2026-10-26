import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Clock3,
  Gauge,
  HelpCircle,
  House,
  Radio,
  Rocket,
  Search,
  Settings,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";
import type { Game, Result, RuntimeState, Session } from "../shared/contracts";
import { AppContext, type Page } from "./context";
import { GameForm } from "./components/GameForm";
import { Home } from "./pages/Home";
import { Connections } from "./pages/Connections";
import { GameDetails } from "./pages/GameDetails";
import { History } from "./pages/History";
import { NetworkPage } from "./pages/Network";
import { PerformancePage } from "./pages/Performance";
import { SettingsPage, Help } from "./pages/Settings";
import { isEconomyMode } from "../shared/performance";
import logo from "./assets/logo.svg";

const items = [
  { page: "home", label: "Início", icon: House },
  { page: "connections", label: "Aplicações", icon: Radio },
  { page: "network", label: "Rede", icon: Gauge },
  { page: "performance", label: "Desempenho", icon: Rocket },
  { page: "history", label: "Histórico", icon: Clock3 },
] as const;

export function App() {
  const [page, setPage] = useState<Page>("home");
  const [gameId, setGameId] = useState("");
  const [runtime, setRuntime] = useState<RuntimeState | null>(null);
  const [active, setActive] = useState<Session | null>(null);
  const [live, setLive] = useState<Session | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<{ game?: Game } | null>(null);
  const [message, setMessage] = useState("");
  const [fatal, setFatal] = useState("");
  const [globalOn, setGlobalOn] = useState(true);

  const notify = useCallback((text: string) => setMessage(text), []);

  const act = useCallback(
    async <T,>(task: () => Promise<Result<T>>): Promise<T | undefined> => {
      try {
        const result = await task();
        if (!result.ok) {
          setMessage(result.error.message);
          return;
        }
        return result.value;
      } catch (e) {
        setMessage(String(e));
      }
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (!window.routepilot) {
      setFatal("Abra a aplicação através do RoutePilot.exe ou de npm start.");
      return;
    }
    try {
      const r = await window.routepilot.getState();
      if (!r.ok) {
        setFatal(r.error.message);
        return;
      }
      setFatal("");
      setRuntime(r.value);
      setActive(r.value.active?.state === "running" ? r.value.active : null);
    } catch (e) {
      setFatal(String(e));
    }
  }, []);

  const toggleGame = useCallback(
    async (id: string, enabled: boolean) => {
      if (!runtime) return;
      const g = runtime.store.games.find((x) => x.id === id);
      if (!g) return;
      const updated: Game = { ...g, enabled };
      await act(() => window.routepilot.saveGame(updated));
      await refresh();
      notify(
        enabled
          ? `${g.name}: Otimização ativada`
          : `${g.name}: Otimização pausada`,
      );
    },
    [runtime, act, refresh, notify],
  );

  const autoDetect = useCallback(async () => {
    notify("A detetar jogos instalados no teu computador...");
    const res = await act(() => window.routepilot.autoDetectGames());
    if (res) {
      await refresh();
      notify(
        res.added > 0
          ? `Foram detetados e adicionados ${res.added} novos jogos.`
          : "Nenhum jogo novo encontrado.",
      );
    }
  }, [act, refresh, notify]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 7000);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    void refresh();
    if (!window.routepilot) return;
    return window.routepilot.onSession((session) => {
      setLive(session);
      setActive(session.state === "running" ? session : null);
      if (session.state !== "running") void refresh();
    });
  }, [refresh]);

  const navigate = useCallback((next: Page, id?: string) => {
    setPage(next);
    if (id) setGameId(id);
    document.querySelector("main")?.scrollTo({ top: 0 });
  }, []);

  const edit = useCallback((game?: Game) => setForm({ game }), []);
  const closeForm = useCallback(() => setForm(null), []);

  const context = {
    runtime,
    active,
    live,
    search,
    setSearch,
    navigate,
    edit,
    refresh,
    notify,
    act,
    globalOn,
    setGlobalOn,
    toggleGame,
    autoDetect,
  };

  return (
    <AppContext.Provider value={context}>
      <div
        className={
          "app-shell " +
          (isEconomyMode(runtime?.store.settings) ? "economy-mode" : "")
        }
      >
        <aside className="sidebar">
          <button
            className="brand"
            aria-label="RoutePilot — Início"
            onClick={() => navigate("home")}
          >
            <img src={logo} alt="" width={36} height={36} />
          </button>
          <div className="sidebar-divider" />
          <nav aria-label="Navegação principal">
            {items.map((item) => (
              <button
                key={item.label}
                aria-label={item.label}
                title={item.label}
                className={
                  "nav-item " +
                  (page === item.page ||
                  (page === "details" && item.page === "connections")
                    ? "selected"
                    : "")
                }
                onClick={() => navigate(item.page)}
              >
                <item.icon size={22} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <button
              className={"nav-item " + (page === "settings" ? "selected" : "")}
              title="Definições"
              aria-label="Definições"
              onClick={() => navigate("settings")}
            >
              <Settings size={22} />
              <span>Definições</span>
            </button>
            <button
              className={"nav-item " + (page === "help" ? "selected" : "")}
              title="Ajuda"
              aria-label="Ajuda"
              onClick={() => navigate("help")}
            >
              <HelpCircle size={22} />
              <span>Ajuda</span>
            </button>
            <div className="avatar" title="Perfil local">
              RP
            </div>
            <small>{runtime?.appVersion ? `v${runtime.appVersion}` : ""}</small>
          </div>
        </aside>

        <div className="workspace">
          <header className="topbar">
            <div className="topbar-left">
              <div
                className={"routepilot-toggle " + (globalOn ? "is-on" : "is-off")}
                onClick={() => setGlobalOn(!globalOn)}
                role="switch"
                aria-checked={globalOn}
                title={
                  globalOn
                    ? "Otimização RoutePilot Ativa"
                    : "Otimização Desativada"
                }
              >
                <div className="toggle-track">
                  <div className="toggle-knob" />
                </div>
                <span className="toggle-label">
                  RoutePilot {globalOn ? "ON" : "OFF"}
                </span>
              </div>
            </div>

            <div className="topbar-right">
              <label className="global-search">
                <Search size={16} />
                <input
                  aria-label="Procurar"
                  placeholder="Procurar"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    if (page !== "connections") navigate("connections");
                  }}
                />
              </label>
              {isEconomyMode(runtime?.store.settings) && (
                <div
                  className="eco-badge"
                  title="Modo económico: atualizações menos frequentes"
                >
                  <Zap size={14} />
                  <span>Modo económico</span>
                </div>
              )}
            </div>
          </header>

          <main>
            {fatal && (
              <div className="fatal-error" role="alert">
                <h3>Não foi possível carregar os dados</h3>
                <p>{fatal}</p>
                <button
                  className="button"
                  onClick={() =>
                    void act(() => window.routepilot.retrySave()).then(() =>
                      refresh(),
                    )
                  }
                >
                  Tentar novamente
                </button>
              </div>
            )}
            <div className="page-enter" key={page === "details" ? `details-${gameId}` : page}>
            {page === "home" ? (
              <Home />
            ) : page === "connections" ? (
              <Connections />
            ) : page === "details" ? (
              <GameDetails id={gameId} />
            ) : page === "network" ? (
              <NetworkPage />
            ) : page === "performance" ? (
              <PerformancePage />
            ) : page === "history" ? (
              <History />
            ) : page === "settings" ? (
              <SettingsPage />
            ) : (
              <Help />
            )}
            </div>
            <footer className="page-footer">
              <span>
                <ShieldCheck size={13} />
                Os teus dados ficam neste computador. Sem telemetria.
              </span>
              <span>RoutePilot · Otimização Inteligente de Rotas</span>
            </footer>
          </main>
        </div>

        {message && (
          <div className="toast" role="status">
            <Activity size={19} />
            <span>{message}</span>
            <button
              aria-label="Fechar mensagem"
              className="icon-button"
              onClick={() => setMessage("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {form && <GameForm game={form.game} onClose={closeForm} />}
      </div>
    </AppContext.Provider>
  );
}
