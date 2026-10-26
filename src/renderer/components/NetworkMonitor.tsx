import { useEffect, useMemo, useState } from "react";
import { Activity, Play, Square } from "lucide-react";
import type { MonitorState, MonitorTarget } from "../../shared/contracts";
import { useApp } from "../context";
import { number } from "./UI";

const ms = (v: number | null) => (v === null ? "—" : `${number(v, 0)} ms`);

function Sparkline({ samples }: { samples: (number | null)[] }) {
  const w = 600;
  const h = 90;
  const values = samples.filter((s): s is number => s !== null);
  const max = Math.max(20, ...values) * 1.15;
  const step = samples.length > 1 ? w / (samples.length - 1) : w;
  let d = "";
  samples.forEach((s, i) => {
    if (s === null) return;
    const x = i * step;
    const y = h - (s / max) * h;
    d += `${d && samples[i - 1] !== null ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)} `;
  });
  return (
    <svg className="monitor-chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={d} fill="none" stroke="var(--mint)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {samples.map((s, i) =>
        s === null ? (
          <line key={i} x1={i * step} x2={i * step} y1={0} y2={h} stroke="#ff6b81" strokeOpacity="0.6" vectorEffect="non-scaling-stroke" />
        ) : null,
      )}
    </svg>
  );
}

export function NetworkMonitor() {
  const { act } = useApp();
  const [targets, setTargets] = useState<MonitorTarget[]>([]);
  const [selected, setSelected] = useState("");
  const [state, setState] = useState<MonitorState | null>(null);

  useEffect(() => {
    void act(() => window.routepilot.monitorTargets()).then((t) => {
      if (!t) return;
      setTargets(t);
      setSelected((s) => s || t.find((x) => x.group === "CS2")?.id || t[0]?.id || "");
    });
    return window.routepilot?.onMonitor?.((s) => setState(s));
  }, [act]);

  const groups = useMemo(() => [...new Set(targets.map((t) => t.group))], [targets]);
  const target = targets.find((t) => t.id === selected);
  const running = !!state?.running;
  const lossPct = state && state.sent ? Math.round((state.lost / state.sent) * 100) : null;

  return (
    <section className="panel network-panel">
      <div className="route-compare-head">
        <div>
          <h3>
            <Activity size={16} /> Monitor ao vivo
          </h3>
          <p>
            Deixa a correr enquanto jogas: mede o ping a cada segundo.
          </p>
        </div>
        <div className="monitor-controls">
          <select
            value={selected}
            disabled={running}
            onChange={(e) => setSelected(e.target.value)}
            aria-label="Alvo do monitor"
          >
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {targets
                  .filter((t) => t.group === g)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          {running ? (
            <button className="button stop compact" onClick={() => void act(() => window.routepilot.monitorStop())}>
              <Square size={14} /> Parar
            </button>
          ) : (
            <button
              className="button primary compact"
              disabled={!target}
              onClick={() => target && void act(() => window.routepilot.monitorStart(target))}
            >
              <Play size={14} /> Iniciar
            </button>
          )}
        </div>
      </div>

      {state && (
        <>
          <div className="network-summary monitor-summary">
            <div className="network-card">
              <span>Agora</span>
              <strong>{ms(state.lastMs)}</strong>
              <small>{state.target.label}</small>
            </div>
            <div className="network-card">
              <span>Média / mínimo</span>
              <strong>{ms(state.meanMs)}</strong>
              <small>mínimo {ms(state.minMs)}</small>
            </div>
            <div className="network-card">
              <span>Jitter</span>
              <strong>{ms(state.jitterMs)}</strong>
              <small>{state.spikes} picos (+30 ms)</small>
            </div>
            <div className="network-card">
              <span>Sem resposta</span>
              <strong className={lossPct ? "grade-D" : "grade-A"}>{lossPct === null ? "—" : `${lossPct}%`}</strong>
              <small>
                {state.lost} de {state.sent} sondas
              </small>
            </div>
          </div>
          <Sparkline samples={state.samples} />
          <p className="route-compare-note">
            Últimos {state.samples.length} segundos. Linhas vermelhas = sem
            resposta. Picos frequentes costumam vir de Wi-Fi ou de downloads na
            mesma rede.
          </p>
        </>
      )}
    </section>
  );
}
