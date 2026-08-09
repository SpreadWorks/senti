/**
 * One-way cleanup for the agent-host hook that senrail previously installed.
 *
 * This is removal code, not a runtime integration. It deletes only the
 * uniquely named legacy handler and preserves every project-owned hook.
 */

import fs from "node:fs";
import path from "node:path";

const LEGACY_HANDLER_FILE = "senrail-flow-final-response-guard.mjs";
const LEGACY_HANDLER_PATH = `.codex/hooks/${LEGACY_HANDLER_FILE}`;
const LEGACY_CONFIG_PATH = ".codex/hooks.json";

function isLegacyHandler(handler) {
  return typeof handler?.command === "string"
    && handler.command.includes(LEGACY_HANDLER_FILE);
}

function isEmptyObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === 0;
}

export class LegacyAgentArtifactCleanup {
  constructor(root) {
    this.root = path.resolve(root);
    this.handlerPath = path.join(this.root, LEGACY_HANDLER_PATH);
    this.configPath = path.join(this.root, LEGACY_CONFIG_PATH);
    Object.freeze(this);
  }

  cleanedConfig() {
    if (!fs.existsSync(this.configPath)) return { changed: false, removeFile: false, value: null };
    let config;
    try {
      config = JSON.parse(fs.readFileSync(this.configPath, "utf8"));
    } catch (error) {
      throw new Error(`cannot remove legacy Flow hook from ${this.configPath}: invalid JSON (${error.message})`);
    }
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      throw new Error(`cannot remove legacy Flow hook from ${this.configPath}: expected a JSON object`);
    }
    if (config.hooks == null) return { changed: false, removeFile: false, value: config };
    if (typeof config.hooks !== "object" || Array.isArray(config.hooks)) {
      throw new Error(`cannot remove legacy Flow hook from ${this.configPath}: hooks must be an object`);
    }
    if (config.hooks.Stop == null) return { changed: false, removeFile: false, value: config };
    if (!Array.isArray(config.hooks.Stop)) {
      throw new Error(`cannot remove legacy Flow hook from ${this.configPath}: hooks.Stop must be an array`);
    }

    let removed = 0;
    const retainedGroups = [];
    for (const group of config.hooks.Stop) {
      if (!Array.isArray(group?.hooks)) {
        retainedGroups.push(group);
        continue;
      }
      const handlers = group.hooks.filter((handler) => {
        if (!isLegacyHandler(handler)) return true;
        removed += 1;
        return false;
      });
      if (handlers.length > 0) retainedGroups.push({ ...group, hooks: handlers });
    }
    if (removed === 0) return { changed: false, removeFile: false, value: config };

    const next = structuredClone(config);
    if (retainedGroups.length > 0) next.hooks.Stop = retainedGroups;
    else delete next.hooks.Stop;
    if (isEmptyObject(next.hooks)) delete next.hooks;
    return {
      changed: true,
      removeFile: isEmptyObject(next),
      value: next,
    };
  }

  run({ dryRun = false } = {}) {
    const config = this.cleanedConfig();
    const handlerExists = fs.existsSync(this.handlerPath);
    if (!dryRun) {
      if (handlerExists) fs.rmSync(this.handlerPath);
      if (config.changed) {
        if (config.removeFile) fs.rmSync(this.configPath, { force: true });
        else fs.writeFileSync(this.configPath, `${JSON.stringify(config.value, null, 2)}\n`, "utf8");
      }
    }
    return {
      removedHandler: handlerExists,
      updatedConfig: config.changed,
      removedConfig: config.changed && config.removeFile,
    };
  }
}

export function removeLegacyAgentArtifacts(root, options) {
  return new LegacyAgentArtifactCleanup(root).run(options);
}
