import { z } from "zod";
import {
  gameSchema,
  settingsSchema,
  targetSchema,
  idSchema,
  validateHost,
} from "../shared/validation";
import { ok, fail, type Result } from "../shared/contracts";
const empty = z.strictObject({});
const callSchema = z.discriminatedUnion("operation", [
  z.strictObject({ operation: z.literal("discoverGames"), args: empty }),
  z.strictObject({ operation: z.literal("autoDetectGames"), args: empty }),
  z.strictObject({ operation: z.literal("cancelDiscovery"), args: empty }),
  z.strictObject({ operation: z.literal("chooseSteamLibrary"), args: empty }),
  z.strictObject({
    operation: z.literal("importDiscoveredGames"),
    args: z.strictObject({ ids: z.array(idSchema).min(1).max(64) }),
  }),
  z.strictObject({ operation: z.literal("getState"), args: empty }),
  z.strictObject({ operation: z.literal("retrySave"), args: empty }),
  z.strictObject({ operation: z.literal("saveGame"), args: gameSchema }),
  z.strictObject({
    operation: z.literal("removeGame"),
    args: z.strictObject({ id: idSchema }),
  }),
  z.strictObject({ operation: z.literal("chooseExecutable"), args: empty }),
  z.strictObject({
    operation: z.literal("saveSettings"),
    args: settingsSchema,
  }),
  z.strictObject({
    operation: z.literal("startSession"),
    args: z.strictObject({ id: idSchema }),
  }),
  z.strictObject({
    operation: z.literal("cancelSession"),
    args: z.strictObject({ id: idSchema }),
  }),
  z.strictObject({ operation: z.literal("startTrace"), args: targetSchema }),
  z.strictObject({ operation: z.literal("cancelTrace"), args: empty }),
  z.strictObject({ operation: z.literal("compareRoutes"), args: targetSchema }),
  z.strictObject({ operation: z.literal("cancelCompare"), args: empty }),
  z.strictObject({ operation: z.literal("runNetworkCheck"), args: empty }),
  z.strictObject({ operation: z.literal("scanCs2"), args: empty }),
  z.strictObject({ operation: z.literal("scanLol"), args: empty }),
  z.strictObject({ operation: z.literal("monitorTargets"), args: empty }),
  z.strictObject({
    operation: z.literal("monitorStart"),
    args: z.strictObject({
      id: z.string().min(1).max(40),
      group: z.string().max(40),
      label: z.string().max(120),
      host: z.string().refine((v) => validateHost(v).ok),
    }),
  }),
  z.strictObject({ operation: z.literal("monitorStop"), args: empty }),
  z.strictObject({ operation: z.literal("perfStatus"), args: empty }),
  z.strictObject({
    operation: z.literal("perfPowerScheme"),
    args: z.strictObject({ guid: z.string().regex(/^[0-9a-f-]{36}$/i) }),
  }),
  z.strictObject({ operation: z.literal("perfGameMode"), args: z.strictObject({ on: z.boolean() }) }),
  z.strictObject({
    operation: z.literal("perfCloseProcess"),
    args: z.strictObject({ name: z.string().min(1).max(64) }),
  }),
  z.strictObject({ operation: z.literal("perfBoostGames"), args: empty }),
  z.strictObject({ operation: z.literal("qosStatus"), args: empty }),
  z.strictObject({
    operation: z.literal("qosApply"),
    args: z.strictObject({
      limits: z
        .array(z.strictObject({ exe: z.string().min(1).max(64), mbps: z.number().int().min(1).max(1000) }))
        .max(20),
    }),
  }),
  z.strictObject({ operation: z.literal("linksStatus"), args: empty }),
  z.strictObject({
    operation: z.literal("linksPrefer"),
    args: z.strictObject({ index: z.number().int().min(0).max(100000) }),
  }),
  z.strictObject({ operation: z.literal("linksAutomatic"), args: empty }),
  z.strictObject({ operation: z.literal("cs2Status"), args: empty }),
  z.strictObject({
    operation: z.literal("cs2SetMode"),
    args: z.strictObject({
      mode: z.enum(["auto", "manual", "off"]),
      allow: z.array(z.string().regex(/^[a-z0-9]{2,8}$/)).max(64),
    }),
  }),
  z.strictObject({ operation: z.literal("cs2Uninstall"), args: empty }),
  z.strictObject({ operation: z.literal("cancelNetworkCheck"), args: empty }),
  z.strictObject({ operation: z.literal("readHardware"), args: empty }),
  z.strictObject({
    operation: z.literal("exportSessions"),
    args: z.strictObject({ format: z.enum(["json", "csv"]) }),
  }),
  z.strictObject({ operation: z.literal("checkForUpdates"), args: empty }),
  z.strictObject({ operation: z.literal("installUpdate"), args: empty }),
]);
export type Call = z.infer<typeof callSchema>;
export function authorizeSender(
  expected: string,
  actual: string,
  mainFrame: boolean,
) {
  return mainFrame && expected === actual;
}
export function validateCall(value: unknown): Result<Call> {
  const parsed = callSchema.safeParse(value);
  return parsed.success
    ? ok(parsed.data)
    : fail("invalid_call", "Pedido inválido. Reveja os campos e limites.");
}
