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

  useEffect(
    () => window.routepilot?.onNetworkProgress?.((s) => setStep(s)),
    [],
  );

  const run = async () => {
    setRunning(true);
    setStep("A iniciar…");
    try {
      const r = await act(() => window.routepilot.runNetworkCheck());
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
        title="Verificar a minha rede"
        subtitle="Encontra o que está a aumentar o teu ping dentro de casa: Wi-Fi, router e bufferbloat."
      />
      <section className="panel network-panel">
        <div className="route-compare-head">
          <div>
            <h3>
              <Gauge size={16} /> Teste completo (~30 s)
            </h3>
            <p>
              Mede o router, o ping com a ligação parada e o ping durante um
              download e um upload. A carga usa os servidores de teste da
              Cloudflare (speed.cloudflare.com) e consome cerca de 100–500 MB.
            </p>
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

      <SectionTitle>Network Analyzer</SectionTitle>
      <NetworkMonitor />

      <SectionTitle>Ligações</SectionTitle>
      <NetLinks />
    </>
  );
}
