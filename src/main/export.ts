import { writeFile } from "node:fs/promises";
import { ok, fail, type Session, type Result } from "../shared/contracts";
const cell = (v: unknown) => {
  const raw = v === null || v === undefined ? "" : String(v);
  const safe =
    typeof v === "string" && /^[\s]*[=+\-@\t\r]/.test(raw) ? "'" + raw : raw;
  return '"' + safe.replaceAll('"', '""') + '"';
};
export async function exportSessions(
  sessions: Session[],
  format: "json" | "csv",
  path: string,
): Promise<Result<void>> {
  try {
    const rows = [
      [
        "Sessão",
        "Aplicação ID",
        "Destino",
        "Host",
        "Início",
        "Fim",
        "Estado",
        "Enviados",
        "Recebidos",
        "Mínimo ms",
        "Média ms",
        "Jitter ms",
        "Sem resposta %",
      ],
      ...sessions.map((s) => [
        s.id,
        s.gameId,
        s.target.label,
        s.target.host,
        s.startedAt,
        s.endedAt,
        s.state,
        s.metrics.sent,
        s.metrics.received,
        s.metrics.minMs,
        s.metrics.meanMs,
        s.metrics.jitterMs,
        s.metrics.noReplyPercent,
      ]),
    ];
    await writeFile(
      path,
      format === "json"
        ? JSON.stringify(sessions, null, 2)
        : "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n"),
      "utf8",
    );
    return ok(undefined);
  } catch (e) {
    return fail("export_failed", String(e));
  }
}
