import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { resolveUserStateDir, resolveUserConfigPath } from "./constants";

// ── 类型定义 ──

export interface RunJianClawConfig {
  setupCompletedAt?: string;
  cliPreference?: "installed" | "uninstalled";
  updateChannel?: "stable" | "dev";
  lastShownReleaseNotesVersion?: string;
  skillStore?: {
    registryUrl?: string;
  };
}

// 四种归属状态
export type OwnershipState =
  | "RunJianClaw"
  | "legacy-RunJianClaw"
  | "external-openclaw"
  | "fresh";

// ── 路径 ──

// RunJianClaw 专属配置文件路径
export function resolveRunJianClawConfigPath(): string {
  return path.join(resolveUserStateDir(), "RunJianClaw.config.json");
}

// .device-id 文件路径（与官方 CLI 共用）
function resolveDeviceIdPath(): string {
  return path.join(resolveUserStateDir(), ".device-id");
}

// legacy skill-store.json 文件路径
function resolveSkillStoreConfigPath(): string {
  return path.join(resolveUserStateDir(), "skill-store.json");
}

// ── 读写 ──

// 读取 RunJianClaw 专属配置，不存在或解析失败返回 null
export function readRunJianClawConfig(): RunJianClawConfig | null {
  try {
    const raw = fs.readFileSync(resolveRunJianClawConfigPath(), "utf-8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as RunJianClawConfig;
  } catch {
    return null;
  }
}

// 写入 RunJianClaw 专属配置
export function writeRunJianClawConfig(config: RunJianClawConfig): void {
  const dir = resolveUserStateDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    resolveRunJianClawConfigPath(),
    JSON.stringify(config, null, 2) + "\n",
    "utf-8",
  );
}

// ── 归属检测 ──

// 老版 RunJianClaw 独有文件：官方 CLI 不会创建 setup-baseline
function hasLegacyRunJianClawMarker(): boolean {
  return fs.existsSync(
    path.join(resolveUserStateDir(), "openclaw-setup-baseline.json"),
  );
}

// 判定当前 ~/.openclaw/ 目录的归属状态
export function detectOwnership(): OwnershipState {
  const RunJianClawConfig = readRunJianClawConfig();
  if (RunJianClawConfig?.setupCompletedAt) return "RunJianClaw";

  // 老版 RunJianClaw 没有 RunJianClaw.config.json，但会创建这些独有文件
  // （.device-id 和 wizard.lastRunAt 不可靠：官方 CLI 也会创建）
  if (hasLegacyRunJianClawMarker()) return "legacy-RunJianClaw";

  const openclawJsonExists = fs.existsSync(resolveUserConfigPath());
  if (openclawJsonExists) return "external-openclaw";

  return "fresh";
}

// ── 迁移 ──

// 从 legacy 文件迁移到 RunJianClaw.config.json（老 RunJianClaw 用户升级）
export function migrateFromLegacy(): RunJianClawConfig {
  // 读取 wizard.lastRunAt
  let setupCompletedAt: string | undefined;
  try {
    const raw = fs.readFileSync(resolveUserConfigPath(), "utf-8");
    const config = JSON.parse(raw);
    if (config?.wizard?.lastRunAt) {
      setupCompletedAt = config.wizard.lastRunAt;
    }
  } catch {}

  // 读取 skill-store.json
  let skillStore: RunJianClawConfig["skillStore"];
  const skillStorePath = resolveSkillStoreConfigPath();
  try {
    const raw = JSON.parse(fs.readFileSync(skillStorePath, "utf-8"));
    if (raw?.registryUrl) {
      skillStore = { registryUrl: raw.registryUrl };
    }
  } catch {}

  const config: RunJianClawConfig = { setupCompletedAt, skillStore };
  writeRunJianClawConfig(config);
  return config;
}

// ── 便捷方法 ──

// 标记 Setup 完成（写入 setupCompletedAt 到 RunJianClaw.config.json）
export function markSetupComplete(): void {
  let config = readRunJianClawConfig();
  if (!config) {
    config = {};
  }
  config.setupCompletedAt = new Date().toISOString();
  writeRunJianClawConfig(config);
}

// 确保 deviceId 存在，直接读写 .device-id 文件（与官方 CLI 共用）
export function ensureDeviceId(): string {
  const deviceIdPath = resolveDeviceIdPath();
  try {
    const existing = fs.readFileSync(deviceIdPath, "utf-8").trim();
    if (existing) return existing;
  } catch {}

  // 文件不存在或为空，生成新 ID 并写入
  const deviceId = crypto.randomUUID();
  const dir = resolveUserStateDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(deviceIdPath, deviceId + "\n", "utf-8");
  return deviceId;
}
