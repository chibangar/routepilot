export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string } };
export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = (code: string, message: string): Result<never> => ({
  ok: false,
  error: { code, message },
});
export type Target = { id: string; label: string; host: string };
export type Game = {
  id: string;
  name: string;
  executablePath: string | null;
  targets: Target[];
  mode: "manual" | "automatic";
  selectedTargetId: string | null;
  installation?: Installation;
  enabled?: boolean;
  redirectLogin?: boolean;
};
export type GameSource =
  | "Steam"
  | "Epic Games"
  | "GOG"
  | "Riot Games"
  | "EA App"
  | "Ubisoft"
  | "Battle.net"
  | "Windows"
  | "Personalizado";
export type Installation = {
  discoveryId: string;
  source: GameSource;
  externalId: string;
  sourceName: string;
  installPath: string;
  evidencePath: string;
};
export type DiscoveredGame = Installation & {
  id: string;
  name: string;
  executablePath: string | null;
};
export type DiscoveryReport = {
  games: DiscoveredGame[];
  warnings: string[];
  partial: boolean;
  cancelled: boolean;
  scannedAt: string;
  sources: GameSource[];
};
export type Sample = {
  index: number;
  at: string;
  status: "reply" | "timeout" | "error";
  rttMs: number | null;
  reason: string | null;
};
export type Metrics = {
  sent: number;
  received: number;
  minMs: number | null;
  meanMs: number | null;
  jitterMs: number | null;
  noReplyPercent: number | null;
};
export type Session = {
  id: string;
  gameId: string;
  target: Target;
  startedAt: string;
  endedAt: string | null;
  state: "running" | "completed" | "cancelled" | "failed";
  samples: Sample[];
  metrics: Metrics;
  selection?: { target: Target; samples: Sample[] }[];
};
export type Relay = {
  id: string;
  label: string;
  host: string;
  port: number;
  token: string;
};
export type RelayResult = {
  relayId: string;
  label: string;
  relayRttMs: number | null;
  targetRttMs: number | null;
  totalMs: number | null;
  error: string | null;
};
export type RouteComparison = {
  target: Target;
  measuredAt: string;
  directMs: number | null;
  directError: string | null;
  relays: RelayResult[];
  best:
    | { kind: "direct"; ms: number }
    | { kind: "relay"; relayId: string; ms: number }
    | null;
};
export type NetworkPhase = {
  sent: number;
  received: number;
  medianMs: number | null;
  jitterMs: number | null;
};
export type NetworkCheck = {
  measuredAt: string;
  adapterName: string | null;
  adapterDescription: string | null;
  wifi: boolean | null;
  wifiSignal: number | null;
  linkSpeed: string | null;
  gatewayAddress: string | null;
  gateway: NetworkPhase;
  idle: NetworkPhase;
  download: NetworkPhase;
  upload: NetworkPhase;
  downloadMbps: number | null;
  uploadMbps: number | null;
  downloadIncreaseMs: number | null;
  uploadIncreaseMs: number | null;
  bufferbloatGrade: "A+" | "A" | "B" | "C" | "D" | "F" | null;
  metered: boolean;
  loadSkipped: string | null;
  dropped: "download" | "upload" | null;
  recovered: boolean | null;
  dataUsedMb: number;
  advice: string[];
};
export type Cs2Datacenter = {
  code: string;
  name: string;
  relays: string[];
  pingMs: number | null;
};
export type Cs2Scan = { measuredAt: string; datacenters: Cs2Datacenter[] };
export type LolRegionPing = {
  code: string;
  name: string;
  city: string;
  via: string | null;
  match: "exact" | "near" | null;
  pingMs: number | null;
};
export type LolScan = { measuredAt: string; regions: LolRegionPing[] };
export type MonitorTarget = { id: string; group: string; label: string; host: string };
export type BreakdownPart = "casa" | "operadora" | "cabo" | "continente" | "caminho";
export type BreakdownSegment = { part: BreakdownPart; label: string; ms: number };
export type BreakdownHop = {
  ttl: number;
  address: string;
  ms: number;
  part: BreakdownPart | "servidor";
};
export type PingBreakdown = {
  measuredAt: string;
  location: "continente" | "madeira" | "acores";
  target: { id: string; label: string; host: string };
  serverName: string | null;
  totalMs: number;
  medianMs: number;
  lossPct: number;
  segments: BreakdownSegment[];
  hops: BreakdownHop[];
  expectedMs: number | null;
  cableExpectedMs: number | null;
  excessMs: number | null;
  verdict: "casa" | "rota" | "distancia" | "bom";
  headline: string;
  advice: string[];
  traceComplete: boolean;
};
export type MonitorState = {
  target: MonitorTarget;
  running: boolean;
  samples: (number | null)[];
  sent: number;
  lost: number;
  minMs: number | null;
  meanMs: number | null;
  jitterMs: number | null;
  spikes: number;
  lastMs: number | null;
};
export type PerfProcess = {
  name: string;
  count: number;
  memoryMb: number;
  cpuSeconds: number;
  closable: boolean;
};
export type PerfStatus = {
  powerScheme: { guid: string; name: string } | null;
  highPerformanceAvailable: boolean;
  gameModeOn: boolean;
  heavy: PerfProcess[];
  runningGames: { name: string; priority: string }[];
};
export type QosLimit = { exe: string; mbps: number };
export type QosRule = { exe: string; label: string; mbps: number };
export type NetLink = {
  index: number;
  alias: string;
  description: string;
  ip: string;
  gateway: string;
  metric: number;
  automaticMetric: boolean;
  wifi: boolean;
  pingMs: number | null;
};
export type Cs2Mode = "auto" | "manual" | "off";
export type Cs2Status = {
  installed: boolean;
  mode: Cs2Mode;
  ok: boolean | null;
  allowed: string[];
  blocked: number;
  pings: Record<string, number>;
  error: string | null;
  checkedAt: string | null;
};
export type Settings = {
  economyMode?: boolean;
  sampleCount: number;
  timeoutMs: number;
  intervalMs: number;
  relays?: Relay[];
};
export type Store = {
  version: 1;
  games: Game[];
  sessions: Session[];
  settings: Settings;
  discovery?: { steamLibraries: string[] };
  globalOptimization?: boolean;
};
export type Hop = {
  ttl: number;
  address: string | null;
  rttMs: number | null;
  status: "reply" | "timeout" | "unparsed";
  raw: string;
};
export type Trace = {
  target: Target;
  complete: boolean;
  hops: Hop[];
  raw: string;
  limitations: string[];
};
export type Hardware = {
  sampledAt?: string;
  sampleWindowMs?: number | null;
  cpuPercent: number | null;
  cpuName: string;
  cpuCount: number;
  cpuMhz?: number | null;
  gpuPercent?: number | null;
  gpuMhz?: number | null;
  memoryUsedBytes: number;
  memoryTotalBytes: number;
};
export type RuntimeState = {
  store: Store;
  active: Session | null;
  selecting: boolean;
  traceActive: boolean;
  dataPath: string;
  appVersion?: string;
};
export interface RoutePilotAPI {
  discoverGames(): Promise<Result<DiscoveryReport>>;
  autoDetectGames(): Promise<Result<{ store: Store; added: number }>>;
  cancelDiscovery(): Promise<Result<void>>;
  chooseSteamLibrary(): Promise<Result<DiscoveryReport | null>>;
  importDiscoveredGames(
    ids: string[],
  ): Promise<Result<{ store: Store; added: number; skipped: number }>>;
  getState(): Promise<Result<RuntimeState>>;
  retrySave(): Promise<Result<void>>;
  saveGame(game: Game): Promise<Result<Store>>;
  removeGame(id: string): Promise<Result<Store>>;
  chooseExecutable(): Promise<Result<string | null>>;
  saveSettings(settings: Settings): Promise<Result<Store>>;
  startSession(id: string): Promise<Result<{ id: string }>>;
  cancelSession(id: string): Promise<Result<void>>;
  startTrace(target: Target): Promise<Result<Trace>>;
  cancelTrace(): Promise<Result<void>>;
  compareRoutes(target: Target): Promise<Result<RouteComparison>>;
  cancelCompare(): Promise<Result<void>>;
  runNetworkCheck(withLoad?: boolean): Promise<Result<NetworkCheck>>;
  scanCs2(): Promise<Result<Cs2Scan>>;
  scanLol(): Promise<Result<LolScan>>;
  monitorTargets(): Promise<Result<MonitorTarget[]>>;
  monitorStart(target: MonitorTarget): Promise<Result<void>>;
  monitorStop(): Promise<Result<void>>;
  onMonitor?(listener: (state: MonitorState) => void): () => void;
  perfStatus(): Promise<Result<PerfStatus>>;
  perfPowerScheme(guid: string): Promise<Result<PerfStatus>>;
  perfGameMode(on: boolean): Promise<Result<PerfStatus>>;
  perfCloseProcess(name: string): Promise<Result<PerfStatus>>;
  perfBoostGames(): Promise<Result<number>>;
  qosStatus(): Promise<Result<QosRule[]>>;
  qosApply(limits: QosLimit[]): Promise<Result<QosRule[]>>;
  linksStatus(): Promise<Result<NetLink[]>>;
  linksPrefer(index: number): Promise<Result<NetLink[]>>;
  linksAutomatic(): Promise<Result<NetLink[]>>;
  cs2Status(): Promise<Result<Cs2Status>>;
  cs2SetMode(mode: Cs2Mode, allow?: string[]): Promise<Result<Cs2Status>>;
  cs2Uninstall(): Promise<Result<Cs2Status>>;
  cancelNetworkCheck(): Promise<Result<void>>;
  onNetworkProgress?(listener: (step: string) => void): () => void;
  pingBreakdown(
    target: MonitorTarget,
    location: PingBreakdown["location"],
  ): Promise<Result<PingBreakdown>>;
  cancelBreakdown(): Promise<Result<void>>;
  onBreakdownProgress?(listener: (step: string) => void): () => void;
  readHardware(): Promise<Result<Hardware>>;
  exportSessions(format: "json" | "csv"): Promise<Result<string | null>>;
  checkForUpdates(): Promise<Result<{ updateAvailable: boolean; version?: string }>>;
  installUpdate(): Promise<Result<void>>;
  onSession(listener: (session: Session) => void): () => void;
  onUpdateDownloaded?(listener: (version: string) => void): () => void;
}
declare global {
  interface Window {
    routepilot: RoutePilotAPI;
  }
}
