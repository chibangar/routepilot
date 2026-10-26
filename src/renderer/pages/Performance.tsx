import { useCallback, useEffect, useState } from "react";
import { Gauge, Gamepad2, Rocket, Upload, X, Zap } from "lucide-react";
import type { PerfStatus, QosRule } from "../../shared/contracts";
import { useApp } from "../context";
import { PageHeading, SectionTitle, number } from "../components/UI";
import { HardwareGauges } from "../components/HardwareGauges";

const HIGH_PERFORMANCE = "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c";
const BALANCED = "381b4222-f694-41f0-9685-ff5bb260df2e";
const ULTIMATE = "e9a42b02-d5df-448d-aa00-03f14749eb61";

// Mesma lista que src/main/system/qos.ts (as que o RoutePilot pode limitar).
const QOS_APPS = [
  { exe: "OneDrive.exe", label: "OneDrive" },
  { exe: "Dropbox.exe", label: "Dropbox" },
  { exe: "GoogleDriveFS.exe", label: "Google Drive" },
  { exe: "steam.exe", label: "Steam" },
  { exe: "steamwebhelper.exe", label: "Steam (web)" },
  { exe: "EpicGamesLauncher.exe", label: "Epic Games" },
  { exe: "Discord.exe", label: "Discord" },
  { exe: "chrome.exe", label: "Google Chrome" },
  { exe: "msedge.exe", label: "Microsoft Edge" },
  { exe: "firefox.exe", label: "Firefox" },
  { exe: "qbittorrent.exe", label: "qBittorrent" },
  { exe: "uTorrent.exe", label: "µTorrent" },
  { exe: "obs64.exe", label: "OBS Studio" },
];

