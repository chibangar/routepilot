import { useEffect, useState } from "react";
import { MapPin, ShieldCheck, Trash2, Undo2, Zap } from "lucide-react";
import type { Cs2Mode, Cs2Scan, Cs2Status } from "../../shared/contracts";
import { useApp } from "../context";
import { number } from "./UI";

export const isCs2 = (name: string) => /counter[- ]?strike|\bcs2\b|\bcs:?go\b/i.test(name);

const quality = (ms: number) =>
  ms < 40 ? "ótimo" : ms < 70 ? "bom" : ms < 110 ? "jogável" : "com lag";

const CONSENT =
  "Para escolher o servidor sozinho, o RoutePilot vai instalar uma tarefa do Windows (\"RoutePilot CS2\") que corre como administrador ao iniciar sessão e a cada 6 horas.\n\n" +
  "Ela mede os servidores oficiais do CS2, mantém ativo o de menor ping e bloqueia os outros na Firewall do Windows (só UDP). Demora poucos segundos e não fica a correr.\n\n" +
  "O Windows pede permissão de administrador uma vez. Podes remover tudo no botão \"Remover do Windows\".\n\nContinuar?";

export function Cs2Datacenters({ disabled }: { disabled: boolean }) {
  const { act, notify } = useApp();
  const [scan, setScan] = useState<Cs2Scan | null>(null);
  const [status, setStatus] = useState<Cs2Status | null>(null);
  const [running, setRunning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [all, setAll] = useState(false);

  useEffect(() => {
    void act(() => window.routepilot.cs2Status()).then((s) => s && setStatus(s));
  }, [act]);

  const run = async () => {
    setRunning(true);
    try {
      const r = await act(() => window.routepilot.scanCs2());
      if (r) setScan(r);
    } finally {
      setRunning(false);
    }
  };

  const setMode = async (mode: Cs2Mode, allow: string[] = [], label = "") => {
    if (mode !== "off" && !status?.installed && !window.confirm(CONSENT)) return;
    setApplying(true);
    try {
      const s = await act(() => window.routepilot.cs2SetMode(mode, allow));
      if (s) {
        setStatus(s);
        notify(
          mode === "off"
            ? "Todos os servidores do CS2 voltaram a estar disponíveis."
            : `${label || "Servidor"} ativo. Reinicia o CS2 se já estiver aberto.`,
        );
      }
    } finally {
      setApplying(false);
    }
  };

  const remove = async () => {
    if (!window.confirm("Remover a tarefa do RoutePilot e todas as regras do CS2 do Windows?")) return;
    setApplying(true);
    try {
      const s = await act(() => window.routepilot.cs2Uninstall());
      if (s) {
        setStatus(s);
        notify("Tarefa e regras do RoutePilot removidas do Windows.");
      }
    } finally {
      setApplying(false);
    }
  };

  const nameOf = (code: string) =>
    scan?.datacenters.find((d) => d.code === code)?.name ?? code.toUpperCase();
  const active = status && status.mode !== "off" && status.ok && status.allowed.length > 0;
  const reachable = scan?.datacenters.filter((d) => d.pingMs !== null) ?? [];
  const best = reachable[0];
  const shown = all ? scan?.datacenters ?? [] : scan?.datacenters.slice(0, 10) ?? [];
  const busy = disabled || applying;

  return (
    <section className="diagram-section-card route-compare">
      <div className="route-compare-head">
        <div>
          <h3>
            <MapPin size={16} /> Servidores do CS2
          </h3>
          <p>
            O RoutePilot mede todos os datacenters oficiais da Valve e mantém
            ativo o de menor ping; os outros ficam bloqueados na Firewall do
            Windows, por isso o matchmaking só te põe no servidor mais rápido.
          </p>
        </div>
        <label className="cs2-auto-toggle">
          <input
            type="checkbox"
            checked={status?.mode === "auto"}
            disabled={busy}
            onChange={(e) =>
              void setMode(e.target.checked ? "auto" : "off", [], "Melhor servidor")
            }
          />
          <span>{applying ? "A aplicar…" : "Automático"}</span>
        </label>
      </div>

      {active && (
        <div className="cs2-active">
          <ShieldCheck size={16} />
          <span>
            {status.mode === "auto" ? "Automático" : "Manual"}: ativo em{" "}
            <strong>
              {status.allowed
                .map((c) => (status.pings[c] !== undefined ? `${nameOf(c)} (${status.pings[c]} ms)` : nameOf(c)))
                .join(", ")}
            </strong>{" "}
            · {status.blocked} bloqueados
            {status.checkedAt &&
              ` · verificado às ${new Date(status.checkedAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}`}
          </span>
          <button className="button secondary compact" disabled={busy} onClick={() => void setMode("off")}>
            <Undo2 size={14} /> Desativar
          </button>
        </div>
      )}
      {status?.ok === false && status.error && (
        <p className="relay-error">Última verificação falhou: {status.error}</p>
      )}

      <div className="cs2-best">
        <p className="route-compare-note">
          {best
            ? `Menor ping agora: ${best.name} com ${number(best.pingMs!, 0)} ms (${quality(best.pingMs!)}).`
            : "Mede os servidores para veres o ping de cada um."}
        </p>
        <button className="button secondary compact" disabled={busy || running} onClick={() => void run()}>
          {running ? "A medir…" : scan ? "Medir de novo" : "Ver servidores"}
        </button>
        {status?.mode !== "auto" && (
          <button
            className="button primary compact"
            disabled={busy}
            onClick={() => void setMode("auto", [], "Melhor servidor")}
          >
            <Zap size={14} /> Ativar o melhor automaticamente
          </button>
        )}
      </div>

      {scan && (
        <>
          <table className="route-compare-table">
            <thead>
              <tr>
                <th>Datacenter</th>
                <th>Ping</th>
                <th>Qualidade</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((d) => {
                const isAllowed = !!active && status!.allowed.includes(d.code);
                return (
                  <tr key={d.code} className={isAllowed ? "best" : ""}>
                    <td>
                      {d.name} <small>({d.code})</small>
                    </td>
                    <td>{d.pingMs === null ? "sem resposta" : `${number(d.pingMs, 0)} ms`}</td>
                    <td>
                      {isAllowed
                        ? "ativo"
                        : active
                          ? "bloqueado"
                          : d.pingMs === null
                            ? "—"
                            : quality(d.pingMs)}
                    </td>
                    <td>
                      {d.pingMs !== null && !isAllowed && (
                        <button
                          className="quick-setup-link"
                          disabled={busy}
                          onClick={() => void setMode("manual", [d.code], d.name)}
                        >
                          Ativar só este
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button className="quick-setup-link" onClick={() => setAll(!all)}>
            {all ? "Mostrar só os mais perto" : `Ver todos (${scan.datacenters.length})`}
          </button>
        </>
      )}

      <p className="route-compare-note">
        Com poucos servidores ativos, encontrar partida pode demorar mais. Dota
        2 e Deadlock usam a mesma rede da Valve e ficam também limitados.
        {status?.installed && (
          <>
            {" "}
            <button className="quick-setup-link" disabled={busy} onClick={() => void remove()}>
              <Trash2 size={12} /> Remover do Windows
            </button>
          </>
        )}
      </p>
    </section>
  );
}
