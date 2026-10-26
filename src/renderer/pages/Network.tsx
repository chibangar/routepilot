import { useEffect, useState } from "react";
import { Gauge, Lightbulb, Square, Wifi, Cable } from "lucide-react";
import type { NetworkCheck, NetworkPhase } from "../../shared/contracts";
import { useApp } from "../context";
import { PageHeading, SectionTitle, number } from "../components/UI";
import { NetworkMonitor } from "../components/NetworkMonitor";
import { NetLinks } from "../components/NetLinks";

const ms = (v: number | null) => (v === null ? "—" : `${number(v, 0)} ms`);
const loss = (p: NetworkPhase) =>
  p.sent ? `${Math.round(((p.sent - p.received) / p.sent) * 100)}%` : "—";

export function NetworkPage() {
  const { act, active, runtime } = useApp();
  const [result, setResult] = useState<NetworkCheck | null>(null);
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState("");
  const [withLoad, setWithLoad] = useState(true);
  const [tool, setTool] = useState<"casa" | "monitor" | "ligacoes">("casa");

  useEffect(
    () => window.routepilot?.onNetworkProgress?.((s) => setStep(s)),
    [],
  );

  const run = async () => {
    setRunning(true);
    setStep("A iniciar…");
    try {
      const r = await act(() => window.routepilot.runNetworkCheck(withLoad));
      if (r) setResult(r);
    } finally {
      setRunning(false);
      setStep("");
    }
  };

  const busy = !!active || !!runtime?.traceActive;

  return (
    <>
      <PageHeading
        eyebrow="ANTES DE JOGAR"
        title="A minha rede"
        subtitle="Para veres de onde vem o teu ping, usa o Início. Aqui estão as ferramentas extra."
      />
      <div className="segmented tool-tabs" role="tablist" aria-label="Outras ferramentas">
        {(
          [
            ["casa", "Teste da rede de casa"],
            ["monitor", "Monitor ao vivo"],
            ["ligacoes", "Ligações"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tool === id}
            className={tool === id ? "active" : ""}
            onClick={() => setTool(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tool === "casa" && (
      <>
      <section className="panel network-panel">
        <div className="route-compare-head">
          <div>
            <h3>
              <Gauge size={16} /> Wi-Fi, router e bufferbloat (~30 s)
            </h3>
            <p>
              Usa até ~80 MB. Não corre em ligações móveis ou tarifadas.
            </p>
            <label className="cs2-auto-toggle network-load-toggle">
              <input
                type="checkbox"
                checked={withLoad}
                disabled={running}
                onChange={(e) => setWithLoad(e.target.checked)}
              />
              <span>Incluir teste com carga (bufferbloat)</span>
            </label>
          </div>
          {running ? (
            <button
              className="button stop compact"
              onClick={() => void act(() => window.routepilot.cancelNetworkCheck())}
            >
              <Square size={14} /> Cancelar
            </button>
          ) : (
            <button className="button primary compact" disabled={busy} onClick={() => void run()}>
              Iniciar teste
            </button>
          )}
        </div>
        {running && <p className="route-compare-note">{step}</p>}
      </section>

      {result && (
        <>
          <SectionTitle>Resultado</SectionTitle>
          {result.dropped && (
            <div className={"network-alert " + (result.recovered ? "warn" : "bad")} role="alert">
              <strong>
                {result.recovered
                  ? "A ligação caiu durante o teste e já voltou."
                  : "A ligação caiu durante o teste e ainda não voltou."}
              </strong>
              <span>
                {result.recovered
                  ? "O RoutePilot parou a carga assim que deixou de haver resposta. O teu router ou a operadora não aguentam a ligação cheia."
                  : "O RoutePilot já parou toda a carga. Espera uns segundos; se não voltar, desliga e liga o Wi-Fi/cabo ou reinicia o router."}
              </span>
            </div>
          )}
          <p className="route-compare-note">
            Dados usados neste teste: {result.dataUsedMb} MB
            {result.metered ? " · ligação tarifada/móvel" : ""}.
          </p>
          <div className="network-summary">
            <div className="network-card">
              <span>Ligação</span>
              <strong>
                {result.wifi ? <Wifi size={18} /> : <Cable size={18} />}{" "}
                {result.wifi === null ? "Desconhecida" : result.wifi ? "Wi-Fi" : "Cabo"}
              </strong>
              <small>
                {[result.wifiSignal !== null ? `Sinal ${result.wifiSignal}%` : null, result.linkSpeed]
                  .filter(Boolean)
                  .join(" · ") || result.adapterName || ""}
              </small>
            </div>
            <div className="network-card">
              <span>Bufferbloat</span>
              <strong className={"grade grade-" + (result.bufferbloatGrade ?? "na").replace("+", "p")}>
                {result.bufferbloatGrade ?? "—"}
              </strong>
              <small>
                +{ms(result.downloadIncreaseMs)} download · +{ms(result.uploadIncreaseMs)} upload
              </small>
            </div>
            <div className="network-card">
              <span>Velocidade durante o teste</span>
              <strong>
                {result.downloadMbps ?? "—"} / {result.uploadMbps ?? "—"} Mbit/s
              </strong>
              <small>download / upload</small>
            </div>
          </div>

          <table className="route-compare-table">
            <thead>
              <tr>
                <th>Medição</th>
                <th>Ping (mediana)</th>
                <th>Jitter</th>
                <th>Sem resposta</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Router {result.gatewayAddress ? `(${result.gatewayAddress})` : ""}</td>
                <td>{ms(result.gateway.medianMs)}</td>
                <td>{ms(result.gateway.jitterMs)}</td>
                <td>{loss(result.gateway)}</td>
              </tr>
              <tr>
                <td>Internet, ligação parada</td>
                <td>{ms(result.idle.medianMs)}</td>
                <td>{ms(result.idle.jitterMs)}</td>
                <td>{loss(result.idle)}</td>
              </tr>
              <tr>
                <td>Internet, durante download</td>
                <td>{ms(result.download.medianMs)}</td>
                <td>{ms(result.download.jitterMs)}</td>
                <td>{loss(result.download)}</td>
              </tr>
              <tr>
                <td>Internet, durante upload</td>
                <td>{ms(result.upload.medianMs)}</td>
                <td>{ms(result.upload.jitterMs)}</td>
                <td>{loss(result.upload)}</td>
              </tr>
            </tbody>
          </table>

          <SectionTitle>O que fazer</SectionTitle>
          <ul className="network-advice">
            {result.advice.map((tip) => (
              <li key={tip}>
                <Lightbulb size={15} />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      </>
      )}
      {tool === "monitor" && <NetworkMonitor />}
      {tool === "ligacoes" && <NetLinks />}
    </>
  );
}
