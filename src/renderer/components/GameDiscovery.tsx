import { useEffect, useRef, useState } from "react";
import {
  FolderSearch,
  FolderOpen,
  RefreshCw,
  Search,
  X,
  Check,
  Square,
  Info,
} from "lucide-react";
import type { DiscoveryReport } from "../../shared/contracts";
import { useApp } from "../context";
import { Empty, GameIcon, SearchField } from "./UI";
export function GameDiscovery({ onClose }: { onClose: () => void }) {
  const { runtime, refresh, notify } = useApp();
  const [report, setReport] = useState<DiscoveryReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const alive = useRef(true);
  const ref = useRef<HTMLDivElement>(null);
  const addedIds = new Set(
    (runtime?.store.games ?? [])
      .map((game) => game.installation?.discoveryId)
      .filter(Boolean),
  );
  async function scan(folder = false) {
    setBusy(true);
    setError("");
    try {
      const result = await (folder
        ? window.routepilot.chooseSteamLibrary()
        : window.routepilot.discoverGames());
      if (!alive.current) return;
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      if (result.value) {
        setReport(result.value);
        setSelected(new Set());
      }
    } catch (e) {
      if (alive.current) setError(String(e));
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  useEffect(() => {
    alive.current = true;
    void scan();
    return () => {
      alive.current = false;
      void window.routepilot.cancelDiscovery();
    };
  }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !importing) onClose();
      if (e.key === "Tab") {
        const fields = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled),input:not(:disabled),summary",
          ) ?? [],
        );
        if (e.shiftKey && document.activeElement === fields[0]) {
          e.preventDefault();
          fields.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === fields.at(-1)) {
          e.preventDefault();
          fields[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, importing]);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button")?.focus();
  }, []);
  const games = (report?.games ?? []).filter((game) =>
    game.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  const chosen = [...selected].filter((id) => !addedIds.has(id));
  async function add() {
    setImporting(true);
    setError("");
    try {
      const result = await window.routepilot.importDiscoveredGames(chosen);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      await refresh();
      setSelected(new Set());
      notify(
        `${result.value.added} jogos adicionados${result.value.skipped ? `; ${result.value.skipped} já estavam na biblioteca` : ""}. Configura um destino para iniciar diagnósticos.`,
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <div
        className="modal discovery-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="discovery-title"
        ref={ref}
      >
        <div className="modal-heading">
          <div className="modal-icon">
            <FolderSearch size={25} />
          </div>
          <button
            className="icon-button"
            aria-label="Fechar deteção"
            disabled={importing}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <h2 id="discovery-title">Os teus jogos, num só lugar.</h2>
        <p className="muted">
          Procura registos de instalação da Steam, Epic Games e GOG neste
          computador.
        </p>
        <div className="discovery-tools">
          <div className="discovery-providers">
            <span className="tag">Steam</span>
            <span className="tag">Epic Games</span>
            <span className="tag">GOG</span>
          </div>
          {busy ? (
            <button
              className="text-button"
              onClick={() => void window.routepilot.cancelDiscovery()}
            >
              <Square size={13} />
              Cancelar procura
            </button>
          ) : (
            <button
              className="text-button"
              onClick={() => void scan()}
              disabled={importing}
            >
              <RefreshCw size={14} />
              Procurar novamente
            </button>
          )}
        </div>
        {busy ? (
          <Empty
            title="A procurar jogos instalados…"
            text="A ler registos e manifestos locais. Os jogos não são executados."
            icon={<RefreshCw size={28} className="spin" />}
          />
        ) : report?.games.length ? (
          <>
            <div className="discovery-list-heading">
              <span>
                {report.games.length}{" "}
                {report.games.length === 1
                  ? "instalação encontrada"
                  : "instalações encontradas"}
              </span>
              <SearchField
                value={query}
                onChange={setQuery}
                placeholder="Filtrar jogos encontrados"
              />
            </div>
            <div className="discovery-list">
              {games.map((game) => {
                const added = addedIds.has(game.id);
                return (
                  <label
                    className={
                      "discovered-game " + (added ? "already-added" : "")
                    }
                    key={game.id}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Selecionar ${game.name}`}
                      checked={added || selected.has(game.id)}
                      disabled={added || importing}
                      onChange={(e) => {
                        const next = new Set(selected);
                        if (e.target.checked) next.add(game.id);
                        else next.delete(game.id);
                        setSelected(next);
                      }}
                    />
                    <GameIcon game={game} />
                    <div className="discovered-game-copy">
                      <h3>{game.name}</h3>
                      <span title={game.installPath}>{game.installPath}</span>
                      <small>
                        {game.executablePath
                          ? "Executável identificado"
                          : "Executável por associar · opcional"}
                      </small>
                    </div>
                    <span className={"tag " + (added ? "mint-tag" : "")}>
                      {added ? (
                        <>
                          <Check size={11} />
                          Adicionado
                        </>
                      ) : (
                        game.source
                      )}
                    </span>
                  </label>
                );
              })}
              {!games.length && (
                <p className="muted small">
                  Nenhum resultado corresponde à pesquisa.
                </p>
              )}
            </div>
          </>
        ) : report ? (
          <Empty
            title="Não encontrámos jogos nestas fontes"
            text="Isto não significa que não tenhas jogos instalados. Podes indicar uma biblioteca Steam ou adicionar uma aplicação manualmente."
            icon={<FolderSearch size={30} />}
          />
        ) : null}
        {report?.partial && (
          <div className="discovery-warning" role="status">
            <Info size={16} />
            <span>
              {report.cancelled
                ? "Procura cancelada. Os resultados apresentados são parciais."
                : "A deteção tem cobertura parcial. Consulta os detalhes abaixo."}
            </span>
          </div>
        )}
        {report && (
          <details>
            <summary>Origem e limites da deteção</summary>
            <p className="field-note">
              São apresentados registos com pastas locais existentes. Estes
              metadados não verificam se o jogo inicia ou se a instalação está
              completa. Outros launchers e instalações sem registo podem não ser
              encontrados. Os registos Steam também podem incluir ferramentas,
              servidores dedicados e componentes de suporte.
            </p>
            {report.warnings.length > 0 && (
              <ul className="discovery-warnings">
                {report.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            )}
            <p className="field-note">
              Executáveis Steam não são adivinhados. Podes associá-los depois,
              se quiseres.
            </p>
          </details>
        )}
        {error && (
          <div className="inline-error" role="alert">
            {error}
          </div>
        )}
        <div className="discovery-folder">
          <FolderOpen size={17} />
          <div>
            <strong>A tua biblioteca está noutro disco?</strong>
            <p>Escolhe a pasta Steam que contém a pasta steamapps.</p>
          </div>
          <button
            className="button compact"
            disabled={busy || importing}
            onClick={() => void scan(true)}
          >
            Escolher biblioteca
          </button>
        </div>
        <div className="modal-footer">
          <button className="button" onClick={onClose} disabled={importing}>
            Fechar
          </button>
          <button
            className="button primary"
            disabled={busy || importing || chosen.length === 0}
            onClick={() => void add()}
          >
            <Check size={16} />
            {importing
              ? "A adicionar…"
              : `Adicionar selecionados (${chosen.length})`}
          </button>
        </div>
        <p className="field-note discovery-footnote">
          Só são adicionados os jogos selecionados. Os destinos de rede ficam
          por configurar.
        </p>
      </div>
    </div>
  );
}
