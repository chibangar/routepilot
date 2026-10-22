import type { Settings } from "./contracts";
export const isEconomyMode = (
  settings: Pick<Settings, "economyMode"> | undefined,
) => settings?.economyMode !== false;
