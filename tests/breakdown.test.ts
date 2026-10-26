import { expect, test } from "vitest";
import { analyse, type Measured } from "../src/main/diagnostics/breakdown";
import { validateCall } from "../src/main/ipc";
import { expectedMs, nearestPop, POP_PLACES } from "../src/shared/pop-locations";

const madrid = { id: "cs2-mad", group: "CS2", label: "Madrid (Spain)", host: "155.133.246.34" };
const frankfurt = { id: "cs2-fra", group: "CS2", label: "Frankfurt (Germany)", host: "155.133.226.71" };
const base = (over: Partial<Measured>): Measured => ({
  location: "continente",
  target: madrid,
  points: [],
  totalMs: 15,
  medianMs: 16,
  lossPct: 0,
  traceComplete: true,
  ...over,
});
const sum = (r: ReturnType<typeof analyse>) => r.segments.reduce((a, s) => a + s.ms, 0);

test("splits an Azores path into home, island ISP, cable and mainland", () => {
  const r = analyse(
    base({
      location: "acores",
      points: [
        { ttl: 1, address: "192.168.1.1", ms: 1 },
        { ttl: 2, address: "10.0.0.1", ms: 4 },
        { ttl: 3, address: "213.13.1.1", ms: 6 },
        { ttl: 4, address: "213.13.2.1", ms: 33 },
        { ttl: 5, address: "195.0.0.1", ms: 40 },
        { ttl: 6, address: "80.0.0.1", ms: 48 },
      ],
      totalMs: 52,
      medianMs: 54,
    }),
  );
  expect(r.segments.map((s) => [s.part, s.ms])).toEqual([
    ["casa", 1],
    ["operadora", 5],
    ["cabo", 27],
    ["continente", 19],
  ]);
  expect(sum(r)).toBeCloseTo(52);
  expect(r.hops.map((h) => h.part)).toEqual([
    "casa",
    "operadora",
    "operadora",
    "continente",
    "continente",
    "continente",
  ]);
  expect(r.verdict).toBe("distancia");
  expect(r.advice.some((a) => /cabo submarino/.test(a))).toBe(true);
});

test("blames the home network when the router itself is slow", () => {
  const r = analyse(
    base({ points: [{ ttl: 1, address: "192.168.1.1", ms: 25 }], totalMs: 40, medianMs: 60 }),
  );
  expect(r.verdict).toBe("casa");
  expect(r.segments[0]).toEqual({ part: "casa", label: "Casa (PC → router)", ms: 25 });
  expect(r.advice.some((a) => /cabo de rede/.test(a))).toBe(true);
  expect(r.advice.some((a) => /O ping varia/.test(a))).toBe(true);
});

test("flags a detour and suggests the nearer CS2 datacenter", () => {
  const r = analyse(
    base({
      target: frankfurt,
      points: [{ ttl: 1, address: "192.168.1.1", ms: 1 }],
      totalMs: 110,
      medianMs: 112,
    }),
  );
  expect(r.verdict).toBe("rota");
  expect(r.excessMs).toBeGreaterThan(50);
  expect(r.advice.some((a) => a.startsWith("Madrid fica mais perto"))).toBe(true);
});

test("ignores intermediate routers that answer pings slowly", () => {
  const r = analyse(
    base({
      points: [
        { ttl: 1, address: "192.168.1.1", ms: 1 },
        { ttl: 2, address: "10.1.1.1", ms: 200 },
        { ttl: 3, address: "62.0.0.1", ms: 9 },
      ],
      totalMs: 14,
    }),
  );
  expect(r.hops[1].ms).toBe(9);
  expect(r.hops[1].part).toBe("caminho");
  expect(r.segments).toEqual([
    { part: "casa", label: "Casa (PC → router)", ms: 1 },
    { part: "caminho", label: "Operadora → servidor", ms: 13 },
  ]);
  expect(r.verdict).toBe("bom");
});

test("distance estimates grow from mainland to islands and Madrid is nearest", () => {
  const mad = POP_PLACES.mad;
  expect(expectedMs("continente", mad)).toBeLessThan(expectedMs("madeira", mad));
  expect(expectedMs("madeira", mad)).toBeLessThan(expectedMs("acores", mad));
  for (const l of ["continente", "madeira", "acores"] as const)
    expect(nearestPop(l).code).toBe("mad");
});

test("IPC accepts only game server targets for the breakdown", () => {
  expect(validateCall({ operation: "pingBreakdown", args: { target: madrid, location: "acores" } }).ok).toBe(true);
  expect(
    validateCall({
      operation: "pingBreakdown",
      args: { target: { ...madrid, id: "router" }, location: "acores" },
    }).ok,
  ).toBe(false);
  expect(
    validateCall({ operation: "pingBreakdown", args: { target: madrid, location: "lua" } }).ok,
  ).toBe(false);
});

test("keeps ISP private hops out of home and spots an impossible island ping", () => {
  const r = analyse(
    base({
      location: "acores",
      points: [
        { ttl: 1, address: "192.168.1.254", ms: 2 },
        { ttl: 2, address: "10.207.64.1", ms: 3 },
        { ttl: 4, address: "195.8.30.245", ms: 7 },
      ],
      totalMs: 10,
    }),
  );
  expect(r.hops.map((h) => h.part)).toEqual(["casa", "caminho", "caminho"]);
  expect(r.headline).toMatch(/não bate com a localização/);
  expect(r.advice[0]).toMatch(/não é possível a partir dos Açores/);
});
