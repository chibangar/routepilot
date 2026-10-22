import { useState } from "react";
import { Plus, Server, Trash2 } from "lucide-react";
import type { Relay } from "../../shared/contracts";

const blank = { label: "", host: "", port: "7400", token: "" };

export function RelaySettings({
  relays,
  onChange,
}: {
  relays: Relay[];
  onChange: (relays: Relay[]) => void;
}) {
  const [draft, setDraft] = useState(blank);
  const [error, setError] = useState("");

  const add = () => {
    const port = Number(draft.port);
    if (!draft.label.trim() || !draft.host.trim())
      return setError("Indica um nome e o hostname/IP do relay.");
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      return setError("Porta inválida.");
    if (draft.token.length < 32)
      return setError("O token tem de ter pelo menos 32 caracteres.");
    if (relays.length >= 8) return setError("Máximo de 8 relays.");
    setError("");
    onChange([
      ...relays,
      {
        id: "relay-" + crypto.randomUUID().slice(0, 8),
        label: draft.label.trim(),
        host: draft.host.trim(),
        port,
        token: draft.token,
      },
    ]);
    setDraft(blank);
  };

  return (
    <div className="setting-row relay-settings">
      <div style={{ flex: 1 }}>
        <h3>
          <Server size={17} /> Servidores de passagem (relays)
        </h3>
        <p>
          Servidores teus com o <code>relay/server.mjs</code>. São usados em
          “Comparar rotas” para medir se passar por eles é mais rápido do que a
          ligação direta. Guarda as alterações no fim da página.
        </p>
        {relays.map((r) => (
          <div className="relay-row" key={r.id}>
            <strong>{r.label}</strong>
            <code>
              {r.host}:{r.port}
            </code>
            <button
              type="button"
              className="icon-button"
              aria-label={`Remover ${r.label}`}
              onClick={() => onChange(relays.filter((x) => x.id !== r.id))}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        <div className="relay-form">
          <input
            aria-label="Nome do relay"
            placeholder="Nome (ex.: São Paulo)"
            value={draft.label}
            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          />
          <input
            aria-label="Hostname ou IP do relay"
            placeholder="IP ou hostname"
            value={draft.host}
            onChange={(e) => setDraft({ ...draft, host: e.target.value })}
          />
          <input
            aria-label="Porta UDP"
            type="number"
            min="1"
            max="65535"
            value={draft.port}
            onChange={(e) => setDraft({ ...draft, port: e.target.value })}
          />
          <input
            aria-label="Token do relay"
            type="password"
            placeholder="Token (RELAY_TOKEN)"
            value={draft.token}
            onChange={(e) => setDraft({ ...draft, token: e.target.value })}
          />
          <button type="button" className="button secondary compact" onClick={add}>
            <Plus size={15} /> Adicionar relay
          </button>
        </div>
        {error && <p className="relay-error">{error}</p>}
      </div>
    </div>
  );
}
