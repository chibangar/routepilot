import type { Game, Target } from "./contracts";

export type RegionKey =
  | "América do Sul"
  | "Europa"
  | "América do Norte"
  | "Ásia"
  | "Oceânia";

export type GamePreset = {
  id: string;
  name: string;
  aliases: string[];
  processNames: string[];
  category: "FPS" | "Futebol" | "MMORPG" | "Voz" | "Battle Royale" | "Ação";
  icon: string;
  regions: {
    region: RegionKey;
    servers: {
      id: string;
      label: string;
      host: string;
      city: string;
      basePing: number;
    }[];
  }[];
};

export const PRESET_GAMES: GamePreset[] = [
  {
    id: "valorant",
    name: "Valorant",
    aliases: ["valorant", "riot valorant"],
    processNames: ["valorant.exe", "valorant-win64-shipping.exe", "riotclient.exe"],
    category: "FPS",
    icon: "valorant",
    regions: [
      {
        region: "América do Sul",
        servers: [
          {
            id: "val-sa-sp",
            label: "São Paulo (BR-SP)",
            host: "177.54.144.1",
            city: "São Paulo",
            basePing: 12,
          },
          {
            id: "val-sa-scl",
            label: "Santiago (CL-SCL)",
            host: "15.228.1.1",
            city: "Santiago",
            basePing: 38,
          },
        ],
      },
      {
        region: "Europa",
        servers: [
          {
            id: "val-eu-fra",
            label: "Frankfurt 01 (EU-DE)",
            host: "3.120.0.1",
            city: "Frankfurt",
            basePing: 34,
          },
          {
            id: "val-eu-mad",
            label: "Madrid 01 (EU-ES)",
            host: "15.237.0.1",
            city: "Madrid",
            basePing: 18,
          },
          {
            id: "val-eu-lon",
            label: "Londres 01 (EU-UK)",
            host: "3.8.0.1",
            city: "Londres",
            basePing: 42,
          },
          {
            id: "val-eu-par",
            label: "Paris 01 (EU-FR)",
            host: "15.188.0.1",
            city: "Paris",
            basePing: 36,
          },
        ],
      },
      {
        region: "América do Norte",
        servers: [
          {
            id: "val-na-va",
            label: "N. Virgínia (US-East)",
            host: "3.80.0.1",
            city: "Virgínia",
            basePing: 108,
          },
          {
            id: "val-na-ca",
            label: "Califórnia (US-West)",
            host: "54.183.0.1",
            city: "Califórnia",
            basePing: 145,
          },
        ],
      },
      {
        region: "Ásia",
        servers: [
          {
            id: "val-as-tyo",
            label: "Tóquio (JP-TYO)",
            host: "13.112.0.1",
            city: "Tóquio",
            basePing: 220,
          },
        ],
      },
    ],
  },
  {
    id: "ea-fc-26",
    name: "EA SPORTS FC 26",
    aliases: [
      "ea sports fc 26",
      "ea sports fc 25",
      "ea sports fc 24",
      "fc 26",
      "fc 25",
      "fc 24",
      "fifa 23",
      "fifa",
    ],
    processNames: ["fc26.exe", "fc25.exe", "fc24.exe", "fifa23.exe"],
    category: "Futebol",
    icon: "ea-fc",
    regions: [
      {
        region: "América do Sul",
        servers: [
          {
            id: "fc-sa-sp",
            label: "São Paulo 01 (SA-BR)",
            host: "15.228.10.1",
            city: "São Paulo",
            basePing: 14,
          },
        ],
      },
      {
        region: "Europa",
        servers: [
          {
            id: "fc-eu-fra",
            label: "Frankfurt 01 (EU-DE)",
            host: "3.121.0.1",
            city: "Frankfurt",
            basePing: 32,
          },
          {
            id: "fc-eu-mad",
            label: "Madrid 01 (EU-ES)",
            host: "15.236.0.1",
            city: "Madrid",
            basePing: 16,
          },
          {
            id: "fc-eu-lon",
            label: "Londres 01 (EU-UK)",
            host: "3.9.0.1",
            city: "Londres",
            basePing: 40,
          },
        ],
      },
      {
        region: "América do Norte",
        servers: [
          {
            id: "fc-na-va",
            label: "Virgínia 01 (US-East)",
            host: "3.82.0.1",
            city: "Virgínia",
            basePing: 112,
          },
        ],
      },
    ],
  },
  {
    id: "lineage-2",
    name: "Lineage II",
    aliases: ["lineage ii", "lineage 2", "lineage", "l2"],
    processNames: ["l2.exe", "lineage2.exe"],
    category: "MMORPG",
    icon: "lineage",
    regions: [
      {
        region: "América do Sul",
        servers: [
          {
            id: "l2-sa-sp",
            label: "São Paulo (SA-BR)",
            host: "177.54.148.1",
            city: "São Paulo",
            basePing: 18,
          },
        ],
      },
      {
        region: "Europa",
        servers: [
          {
            id: "l2-eu-fra",
            label: "Frankfurt (EU-Central)",
            host: "18.194.0.1",
            city: "Frankfurt",
            basePing: 35,
          },
        ],
      },
      {
        region: "América do Norte",
        servers: [
          {
            id: "l2-na-va",
            label: "Virgínia (US-East)",
            host: "54.210.0.1",
            city: "Virgínia",
            basePing: 115,
          },
        ],
      },
    ],
  },
  {
    id: "teamspeak3",
    name: "TeamSpeak3",
    aliases: ["teamspeak 3", "teamspeak3", "teamspeak", "ts3"],
    processNames: ["ts3client_win64.exe", "ts3client_win32.exe"],
    category: "Voz",
    icon: "teamspeak",
    regions: [
      {
        region: "Europa",
        servers: [
          {
            id: "ts-eu-fra",
            label: "Frankfurt (Voz Pública EU)",
            host: "198.251.86.1",
            city: "Frankfurt",
            basePing: 29,
          },
        ],
      },
      {
        region: "América do Sul",
        servers: [
          {
            id: "ts-sa-sp",
            label: "São Paulo (Voz Pública SA)",
            host: "177.54.150.1",
            city: "São Paulo",
            basePing: 15,
          },
        ],
      },
    ],
  },
  {
    id: "counter-strike-2",
    name: "Counter-Strike 2",
    aliases: [
      "counter-strike 2",
      "counter-strike: global offensive",
      "cs2",
      "csgo",
      "counter strike",
    ],
    processNames: ["cs2.exe", "csgo.exe"],
    category: "FPS",
    icon: "cs2",
    regions: [
      {
        region: "América do Sul",
        servers: [
          {
            id: "cs2-sa-gru",
            label: "São Paulo (GRU Valve)",
            host: "155.133.227.1",
            city: "São Paulo",
            basePing: 11,
          },
          {
            id: "cs2-sa-scl",
            label: "Santiago (SCL Valve)",
            host: "155.133.249.1",
            city: "Santiago",
            basePing: 39,
          },
        ],
      },
      {
        region: "Europa",
        servers: [
          {
            id: "cs2-eu-mad",
            label: "Madrid (MAD Valve)",
            host: "155.133.247.1",
            city: "Madrid",
            basePing: 14,
          },
          {
            id: "cs2-eu-fra",
            label: "Frankfurt (FRA Valve)",
            host: "155.133.226.1",
            city: "Frankfurt",
            basePing: 31,
          },
          {
            id: "cs2-eu-lhr",
            label: "Londres (LHR Valve)",
            host: "155.133.248.1",
            city: "Londres",
            basePing: 39,
          },
          {
            id: "cs2-eu-vie",
            label: "Viena (VIE Valve)",
            host: "155.133.230.1",
            city: "Viena",
            basePing: 45,
          },
        ],
      },
      {
        region: "América do Norte",
        servers: [
          {
            id: "cs2-na-iad",
            label: "Virgínia (IAD Valve)",
            host: "155.133.252.1",
            city: "Virgínia",
            basePing: 105,
          },
          {
            id: "cs2-na-ord",
            label: "Chicago (ORD Valve)",
            host: "155.133.253.1",
            city: "Chicago",
            basePing: 118,
          },
        ],
      },
    ],
  },
  {
    id: "fortnite",
    name: "Fortnite",
    aliases: ["fortnite"],
    processNames: ["fortniteclient-win64-shipping.exe"],
    category: "Battle Royale",
    icon: "fortnite",
    regions: [
      {
        region: "América do Sul",
        servers: [
          {
            id: "fn-sa-sp",
            label: "São Paulo (SA Epic AWS)",
            host: "15.228.12.1",
            city: "São Paulo",
            basePing: 13,
          },
        ],
      },
      {
        region: "Europa",
        servers: [
          {
            id: "fn-eu-fra",
            label: "Frankfurt (EU Epic AWS)",
            host: "3.122.0.1",
            city: "Frankfurt",
            basePing: 33,
          },
          {
            id: "fn-eu-lon",
            label: "Londres (EU Epic AWS)",
            host: "3.10.0.1",
            city: "Londres",
            basePing: 41,
          },
        ],
      },
      {
        region: "América do Norte",
        servers: [
          {
            id: "fn-na-va",
            label: "Virgínia (NA-East Epic AWS)",
            host: "3.85.0.1",
            city: "Virgínia",
            basePing: 109,
          },
        ],
      },
    ],
  },
  {
    id: "league-of-legends",
    name: "League of Legends",
    aliases: ["league of legends", "lol", "league"],
    processNames: ["leagueclient.exe", "league of legends.exe"],
    category: "MMORPG",
    icon: "lol",
    regions: [
      {
        region: "América do Sul",
        servers: [
          {
            id: "lol-sa-br",
            label: "Brasil (São Paulo Riot)",
            host: "104.160.152.3",
            city: "São Paulo",
            basePing: 12,
          },
        ],
      },
      {
        region: "Europa",
        servers: [
          {
            id: "lol-eu-ams",
            label: "EU West (Amesterdão Riot)",
            host: "104.160.141.3",
            city: "Amesterdão",
            basePing: 36,
          },
        ],
      },
      {
        region: "América do Norte",
        servers: [
          {
            id: "lol-na-chi",
            label: "NA (Chicago Riot)",
            host: "104.160.131.3",
            city: "Chicago",
            basePing: 110,
          },
        ],
      },
    ],
  },
  {
    id: "gta-v",
    name: "Grand Theft Auto V",
    aliases: ["grand theft auto v", "gta v", "gta 5", "gta", "fivem"],
    processNames: ["gta5.exe", "playgtav.exe", "fivem.exe"],
    category: "Ação",
    icon: "gta",
    regions: [
      {
        region: "América do Sul",
        servers: [
          {
            id: "gta-sa-sp",
            label: "São Paulo (Relay SA)",
            host: "177.54.144.1",
            city: "São Paulo",
            basePing: 16,
          },
        ],
      },
      {
        region: "Europa",
        servers: [
          {
            id: "gta-eu-fra",
            label: "Frankfurt (Relay EU)",
            host: "3.120.0.1",
            city: "Frankfurt",
            basePing: 34,
          },
        ],
      },
      {
        region: "América do Norte",
        servers: [
          {
            id: "gta-na-va",
            label: "Virgínia (Relay NA)",
            host: "3.80.0.1",
            city: "Virgínia",
            basePing: 110,
          },
        ],
      },
    ],
  },
];

