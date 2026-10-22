import { expect, test } from "vitest";
import { mergeDiscoveredGames } from "../src/main/discovery/import";
import { defaultStore } from "../src/main/store";
import type { DiscoveredGame } from "../src/shared/contracts";
test("a moved installation keeps the existing configured game identity", () => {
  const first = mergeDiscoveredGames(defaultStore(), [
    {
      id: "old-location",
      discoveryId: "old-location",
      name: "Game",
      sourceName: "Game",
      source: "Steam",
      externalId: "123",
      installPath: "C:/Old",
      executablePath: null,
      evidencePath: "C:/Old/appmanifest.acf",
    },
  ]);
  if (!first.ok) throw new Error("initial import");
  first.value.store.games[0].name = "My configured name";
  const moved = mergeDiscoveredGames(first.value.store, [
    {
      id: "new-location",
      discoveryId: "new-location",
      name: "Game",
      sourceName: "Game",
      source: "Steam",
      externalId: "123",
      installPath: "D:/New",
      executablePath: null,
      evidencePath: "D:/New/appmanifest.acf",
    },
  ]);
  expect(moved.ok).toBe(true);
  if (moved.ok) {
    expect(moved.value.store.games).toHaveLength(1);
    expect(moved.value.store.games[0].name).toBe("My configured name");
  }
});
const candidate: DiscoveredGame = {
  id: "id1",
  discoveryId: "id1",
  name: "Local Game",
  sourceName: "Local Game",
  source: "Steam",
  externalId: "123",
  installPath: "C:/Games/Local",
  executablePath: null,
  evidencePath: "C:/Steam/steamapps/appmanifest_123.acf",
};
test("imports once without inventing targets and preserves installation provenance", () => {
  const first = mergeDiscoveredGames(defaultStore(), [candidate]);
  expect(first.ok).toBe(true);
  if (!first.ok) return;
  expect(first.value.added).toBe(1);
  expect(first.value.store.games[0].targets).toEqual([]);
  expect(first.value.store.games[0].installation?.externalId).toBe("123");
  first.value.store.games[0].name = "My Name";
  const again = mergeDiscoveredGames(first.value.store, [candidate]);
  expect(again.ok).toBe(true);
  if (again.ok) {
    expect(again.value.added).toBe(0);
    expect(again.value.skipped).toBe(1);
    expect(again.value.store.games[0].name).toBe("My Name");
  }
});
