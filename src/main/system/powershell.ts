import { runProcess, systemCommand } from "../diagnostics/process";

export const powershellPath = () =>
  systemCommand("WindowsPowerShell/v1.0/powershell.exe");

export const psQuote = (s: string) => `'${s.replace(/'/g, "''")}'`;

// Corre um script sem privilégios e devolve o stdout (UTF-8).
export async function runPs(script: string, signal: AbortSignal, timeoutMs = 20000) {
  const r = await runProcess(
    powershellPath(),
    ["-NoProfile", "-NonInteractive", "-Command", script],
    signal,
    timeoutMs,
    1 << 20,
    "utf8",
  );
  if (r.timedOut) throw new Error("O PowerShell excedeu o tempo.");
  return r;
}

export async function runPsJson<T>(script: string, signal: AbortSignal): Promise<T | null> {
  const r = await runPs(script, signal);
  const text = r.stdout.trim();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

// Um único pedido de administrador (UAC); o processo elevado corre escondido.
export async function runElevated(script: string, signal: AbortSignal) {
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  const launcher = [
    "$ErrorActionPreference = 'Stop'",
    "try {",
    `  $p = Start-Process -FilePath '${powershellPath()}' -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ArgumentList '-NoProfile','-NonInteractive','-EncodedCommand','${encoded}'`,
    "  exit $p.ExitCode",
    "} catch { Write-Output 'UAC_DENIED'; exit 5 }",
  ].join("\n");
  const r = await runProcess(
    powershellPath(),
    ["-NoProfile", "-NonInteractive", "-Command", launcher],
    signal,
    120000,
    65536,
    "utf8",
  );
  if (r.stdout.includes("UAC_DENIED"))
    throw new Error("Permissão de administrador recusada. Nada foi alterado.");
  if (r.timedOut) throw new Error("O pedido de permissão expirou.");
  if (r.code !== 0)
    throw new Error(`O Windows recusou a alteração (código ${r.code}).`);
}
