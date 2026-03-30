import { test, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

vi.mock("electron", () => ({
  app: { getVersion: () => "2026.3.10" },
}));

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "RunJianClaw-config-test-"));
  vi.stubEnv("OPENCLAW_STATE_DIR", tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

test("readRunJianClawConfig 无文件时返回 null", async () => {
  const { readRunJianClawConfig } = await import("./RunJianClaw-config");
  expect(readRunJianClawConfig()).toBeNull();
});

test("writeRunJianClawConfig + readRunJianClawConfig 往返一致", async () => {
  const { readRunJianClawConfig, writeRunJianClawConfig } = await import("./RunJianClaw-config");
  const config = {
    deviceId: "test-uuid",
    setupCompletedAt: "2026-03-10T00:00:00.000Z",
  };
  writeRunJianClawConfig(config);
  expect(readRunJianClawConfig()).toEqual(config);
});

test("detectOwnership 无任何文件时返回 fresh", async () => {
  const { detectOwnership } = await import("./RunJianClaw-config");
  expect(detectOwnership()).toBe("fresh");
});

test("detectOwnership 有 RunJianClaw.config.json + setupCompletedAt 时返回 RunJianClaw", async () => {
  const { writeRunJianClawConfig, detectOwnership } = await import("./RunJianClaw-config");
  writeRunJianClawConfig({
    deviceId: "id",
    setupCompletedAt: "2026-03-10T00:00:00.000Z",
  });
  expect(detectOwnership()).toBe("RunJianClaw");
});

test("detectOwnership 有 setup-baseline 文件时返回 legacy-RunJianClaw", async () => {
  const { detectOwnership } = await import("./RunJianClaw-config");
  fs.writeFileSync(path.join(tmpDir, "openclaw-setup-baseline.json"), "{}", "utf-8");
  expect(detectOwnership()).toBe("legacy-RunJianClaw");
});

test("detectOwnership 有 .device-id 但无 RunJianClaw 独有文件时返回 external-openclaw", async () => {
  const { detectOwnership } = await import("./RunJianClaw-config");
  fs.writeFileSync(path.join(tmpDir, ".device-id"), "some-uuid", "utf-8");
  fs.writeFileSync(path.join(tmpDir, "openclaw.json"), "{}", "utf-8");
  expect(detectOwnership()).toBe("external-openclaw");
});

test("detectOwnership 有 openclaw.json 无 .device-id 无 RunJianClaw.config.json 时返回 external-openclaw", async () => {
  const { detectOwnership } = await import("./RunJianClaw-config");
  fs.writeFileSync(path.join(tmpDir, "openclaw.json"), "{}", "utf-8");
  expect(detectOwnership()).toBe("external-openclaw");
});

test("migrateFromLegacy 从 .device-id 和 wizard.lastRunAt 迁移", async () => {
  const { migrateFromLegacy, readRunJianClawConfig } = await import("./RunJianClaw-config");
  fs.writeFileSync(path.join(tmpDir, ".device-id"), "legacy-uuid", "utf-8");
  fs.writeFileSync(
    path.join(tmpDir, "openclaw.json"),
    JSON.stringify({ wizard: { lastRunAt: "2026-01-01T00:00:00.000Z" } }),
    "utf-8",
  );
  fs.writeFileSync(
    path.join(tmpDir, "skill-store.json"),
    JSON.stringify({ registryUrl: "https://custom.registry" }),
    "utf-8",
  );

  const result = migrateFromLegacy();
  expect(result.deviceId).toBe("legacy-uuid");
  expect(result.setupCompletedAt).toBe("2026-01-01T00:00:00.000Z");
  expect(result.skillStore?.registryUrl).toBe("https://custom.registry");

  const saved = readRunJianClawConfig();
  expect(saved?.deviceId).toBe("legacy-uuid");
});

test("markSetupComplete 写入 setupCompletedAt", async () => {
  const { markSetupComplete, readRunJianClawConfig } = await import("./RunJianClaw-config");
  markSetupComplete();
  const config = readRunJianClawConfig();
  expect(config?.setupCompletedAt).toBeTruthy();
  expect(typeof config?.setupCompletedAt).toBe("string");
});
