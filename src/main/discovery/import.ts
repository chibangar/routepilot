import { resolve } from "node:path";
import {
  ok,
  fail,
  type Result,
  type Store,
  type DiscoveredGame,
} from "../../shared/contracts";
export function mergeDiscoveredGames(
  current: Store,
  candidates: DiscoveredGame[],
): Result<{ store: Store; added: number; skipped: number }> {
  const next = structuredClone(current);
  let added = 0,
    skipped = 0;
  for (const candidate of candidates) {
    if (
      next.games.some(
        (game) =>
          game.installation?.discoveryId === candidate.id ||
          (game.installation?.source === candidate.source &&
            game.installation?.externalId === candidate.externalId) ||
          (candidate.executablePath &&
            game.executablePath &&
            resolve(candidate.executablePath).toLowerCase() ===
              resolve(game.executablePath).toLowerCase()),
      )
    ) {
      skipped++;
      continue;
    }
    if (next.games.length >= 64)
      return fail(
        "capacity",
        "A biblioteca suporta 64 aplicações. Selecione menos jogos ou remova aplicações.",
      );
    next.games.push({
      id: "detected-" + candidate.id,
      name: candidate.name.trim().slice(0, 80) || "Jogo detetado",
      executablePath: candidate.executablePath,
      targets: [],
      mode: "manual",
      selectedTargetId: null,
      installation: {
        discoveryId: candidate.id,
        source: candidate.source,
        externalId: candidate.externalId,
        sourceName: candidate.sourceName,
        installPath: candidate.installPath,
        evidencePath: candidate.evidencePath,
      },
    });
    added++;
  }
  return ok({ store: next, added, skipped });
}
