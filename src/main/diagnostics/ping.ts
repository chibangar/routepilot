import { validateHost } from "../../shared/validation";
import type { Sample } from "../../shared/contracts";
import { runProcess, systemCommand } from "./process";
const sample = (
  status: Sample["status"],
  rttMs: number | null,
  reason: string | null,
): Sample => ({
  index: 0,
  at: new Date().toISOString(),
  status,
  rttMs,
  reason,
});
export function parsePing(output: string, exitCode: number | null): Sample {
  const match = output.match(
    /(?:time|tempo)\s*([=<])\s*(\d+(?:[.,]\d+)?)\s*ms/i,
  );
  if (match) {
    const value = Number(match[2].replace(",", "."));
    return sample(
      "reply",
      match[1] === "<" ? value / 2 : value,
      (match[1] === "<"
        ? "Valor inferior ao limite; metade do limite é usada como estimativa.\n"
        : "") + output.trim().slice(0, 1700),
    );
  }
  if (
    /could not find host|n.o.*encontrar.*host|cannot resolve|unknown host|general failure|falha geral/i.test(
      output,
    )
  )
    return sample("error", null, output.trim().slice(0, 1700));
  if (/timed out|unreachable|esgotado|inacess.vel/i.test(output))
    return sample("timeout", null, output.trim().slice(0, 1700));
  return sample(
    "error",
    null,
    `Não foi possível interpretar a resposta do ping (código ${exitCode ?? "desconhecido"}).\n` +
      output.trim().slice(0, 1600),
  );
}
export async function probeHost(
  host: string,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<Sample> {
  const valid = validateHost(host);
  if (!valid.ok) return sample("error", null, valid.error.message);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 250 || timeoutMs > 5000)
    return sample("error", null, "Timeout inválido.");
  const result = await runProcess(
    systemCommand("ping.exe"),
    ["-n", "1", "-w", String(timeoutMs), host],
    signal,
    timeoutMs + 3000,
    65536,
  );
  if (result.cancelled) return sample("error", null, "Cancelado.");
  if (result.error || result.timedOut)
    return sample(
      "error",
      null,
      result.error ?? "O processo ping excedeu o prazo.",
    );
  const parsed = parsePing(result.stdout, result.code);
  if (result.stderr)
    parsed.reason = (
      (parsed.reason ?? "") +
      "\n[stderr]\n" +
      result.stderr
    ).slice(0, 1900);
  return parsed;
}
