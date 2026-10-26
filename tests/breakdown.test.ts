import { expect, test } from "vitest";
import { analyse, type Measured } from "../src/main/diagnostics/breakdown";
import { validateCall } from "../src/main/ipc";
import { expectedMs, nearestPop, POP_PLACES, regionFor } from "../src/shared/pop-locations";

const madrid = { id: "cs2-mad", group: "CS2", label: "Madrid (Spain)", host: "155.133.246.34" };
const frankfurt = { id: "cs2-fra", group: "CS2", label: "Frankfurt (Germany)", host: "155.133.226.71" };
const base = (over: Partial<Measured>): Measured => ({
  location: "continente",
  connection: "cabo",
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
  expect(r.advice.some((a) => /Mesmo por cabo/.test(a))).toBe(true);
  expect(r.advice.some((a) => /O ping varia/.test(a))).toBe(true);
});

test("gives Wi-Fi advice on Wi-Fi and tolerates a few ms more at home", () => {
  const slow = analyse(
    base({ connection: "wifi", points: [{ ttl: 1, address: "192.168.1.1", ms: 25 }], totalMs: 40 }),
  );
  expect(slow.verdict).toBe("casa");
  expect(slow.advice.some((a) => /5 GHz/.test(a))).toBe(true);
  const normal = analyse(
    base({ connection: "wifi", points: [{ ttl: 1, address: "192.168.1.1", ms: 6 }], totalMs: 18 }),
  );
  expect(normal.verdict).toBe("bom");
  expect(normal.advice.at(-1)).toMatch(/em Wi-Fi, usa 5 GHz/);
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
  expect(validateCall({ operation: "pingBreakdown", args: { target: madrid, location: "acores", connection: "wifi" } }).ok).toBe(true);
  expect(
    validateCall({
      operation: "pingBreakdown",
      args: { target: { ...madrid, id: "router" }, location: "acores", connection: "cabo" },
    }).ok,
  ).toBe(false);
  expect(
    validateCall({ operation: "pingBreakdown", args: { target: madrid, location: "lua", connection: "cabo" } }).ok,
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

test("exact coordinates pick the region and refine the distance estimate", () => {
  expect(regionFor({ lat: 37.74, lon: -25.67 })).toBe("acores"); // Ponta Delgada
  expect(regionFor({ lat: 39.45, lon: -31.13 })).toBe("acores"); // Flores
  expect(regionFor({ lat: 32.65, lon: -16.91 })).toBe("madeira"); // Funchal
  expect(regionFor({ lat: 41.15, lon: -8.61 })).toBe("continente"); // Porto
  expect(regionFor({ lat: 48.86, lon: 2.35 })).toBeNull(); // Paris
  const mad = POP_PLACES.mad;
  // Flores fica mais longe do continente do que São Miguel.
  expect(expectedMs("acores", mad, { lat: 39.45, lon: -31.13 })).toBeGreaterThan(expectedMs("acores", mad));
  const r = analyse(base({ location: "acores", origin: { lat: 39.45, lon: -31.13 }, totalMs: 60 }));
  expect(r.exactLocation).toBe(true);
  expect(r.expectedMs).toBe(expectedMs("acores", mad, { lat: 39.45, lon: -31.13 }));
});

test("IPC validates the origin and the locate method", () => {
  const args = { target: madrid, location: "acores", connection: "cabo" };
  expect(validateCall({ operation: "pingBreakdown", args: { ...args, origin: { lat: 37.7, lon: -25.6 } } }).ok).toBe(true);
  expect(validateCall({ operation: "pingBreakdown", args: { ...args, origin: { lat: 137, lon: 0 } } }).ok).toBe(false);
  expect(validateCall({ operation: "locate", args: { method: "windows" } }).ok).toBe(true);
  expect(validateCall({ operation: "locate", args: { method: "gps" } }).ok).toBe(false);
});
