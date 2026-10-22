import { isIP } from "node:net";
import {
  ok,
  fail,
  type Target,
  type Trace,
  type Hop,
  type Result,
} from "../../shared/contracts";
import { targetSchema } from "../../shared/validation";
import { runProcess, systemCommand } from "./process";
function ipIdentity(address: string | null): string | null {
  if (!address) return null;
  if (isIP(address) !== 6) return address;
  const [base, scope] = address.split("%");
  return new URL(`http://[${base}]/`).hostname + (scope ? "%" + scope : "");
}
export function parseTrace(target: Target, raw: string): Trace {
  const hops: Hop[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const row = line.match(/^\s*(\d{1,2})\s+(.+)$/);
    if (!row) continue;
    const address = row[2].split(/\s+/).find((token) => isIP(token)) ?? null;
    const times = [...row[2].matchAll(/(<)?\s*(\d+)\s*ms/gi)].map(
      (m) => Number(m[2]) / (m[1] ? 2 : 1),
    );
    hops.push({
      ttl: Number(row[1]),
      address,
      rttMs: times.length
        ? times.reduce((a, b) => a + b, 0) / times.length
        : null,
      status:
        address && times.length
          ? "reply"
          : /\*/.test(row[2])
            ? "timeout"
            : "unparsed",
      raw: line,
    });
  }
  const header = raw
    .split(/\r?\n/)
    .filter((line) => !/^\s*\d+\s/.test(line))
    .join("\n");
  const resolved = isIP(target.host)
    ? target.host
    : (header.match(/\[([0-9a-f:.]+)\]/i)?.[1] ?? null);
  const complete =
    resolved !== null &&
    ipIdentity(hops.at(-1)?.address ?? null) === ipIdentity(resolved) &&
    hops.at(-1)?.status === "reply";
  return {
    target,
    raw,
    complete,
    hops,
    limitations: [
      ...(!complete ? ["Destino não confirmado; caminho parcial."] : []),
      "Traceroute observa respostas ICMP; o caminho do tráfego do jogo pode ser diferente.",
    ],
  };
}
export async function traceHost(
  target: Target,
  signal: AbortSignal,
): Promise<Result<Trace>> {
  if (!targetSchema.safeParse(target).success)
    return fail("invalid_target", "Destino de traceroute inválido.");
  const result = await runProcess(
    systemCommand("tracert.exe"),
    ["-d", "-h", "20", "-w", "500", target.host],
    signal,
    45000,
    262144,
  );
  if (result.error) return fail("trace_process", result.error);
  const trace = parseTrace(target, result.stdout);
  if (result.stderr) {
    trace.raw += "\n[stderr]\n" + result.stderr;
    trace.limitations.push(
      "O processo devolveu informação adicional no canal de diagnóstico.",
    );
  }
  if (result.cancelled || result.timedOut) {
    trace.complete = false;
    trace.limitations.unshift(
      result.cancelled
        ? "Diagnóstico cancelado; resultados parciais."
        : "Tempo máximo de 45 segundos atingido; resultados parciais.",
    );
  }
  return ok(trace);
}
