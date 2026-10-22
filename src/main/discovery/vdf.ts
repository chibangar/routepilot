export type Vdf = { [key: string]: string | Vdf };
/** Bounded KeyValues text parser: quoted/bare tokens, braces, // comments. */
export function parseVdf(input: string): Vdf {
  if (input.length > 1024 * 1024)
    throw new Error("Manifesto VDF demasiado grande.");
  let at = 0,
    tokens = 0;
  function skip() {
    while (at < input.length) {
      if (/\s/.test(input[at]) || input[at] === "\uFEFF") {
        at++;
        continue;
      }
      if (input.slice(at, at + 2) === "//") {
        while (at < input.length && input[at] !== "\n") at++;
        continue;
      }
      break;
    }
  }
  function token(): string | null {
    skip();
    if (at === input.length) return null;
    if (++tokens > 100000) throw new Error("Limite de tokens VDF atingido.");
    const c = input[at++];
    if (c === "{" || c === "}") return c;
    if (c === '"') {
      let value = "";
      while (at < input.length) {
        const next = input[at++];
        if (next === '"') return value;
        if (next === "\\") {
          if (at === input.length) throw new Error("Escape VDF incompleto.");
          const escaped = input[at++];
          value +=
            escaped === "n"
              ? "\n"
              : escaped === "t"
                ? "\t"
                : escaped === "r"
                  ? "\r"
                  : escaped === "\\"
                    ? "\\"
                    : escaped === '"'
                      ? '"'
                      : "\\" + escaped;
        } else value += next;
      }
      throw new Error("String VDF incompleta.");
    }
    let value = c;
    while (at < input.length && !/[\s{}]/.test(input[at])) value += input[at++];
    return value;
  }
  function object(nested: boolean, depth: number): Vdf {
    if (depth > 16) throw new Error("Profundidade VDF excedida.");
    const result: Vdf = Object.create(null);
    const keys = new Set<string>();
    for (;;) {
      const key = token();
      if (key === null) {
        if (nested) throw new Error("Objeto VDF incompleto.");
        return result;
      }
      if (key === "}") {
        if (!nested) throw new Error("Fecho VDF inesperado.");
        return result;
      }
      if (key === "{") throw new Error("Chave VDF em falta.");
      if (keys.has(key.toLowerCase()))
        throw new Error("Chave VDF repetida ou ambígua.");
      keys.add(key.toLowerCase());
      const value = token();
      if (value === null || value === "}")
        throw new Error("Valor VDF em falta.");
      result[key] = value === "{" ? object(true, depth + 1) : value;
    }
  }
  return object(false, 0);
}
export function vdfObject(value: string | Vdf | undefined): Vdf {
  if (!value || typeof value !== "object")
    throw new Error("Objeto VDF em falta.");
  return value;
}
export function vdfField(object: Vdf, name: string): string | Vdf | undefined {
  return Object.entries(object).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  )?.[1];
}
