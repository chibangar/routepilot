import { expect, test } from "vitest";
import {
  advice,
  droppedAt,
  grade,
  parseAdapter,
  parseWifiSignal,
} from "../src/main/diagnostics/network-check";

test("identifica Wi-Fi e cabo pelo tipo de meio físico", () => {
  expect(
    parseAdapter('{"name":"Wi-Fi","media":"Native 802.11","ndis":"9","speed":"866.7 Mbps","gateway":"192.168.1.1"}'),
  ).toMatchObject({ wifi: true, gateway: "192.168.1.1" });
  expect(
    parseAdapter('{"name":"Ethernet","media":"802.3","ndis":"14","speed":"1 Gbps","gateway":"192.168.1.1"}').wifi,
  ).toBe(false);
  expect(parseAdapter("").wifi).toBeNull();
});

test("lê o sinal Wi-Fi em PT/EN", () => {
  expect(parseWifiSignal("    Sinal                  : 72%")).toBe(72);
  expect(parseWifiSignal("    Signal                 : 99%")).toBe(99);
  expect(parseWifiSignal("nada")).toBeNull();
});

test("nota de bufferbloat", () => {
  expect(grade(2)).toBe("A+");
  expect(grade(45)).toBe("B");
  expect(grade(500)).toBe("F");
  expect(grade(null)).toBeNull();
});

test("conselhos refletem os problemas encontrados", () => {
  const phase = { sent: 10, received: 10, medianMs: 1, jitterMs: 0.2 };
  const tips = advice({
    measuredAt: "",
    adapterName: "Wi-Fi",
    adapterDescription: null,
    wifi: true,
    wifiSignal: 50,
    linkSpeed: null,
    gatewayAddress: "192.168.1.1",
    gateway: phase,
    idle: phase,
    download: phase,
    upload: phase,
    downloadMbps: 100,
    uploadMbps: 10,
    downloadIncreaseMs: 120,
    uploadIncreaseMs: 10,
    bufferbloatGrade: "C",
    metered: false,
    loadSkipped: null,
    dropped: null,
    recovered: null,
    dataUsedMb: 80,
  });
  expect(tips.join(" ")).toMatch(/cabo/);
  expect(tips.join(" ")).toMatch(/50%/);
  expect(tips.join(" ")).toMatch(/SQM/);
});

test("deteta ligações tarifadas ou móveis para não gastar dados", () => {
  expect(parseAdapter('{"name":"Ethernet","description":"Realtek","media":"802.3","gateway":"192.168.0.1","cost":"Unrestricted"}').metered).toBe(false);
  expect(parseAdapter('{"name":"Wi-Fi","description":"Intel","media":"Native 802.11","gateway":"192.168.0.1","cost":"Fixed"}').metered).toBe(true);
  expect(parseAdapter('{"name":"Ethernet 3","description":"Remote NDIS based Internet Sharing Device","media":"802.3","gateway":"192.168.42.129"}').metered).toBe(true);
});

test("pára a carga após 3 sondas seguidas sem resposta", () => {
  expect(droppedAt([10, 12, null, null])).toBe(false);
  expect(droppedAt([10, null, null, null])).toBe(true);
  expect(droppedAt([null, null])).toBe(false);
});

test("avisa quando a ligação caiu durante o teste", () => {
  const phase = { sent: 10, received: 10, medianMs: 1, jitterMs: 0.2 };
  const base = {
    measuredAt: "", adapterName: "Ethernet", adapterDescription: null, wifi: false, wifiSignal: null,
    linkSpeed: null, gatewayAddress: null, gateway: phase, idle: phase, download: phase, upload: phase,
    downloadMbps: null, uploadMbps: null, downloadIncreaseMs: null, uploadIncreaseMs: null,
    bufferbloatGrade: "F" as const, metered: false, loadSkipped: null, dataUsedMb: 10,
  };
  expect(advice({ ...base, dropped: "download", recovered: true })[0]).toMatch(/parou a carga/);
  expect(advice({ ...base, dropped: "download", recovered: false })[0]).toMatch(/reinicia o router/);
});
