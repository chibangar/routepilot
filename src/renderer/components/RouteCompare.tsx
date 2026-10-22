import { useEffect, useState } from "react";
import { GitCompare, Square } from "lucide-react";
import type { RouteComparison, Target } from "../../shared/contracts";
import { useApp } from "../context";
import { number } from "./UI";

const ms = (v: number | null) => (v === null ? "—" : `${number(v, 0)} ms`);

export function RouteCompare({
  target,
  disabled,
}: {
  target?: Target;
  disabled: boolean;
}) {
  const { runtime, act, navigate } = useApp();
  const relays = runtime?.store.settings.relays ?? [];
  const [result, setResult] = useState<RouteComparison | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => setResult(null), [target?.host]);

  const run = async () => {
    if (!target) return;
    setRunning(true);
    try {
      const r = await act(() => window.routepilot.compareRoutes(target));
      if (r) setResult(r);
    } finally {
      setRunning(false);
    }
  };

  const isBest = (kind: "direct" | string) =>
    result?.best &&
    (kind === "direct"
      ? result.best.kind === "direct"
      : result.best.kind === "relay" && result.best.relayId === kind);

  return (
    <section className="diagram-section-card route-compare">
      <div className="route-compare-head">
        <div>
          <h3>
            <GitCompare size={16} /> Comparar rotas
          </h3>
          <p>
            Mede o ping direto até {target?.label ?? "o destino"} e o caminho
            estimado através de cada relay teu (PC→relay + relay→destino).
          </p>
        </div>
        {running ? (
          <button
            className="button stop compact"
            onClick={() => void act(() => window.routepilot.cancelCompare())}
          >
            <Square size={14} /> Cancelar
          </button>
        ) : (
          <button
            className="button primary compact"
            disabled={disabled || !target}
            onClick={() => void run()}
          >
            Comparar
          </button>
        )}
      </div>

      {relays.length === 0 && (
        <p className="route-compare-note">
          Ainda não tens relays configurados; só a ligação direta será medida.{" "}
          <button className="quick-setup-link" onClick={() => navigate("settings")}>
            Adicionar relay
          </button>
        </p>
      )}

      {result && (
        <table className="route-compare-table">
          <thead>
            <tr>
              <th>Rota</th>
              <th>PC → relay</th>
              <th>Relay → destino</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className={isBest("direct") ? "best" : ""}>
              <td>Direta</td>
              <td>—</td>
              <td>—</td>
              <td>{result.directMs === null ? result.directError : ms(result.directMs)}</td>
            </tr>
            {result.relays.map((r) => (
              <tr key={r.relayId} className={isBest(r.relayId) ? "best" : ""}>
                <td>{r.label}</td>
                <td>{ms(r.relayRttMs)}</td>
                <td>{ms(r.targetRttMs)}</td>
                <td>{r.error ?? ms(r.totalMs)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {result?.best && (
        <p className="route-compare-note">
          {result.best.kind === "direct"
            ? "A ligação direta é a mais rápida; um relay não ajudaria neste destino."
            : `Via ${result.relays.find((r) => r.relayId === (result.best as { relayId: string }).relayId)?.label} seria ${
                result.directMs === null
                  ? "a única rota com resposta"
                  : `${number(result.directMs - result.best.ms, 0)} ms mais rápido`
              }. Valores ICMP; o ping dentro do jogo pode variar.`}
        </p>
      )}
    </section>
  );
}
