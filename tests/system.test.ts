import { expect, test } from "vitest";
import { summarize } from "../src/main/system/monitor";
import { parsePowerScheme, parseSchemes, HIGH_PERFORMANCE } from "../src/main/system/performance";
import { QOS_PREFIX, qosScript } from "../src/main/system/qos";
import { automaticScript, preferScript } from "../src/main/system/interfaces";

const target = { id: "x", group: "Casa", label: "Internet", host: "1.1.1.1" };

test("monitor calcula média, jitter, picos e perdas", () => {
  const s = summarize(target, [10, 12, null, 10, 60, 11], true);
  expect(s).toMatchObject({ sent: 6, lost: 1, minMs: 10, spikes: 1, lastMs: 11, running: true });
  expect(s.meanMs).toBeCloseTo(20.6, 1);
  expect(summarize(target, [], false).meanMs).toBeNull();
});

test("lê o plano de energia em PT e EN", () => {
  expect(
    parsePowerScheme("GUID do Esquema de Energia: 381b4222-f694-41f0-9685-ff5bb260df2e  (Equilibrado)"),
  ).toEqual({ guid: "381b4222-f694-41f0-9685-ff5bb260df2e", name: "Equilibrado" });
  const list = parseSchemes(
    `Power Scheme GUID: 381b4222-f694-41f0-9685-ff5bb260df2e  (Balanced) *\nPower Scheme GUID: ${HIGH_PERFORMANCE}  (High performance)`,
  );
  expect(list.map((s) => s.guid)).toContain(HIGH_PERFORMANCE);
});

test("QoS só cria regras do RoutePilot para apps conhecidas", () => {
  const s = qosScript([{ exe: "OneDrive.exe", mbps: 5 }]);
  expect(s).toContain(`Where-Object { $_.Name -like '${QOS_PREFIX}*' }`);
  expect(s).toContain("-AppPathNameMatchCondition 'OneDrive.exe' -ThrottleRateActionBitsPerSecond 5000000");
  expect(() => qosScript([{ exe: "evil.exe'; Remove-Item C:\\", mbps: 5 }])).toThrow();
  expect(() => qosScript([{ exe: "OneDrive.exe", mbps: 0 }])).toThrow();
  expect(qosScript([])).not.toContain("New-NetQosPolicy");
});

test("Multi-Internet só aceita índices numéricos", () => {
  expect(preferScript(12, [7])).toContain("-InterfaceIndex 12 -AddressFamily IPv4 -InterfaceMetric 5");
  expect(preferScript(12, [7])).toContain("-InterfaceIndex 7 -AddressFamily IPv4 -InterfaceMetric 50");
  expect(automaticScript([12, 7])).toContain("-AutomaticMetric Enabled");
  expect(() => preferScript(1.5, [])).toThrow();
});
