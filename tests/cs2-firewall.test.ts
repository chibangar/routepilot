import { expect, test } from "vitest";
import {
  AUTO_SCRIPT,
  RULE_GROUP,
  TASK_NAME,
  installScript,
  parseStatus,
  uninstallScript,
} from "../src/main/diagnostics/cs2-firewall";

test("o script elevado só usa IPs da Valve e só bloqueia UDP no grupo do RoutePilot", () => {
  expect(AUTO_SCRIPT).toContain("api.steampowered.com/ISteamApps/GetSDRConfig");
  expect(AUTO_SCRIPT).toContain(`$group = '${RULE_GROUP}'`);
  expect(AUTO_SCRIPT).toContain("-Protocol UDP");
  // Do pedido só se aceitam modos conhecidos e códigos curtos.
  expect(AUTO_SCRIPT).toContain("'^[a-z0-9]{2,8}$'");
  expect(AUTO_SCRIPT).not.toMatch(/\$req\.(ips|host|address)/);
});

test("a instalação protege o script e cria a tarefa do utilizador", () => {
  const s = installScript("PC\\Ricardo");
  expect(s).toContain("icacls $dir /inheritance:r");
  expect(s).toContain(`-TaskName '${TASK_NAME}'`);
  expect(s).toContain("-RunLevel Highest");
  expect(s).toContain("-UserId 'PC\\Ricardo'");
  expect(() => installScript("x'; Remove-Item C:\\ -Recurse; '")).toThrow();
});

test("remover apaga a tarefa, as regras e o script", () => {
  const s = uninstallScript();
  expect(s).toContain(`Unregister-ScheduledTask -TaskName '${TASK_NAME}'`);
  expect(s).toContain(`Get-NetFirewallRule -Group '${RULE_GROUP}'`);
});

test("interpreta o estado gravado pela tarefa", () => {
  expect(
    parseStatus(
      true,
      { mode: "auto" },
      { ok: true, allowed: ["mad"], blocked: 44, pings: { mad: 9, par: "x" }, at: "2026-10-22T18:00:00Z" },
    ),
  ).toEqual({
    installed: true,
    mode: "auto",
    ok: true,
    allowed: ["mad"],
    blocked: 44,
    pings: { mad: 9 },
    error: null,
    checkedAt: "2026-10-22T18:00:00Z",
  });
  expect(parseStatus(false, null, null).mode).toBe("off");
});