export function findPresetForName(name: string): GamePreset | undefined {
  const clean = name.toLowerCase().trim();
  return PRESET_GAMES.find(
    (p) =>
      p.name.toLowerCase() === clean ||
      p.aliases.some((a) => clean.includes(a) || a.includes(clean)),
  );
}

export function getDefaultTargetsForGame(name: string, fallback = true): Target[] {
  const preset = findPresetForName(name);
  if (preset) {
    const list: Target[] = [];
    for (const reg of preset.regions) {
      for (const s of reg.servers) {
        if (list.length < 16) {
          list.push({
            id: s.id,
            label: s.label,
            host: s.host,
          });
        }
      }
    }
    return list;
  }
  if (!fallback) return [];
  // Generic fallback targets with valid hosts
  return [
    { id: "sa-sp", label: "São Paulo (América do Sul)", host: "177.54.144.1" },
    { id: "eu-fra", label: "Frankfurt (Europa Central)", host: "3.120.0.1" },
    { id: "eu-mad", label: "Madrid (Europa Ibérica)", host: "15.237.0.1" },
    { id: "na-iad", label: "Virgínia (América do Norte)", host: "3.80.0.1" },
  ];
}

export function enrichGameWithPresets(game: Game): Game {
  const enriched = { ...game };
  const preset = findPresetForName(enriched.name);
  if (preset && (!enriched.targets || enriched.targets.length === 0)) {
    enriched.targets = getDefaultTargetsForGame(enriched.name, true);
    enriched.mode = "automatic";
    enriched.selectedTargetId = enriched.targets[0]?.id ?? null;
  }
  if (enriched.enabled === undefined) {
    enriched.enabled = true;
  }
  if (enriched.redirectLogin === undefined) {
    enriched.redirectLogin = false;
  }
  return enriched;
}

