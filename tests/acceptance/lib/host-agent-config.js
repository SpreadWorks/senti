import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadConfig } from "../../../src/lib/config.js";

function providerCommandIsRelativePath(command) {
  return typeof command === "string"
    && !path.isAbsolute(command)
    && (command.startsWith(".") || command.includes("/") || command.includes("\\"));
}

/**
 * The host's effective agent configuration, made safe to execute from an
 * isolated acceptance fixture. Fixture content never selects a provider.
 */
export class AcceptanceHostAgentConfiguration {
  constructor({ root, agent }) {
    if (typeof root !== "string" || !path.isAbsolute(root)) {
      throw new Error("acceptance host root must be an absolute path");
    }
    if (!agent || typeof agent !== "object") {
      throw new Error("acceptance host configuration requires an agent section");
    }
    this.root = fs.realpathSync(root);
    this.agent = structuredClone(agent);
    for (const provider of Object.values(this.agent.providers || {})) {
      if (providerCommandIsRelativePath(provider.command)) {
        provider.command = path.resolve(this.root, provider.command);
      }
    }
    Object.freeze(this);
  }

  static fromRoot(root) {
    const resolvedRoot = fs.realpathSync(root);
    return new AcceptanceHostAgentConfiguration({
      root: resolvedRoot,
      agent: loadConfig(resolvedRoot).agent,
    });
  }

  toFixtureAgent() {
    return structuredClone(this.agent);
  }
}

/** Resolve the repository containing this acceptance harness, never cwd. */
export function acceptanceHostRoot(moduleUrl = import.meta.url) {
  return fs.realpathSync(path.resolve(path.dirname(fileURLToPath(moduleUrl)), "..", "..", ".."));
}
