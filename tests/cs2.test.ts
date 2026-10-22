import { expect, test } from "vitest";
import { parseSdrConfig } from "../src/main/diagnostics/cs2";

test("lê os datacenters da configuração SDR da Valve", () => {
  const pops = parseSdrConfig({
    revision: 1,
    pops: {
      gru: {
        desc: "Sao Paulo (Brazil)",
        relays: [{ ipv4: "155.133.227.35", port_range: [27015, 27060] }],
      },
      // Entradas sem relays (ex.: pontos só de backbone) são ignoradas.
      ams: { desc: "Amsterdam", relays: [] },
      bad: { desc: "Inválido", relays: [{ ipv4: "-n 5" }] },
    },
  });
  expect(pops).toEqual([
    { code: "gru", name: "Sao Paulo (Brazil)", relays: ["155.133.227.35"] },
  ]);
  expect(parseSdrConfig(null)).toEqual([]);
});
