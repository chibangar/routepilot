import { expect, test } from "vitest";
import { validateCall, authorizeSender } from "../src/main/ipc";
test("accepts only the main local frame", () => {
  expect(
    authorizeSender("file:///app/index.html", "https://evil.test", true),
  ).toBe(false);
  expect(
    authorizeSender("file:///app/index.html", "file:///app/index.html", false),
  ).toBe(false);
  expect(
    authorizeSender("file:///app/index.html", "file:///app/index.html", true),
  ).toBe(true);
});
test("refuses unknown operations, extra paths and malformed arguments", () => {
  expect(
    validateCall({
      operation: "exportSessions",
      args: { format: "json", path: "C:/user.txt" },
    }).ok,
  ).toBe(false);
  expect(
    validateCall({ operation: "exec", args: { command: "whoami" } }).ok,
  ).toBe(false);
  expect(
    validateCall({ operation: "cancelSession", args: { id: 42 } }).ok,
  ).toBe(false);
  expect(
    validateCall({ operation: "exportSessions", args: { format: "json" } }).ok,
  ).toBe(true);
});
