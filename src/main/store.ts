import {
  readFile,
  writeFile,
  mkdir,
  rename,
  copyFile,
  stat,
} from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { ok, fail, type Store, type Result } from "../shared/contracts";
import { storeSchema } from "../shared/validation";
export const defaultStore = (): Store => ({
  version: 1,
  games: [],
  sessions: [],
  settings: {
    sampleCount: 20,
    timeoutMs: 1000,
    intervalMs: 1000,
    economyMode: true,
  },
});
export async function loadStore(path: string): Promise<Result<Store>> {
  try {
    if ((await stat(path)).size > MAX_STORE_BYTES)
      return fail(
        "invalid_store",
        "O ficheiro de dados excede 16 MiB; foi preservado.",
      );
    const parsed = storeSchema.safeParse(
      JSON.parse(await readFile(path, "utf8")),
    );
    return parsed.success
      ? ok(parsed.data)
      : fail(
          "invalid_store",
          "Dados locais inválidos. O ficheiro original foi preservado.",
        );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT")
      return ok(defaultStore());
    return fail(
      "store_read",
      `Não foi possível ler os dados; o original foi preservado. ${String(e)}`,
    );
  }
}
const MAX_STORE_BYTES = 16 * 1024 * 1024;
const queues = new Map<string, Promise<Result<Store>>>();
export function saveStore(path: string, store: Store): Promise<Result<Store>> {
  const parsed = storeSchema.safeParse(store);
  if (!parsed.success)
    return Promise.resolve(
      fail("invalid_store", "Dados recusados pela validação."),
    );
  const retained = parsed.data;
  const sizes = retained.sessions.map((s) =>
    Buffer.byteLength(JSON.stringify(s), "utf8"),
  );
  let count = retained.sessions.length;
  let bytes =
    Buffer.byteLength(JSON.stringify({ ...retained, sessions: [] }), "utf8") +
    sizes.reduce((a, b) => a + b, 0) +
    Math.max(0, count - 1);
  while (bytes > MAX_STORE_BYTES && count > 0) {
    bytes -= sizes[--count] + (count > 0 ? 1 : 0);
  }
  if (bytes > MAX_STORE_BYTES)
    return Promise.resolve(
      fail("store_capacity", "As configurações excedem o limite de 16 MiB."),
    );
  retained.sessions = retained.sessions.slice(0, count);
  const snapshot = JSON.stringify(retained);
  const run = async (): Promise<Result<Store>> => {
    const temp = path + "." + randomUUID() + ".tmp";
    try {
      await mkdir(dirname(path), { recursive: true });
      const previous = await loadStore(path);
      if (!previous.ok) return previous;
      try {
        await copyFile(path, path + ".bak");
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
      await writeFile(temp, snapshot, "utf8");
      await rename(temp, path);
      return ok(retained);
    } catch (e) {
      return fail("store_write", `Falha ao guardar dados. ${String(e)}`);
    }
  };
  const next = (queues.get(path) ?? Promise.resolve(ok(defaultStore()))).then(
    run,
    run,
  );
  queues.set(path, next);
  void next.finally(() => {
    if (queues.get(path) === next) queues.delete(path);
  });
  return next;
}