export type RoutingHop = {
  id: string;
  label: string;
  code: string;
  pingMs: number;
  active: boolean;
  type: "primary" | "secondary" | "tertiary";
};

export type MultipathRouteDiagram = {
  origin: {
    label: string;
    location: string;
    ip: string;
  };
  hops: RoutingHop[];
  destination: {
    label: string;
    region: string;
    host: string;
    bestPingMs: number;
  };
  game: {
    name: string;
    icon: string;
  };
};

export function computeMultipathDiagram(
  game: Game,
  selectedTarget?: Target,
  observedPing?: number | null,
): MultipathRouteDiagram {
  const target =
    selectedTarget ??
    game.targets.find((t) => t.id === game.selectedTargetId) ??
    game.targets[0] ?? {
      id: "sp",
      label: "Sao Paulo",
      host: "177.54.144.1",
    };

  // Determine base ping
  const preset = findPresetForName(game.name);
  let basePing = 33;
  if (observedPing !== null && observedPing !== undefined && observedPing > 0) {
    basePing = Math.round(observedPing);
  } else if (preset) {
    for (const r of preset.regions) {
      const match = r.servers.find((s) => s.id === target.id || s.host === target.host);
      if (match) {
        basePing = match.basePing;
        break;
      }
    }
  }

  // Extract clean city/region from target.label
  let destCity = "Sao Paulo";
  let destRegion = "SA";
  if (target.label.includes("Madrid") || target.label.includes("ES")) {
    destCity = "Madrid";
    destRegion = "EU";
  } else if (target.label.includes("Frankfurt") || target.label.includes("DE")) {
    destCity = "Frankfurt";
    destRegion = "EU";
  } else if (target.label.includes("Londres") || target.label.includes("UK")) {
    destCity = "Londres";
    destRegion = "EU";
  } else if (target.label.includes("Virgínia") || target.label.includes("US")) {
    destCity = "Virgínia";
    destRegion = "NA";
  } else if (target.label.includes("Santiago") || target.label.includes("CL")) {
    destCity = "Santiago";
    destRegion = "SA";
  } else if (target.label.includes("São Paulo") || target.label.includes("BR")) {
    destCity = "Sao Paulo";
    destRegion = "SA";
  }

  const hops: RoutingHop[] = [
    {
      id: "hop-1",
      label: "Automático",
      code: `${destRegion.toLowerCase()}-hop1`,
      pingMs: basePing,
      active: true,
      type: "primary",
    },
    {
      id: "hop-2",
      label: "Automático",
      code: `${destRegion.toLowerCase()}-hop2`,
      pingMs: Math.round(basePing * 1.15) + 3,
      active: false,
      type: "secondary",
    },
    {
      id: "hop-3",
      label: "Automático",
      code: `${destRegion.toLowerCase()}-hop3`,
      pingMs: Math.round(basePing * 1.35) + 7,
      active: false,
      type: "tertiary",
    },
  ];

  return {
    origin: {
      label: "O teu PC",
      location: destRegion === "SA" ? "São Paulo - BR" : "Lisboa - PT",
      ip: "192.168.1.100",
    },
    hops,
    destination: {
      label: destCity,
      region: destRegion,
      host: target.host,
      bestPingMs: basePing,
    },
    game: {
      name: game.name,
      icon: preset?.icon ?? "game",
    },
  };
}
