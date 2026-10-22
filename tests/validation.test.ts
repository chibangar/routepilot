import { expect, test } from "vitest";
import {
  validateHost,
  gameSchema,
  settingsSchema,
} from "../src/shared/validation";
import { isEconomyMode } from "../src/shared/performance";
test("old settings default to economy and explicit choice is preserved", () => {
  expect(isEconomyMode({})).toBe(true);
  expect(isEconomyMode({ economyMode: false })).toBe(false);
  expect(
    settingsSchema.safeParse({
      sampleCount: 20,
      timeoutMs: 1000,
      intervalMs: 1000,
      economyMode: "yes",
    }).success,
  ).toBe(false);
});
test("accepts plain DNS, IPv4 and IPv6 destinations", () => {
  for (const host of ["example.com", "127.0.0.1", "::1"])
    expect(validateHost(host).ok).toBe(true);
});
test("rejects command syntax, URLs and empty destinations", () => {
  for (const host of ["", "-n", "a&b", "a b", "https://a.com", "a\n.com"])
    expect(validateHost(host).ok).toBe(false);
});
test("rejects unknown game properties and invalid selection", () => {
  expect(
    gameSchema.safeParse({
      id: "x",
      name: "Game",
      executablePath: null,
      targets: [],
      mode: "manual",
      selectedTargetId: null,
      evil: true,
    }).success,
  ).toBe(false);
  expect(
    settingsSchema.safeParse({
      sampleCount: 121,
      timeoutMs: 1000,
      intervalMs: 1000,
    }).success,
  ).toBe(false);
});
