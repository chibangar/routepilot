import { useEffect, useMemo, useState } from "react";
import { Cable, Globe, Lightbulb, Monitor, Router, Server, Square, Wifi, Zap } from "lucide-react";
import type {
  ConnectionInfo,
  ConnectionKind,
  MonitorTarget,
  PingBreakdown,
} from "../../shared/contracts";
import { useApp } from "../context";
import { number } from "./UI";

type Location = PingBreakdown["location"];
const LOCATIONS: { id: Location; label: string }[] = [
  { id: "continente", label: "Continente" },
  { id: "madeira", label: "Madeira" },
  { id: "acores", label: "Açores" },
];
const LOCATION_KEY = "routepilot.location";
const CONNECTION_KEY = "routepilot.connection";
const PART_NAMES: Record<string, string> = {
  casa: "Casa",
  operadora: "Operadora na ilha",
  cabo: "Cabo",
  continente: "Continente",
  caminho: "Operadora → servidor",
  servidor: "Servidor",
};
const ms = (v: number | null) => (v === null ? "—" : `${number(v, 0)} ms`);

function load<T extends string>(key: string, allowed: readonly T[]): T | null {
  try {
    const v = localStorage.getItem(key);
    return allowed.includes(v as T) ? (v as T) : null;
  } catch {
    return null;
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Preferência só para esta sessão.
  }
}

const reducedMotion = () => {
  try {
    return (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !!document.querySelector(".economy-mode")
    );
  } catch {
    return false;
  }
};

