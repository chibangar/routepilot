import {
  Activity,
  ArrowRight,
  Gamepad2,
  Plus,
  Radio,
  Search,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Game, Metrics, Sample, Session } from "../../shared/contracts";
import cs2Img from "../assets/games/cs2.jpg";
import valorantImg from "../assets/games/valorant.jpg";
import eafcImg from "../assets/games/eafc.jpg";
import fortniteImg from "../assets/games/fortnite.jpg";
import lolImg from "../assets/games/lol.jpg";
import gta5Img from "../assets/games/gta5.jpg";
import lineage2Img from "../assets/games/lineage2.jpg";
import apexImg from "../assets/games/apex.jpg";
import dota2Img from "../assets/games/dota2.jpg";
import rustImg from "../assets/games/rust.jpg";
import teamspeakSvg from "../assets/games/teamspeak.svg";

export function getGameCoverUrl(game: Pick<Game, "name"> & { installation?: { source?: string; externalId?: string } }): string | null {
  const name = game.name.toLowerCase();
  if (name.includes("counter-strike") || name.includes("cs2") || name.includes("csgo") || name.includes("cs:go")) {
    return cs2Img;
  }
  if (name.includes("valorant")) {
    return valorantImg;
  }
  if (name.includes("fc") || name.includes("fifa")) {
    return eafcImg;
  }
  if (name.includes("fortnite")) {
    return fortniteImg;
  }
  if (name.includes("league of legends") || name.includes("lol")) {
    return lolImg;
  }
  if (name.includes("grand theft auto") || name.includes("gta")) {
    return gta5Img;
  }
  if (name.includes("lineage")) {
    return lineage2Img;
  }
  if (name.includes("apex")) {
    return apexImg;
  }
  if (name.includes("dota")) {
    return dota2Img;
  }
  if (name.includes("rust")) {
    return rustImg;
  }
  if (name.includes("teamspeak") || name.includes("ts3")) {
    return teamspeakSvg;
  }
  if (game.installation?.source === "steam" && game.installation.externalId && /^\d+$/.test(game.installation.externalId)) {
    return `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${game.installation.externalId}/header.jpg`;
  }
  return null;
}
export const number = (value: number | null | undefined, digits = 1) =>
  value === null || value === undefined
    ? "—"
    : value < 1 && value > 0
      ? "<1"
      : value.toLocaleString("pt-PT", { maximumFractionDigits: digits });
