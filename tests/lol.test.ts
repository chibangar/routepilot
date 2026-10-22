import { expect, test } from "vitest";
import { LOL_REGIONS, isLol } from "../src/shared/lol-regions";

test("cada região do LoL aparece uma vez e mede até um relay conhecido", () => {
  const codes = LOL_REGIONS.map((r) => r.code);
  expect(new Set(codes).size).toBe(codes.length);
  expect(codes).toEqual(expect.arrayContaining(["EUW", "EUNE", "NA", "BR"]));
  for (const r of LOL_REGIONS)
    if (r.probe) expect(r.probe.pop).toMatch(/^[a-z0-9]{2,8}$/);
  // EUW e EUNE ficam em cidades com relay da Valve: medição direta.
  expect(LOL_REGIONS.find((r) => r.code === "EUW")?.probe).toMatchObject({ pop: "ams", match: "exact" });
});

test("reconhece o LoL pelo nome", () => {
  expect(isLol("League of Legends")).toBe(true);
  expect(isLol("LoL")).toBe(true);
  expect(isLol("Lineage II")).toBe(false);
});
