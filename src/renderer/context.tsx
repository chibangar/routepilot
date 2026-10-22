import { createContext, useContext } from "react";
import type { Game, Result, RuntimeState, Session } from "../shared/contracts";
export type Page =
  "home" | "connections" | "details" | "history" | "settings" | "help";
export type AppState = {
  runtime: RuntimeState | null;
  active: Session | null;
  live: Session | null;
  search: string;
  setSearch: (s: string) => void;
  navigate: (page: Page, id?: string) => void;
  edit: (game?: Game) => void;
  refresh: () => Promise<void>;
  notify: (text: string) => void;
  act: <T>(task: () => Promise<Result<T>>) => Promise<T | undefined>;
  globalOn: boolean;
  setGlobalOn: (on: boolean) => void;
  toggleGame: (id: string, enabled: boolean) => Promise<void>;
  autoDetect: () => Promise<void>;
};
export const AppContext = createContext<AppState>(null!);
export const useApp = () => useContext(AppContext);
