import { isIP } from "node:net";
import { z } from "zod";
import { fail, ok, type Result } from "./contracts";
export function validateHost(input: string): Result<string> {
  if (
    typeof input !== "string" ||
    !input ||
    input.length > 253 ||
    /\s/.test(input)
  )
    return fail("invalid_host", "Indique um hostname ou endereço IP válido.");
  if (isIP(input)) return ok(input);
  if (/^[\d.]+$/.test(input))
    return fail("invalid_host", "Endereço IP inválido.");
  if (
    input
      .split(".")
      .every((label) =>
        /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/.test(label),
      )
  )
    return ok(input);
  return fail(
    "invalid_host",
    "Use apenas o hostname ou IP, sem URL, espaços ou opções.",
  );
}
const id = z.string().min(1).max(80);
const installationSchema = z.strictObject({
  discoveryId: id,
  source: z.enum([
    "Steam",
    "Epic Games",
    "GOG",
    "Riot Games",
    "EA App",
    "Ubisoft",
    "Battle.net",
    "Windows",
    "Personalizado",
  ]),
  externalId: z.string().min(1).max(4096),
  sourceName: z.string().min(1).max(4096),
  installPath: z.string().min(1).max(4096),
  evidencePath: z.string().min(1).max(4096),
});
export const targetSchema = z.strictObject({
  id,
  label: z.string().trim().min(1).max(80),
  host: z.string().refine((v) => validateHost(v).ok, "Hostname ou IP inválido"),
});
export const gameSchema = z
  .strictObject({
    id,
    name: z.string().trim().min(1).max(80),
    executablePath: z.string().max(4096).nullable(),
    targets: z.array(targetSchema).max(16),
    mode: z.enum(["manual", "automatic"]),
    selectedTargetId: id.nullable(),
    installation: installationSchema.optional(),
    enabled: z.boolean().optional(),
    redirectLogin: z.boolean().optional(),
  })
  .superRefine((game, ctx) => {
    if (new Set(game.targets.map((t) => t.id)).size !== game.targets.length)
      ctx.addIssue({ code: "custom", message: "IDs de destinos repetidos" });
    if (
      game.selectedTargetId &&
      !game.targets.some((t) => t.id === game.selectedTargetId)
    )
      ctx.addIssue({
        code: "custom",
        message: "Destino selecionado inexistente",
      });
  });
export const relaySchema = z.strictObject({
  id,
  label: z.string().trim().min(1).max(80),
  host: z.string().refine((v) => validateHost(v).ok, "Hostname ou IP inválido"),
  port: z.number().int().min(1).max(65535),
  token: z.string().min(32).max(256),
});
export const settingsSchema = z
  .strictObject({
    economyMode: z.boolean().optional(),
    sampleCount: z.number().int().min(1).max(120),
    timeoutMs: z.number().int().min(250).max(5000),
    intervalMs: z.number().int().min(250).max(10000),
    relays: z.array(relaySchema).max(8).optional(),
  })
  .refine(
    (s) => new Set((s.relays ?? []).map((r) => r.id)).size === (s.relays ?? []).length,
    "IDs de relays repetidos",
  );
const numberOrNull = z.number().finite().nonnegative().nullable();
const sampleSchema = z.strictObject({
  index: z.number().int().nonnegative(),
  at: z.iso.datetime(),
  status: z.enum(["reply", "timeout", "error"]),
  rttMs: numberOrNull,
  reason: z.string().max(2000).nullable(),
});
const metricsSchema = z.strictObject({
  sent: z.number().int().nonnegative(),
  received: z.number().int().nonnegative(),
  minMs: numberOrNull,
  meanMs: numberOrNull,
  jitterMs: numberOrNull,
  noReplyPercent: z.number().min(0).max(100).nullable(),
});
export const sessionSchema = z.strictObject({
  id,
  gameId: id,
  target: targetSchema,
  startedAt: z.iso.datetime(),
  endedAt: z.iso.datetime().nullable(),
  state: z.enum(["running", "completed", "cancelled", "failed"]),
  samples: z.array(sampleSchema).max(120),
  metrics: metricsSchema,
  selection: z
    .array(
      z.strictObject({
        target: targetSchema,
        samples: z.array(sampleSchema).max(3),
      }),
    )
    .max(16)
    .optional(),
});
export const storeSchema = z
  .strictObject({
    version: z.literal(1),
    games: z.array(gameSchema).max(64),
    sessions: z.array(sessionSchema).max(200),
    settings: settingsSchema,
    discovery: z
      .strictObject({
        steamLibraries: z.array(z.string().min(1).max(4096)).max(16),
      })
      .optional(),
    globalOptimization: z.boolean().optional(),
  })
  .refine(
    (s) => new Set(s.games.map((g) => g.id)).size === s.games.length,
    "IDs de aplicações repetidos",
  );
export const idSchema = id;
