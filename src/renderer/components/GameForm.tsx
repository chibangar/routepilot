import { useEffect, useRef, useState } from "react";
import { FolderOpen, Plus, Trash2, X, Gamepad2 } from "lucide-react";
import type { Game } from "../../shared/contracts";
import { useApp } from "../context";
export function GameForm({
  game,
  onClose,
}: {
  game?: Game;
  onClose: () => void;
}) {
  const { act, refresh } = useApp();
  const [value, setValue] = useState<Game>(() =>
    game
      ? structuredClone(game)
      : {
          id: crypto.randomUUID(),
          name: "",
          executablePath: null,
          targets: [{ id: crypto.randomUUID(), label: "Principal", host: "" }],
          mode: "manual",
          selectedTargetId: null,
        },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector("input")?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const items = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input, select",
          ) ?? [],
        );
        if (e.shiftKey && document.activeElement === items[0]) {
          e.preventDefault();
          items.at(-1)?.focus();
        } else if (!e.shiftKey && document.activeElement === items.at(-1)) {
          e.preventDefault();
          items[0]?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const next = {
        ...value,
        name: value.name.trim(),
        targets: value.targets.map((t) => ({
          ...t,
          label: t.label.trim(),
          host: t.host.trim(),
        })),
        selectedTargetId:
          value.selectedTargetId ?? value.targets[0]?.id ?? null,
      };
      const result = await window.routepilot.saveGame(next);
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      await refresh();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-form-title"
        ref={ref}
      >
        <div className="modal-heading">
          <div className="modal-icon">
            <Gamepad2 size={24} />
          </div>
          <button
            className="icon-button"
            aria-label="Fechar formulário"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <h2 id="game-form-title">
          {game ? "Configurar aplicação" : "Uma nova ligação começa aqui"}
        </h2>
        <p className="muted">
          Organiza os teus jogos e escolhe os destinos a analisar.
        </p>
        <form onSubmit={submit}>
          <label>
            Nome da aplicação
            <input
              required
              maxLength={80}
              placeholder="Ex.: Valorant"
              value={value.name}
              onChange={(e) => setValue({ ...value, name: e.target.value })}
            />
          </label>
          <label>
            Executável{" "}
            <span className="optional">opcional · não será executado</span>
          </label>
          <div className="file-picker">
            <input
              aria-label="Executável selecionado"
              readOnly
              placeholder="Selecionar um ficheiro .exe"
              value={value.executablePath ?? ""}
            />
            <button
              type="button"
              className="button"
              onClick={async () => {
                const path = await act(() =>
                  window.routepilot.chooseExecutable(),
                );
                if (path) setValue({ ...value, executablePath: path });
              }}
            >
              <FolderOpen size={17} />
              Escolher
            </button>
            {value.executablePath && (
              <button
                type="button"
                className="icon-button"
                aria-label="Limpar executável"
                onClick={() => setValue({ ...value, executablePath: null })}
              >
                <X size={15} />
              </button>
            )}
          </div>
          <div className="section-title">
            <label>Destinos de diagnóstico</label>
            <button
              type="button"
              className="text-button"
              disabled={value.targets.length >= 16}
              onClick={() =>
                setValue({
                  ...value,
                  targets: [
                    ...value.targets,
                    { id: crypto.randomUUID(), label: "", host: "" },
                  ],
                })
              }
            >
              <Plus size={14} />
              Adicionar destino
            </button>
          </div>
          {value.targets.map((target, i) => (
            <div className="target-row" key={target.id}>
              <input
                required
                aria-label={`Nome do destino ${i + 1}`}
                placeholder="Ex.: Lisboa"
                value={target.label}
                maxLength={80}
                onChange={(e) =>
                  setValue({
                    ...value,
                    targets: value.targets.map((t) =>
                      t.id === target.id ? { ...t, label: e.target.value } : t,
                    ),
                  })
                }
              />
              <input
                required
                aria-label={`Host do destino ${i + 1}`}
                placeholder="Hostname ou IP"
                value={target.host}
                maxLength={253}
                onChange={(e) =>
                  setValue({
                    ...value,
                    targets: value.targets.map((t) =>
                      t.id === target.id ? { ...t, host: e.target.value } : t,
                    ),
                  })
                }
              />
              <button
                type="button"
                className="icon-button"
                disabled={value.targets.length === 1}
                aria-label={`Remover destino ${i + 1}`}
                onClick={() =>
                  setValue({
                    ...value,
                    selectedTargetId:
                      value.selectedTargetId === target.id
                        ? null
                        : value.selectedTargetId,
                    targets: value.targets.filter((t) => t.id !== target.id),
                  })
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <p className="field-note">
            Usa um destino que conheças. Os servidores do jogo não são detetados
            automaticamente.
          </p>
          <label>
            Seleção de destino
            <select
              value={value.mode}
              onChange={(e) =>
                setValue({ ...value, mode: e.target.value as Game["mode"] })
              }
            >
              <option value="manual">Manual — escolher um destino</option>
              <option value="automatic">
                Automática — comparar os destinos configurados
              </option>
            </select>
          </label>
          {value.mode === "manual" && (
            <label>
              Destino selecionado
              <select
                value={value.selectedTargetId ?? value.targets[0]?.id ?? ""}
                onChange={(e) =>
                  setValue({ ...value, selectedTargetId: e.target.value })
                }
              >
                {value.targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label || "Sem nome"} · {t.host || "por configurar"}
                  </option>
                ))}
              </select>
            </label>
          )}
          {error && (
            <div className="inline-error" role="alert">
              {error}
            </div>
          )}
          <div className="modal-footer">
            <button type="button" className="button" onClick={onClose}>
              Cancelar
            </button>
            <button className="button primary" type="submit" disabled={saving}>
              {saving
                ? "A guardar…"
                : game
                  ? "Guardar alterações"
                  : "Adicionar aplicação"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
