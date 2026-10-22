import { spawn } from "node:child_process";
import { join } from "node:path";
import { StringDecoder } from "node:string_decoder";
export type ProcessOutput = {
  stdout: string;
  stderr: string;
  code: number | null;
  cancelled: boolean;
  timedOut: boolean;
  error: string | null;
};
export const systemCommand = (name: string) =>
  join(process.env.SystemRoot || "C:/Windows", "System32", name);
export function runProcess(
  command: string,
  args: string[],
  signal: AbortSignal,
  timeoutMs: number,
  maxBytes: number,
  encoding: BufferEncoding = "latin1",
): Promise<ProcessOutput> {
  return new Promise((resolve) => {
    const result: ProcessOutput = {
      stdout: "",
      stderr: "",
      code: null,
      cancelled: signal.aborted,
      timedOut: false,
      error: null,
    };
    if (signal.aborted) {
      resolve(result);
      return;
    }
    const child = spawn(command, args, {
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let total = 0;
    const stdoutDecoder = new StringDecoder(encoding);
    const stderrDecoder = new StringDecoder(encoding);
    let closed = false;
    const stop = () => {
      if (!closed) child.kill();
    };
    const abort = () => {
      result.cancelled = true;
      stop();
    };
    const timer = setTimeout(() => {
      result.timedOut = true;
      stop();
    }, timeoutMs);
    const capture = (stream: "stdout" | "stderr", chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        result.error = "Saída do processo excedeu o limite.";
        stop();
        return;
      }
      result[stream] += (
        stream === "stdout" ? stdoutDecoder : stderrDecoder
      ).write(chunk);
    };
    child.stdout.on("data", (chunk) => capture("stdout", chunk));
    child.stderr.on("data", (chunk) => capture("stderr", chunk));
    child.on("error", (e) => {
      result.error = e.message;
    });
    child.on("close", (code) => {
      closed = true;
      result.stdout += stdoutDecoder.end();
      result.stderr += stderrDecoder.end();
      result.code = code;
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      resolve(result);
    });
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}
