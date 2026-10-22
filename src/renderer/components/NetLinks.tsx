import { useState } from "react";
import { Cable, Network, Undo2, Wifi } from "lucide-react";
import type { NetLink } from "../../shared/contracts";
import { useApp } from "../context";
import { number } from "./UI";

export function NetLinks() {
  const { act, notify } = useApp();
  const [links, setLinks] = useState<NetLink[] | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (task: () => Promise<NetLink[] | undefined>, done?: string) => {
    setBusy(true);
    try {
      const r = await task();
      if (r) {
        setLinks(r);
        if (done) notify(done);
      }
    } finally {
      setBusy(false);
    }
  };

  const best = links?.filter((l) => l.pingMs !== null).sort((a, b) => a.pingMs! - b.pingMs!)[0];
  const manual = links?.some((l) => !l.automaticMetric);

  return (
    <section className="panel network-panel">
      <div className="route-compare-head">
        <div>
          <h3>
            <Network size={16} /> Multi-Internet
          </h3>
          <p>
            Se tens mais de uma ligação (cabo, Wi-Fi, 4G), mede o ping em cada
            uma e escolhe qual o Windows usa primeiro. Se a preferida cair, o
            Windows passa sozinho para a seguinte.
          </p>
        </div>
        <button
          className="button primary compact"
          disabled={busy}
          onClick={() => void run(() => act(() => window.routepilot.linksStatus()))}
        >
          {busy ? "A medir…" : links ? "Medir de novo" : "Ver ligações"}
        </button>
      </div>

      {links && links.length === 0 && (
        <p className="route-compare-note">Não foi encontrada nenhuma ligação ativa com internet.</p>
      )}
      {links && links.length > 0 && (
        <>
          <table className="route-compare-table">
            <thead>
              <tr>
                <th>Ligação</th>
                <th>IP</th>
                <th>Ping (1.1.1.1)</th>
                <th>Ordem</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {links.map((l, i) => (
                <tr key={l.index} className={l.index === best?.index ? "best" : ""}>
                  <td>
                    {l.wifi ? <Wifi size={14} /> : <Cable size={14} />} {l.alias}{" "}
                    <small>{l.description}</small>
                  </td>
                  <td>{l.ip}</td>
                  <td>{l.pingMs === null ? "sem resposta" : `${number(l.pingMs, 0)} ms`}</td>
                  <td>{i === 0 ? "preferida" : `${i + 1}.ª`}</td>
                  <td>
                    {i !== 0 && links.length > 1 && (
                      <button
                        className="quick-setup-link"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Usar "${l.alias}" como ligação preferida para todo o PC? O Windows pede permissão de administrador. Podes voltar ao automático a qualquer momento.`,
                            )
                          )
                            void run(
                              () => act(() => window.routepilot.linksPrefer(l.index)),
                              `${l.alias} é agora a ligação preferida.`,
                            );
                        }}
                      >
                        Preferir esta
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {links.length === 1 && (
            <p className="route-compare-note">
              Só tens uma ligação ativa. Liga o Wi-Fi ou partilha a internet do
              telemóvel por USB para teres uma alternativa.
            </p>
          )}
          {manual && (
            <button
              className="button secondary compact"
              disabled={busy}
              onClick={() =>
                void run(
                  () => act(() => window.routepilot.linksAutomatic()),
                  "O Windows voltou a escolher a ligação automaticamente.",
                )
              }
            >
              <Undo2 size={14} /> Voltar ao automático
            </button>
          )}
        </>
      )}
    </section>
  );
}