// Conta de 0 até ao valor, para o resultado "entrar" com movimento.
function useCountUp(value: number | null) {
  const [shown, setShown] = useState(value ?? 0);
  useEffect(() => {
    if (value === null) return;
    if (reducedMotion()) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 900);
      setShown(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return shown;
}

// O pacote a viajar de casa até ao servidor enquanto o diagnóstico corre.
function RouteAnimation({
  step,
  island,
  connection,
}: {
  step: string;
  island: boolean;
  connection: ConnectionKind;
}) {
  const stage = /servidor…/.test(step) ? 3 : /routers/.test(step) ? 2 : 1;
  const nodes = [
    { icon: Monitor, label: "PC" },
    { icon: connection === "wifi" ? Wifi : Router, label: "Router" },
    { icon: Globe, label: island ? "Cabo até ao continente" : "Operadora" },
    { icon: Server, label: "Servidor" },
  ];
  return (
    <div className="route-anim" aria-live="polite">
      <div className="route-anim-track">
        <div className="route-anim-line" />
        <div className="route-anim-packet" />
        {nodes.map((n, i) => (
          <div key={n.label} className={"route-anim-node" + (i <= stage ? " lit" : "")}>
            <span>
              <n.icon size={20} />
            </span>
            <small>{n.label}</small>
          </div>
        ))}
      </div>
      <p>{step}</p>
    </div>
  );
}

export function PingBreakdownPanel({ busy, hero = false }: { busy: boolean; hero?: boolean }) {
  const { act } = useApp();
  const [targets, setTargets] = useState<MonitorTarget[]>([]);
  const [selected, setSelected] = useState("");
  const [location, setLocation] = useState<Location>(
    () => load(LOCATION_KEY, ["continente", "madeira", "acores"] as const) ?? "continente",
  );
  const [connection, setConnection] = useState<ConnectionKind>(
    () => load(CONNECTION_KEY, ["cabo", "wifi"] as const) ?? "cabo",
  );
  const [detected, setDetected] = useState<ConnectionInfo | null>(null);
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
    void window.routepilot.connectionInfo?.().then((r) => {
      if (!r.ok) return;
      setDetected(r.value);
      // A ligação detetada só substitui uma escolha que ainda não foi feita.
      if (r.value.kind && !load(CONNECTION_KEY, ["cabo", "wifi"] as const))
        setConnection(r.value.kind);
    });
    return window.routepilot?.onBreakdownProgress?.((s) => setStep(s));
  }, [act]);

  const groups = useMemo(() => [...new Set(targets.map((t) => t.group))], [targets]);
  const shownMs = useCountUp(result?.totalMs ?? null);

  const run = async () => {
    const target = targets.find((t) => t.id === selected);
    if (!target) return;
    setRunning(true);
    setResult(null);
    setStep("A seguir o caminho até ao servidor…");
    try {
      const r = await act(() => window.routepilot.pingBreakdown(target, location, connection));
      if (r) setResult(r);
    } finally {
      setRunning(false);
      setStep("");
    }
  };

  const total = result ? result.segments.reduce((a, s) => a + s.ms, 0) || 1 : 1;

  return (
    <section className={"ping-hero" + (hero ? " is-hero" : "")}>
      <div className="ping-hero-glow" aria-hidden="true" />
      <div className="ping-hero-head">
        {hero ? <h1>Baixa o teu ping</h1> : <h3>Onde está o meu ping?</h3>}
        <p>Escolhe três coisas e carrega em Analisar. Em menos de 1 minuto sabes de onde vem o lag.</p>
      </div>

      <div className="ping-steps">
        <div className="ping-step">
          <label>
            <b>1</b> Onde estás
          </label>
          <div className="segmented" role="radiogroup" aria-label="Onde estás">
            {LOCATIONS.map((l) => (
              <button
                key={l.id}
                role="radio"
                aria-checked={location === l.id}
                className={location === l.id ? "active" : ""}
                disabled={running}
                onClick={() => {
                  setLocation(l.id);
                  save(LOCATION_KEY, l.id);
                }}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ping-step">
          <label>
            <b>2</b> Ligação
          </label>
          <div className="segmented" role="radiogroup" aria-label="Ligação">
            {(
              [
                ["cabo", "Cabo de rede", Cable],
                ["wifi", "Wi-Fi", Wifi],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                role="radio"
                aria-checked={connection === id}
                className={connection === id ? "active" : ""}
                disabled={running}
                onClick={() => {
                  setConnection(id);
                  save(CONNECTION_KEY, id);
                }}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
          {detected?.kind && (
            <small className="ping-detected">
              Detetado: {detected.kind === "wifi" ? "Wi-Fi" : "cabo"}
              {detected.kind === "wifi" && detected.wifiSignal !== null
                ? ` · sinal ${detected.wifiSignal}%`
                : ""}
            </small>
          )}
        </div>

        <div className="ping-step">
          <label>
            <b>3</b> Servidor
          </label>
          <select
            className="breakdown-select"
            value={selected}
            disabled={running}
            onChange={(e) => setSelected(e.target.value)}
            aria-label="Servidor"
          >
            {!targets.length && <option value="">A carregar servidores…</option>}
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

        {running ? (
          <button
            className="ping-go stop"
            onClick={() => void act(() => window.routepilot.cancelBreakdown())}
          >
            <Square size={16} /> Cancelar
          </button>
        ) : (
          <button className="ping-go" disabled={busy || !selected} onClick={() => void run()}>
            <Zap size={18} /> Analisar
          </button>
        )}
      </div>

      {running && (
        <RouteAnimation step={step} island={location !== "continente"} connection={connection} />
      )}

      {result && !running && (
        <div className="breakdown-result" key={result.measuredAt}>
          <div className="breakdown-score">
            <strong>{number(shownMs, 0)} ms</strong>
            <div>
              <p className={"breakdown-headline verdict-" + result.verdict}>{result.headline}</p>
              <span>
                Ping até {result.serverName ?? result.target.label} · típico {ms(result.medianMs)} ·{" "}
                {result.connection === "wifi" ? "Wi-Fi" : "cabo"}
              </span>
            </div>
          </div>
          <div className="breakdown-bar" aria-hidden="true">
            {result.segments.map((s, i) => (
              <div
                key={s.part}
                className={"part-" + s.part}
                style={{ flexGrow: Math.max(s.ms, total * 0.02), animationDelay: `${i * 140}ms` }}
                title={`${s.label}: ${ms(s.ms)}`}
              />
            ))}
          </div>
          <ul className="breakdown-legend">
            {result.segments.map((s) => (
              <li key={s.part}>
                <i className={"part-" + s.part} />
                {s.label} <strong>{ms(s.ms)}</strong>
              </li>
            ))}
          </ul>

          <ul className="network-advice">
            {result.advice.map((tip, i) => (
              <li key={tip} style={{ animationDelay: `${400 + i * 120}ms` }}>
                <Lightbulb size={15} />
                <span>{tip}</span>
              </li>
            ))}
          </ul>

          <details className="breakdown-hops">
            <summary>Detalhes ({result.hops.length} saltos)</summary>
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
              Cada salto mostra o menor ping entre ele e os seguintes. O mínimo
              realista é uma estimativa pela distância em fibra
              {result.traceComplete ? "" : "; o traceroute não chegou a confirmar o servidor"}.
            </p>
          </details>
        </div>
      )}
    </section>
  );
}
