// 配置归属四态判定集成测试
import { test, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

vi.mock("electron", () => ({
  app: { getVersion: () => "2026.3.10" },
}));

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ownership-test-"));
  vi.stubEnv("OPENCLAW_STATE_DIR", tmpDir);
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

test("全新安装：无文件 → fresh", async () => {
  const { detectOwnership } = await import("./RunJianClaw-config");
  expect(detectOwnership()).toBe("fresh");
});

test("正常启动：RunJianClaw.config.json 完整 → RunJianClaw", async () => {
  const { writeRunJianClawConfig, detectOwnership } = await import("./RunJianClaw-config");
  writeRunJianClawConfig({ deviceId: "x", setupCompletedAt: "2026-03-10T00:00:00.000Z" });
  expect(detectOwnership()).toBe("RunJianClaw");
});

test("老用户升级：有 .device-id 无 RunJianClaw.config.json → legacy-RunJianClaw", async () => {
  const { detectOwnership } = await import("./RunJianClaw-config");
  fs.writeFileSync(path.join(tmpDir, ".device-id"), "uuid-123");
  expect(detectOwnership()).toBe("legacy-RunJianClaw");
});

test("外部 OpenClaw：有 openclaw.json 无归属 → external-openclaw", async () => {
  const { detectOwnership } = await import("./RunJianClaw-config");
  fs.writeFileSync(path.join(tmpDir, "openclaw.json"), "{}");
  expect(detectOwnership()).toBe("external-openclaw");
});

test("迁移后 .device-id 的 deviceId 被保留", async () => {
  const { migrateFromLegacy, readRunJianClawConfig } = await import("./RunJianClaw-config");
  fs.writeFileSync(path.join(tmpDir, ".device-id"), "preserved-id");
  fs.writeFileSync(path.join(tmpDir, "openclaw.json"), JSON.stringify({
    wizard: { lastRunAt: "2026-01-01T00:00:00.000Z" },
  }));
  migrateFromLegacy();
  expect(readRunJianClawConfig()?.deviceId).toBe("preserved-id");
  expect(readRunJianClawConfig()?.setupCompletedAt).toBe("2026-01-01T00:00:00.000Z");
});

test("markSetupComplete 创建完整的 RunJianClaw.config.json", async () => {
  const { markSetupComplete, detectOwnership } = await import("./RunJianClaw-config");
  markSetupComplete();
  expect(detectOwnership()).toBe("RunJianClaw");
});

test("迁移保留 skill-store.json 的 registryUrl", async () => {
  const { migrateFromLegacy, readRunJianClawConfig } = await import("./RunJianClaw-config");
  fs.writeFileSync(path.join(tmpDir, ".device-id"), "id-1");
  fs.writeFileSync(path.join(tmpDir, "openclaw.json"), "{}");
  fs.writeFileSync(path.join(tmpDir, "skill-store.json"), JSON.stringify({
    registryUrl: "https://my-registry.com",
  }));
  migrateFromLegacy();
  expect(readRunJianClawConfig()?.skillStore?.registryUrl).toBe("https://my-registry.com");
});

test("ensureDeviceId 无配置时自动创建", async () => {
  const { ensureDeviceId, readRunJianClawConfig } = await import("./RunJianClaw-config");
  const id = ensureDeviceId();
  expect(id).toBeTruthy();
  expect(readRunJianClawConfig()?.deviceId).toBe(id);
});

test("ensureDeviceId 已有配置时返回现有 ID", async () => {
  const { writeRunJianClawConfig, ensureDeviceId } = await import("./RunJianClaw-config");
  writeRunJianClawConfig({ deviceId: "existing-id" });
  expect(ensureDeviceId()).toBe("existing-id");
});
