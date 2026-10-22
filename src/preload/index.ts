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
