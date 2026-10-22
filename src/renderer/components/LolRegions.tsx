import { useState } from "react";
import { MapPin } from "lucide-react";
import type { LolScan } from "../../shared/contracts";
import { useApp } from "../context";
import { number } from "./UI";

const quality = (ms: number) =>
  ms < 40 ? "ótimo" : ms < 70 ? "bom" : ms < 110 ? "jogável" : "com lag";

export function LolRegions({ disabled }: { disabled: boolean }) {
  const { act } = useApp();
  const [scan, setScan] = useState<LolScan | null>(null);
  const [running, setRunning] = useState(false);
  const [all, setAll] = useState(false);

  const run = async () => {
    setRunning(true);
    try {
      const r = await act(() => window.routepilot.scanLol());
      if (r) setScan(r);
    } finally {
      setRunning(false);
    }
  };

  const best = scan?.regions.find((r) => r.pingMs !== null);
  const shown = all ? scan?.regions ?? [] : scan?.regions.slice(0, 6) ?? [];

  return (
    <section className="diagram-section-card route-compare">
      <div className="route-compare-head">
        <div>
          <h3>
            <MapPin size={16} /> Servidor do LoL mais perto de ti
          </h3>
          <p>
            Mede o ping até à cidade de cada servidor da Riot (EUW em
            Amesterdão, EUNE em Frankfurt…). A Riot não responde a ping, por
            isso medimos até servidores da Valve na mesma cidade: dá o ping
            real até lá, com uma diferença de poucos ms.
          </p>
        </div>
        <button
          className="button primary compact"
          disabled={disabled || running}
          onClick={() => void run()}
        >
          {running ? "A medir…" : scan ? "Medir de novo" : "Encontrar servidor"}
        </button>
      </div>

      {best && (
        <p className="route-compare-note">
          Servidor mais perto: <strong>{best.code} — {best.name}</strong> ({best.city}),
          cerca de {number(best.pingMs!, 0)} ms ({quality(best.pingMs!)}). No
          LoL o servidor é a região da tua conta: se não estás em {best.code},
          podes transferir a conta na loja do cliente (Conta → Transferência de
          servidor) ou criar uma conta nessa região.
        </p>
      )}

      {scan && (
        <>
          <table className="route-compare-table">
            <thead>
              <tr>
                <th>Região</th>
                <th>Cidade</th>
                <th>Ping estimado</th>
                <th>Qualidade</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.code} className={r.code === best?.code ? "best" : ""}>
                  <td>
                    <strong>{r.code}</strong> <small>{r.name}</small>
                  </td>
                  <td>
                    {r.city}
                    {r.match === "near" && <small> (medido via {r.via})</small>}
                  </td>
                  <td>
                    {r.pingMs === null
                      ? r.via
                        ? "sem resposta"
                        : "não mensurável"
                      : `${r.match === "near" ? "~" : ""}${number(r.pingMs, 0)} ms`}
                  </td>
                  <td>{r.pingMs === null ? "—" : quality(r.pingMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="quick-setup-link" onClick={() => setAll(!all)}>
            {all ? "Mostrar só as mais perto" : `Ver todas (${scan.regions.length})`}
          </button>
          <p className="route-compare-note">
            No jogo, Ctrl+F mostra o ping real. Se for muito acima deste valor,
            o problema está na tua rede de casa: experimenta a página Rede.
          </p>
        </>
      )}
    </section>
  );
}
