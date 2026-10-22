import { expect, test } from "vitest";
import { parsePing, probeHost } from "../src/main/diagnostics/ping";
test("parses PT/EN, submillisecond and IPv6 replies", () => {
  expect(
    parsePing("Resposta de 127.0.0.1: bytes=32 tempo<1ms TTL=128", 0).rttMs,
  ).toBe(0.5);
  expect(parsePing("Reply from ::1: time=32ms", 0).rttMs).toBe(32);
  expect(
    parsePing("Reply from 1.1.1.1: bytes=32 time=2ms TTL=55", 0).status,
  ).toBe("reply");
});
test("unreachable is no reply and malformed success is a parser error", () => {
  expect(parsePing("Request timed out.", 1).status).toBe("timeout");
  expect(parsePing("Destination host unreachable.", 0).status).toBe("timeout");
  expect(parsePing("Reply from", 0).status).toBe("error");
  expect(parsePing("", 1).status).toBe("error");
});
test("rejects command arguments before starting ping", async () => {
  expect(
    (await probeHost("-n 200", 1000, new AbortController().signal)).status,
  ).toBe("error");
});