export const date = (value: string) =>
  new Date(value).toLocaleString("pt-PT", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export const stateName = (state: Session["state"]) =>
  ({
    running: "Em curso",
    completed: "Concluído",
    cancelled: "Cancelado",
    failed: "Falhou",
  })[state];
export function GameIcon({
  game,
  large = false,
}: {
  game: Pick<Game, "name"> & { installation?: { source?: string; externalId?: string } };
  large?: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const coverUrl = !imgError ? getGameCoverUrl(game) : null;
  const isTeamSpeak =
    game.name.toLowerCase().includes("teamspeak") ||
    game.name.toLowerCase().includes("ts3");

  if (coverUrl) {
    if (isTeamSpeak) {
      return (
        <div className={"game-icon teamspeak-icon " + (large ? "large" : "")}>
          <img
            src={coverUrl}
            alt={game.name}
            className="game-icon-svg"
            style={{
              width: large ? 32 : 20,
              height: large ? 32 : 20,
              filter: "brightness(0) invert(1)",
            }}
            onError={() => setImgError(true)}
          />
        </div>
      );
    }
    return (
      <div className={"game-icon game-cover-icon " + (large ? "large" : "")}>
        <img
          src={coverUrl}
          alt={game.name}
          className="game-icon-img"
          loading="lazy"
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  let hash = 0;
  for (const c of game.name) hash = (hash + c.charCodeAt(0) * 17) % 360;
  return (
    <div
      className={"game-icon " + (large ? "large" : "")}
      style={{ "--game-hue": hash } as React.CSSProperties}
    >
      <Gamepad2 size={large ? 30 : 23} />
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title,
  text,
  action,
  icon,
}: {
  title: string;
  text: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon ?? <Radio size={30} />}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function MetricGrid({ metrics }: { metrics: Metrics | undefined }) {
  return (
    <div className="metric-grid">
      {[
        ["Ping mínimo", metrics?.minMs, "ms"],
        ["Ping médio", metrics?.meanMs, "ms"],
        ["Jitter médio", metrics?.jitterMs, "ms"],
        ["Sondas sem resposta", metrics?.noReplyPercent, "%"],
      ].map(([label, value, unit], i) => (
        <div className="metric" key={String(label)}>
          <span>{label}</span>
          <strong
            className={
              i === 0 && value !== null && value !== undefined ? "mint" : ""
            }
          >
            {number(value as number | undefined)}
            <small>{value !== null && value !== undefined ? unit : ""}</small>
          </strong>
        </div>
      ))}
    </div>
  );
}
export function PingChart({ samples }: { samples: Sample[] }) {
  const values = samples.filter((s) => s.rttMs !== null).map((s) => s.rttMs!);
  const max = Math.max(10, ...values) * 1.25;
  const width = 900,
    height = 160;
  const segments: string[][] = [[]];
  samples.forEach((s, i) => {
    if (s.status !== "reply") {
      segments.push([]);
      return;
    }
    segments
      .at(-1)!
      .push(
        `${samples.length === 1 ? width / 2 : (i / (samples.length - 1)) * width},${height - ((s.rttMs ?? 0) / max) * height}`,
      );
  });
  return (
    <div className="chart">
      <div className="chart-scale">
        <span>{number(max, 0)} ms</span>
        <span>0 ms</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Latência das sondas; falhas aparecem como interrupções"
      >
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#35d9ac" stopOpacity=".18" />
            <stop offset="100%" stopColor="#35d9ac" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <line
            key={i}
            x1="0"
            y1={(i * height) / 3}
            x2={width}
            y2={(i * height) / 3}
            stroke="#252a32"
            strokeDasharray="4 6"
          />
        ))}
        {segments
          .filter((s) => s.length)
          .map((points, i) => (
            <g key={i}>
              <polygon
                points={`${points[0].split(",")[0]},${height} ${points.join(" ")} ${points.at(-1)!.split(",")[0]},${height}`}
                fill="url(#chartFill)"
              />
              <polyline
                points={points.join(" ")}
                fill="none"
                stroke="#43e4b5"
                strokeWidth="2.5"
                vectorEffect="non-scaling-stroke"
              />
              {points.map((p, j) => (
                <circle
                  key={j}
                  cx={p.split(",")[0]}
                  cy={p.split(",")[1]}
                  r="3"
                  fill="#43e4b5"
                />
              ))}
            </g>
          ))}
      </svg>
      {!values.length && (
        <div className="chart-empty">
          As respostas aparecem aqui durante o diagnóstico
        </div>
      )}
      <div className="chart-footer">
        <span>Primeira sonda</span>
        <span>{samples.length} observações · ICMP</span>
        <span>Última sonda</span>
      </div>
    </div>
  );
}
export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="section-title">
      <h2>{children}</h2>
      {action}
    </div>
  );
}
export function AddButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="button primary" onClick={onClick}>
      <Plus size={17} />
      Adicionar aplicação
    </button>
  );
}
export function SearchField({
  value,
  onChange,
  placeholder = "Pesquisar aplicações...",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search-field">
      <Search size={17} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
export function SessionEvidence({ session }: { session: Session }) {
  return (
    <div className="session-evidence">
      <div className="evidence-meta">
        <span>Origem: ping.exe · ICMP</span>
        <span>{date(session.startedAt)}</span>
        <span>
          {session.metrics.received}/{session.metrics.sent} respostas
        </span>
      </div>
      <p className="muted small">
        Variação entre respostas consecutivas, sem atravessar falhas. Respostas
        «&lt;1 ms» usam 0,5 ms como estimativa nos cálculos.
      </p>
      <div className="sample-table">
        <table>
          <thead>
            <tr>
              <th>Sonda</th>
              <th>Hora</th>
              <th>Resultado</th>
              <th>RTT</th>
            </tr>
          </thead>
          <tbody>
            {session.samples.map((s) => (
              <tr key={s.index}>
                <td>{s.index + 1}</td>
                <td>{new Date(s.at).toLocaleTimeString("pt-PT")}</td>
                <td>
                  {s.status === "reply"
                    ? "Resposta"
                    : s.status === "timeout"
                      ? "Sem resposta"
                      : "Erro de diagnóstico"}
                </td>
                <td>
                  {number(s.rttMs)}
                  {s.rttMs !== null ? " ms" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details>
        <summary>Ver saída original das sondas</summary>
        <pre>
          {session.samples
            .map(
              (s) =>
                `#${s.index + 1} · ${s.at}\n${s.reason ?? "Sem saída textual."}`,
            )
            .join("\n\n")}
        </pre>
      </details>
      {session.selection && (
        <details>
          <summary>Comparação automática de destinos</summary>
          {session.selection.map((c) => (
            <div className="selection-result" key={c.target.id}>
              <strong>
                {c.target.label} · {c.target.host}
              </strong>
              <p>
                {c.samples.filter((s) => s.status === "reply").length}/
                {c.samples.length} respostas. Comparação parcial quando existem
                falhas.
              </p>
              <pre>
                {c.samples.map((s) => s.reason ?? String(s.rttMs)).join("\n")}
              </pre>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}
