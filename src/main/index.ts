import { app, BrowserWindow, ipcMain, dialog, Menu, screen } from "electron";
import { autoUpdater } from "electron-updater";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { stat } from "node:fs/promises";
import {
  ok,
  fail,
  type Result,
  type Store,
  type Trace,
  type DiscoveryReport,
  type DiscoveredGame,
} from "../shared/contracts";
import { authorizeSender, validateCall } from "./ipc";
import { loadStore, saveStore, defaultStore } from "./store";
import { SessionManager } from "./diagnostics/session-manager";
import { traceHost } from "./diagnostics/trace";
import { readHardware } from "./hardware";
import { exportSessions } from "./export";
import { scanGameSources, localDirectory, knownExecutable } from "./discovery";
import { installedSources } from "./discovery/registry";
import { mergeDiscoveredGames } from "./discovery/import";
import {
  enrichGameWithPresets,
  getDefaultTargetsForGame,
} from "../shared/game-presets";

process.on("uncaughtException", (error) => {
  if (
    error instanceof TypeError &&
    error.message.includes("Object has been destroyed")
  ) {
    return;
  }
  console.error("RoutePilot uncaughtException:", error);
});

app.setName("RoutePilot");
const profile = app.commandLine.getSwitchValue("user-data-dir");
if (profile) app.setPath("userData", resolve(profile));
let win: BrowserWindow | null = null;
let store = defaultStore();
let loadError: string | null = null;
let dataFile = "";
let rendererUrl = "";
let shuttingDown = false;
let finished = false;
const chosenExecutables = new Set<string>();
let traceController: AbortController | null = null;
let traceWork: Promise<Result<Trace>> | null = null;
let mutations = Promise.resolve();
let discoveryController: AbortController | null = null;
let discoveryWork: Promise<Result<DiscoveryReport>> | null = null;
let discovered = new Map<string, DiscoveredGame>();
async function discover(): Promise<Result<DiscoveryReport>> {
  if (discoveryWork) return fail("busy", "Já existe uma deteção em curso.");
  discoveryController = new AbortController();
  const signal = discoveryController.signal;
  discovered = new Map();
  discoveryWork = (async (): Promise<Result<DiscoveryReport>> => {
    try {
      const sources = await installedSources(signal);
      sources.steamRoots.unshift(...(store.discovery?.steamLibraries ?? []));
      const report = await scanGameSources(sources, signal);
      discovered = new Map(report.games.map((game) => [game.id, game]));
      return ok(report);
    } catch (e) {
      return fail("discovery_failed", String(e));
    }
  })();
  try {
    return await discoveryWork;
  } finally {
    discoveryWork = null;
    discoveryController = null;
  }
}
function mutate(
  change: (current: Store) => Result<Store>,
): Promise<Result<Store>> {
  let result: Result<Store> = fail("store_write", "Não foi possível guardar.");
  const run = async () => {
    if (loadError) {
      result = fail("invalid_store", loadError);
      return;
    }
    const next = change(structuredClone(store));
    if (!next.ok) {
      result = next;
      return;
    }
    const saved = await saveStore(dataFile, next.value);
    if (saved.ok) {
      store = saved.value;
      result = ok(structuredClone(store));
    } else result = saved;
  };
  const work = mutations.then(run);
  mutations = work.catch(() => {});
  return work.then(() => result);
}
const manager = new SessionManager(
  (s) => {
    if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
      try {
        win.webContents.send("routepilot:session", s);
      } catch {
        // Window or WebContents may be closing/destroyed
      }
    }
  },
  async (s) => {
    const result = await mutate((current) => {
      current.sessions = [
        s,
        ...current.sessions.filter((x) => x.id !== s.id),
      ].slice(0, 200);
      return ok(current);
    });
    if (!result.ok) throw new Error(result.error.message);
  },
);

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  traceController?.abort();
  discoveryController?.abort();
  await Promise.all([manager.stopAll(), traceWork, discoveryWork]);
  await mutations;
  if (manager.pendingSession) {
    await manager.retryPersistence();
    const pending = manager.pendingSession;
    if (pending) {
      const choice = await dialog.showMessageBox({
        type: "warning",
        title: "Sessão ainda não guardada",
        message: "Não foi possível guardar a última sessão.",
        detail:
          "Pode voltar à aplicação para tentar novamente, guardar uma cópia JSON noutro local ou sair descartando esta sessão.\n\n" +
          (manager.persistenceError ?? ""),
        buttons: [
          "Voltar à aplicação",
          "Guardar cópia e sair",
          "Sair sem guardar",
        ],
        defaultId: 0,
        cancelId: 0,
        noLink: true,
      });
      if (choice.response === 0) {
        shuttingDown = false;
        return;
      }
      if (choice.response === 1) {
        const destination = await dialog.showSaveDialog({
          title: "Guardar sessão recuperada",
          defaultPath: join(
            app.getPath("documents"),
            "RoutePilot-sessao-recuperada.json",
          ),
          filters: [{ name: "JSON", extensions: ["json"] }],
        });
        if (destination.canceled || !destination.filePath) {
          shuttingDown = false;
          return;
        }
        const result = await exportSessions(
          [pending],
          "json",
          destination.filePath,
        );
        if (!result.ok) {
          dialog.showErrorBox("Falha ao guardar cópia", result.error.message);
          shuttingDown = false;
          return;
        }
      }
    }
  }
  finished = true;
  app.quit();
}
app.on("before-quit", (event) => {
  if (!finished) {
    event.preventDefault();
    void shutdown();
  }
});
app.on("window-all-closed", () => {
  if (!finished) void shutdown();
});
if (!app.requestSingleInstanceLock()) {
  finished = true;
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  void app
    .whenReady()
    .then(async () => {
      dataFile = join(app.getPath("userData"), "state.json");
      const loaded = await loadStore(dataFile);
      if (loaded.ok) {
        store = loaded.value;
        let changed = false;
        for (let i = 0; i < store.games.length; i++) {
          if (!store.games[i].targets || store.games[i].targets.length === 0) {
            store.games[i] = enrichGameWithPresets(store.games[i]);
            changed = true;
          }
          if (store.games[i].enabled === undefined) {
            store.games[i].enabled = true;
            changed = true;
          }
        }
        if (!profile && store.games.length === 0) {
          store.games = [
            {
              id: "valorant-auto",
              name: "Valorant",
              executablePath: null,
              targets: getDefaultTargetsForGame("Valorant"),
              mode: "automatic",
              selectedTargetId: "val-sa-sp",
              enabled: true,
              redirectLogin: false,
            },
            {
              id: "ea-fc-auto",
              name: "EA SPORTS FC 26",
              executablePath: null,
              targets: getDefaultTargetsForGame("EA SPORTS FC 26"),
              mode: "automatic",
              selectedTargetId: "fc-sa-sp",
              enabled: true,
              redirectLogin: false,
            },
            {
              id: "lineage-2-auto",
              name: "Lineage II",
              executablePath: null,
              targets: getDefaultTargetsForGame("Lineage II"),
              mode: "automatic",
              selectedTargetId: "l2-sa-sp",
              enabled: true,
              redirectLogin: false,
            },
            {
              id: "teamspeak3-auto",
              name: "TeamSpeak3",
              executablePath: null,
              targets: getDefaultTargetsForGame("TeamSpeak3"),
              mode: "manual",
              selectedTargetId: "ts-eu-fra",
              enabled: true,
              redirectLogin: false,
            },
          ];
          changed = true;
        }
        if (changed) void saveStore(dataFile, store);
      } else loadError = loaded.error.message;
      Menu.setApplicationMenu(null);
      rendererUrl = pathToFileURL(
        join(__dirname, "../renderer/index.html"),
      ).href;
      const area = screen.getPrimaryDisplay().workAreaSize;
      win = new BrowserWindow({
        width: Math.min(1480, area.width),
        height: Math.min(950, area.height),
        minWidth: Math.min(960, area.width),
        minHeight: Math.min(640, area.height),
        backgroundColor: "#0b0d10",
        title: "RoutePilot",
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
          preload: join(__dirname, "../preload/index.cjs"),
          contextIsolation: true,
          nodeIntegration: false,
          sandbox: true,
          backgroundThrottling: true,
        },
      });
      win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      win.webContents.on("will-navigate", (e, url) => {
        if (url !== rendererUrl) e.preventDefault();
      });
      win.webContents.session.setPermissionRequestHandler(
        (_contents, _permission, callback) => callback(false),
      );
      win.on("close", (event) => {
        if (!finished) {
          event.preventDefault();
          void shutdown();
        }
      });
      win.on("closed", () => {
        win = null;
      });
      ipcMain.handle("routepilot:invoke", async (event, input: unknown) => {
        if (
          !win ||
          win.isDestroyed() ||
          win.webContents.isDestroyed() ||
          event.sender.isDestroyed() ||
          event.sender !== win.webContents ||
          !authorizeSender(
            rendererUrl,
            event.senderFrame?.url ?? "",
            event.senderFrame === win.webContents.mainFrame,
          )
        )
          return fail("unauthorized", "Origem do pedido recusada.");
        if (shuttingDown)
          return fail("closing", "A aplicação está a encerrar.");
        const parsed = validateCall(input);
        if (!parsed.ok) return parsed;
        const call = parsed.value;
        try {
          switch (call.operation) {
            case "discoverGames":
              return discover();
            case "autoDetectGames": {
              const rep = await discover();
              if (!rep.ok) return rep;
              let added = 0;
              const result = await mutate((current) => {
                for (const game of rep.value.games) {
                  const already = current.games.some(
                    (g) =>
                      g.name.toLowerCase() === game.name.toLowerCase() ||
                      g.installation?.externalId === game.externalId,
                  );
                  if (!already && current.games.length < 64) {
                    const targets = getDefaultTargetsForGame(game.name);
                    current.games.push({
                      id: "detected-" + game.id,
                      name: game.name,
                      executablePath: game.executablePath,
                      targets,
                      mode: "automatic",
                      selectedTargetId: targets[0]?.id ?? null,
                      enabled: true,
                      redirectLogin: false,
                      installation: {
                        discoveryId: game.id,
                        source: game.source,
                        externalId: game.externalId,
                        sourceName: game.sourceName,
                        installPath: game.installPath,
                        evidencePath: game.evidencePath,
                      },
                    });
                    added++;
                  }
                }
                return ok(current);
              });
              return result.ok ? ok({ store: result.value, added }) : result;
            }
            case "cancelDiscovery":
              discoveryController?.abort();
              await discoveryWork;
              return ok(undefined);
            case "chooseSteamLibrary": {
              if (discoveryWork)
                return fail("busy", "Aguarde a deteção terminar.");
              if (!win || win.isDestroyed())
                return fail("destroyed", "Janela indisponível.");
              const choice = await dialog.showOpenDialog(win, {
                title: "Escolher pasta da Steam ou biblioteca Steam",
                properties: ["openDirectory"],
              });
              if (choice.canceled || !choice.filePaths[0]) return ok(null);
              const root = resolve(choice.filePaths[0]);
              if (!(await localDirectory(join(root, "steamapps"))))
                return fail(
                  "invalid_library",
                  "Escolha a pasta que contém a pasta steamapps.",
                );
              const saved = await mutate((current) => {
                const libraries = current.discovery?.steamLibraries ?? [];
                if (
                  !libraries.some(
                    (path) =>
                      resolve(path).toLowerCase() === root.toLowerCase(),
                  )
                ) {
                  if (libraries.length >= 16)
                    return fail(
                      "capacity",
                      "Limite de 16 bibliotecas adicionais atingido.",
                    );
                  libraries.push(root);
                }
                current.discovery = { steamLibraries: libraries };
                return ok(current);
              });
              return saved.ok ? discover() : saved;
            }
            case "importDiscoveredGames": {
              if (discoveryWork)
                return fail("busy", "Aguarde a deteção terminar.");
              const candidates: DiscoveredGame[] = [];
              for (const id of new Set(call.args.ids)) {
                const candidate = discovered.get(id);
                if (!candidate)
                  return fail(
                    "scan_expired",
                    "Seleção desatualizada. Execute a deteção novamente.",
                  );
                if (!(await localDirectory(candidate.installPath)))
                  return fail(
                    "install_missing",
                    `A pasta de ${candidate.name} já não foi encontrada. Atualize a deteção.`,
                  );
                candidates.push({
                  ...candidate,
                  executablePath: await knownExecutable(
                    candidate.installPath,
                    candidate.executablePath,
                  ),
                });
              }
              let added = 0,
                skipped = 0;
              const result = await mutate((current) => {
                const merged = mergeDiscoveredGames(current, candidates);
                if (!merged.ok) return merged;
                for (const g of merged.value.store.games) {
                  if (!g.targets || g.targets.length === 0) {
                    const targets = getDefaultTargetsForGame(g.name, false);
                    if (targets.length > 0) {
                      g.targets = targets;
                      g.mode = "automatic";
                      g.selectedTargetId = targets[0].id;
                      g.enabled = true;
                    }
                  }
                }
                added = merged.value.added;
                skipped = merged.value.skipped;
                return ok(merged.value.store);
              });
              return result.ok
                ? ok({ store: result.value, added, skipped })
                : result;
            }
            case "retrySave":
              return manager.retryPersistence();
            case "getState":
              return loadError
                ? fail("invalid_store", loadError)
                : manager.persistenceError
                  ? fail("store_write", manager.persistenceError)
                  : ok({
                      store,
                      active: manager.active,
                      selecting: manager.selecting,
                      traceActive: !!traceWork,
                      dataPath: app.getPath("userData"),
                    });
            case "saveGame": {
              const game = call.args;
              const previous = store.games.find((g) => g.id === game.id);
              if (
                JSON.stringify(game.installation) !==
                JSON.stringify(previous?.installation)
              )
                return fail(
                  "invalid_source",
                  "Os dados de instalação são geridos pela deteção de jogos.",
                );
              if (
                game.executablePath &&
                game.executablePath !== previous?.executablePath &&
                !chosenExecutables.has(game.executablePath)
              )
                return fail(
                  "invalid_path",
                  "Escolha o executável através do botão de seleção.",
                );
              return mutate((current) => {
                const index = current.games.findIndex((g) => g.id === game.id);
                if (index < 0 && current.games.length >= 64)
                  return fail("capacity", "Limite de 64 aplicações atingido.");
                if (index >= 0) current.games[index] = game;
                else current.games.push(game);
                return ok(current);
              });
            }
            case "removeGame":
              return mutate((current) => {
                if (manager.active?.gameId === call.args.id)
                  return fail(
                    "busy",
                    "Termine o diagnóstico antes de remover esta aplicação.",
                  );
                if (!current.games.some((g) => g.id === call.args.id))
                  return fail("not_found", "Aplicação inexistente.");
                current.games = current.games.filter(
                  (g) => g.id !== call.args.id,
                );
                return ok(current);
              });
            case "chooseExecutable": {
              if (!win || win.isDestroyed())
                return fail("destroyed", "Janela indisponível.");
              const choice = await dialog.showOpenDialog(win, {
                title: "Selecionar aplicação",
                properties: ["openFile"],
                filters: [{ name: "Aplicações Windows", extensions: ["exe"] }],
              });
              const path = choice.filePaths[0];
              if (choice.canceled || !path) return ok(null);
              if (
                !path.toLowerCase().endsWith(".exe") ||
                !(await stat(path)).isFile()
              )
                return fail("invalid_file", "Escolha um ficheiro .exe.");
              chosenExecutables.add(path);
              return ok(path);
            }
            case "saveSettings":
              return mutate((current) => {
                current.settings = call.args;
                return ok(current);
              });
            case "startSession": {
              if (loadError) return fail("invalid_store", loadError);
              if (traceWork)
                return fail(
                  "busy",
                  "Aguarde o traceroute terminar ou cancele-o.",
                );
              const game = store.games.find((g) => g.id === call.args.id);
              return game
                ? manager.start(game, store.settings)
                : fail("not_found", "Aplicação inexistente.");
            }
            case "cancelSession":
              return manager.cancel(call.args.id);
            case "startTrace": {
              if (traceWork || manager.active)
                return fail("busy", "Já existe um diagnóstico ativo.");
              traceController = new AbortController();
              traceWork = traceHost(call.args, traceController.signal);
              try {
                return await traceWork;
              } finally {
                traceController = null;
                traceWork = null;
              }
            }
            case "cancelTrace":
              traceController?.abort();
              await traceWork;
              return ok(undefined);
            case "readHardware":
              return ok(readHardware());
            case "exportSessions": {
              const format = call.args.format;
              if (!win || win.isDestroyed())
                return fail("destroyed", "Janela indisponível.");
              const choice = await dialog.showSaveDialog(win, {
                title: "Exportar histórico",
                defaultPath: `RoutePilot-historico.${format}`,
                filters: [{ name: format.toUpperCase(), extensions: [format] }],
              });
              if (choice.canceled || !choice.filePath) return ok(null);
              const result = await exportSessions(
                structuredClone(store.sessions),
                format,
                choice.filePath,
              );
              return result.ok ? ok(choice.filePath) : result;
            }
            case "checkForUpdates": {
              if (!app.isPackaged) {
                return ok({
                  updateAvailable: false,
                  version: app.getVersion(),
                });
              }
              try {
                const res = await autoUpdater.checkForUpdates();
                const isAvail =
                  Boolean(
                    res?.updateInfo?.version &&
                      res.updateInfo.version !== app.getVersion(),
                  );
                return ok({
                  updateAvailable: isAvail,
                  version: res?.updateInfo?.version,
                });
              } catch (err) {
                return fail("update_check_failed", String(err));
              }
            }
            case "installUpdate": {
              if (!app.isPackaged)
                return fail("not_packaged", "Apenas em produção.");
              autoUpdater.quitAndInstall();
              return ok(undefined);
            }
          }
        } catch (e) {
          return fail("operation_failed", String(e));
        }
      });
      await win.loadURL(rendererUrl);
      win.show();

      if (app.isPackaged) {
        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;
        autoUpdater.on("update-downloaded", (info) => {
          if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) {
            try {
              win.webContents.send("routepilot:update-downloaded", info.version);
            } catch {}
          }
          dialog
            .showMessageBox(win && !win.isDestroyed() ? win : (undefined as any), {
              type: "info",
              title: "Atualização Disponível",
              message: `Nova versão do RoutePilot (v${info.version}) foi descarregada!`,
              detail:
                "A atualização será aplicada automaticamente ao reiniciar a aplicação.",
              buttons: ["Reiniciar agora", "Mais tarde"],
              defaultId: 0,
              cancelId: 1,
            })
            .then((res) => {
              if (res.response === 0) {
                autoUpdater.quitAndInstall();
              }
            })
            .catch(() => {});
        });

        setTimeout(() => {
          autoUpdater.checkForUpdates().catch(() => {});
        }, 8000);

        setInterval(() => {
          autoUpdater.checkForUpdates().catch(() => {});
        }, 30 * 60 * 1000);
      }
    })
    .catch((e) => {
      dialog.showErrorBox("RoutePilot", String(e));
      finished = true;
      app.quit();
    });
}
