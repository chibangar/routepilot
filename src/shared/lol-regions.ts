// Regiões do League of Legends e a cidade do datacenter (wiki oficial).
// A Riot não responde a ping, por isso o RTT é medido até um relay da Valve
// na mesma cidade ("exact") ou na cidade mais próxima disponível ("near").
export type LolRegion = {
  code: string;
  name: string;
  city: string;
  probe: { pop: string; match: "exact" | "near"; via: string } | null;
};

export const LOL_REGIONS: LolRegion[] = [
  { code: "EUW", name: "Europa Oeste", city: "Amesterdão", probe: { pop: "ams", match: "exact", via: "Amesterdão" } },
  { code: "EUNE", name: "Europa Nórdica e Leste", city: "Frankfurt", probe: { pop: "fra", match: "exact", via: "Frankfurt" } },
  { code: "NA", name: "América do Norte", city: "Chicago", probe: { pop: "ord", match: "exact", via: "Chicago" } },
  { code: "BR", name: "Brasil", city: "São Paulo", probe: { pop: "gru", match: "exact", via: "São Paulo" } },
  { code: "LAN", name: "América Latina Norte", city: "Miami", probe: { pop: "atl", match: "near", via: "Atlanta" } },
  { code: "LAS", name: "América Latina Sul", city: "Santiago", probe: { pop: "scl", match: "exact", via: "Santiago" } },
  { code: "RU", name: "Rússia", city: "Estocolmo", probe: { pop: "sto", match: "exact", via: "Estocolmo" } },
  { code: "TR", name: "Turquia", city: "Istambul", probe: null },
  { code: "ME", name: "Médio Oriente", city: "Bahrein", probe: { pop: "dxb", match: "near", via: "Dubai" } },
  { code: "SEA", name: "Sudeste Asiático", city: "Singapura", probe: { pop: "sgp", match: "exact", via: "Singapura" } },
  { code: "OCE", name: "Oceânia", city: "Sydney", probe: { pop: "syd", match: "exact", via: "Sydney" } },
  { code: "JP", name: "Japão", city: "Tóquio", probe: { pop: "tyo", match: "exact", via: "Tóquio" } },
  { code: "KR", name: "Coreia", city: "Seul", probe: { pop: "seo", match: "exact", via: "Seul" } },
  { code: "TW", name: "Taiwan, Hong Kong e Macau", city: "Taipé", probe: { pop: "hkg", match: "near", via: "Hong Kong" } },
  { code: "VN", name: "Vietname", city: "Ho Chi Minh", probe: { pop: "sgp", match: "near", via: "Singapura" } },
];

export const isLol = (name: string) =>
  /league of legends|\blol\b/i.test(name);