export function PerformancePage() {
  const { act, notify } = useApp();
  const [perf, setPerf] = useState<PerfStatus | null>(null);
  const [rules, setRules] = useState<QosRule[] | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [p, q] = await Promise.all([
      act(() => window.routepilot.perfStatus()),
      act(() => window.routepilot.qosStatus()),
    ]);
    if (p) setPerf(p);
    if (q) {
      setRules(q);
      setDraft(Object.fromEntries(q.map((r) => [r.exe.toLowerCase(), r.mbps])));
    }
  }, [act]);

  useEffect(() => {
    void load();
  }, [load]);

  const step = async <T,>(task: () => Promise<T | undefined>, done: string, apply?: (v: T) => void) => {
    setBusy(true);
    try {
      const r = await task();
      if (r !== undefined) {
        apply?.(r);
        notify(done);
      }
    } finally {
      setBusy(false);
    }
  };

  const scheme = perf?.powerScheme;
  const highOn = scheme?.guid === HIGH_PERFORMANCE || scheme?.guid === ULTIMATE;
  const limits = Object.entries(draft)
    .filter(([, mbps]) => mbps > 0)
    .map(([exe, mbps]) => ({ exe: QOS_APPS.find((a) => a.exe.toLowerCase() === exe)?.exe ?? exe, mbps }));

  return (
    <>
      <PageHeading
        eyebrow="MAIS FPS, MENOS LAG"
        title="Desempenho"
        subtitle="Ajustes reais do Windows para jogar, cada um com botão para desfazer."
      />

      <SectionTitle>Hardware</SectionTitle>
      <HardwareGauges />

      <SectionTitle>Windows</SectionTitle>
      <section className="panel settings-panel">
        <div className="setting-row">
          <div>
            <h3>
              <Zap size={17} /> Plano de energia
            </h3>
            <p>
              Atual: <strong>{scheme?.name ?? "—"}</strong>. O plano de alto
              desempenho evita que o processador baixe a velocidade a meio do
              jogo. Gasta mais energia, sobretudo em portáteis.
            </p>
          </div>
          {highOn ? (
            <button
              className="button secondary compact"
              disabled={busy}
              onClick={() =>
                void step(() => act(() => window.routepilot.perfPowerScheme(BALANCED)), "Plano equilibrado ativo.", setPerf)
              }
            >
              Voltar a equilibrado
            </button>
          ) : (
            <button
              className="button primary compact"
              disabled={busy}
              onClick={() =>
                void step(
                  () => act(() => window.routepilot.perfPowerScheme(HIGH_PERFORMANCE)),
                  "Plano de alto desempenho ativo.",
                  setPerf,
                )
              }
            >
              Ativar alto desempenho
            </button>
          )}
        </div>
        <div className="setting-row">
          <div>
            <h3>
              <Gamepad2 size={17} /> Modo de Jogo do Windows
            </h3>
            <p>
              Dá prioridade ao jogo e evita atualizações e notificações do
              Windows enquanto jogas. Recomendado ligado.
            </p>
          </div>
          <label className="cs2-auto-toggle">
            <input
              type="checkbox"
              checked={!!perf?.gameModeOn}
              disabled={busy || !perf}
              onChange={(e) =>
                void step(
                  () => act(() => window.routepilot.perfGameMode(e.target.checked)),
                  e.target.checked ? "Modo de Jogo ligado." : "Modo de Jogo desligado.",
                  setPerf,
                )
              }
            />
            <span>{perf?.gameModeOn ? "Ligado" : "Desligado"}</span>
          </label>
        </div>
        <div className="setting-row">
          <div>
            <h3>
              <Rocket size={17} /> Prioridade do jogo
            </h3>
            <p>
              {perf?.runningGames.length
                ? `A correr: ${perf.runningGames.map((g) => `${g.name} (${g.priority})`).join(", ")}. `
                : "Nenhum jogo conhecido a correr agora. "}
              Dá prioridade alta ao processo do jogo; volta ao normal quando o
              jogo fecha.
            </p>
          </div>
          <button
            className="button primary compact"
            disabled={busy || !perf?.runningGames.length}
            onClick={() =>
              void step(
                () => act(() => window.routepilot.perfBoostGames()),
                "Prioridade alta aplicada ao jogo.",
                () => void load(),
              )
            }
          >
            Dar prioridade
          </button>
        </div>
      </section>

      <SectionTitle>Apps em segundo plano</SectionTitle>
      <section className="panel network-panel">
        <p className="route-compare-note">
          As apps que mais memória usam agora. Fechar as que não precisas liberta
          recursos para o jogo. (Não usamos "limpezas de RAM": o Windows gere a
          memória melhor sozinho e esvaziá-la à força deixa o PC mais lento.)
        </p>
        <table className="route-compare-table">
          <thead>
            <tr>
              <th>App</th>
              <th>Memória</th>
              <th>CPU usado</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(perf?.heavy ?? []).slice(0, 12).map((p) => (
              <tr key={p.name}>
                <td>
                  {p.name} {p.count > 1 && <small>({p.count} processos)</small>}
                </td>
                <td>{number(p.memoryMb, 0)} MB</td>
                <td>{number(p.cpuSeconds, 0)} s</td>
                <td>
                  {p.closable && (
                    <button
                      className="quick-setup-link"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Fechar ${p.name}? Trabalho não guardado nessa app pode perder-se.`))
                          void step(
                            () => act(() => window.routepilot.perfCloseProcess(p.name)),
                            `${p.name} foi fechado.`,
                            setPerf,
                          );
                      }}
                    >
                      <X size={12} /> Fechar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <SectionTitle>Traffic Shaper</SectionTitle>
      <section className="panel network-panel">
        <div className="route-compare-head">
          <div>
            <h3>
              <Upload size={16} /> Limitar o upload de outras apps
            </h3>
            <p>
              Uploads (OneDrive, Discord, streaming…) enchem a ligação e fazem o
              ping subir. Define um limite em Mbit/s para cada app; o jogo fica
              com o resto. Usa as regras de QoS do Windows e só limita o
              upload. Para o download, ativa SQM/QoS no router (vê a página
              Rede).
            </p>
          </div>
          <Gauge size={20} />
        </div>
        <table className="route-compare-table">
          <thead>
            <tr>
              <th>App</th>
              <th>Limite de upload</th>
            </tr>
          </thead>
          <tbody>
            {QOS_APPS.map((a) => {
              const value = draft[a.exe.toLowerCase()] ?? 0;
              return (
                <tr key={a.exe} className={value > 0 ? "best" : ""}>
                  <td>
                    {a.label} <small>{a.exe}</small>
                  </td>
                  <td>
                    <div className="input-unit qos-input">
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        value={value || ""}
                        placeholder="sem limite"
                        aria-label={`Limite de upload de ${a.label}`}
                        onChange={(e) =>
                          setDraft({ ...draft, [a.exe.toLowerCase()]: Math.max(0, Math.min(1000, Math.round(Number(e.target.value) || 0))) })
                        }
                      />
                      <span>Mbit/s</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="cs2-best">
          <p className="route-compare-note">
            {rules?.length
              ? `Ativo: ${rules.map((r) => `${r.label} ${r.mbps} Mbit/s`).join(", ")}.`
              : "Nenhum limite ativo."}{" "}
            Aplicar pede permissão de administrador.
          </p>
          <button
            className="button primary compact"
            disabled={busy}
            onClick={() =>
              void step(
                () => act(() => window.routepilot.qosApply(limits)),
                limits.length ? "Limites de upload aplicados." : "Limites de upload removidos.",
                (r) => setRules(r),
              )
            }
          >
            {limits.length ? "Aplicar limites" : "Remover limites"}
          </button>
        </div>
      </section>
    </>
  );
}
