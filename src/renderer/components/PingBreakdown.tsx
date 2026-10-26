import { useEffect, useMemo, useState } from "react";
import { Lightbulb, MapPin, Square } from "lucide-react";
import type { MonitorTarget, PingBreakdown } from "../../shared/contracts";
import { useApp } from "../context";
import { number } from "./UI";

type Location = PingBreakdown["location"];
const LOCATIONS: { id: Location; label: string }[] = [
  { id: "continente", label: "Continente" },
  { id: "madeira", label: "Madeira" },
  { id: "acores", label: "Açores" },
];
const STORAGE_KEY = "routepilot.location";
const PART_NAMES: Record<string, string> = {
  casa: "Casa",
  operadora: "Operadora na ilha",
  cabo: "Cabo",
  continente: "Continente",
  caminho: "Operadora → servidor",
  servidor: "Servidor",
};
const ms = (v: number | null) => (v === null ? "—" : `${number(v, 0)} ms`);

function savedLocation(): Location {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "continente" || v === "madeira" || v === "acores") return v;
  } catch {
    // Sem armazenamento local, usa o continente.
  }
  return "continente";
}

export function PingBreakdownPanel({ busy }: { busy: boolean }) {
  const { act } = useApp();
  const [targets, setTargets] = useState<MonitorTarget[]>([]);
  const [selected, setSelected] = useState("");
  const [location, setLocation] = useState<Location>(savedLocation);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState("");
  const [result, setResult] = useState<PingBreakdown | null>(null);

  useEffect(() => {
    void act(() => window.routepilot.monitorTargets()).then((t) => {
      if (!t) return;
      const servers = t.filter((x) => x.id.startsWith("cs2-") || x.id.startsWith("lol-"));
      setTargets(servers);
      setSelected((s) => s || servers.find((x) => x.id === "cs2-mad")?.id || servers[0]?.id || "");
    });
    return window.routepilot?.onBreakdownProgress?.((s) => setStep(s));
  }, [act]);

  const groups = useMemo(() => [...new Set(targets.map((t) => t.group))], [targets]);

  const chooseLocation = (v: Location) => {
    setLocation(v);
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      // Preferência só para esta sessão.
    }
  };

  const run = async () => {
    const target = targets.find((t) => t.id === selected);
    if (!target) return;
    setRunning(true);
    setStep("A iniciar…");
    try {
      const r = await act(() => window.routepilot.pingBreakdown(target, location));
      if (r) setResult(r);
    } finally {
      setRunning(false);
      setStep("");
    }
  };

  const total = result ? result.segments.reduce((a, s) => a + s.ms, 0) || 1 : 1;

  return (
    <>
      <section className="panel network-panel">
        <div className="route-compare-head">
          <div>
            <h3>
              <MapPin size={16} /> Onde está o meu ping?
            </h3>
            <p>
              Segue o caminho até ao servidor e divide o ping em casa,
              operadora, cabo ilha → continente e continente → servidor.
              Compara com o mínimo que a distância permite e diz o que dá para
              melhorar. Demora até ~1 minuto.
            </p>
            <div className="breakdown-controls">
              <div className="segmented" role="radiogroup" aria-label="Onde estás">
                {LOCATIONS.map((l) => (
                  <button
                    key={l.id}
                    role="radio"
                    aria-checked={location === l.id}
                    className={location === l.id ? "active" : ""}
                    disabled={running}
                    onClick={() => chooseLocation(l.id)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
              <div className="monitor-controls">
                <select
                  value={selected}
                  disabled={running}
                  onChange={(e) => setSelected(e.target.value)}
                  aria-label="Servidor"
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
              </div>
            </div>
          </div>
          {running ? (
            <button
              className="button stop compact"
              onClick={() => void act(() => window.routepilot.cancelBreakdown())}
            >
              <Square size={14} /> Cancelar
            </button>
          ) : (
            <button
              className="button primary compact"
              disabled={busy || !selected}
              onClick={() => void run()}
            >
              Analisar
            </button>
          )}
        </div>
        {running && <p className="route-compare-note">{step}</p>}

        {result && (
          <div className="breakdown-result">
            <p className={"breakdown-headline verdict-" + result.verdict}>{result.headline}</p>
            <div className="breakdown-totals">
              <span>
                Ping até {result.serverName ?? result.target.label}: <strong>{ms(result.totalMs)}</strong>{" "}
                (típico {ms(result.medianMs)})
              </span>
              {result.expectedMs !== null && (
                <span>
                  Mínimo realista para a distância: <strong>~{ms(result.expectedMs)}</strong>
                </span>
              )}
            </div>
            <div className="breakdown-bar" aria-hidden="true">
              {result.segments.map((s) => (
                <div
                  key={s.part}
                  className={"part-" + s.part}
                  style={{ flexGrow: Math.max(s.ms, total * 0.02) }}
                  title={`${s.label}: ${ms(s.ms)}`}
                />
              ))}
            </div>
            <ul className="breakdown-legend">
              {result.segments.map((s) => (
                <li key={s.part}>
                  <i className={"part-" + s.part} />
                  <span>{s.label}</span>
                  <strong>{ms(s.ms)}</strong>
                </li>
              ))}
            </ul>

            <ul className="network-advice">
              {result.advice.map((tip) => (
                <li key={tip}>
                  <Lightbulb size={15} />
                  <span>{tip}</span>
                </li>
              ))}
            </ul>

            <details className="breakdown-hops">
              <summary>Ver os {result.hops.length} saltos do caminho</summary>
              <table className="route-compare-table">
                <thead>
                  <tr>
                    <th>Salto</th>
                    <th>Endereço</th>
                    <th>Ping</th>
                    <th>Parte</th>
                  </tr>
                </thead>
                <tbody>
                  {result.hops.map((h) => (
                    <tr key={h.ttl}>
                      <td>{h.ttl}</td>
                      <td>{h.address}</td>
                      <td>{ms(h.ms)}</td>
                      <td>{PART_NAMES[h.part]}</td>
                    </tr>
                  ))}
                  <tr>
                    <td>—</td>
                    <td>{result.target.host}</td>
                    <td>{ms(result.totalMs)}</td>
                    <td>{PART_NAMES.servidor}</td>
                  </tr>
                </tbody>
              </table>
              <p className="route-compare-note">
                Cada salto mostra o menor ping entre ele e os seguintes, porque
                os routers atrasam as respostas ao ping. O mínimo realista é uma
                estimativa pela distância em fibra
                {result.traceComplete ? "" : "; o traceroute não chegou a confirmar o servidor"}.
              </p>
            </details>
          </div>
        )}
      </section>
    </>
  );
}
