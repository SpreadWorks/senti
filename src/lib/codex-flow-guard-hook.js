/**
 * Deployment for the Codex Stop hook that enforces senti Flow continuation.
 *
 * The generated .codex directory is local agent configuration, so it remains
 * outside source control. This module only owns its uniquely named handler;
 * all project-owned hook groups remain intact.
 */

import fs from "node:fs";
import path from "node:path";
import { PKG_DIR } from "./cli.js";

export const CODEX_FLOW_GUARD_HOOK_FILE = "senti-flow-final-response-guard.mjs";
const CODEX_FLOW_GUARD_HOOK_PATH = `.codex/hooks/${CODEX_FLOW_GUARD_HOOK_FILE}`;
const CODEX_FLOW_GUARD_COMMAND = `node "$(git rev-parse --show-toplevel)/${CODEX_FLOW_GUARD_HOOK_PATH}"`;

function hookHandler() {
  return {
    type: "command",
    command: CODEX_FLOW_GUARD_COMMAND,
    timeout: 30,
    statusMessage: "Checking active senti Flow continuation",
  };
}

function isManagedHandler(handler) {
  return typeof handler?.command === "string"
    && handler.command.includes(CODEX_FLOW_GUARD_HOOK_FILE);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function mergeCodexFlowGuardHook(config = {}) {
  if (config == null || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Codex hooks configuration must be a JSON object");
  }
  const next = clone(config);
  if (next.hooks != null && (typeof next.hooks !== "object" || Array.isArray(next.hooks))) {
    throw new Error("Codex hooks configuration field 'hooks' must be an object");
  }
  next.hooks = next.hooks || {};
  if (next.hooks.Stop != null && !Array.isArray(next.hooks.Stop)) {
    throw new Error("Codex hooks configuration field 'hooks.Stop' must be an array");
  }

  const retained = (next.hooks.Stop || [])
    .map((group) => ({ ...group, hooks: Array.isArray(group?.hooks) ? group.hooks.filter((handler) => !isManagedHandler(handler)) : group?.hooks }))
    .filter((group) => !Array.isArray(group.hooks) || group.hooks.length > 0);
  retained.push({ hooks: [hookHandler()] });
  next.hooks.Stop = retained;
  return next;
}

function readConfig(file) {
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`cannot update ${file}: invalid JSON (${error.message})`);
  }
}

function writeIfChanged(file, content, dryRun) {
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (current === content) return "unchanged";
  if (!dryRun) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content, "utf8");
  }
  return "updated";
}

export function deployCodexFlowGuardHook(root, { dryRun = false } = {}) {
  const source = path.join(PKG_DIR, "codex-hooks", CODEX_FLOW_GUARD_HOOK_FILE);
  const hookFile = path.join(root, ".codex", "hooks", CODEX_FLOW_GUARD_HOOK_FILE);
  const configFile = path.join(root, ".codex", "hooks.json");
  const config = mergeCodexFlowGuardHook(readConfig(configFile));
  const hookStatus = writeIfChanged(hookFile, fs.readFileSync(source, "utf8"), dryRun);
  const configStatus = writeIfChanged(configFile, `${JSON.stringify(config, null, 2)}\n`, dryRun);
  return { hookStatus, configStatus, hookFile, configFile };
}
