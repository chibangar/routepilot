import { contextBridge, ipcRenderer } from "electron";
import type { RoutePilotAPI } from "../shared/contracts";
const invoke = (operation: string, args: unknown = {}) =>
  ipcRenderer.invoke("routepilot:invoke", { operation, args });
const api: RoutePilotAPI = {
  discoverGames: () => invoke("discoverGames"),
  autoDetectGames: () => invoke("autoDetectGames"),
  cancelDiscovery: () => invoke("cancelDiscovery"),
  chooseSteamLibrary: () => invoke("chooseSteamLibrary"),
  importDiscoveredGames: (ids) => invoke("importDiscoveredGames", { ids }),
  retrySave: () => invoke("retrySave"),
  getState: () => invoke("getState"),
  saveGame: (game) => invoke("saveGame", game),
  removeGame: (id) => invoke("removeGame", { id }),
  chooseExecutable: () => invoke("chooseExecutable"),
  saveSettings: (settings) => invoke("saveSettings", settings),
  startSession: (id) => invoke("startSession", { id }),
  cancelSession: (id) => invoke("cancelSession", { id }),
  startTrace: (target) => invoke("startTrace", target),
  cancelTrace: () => invoke("cancelTrace"),
  compareRoutes: (target) => invoke("compareRoutes", target),
  cancelCompare: () => invoke("cancelCompare"),
  runNetworkCheck: (withLoad = true) => invoke("runNetworkCheck", { withLoad }),
  scanCs2: () => invoke("scanCs2"),
  scanLol: () => invoke("scanLol"),
  monitorTargets: () => invoke("monitorTargets"),
  monitorStart: (target) => invoke("monitorStart", target),
  monitorStop: () => invoke("monitorStop"),
  onMonitor: (listener) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      state: Parameters<typeof listener>[0],
    ) => listener(state);
    ipcRenderer.on("routepilot:monitor", handler);
    return () => ipcRenderer.removeListener("routepilot:monitor", handler);
  },
  perfStatus: () => invoke("perfStatus"),
  perfPowerScheme: (guid) => invoke("perfPowerScheme", { guid }),
  perfGameMode: (on) => invoke("perfGameMode", { on }),
  perfCloseProcess: (name) => invoke("perfCloseProcess", { name }),
  perfBoostGames: () => invoke("perfBoostGames"),
  qosStatus: () => invoke("qosStatus"),
  qosApply: (limits) => invoke("qosApply", { limits }),
  linksStatus: () => invoke("linksStatus"),
  linksPrefer: (index) => invoke("linksPrefer", { index }),
  linksAutomatic: () => invoke("linksAutomatic"),
  cs2Status: () => invoke("cs2Status"),
  cs2SetMode: (mode, allow = []) => invoke("cs2SetMode", { mode, allow }),
  cs2Uninstall: () => invoke("cs2Uninstall"),
  cancelNetworkCheck: () => invoke("cancelNetworkCheck"),
  onNetworkProgress: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, step: string) =>
      listener(step);
    ipcRenderer.on("routepilot:network-progress", handler);
    return () =>
      ipcRenderer.removeListener("routepilot:network-progress", handler);
  },
  connectionInfo: () => invoke("connectionInfo"),
  pingBreakdown: (target, location, connection) =>
    invoke("pingBreakdown", { target, location, connection }),
  cancelBreakdown: () => invoke("cancelBreakdown"),
  onBreakdownProgress: (listener) => {
    const handler = (_event: Electron.IpcRendererEvent, step: string) =>
      listener(step);
    ipcRenderer.on("routepilot:breakdown-progress", handler);
    return () =>
      ipcRenderer.removeListener("routepilot:breakdown-progress", handler);
  },
  readHardware: () => invoke("readHardware"),
  exportSessions: (format) => invoke("exportSessions", { format }),
  checkForUpdates: () => invoke("checkForUpdates"),
  installUpdate: () => invoke("installUpdate"),
  onSession: (listener) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      session: Parameters<typeof listener>[0],
    ) => listener(session);
    ipcRenderer.on("routepilot:session", handler);
    return () => ipcRenderer.removeListener("routepilot:session", handler);
  },
  onUpdateDownloaded: (listener) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      version: string,
    ) => listener(version);
    ipcRenderer.on("routepilot:update-downloaded", handler);
    return () => ipcRenderer.removeListener("routepilot:update-downloaded", handler);
  },
};
contextBridge.exposeInMainWorld("routepilot", api);
