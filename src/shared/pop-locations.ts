import { LOL_REGIONS } from "./lol-regions";

// Coordenadas aproximadas dos datacenters da Valve (lista GetSDRConfig) e dos
// pontos de partida usados para estimar o ping mínimo que a distância permite.
export type Place = { name: string; lat: number; lon: number };

export const POP_PLACES: Record<string, Place> = {
  ams: { name: "Amesterdão", lat: 52.37, lon: 4.9 },
  atl: { name: "Atlanta", lat: 33.75, lon: -84.39 },
  bom2: { name: "Mumbai", lat: 19.08, lon: 72.88 },
  dfw: { name: "Dallas", lat: 32.78, lon: -96.8 },
  dxb: { name: "Dubai", lat: 25.2, lon: 55.27 },
  eze: { name: "Buenos Aires", lat: -34.6, lon: -58.38 },
  fra: { name: "Frankfurt", lat: 50.11, lon: 8.68 },
  gru: { name: "São Paulo", lat: -23.55, lon: -46.63 },
  gum: { name: "Guam", lat: 13.44, lon: 144.79 },
  hkg: { name: "Hong Kong", lat: 22.32, lon: 114.17 },
  iad: { name: "Virgínia", lat: 39.0, lon: -77.45 },
  jnb: { name: "Joanesburgo", lat: -26.2, lon: 28.05 },
  lax: { name: "Los Angeles", lat: 34.05, lon: -118.24 },
  lhr: { name: "Londres", lat: 51.51, lon: -0.13 },
  lim: { name: "Lima", lat: -12.05, lon: -77.04 },
  maa2: { name: "Chennai", lat: 13.08, lon: 80.27 },
  mad: { name: "Madrid", lat: 40.42, lon: -3.7 },
  ord: { name: "Chicago", lat: 41.88, lon: -87.63 },
  par: { name: "Paris", lat: 48.86, lon: 2.35 },
  scl: { name: "Santiago", lat: -33.45, lon: -70.67 },
  sea: { name: "Seattle", lat: 47.61, lon: -122.33 },
  seo: { name: "Seul", lat: 37.57, lon: 126.98 },
  sgp: { name: "Singapura", lat: 1.35, lon: 103.82 },
  sto: { name: "Estocolmo", lat: 59.33, lon: 18.07 },
  syd: { name: "Sydney", lat: -33.87, lon: 151.21 },
  tyo: { name: "Tóquio", lat: 35.68, lon: 139.69 },
  vie: { name: "Viena", lat: 48.21, lon: 16.37 },
  waw: { name: "Varsóvia", lat: 52.23, lon: 21.01 },
};
const ALIASES: Record<string, string> = {
  sto2: "sto",
  dfra: "fra",
  dvie: "vie",
  dlhr: "lhr",
  dfjr: "dxb",
};

export type PingLocation = "continente" | "madeira" | "acores";
export const LOCATIONS: Record<PingLocation, Place & { island: boolean }> = {
  continente: { name: "Portugal continental", lat: 38.72, lon: -9.14, island: false },
  madeira: { name: "Madeira", lat: 32.65, lon: -16.91, island: true },
  acores: { name: "Açores", lat: 37.74, lon: -25.67, island: true },
};
// O tráfego das ilhas chega ao continente pelos cabos submarinos de Lisboa.
export const MAINLAND = LOCATIONS.continente;

export function distanceKm(a: Place, b: Place) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

// A luz na fibra faz ~100 km de ida e volta por ms. Os cabos não seguem a
// linha reta, por isso conta-se +60% de distância e 5 ms de acesso/routers.
const ROUTE_FACTOR = 1.6;
const ACCESS_MS = 5;
export const fibreMs = (km: number) => (km / 100) * ROUTE_FACTOR;

export type Coords = { lat: number; lon: number };

// Ponto de partida: a localização exata, quando a pessoa a deu, ou a cidade
// de referência da região.
const startOf = (location: PingLocation, origin?: Coords | null): Place & { island: boolean } =>
  origin ? { ...LOCATIONS[location], lat: origin.lat, lon: origin.lon } : LOCATIONS[location];

// Região a partir de coordenadas; null fora de Portugal.
export function regionFor({ lat, lon }: Coords): PingLocation | null {
  if (lat >= 36.5 && lat <= 40 && lon >= -31.5 && lon <= -24.5) return "acores";
  if (lat >= 29.8 && lat <= 33.3 && lon >= -17.5 && lon <= -15.7) return "madeira";
  if (lat >= 36.8 && lat <= 42.2 && lon >= -9.6 && lon <= -6.1) return "continente";
  return null;
}

export function cableMs(location: PingLocation, origin?: Coords | null) {
  const from = startOf(location, origin);
  return from.island ? fibreMs(distanceKm(from, MAINLAND)) : 0;
}

export function expectedMs(location: PingLocation, server: Place, origin?: Coords | null) {
  const from = startOf(location, origin);
  const km = from.island
    ? distanceKm(from, MAINLAND) + distanceKm(MAINLAND, server)
    : distanceKm(from, server);
  return Math.round(fibreMs(km) + ACCESS_MS);
}

export function placeForPop(code: string): Place | null {
  return POP_PLACES[ALIASES[code] ?? code] ?? null;
}

// Código do datacenter da Valve a partir do id de um alvo do monitor
// ("cs2-mad" ou "lol-EUW").
export function popForTarget(id: string): string | null {
  const cs2 = id.match(/^cs2-([a-z0-9]+)$/);
  if (cs2) return cs2[1];
  const lol = id.match(/^lol-([A-Z]+)$/);
  if (lol) return LOL_REGIONS.find((r) => r.code === lol[1])?.probe?.pop ?? null;
  return null;
}

export function nearestPop(location: PingLocation, origin?: Coords | null) {
  let best: { code: string; place: Place; ms: number } | null = null;
  for (const [code, place] of Object.entries(POP_PLACES)) {
    const ms = expectedMs(location, place, origin);
    if (!best || ms < best.ms) best = { code, place, ms };
  }
  return best!;
}
