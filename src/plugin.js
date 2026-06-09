#!/usr/bin/env node

import { repoRoot } from "./lib/cli.js";
import { EXIT_ERROR } from "./lib/constants.js";
import {
  addPluginRepo,
  findPluginCandidates,
  installPlugin,
  listInstalledPlugins,
  maskPluginSource,
  readProjectConfig,
  setPluginEnabled,
  syncInstalledPlugins,
  updatePluginRepos,
} from "./lib/plugin-registry.js";

function printHelp() {
  console.log([
    "Usage: senti plugin <command> [args]",
    "",
    "Manage plugin repos and installed plugin packages.",
    "",
    "Commands:",
    "  repo add <git URL|local path> [--ref <ref>]",
    "  repo update",
    "  repo list [--json]",
    "  find [--json]",
    "  install <id>",
    "  list [--json]",
    "  enable <id>",
    "  disable <id>",
    "  update-all",
    "  sync",
    "",
    "Installed packages are recorded with a reproducible commit pin.",
  ].join("\n"));
}

function printRepoHelp() {
  console.log([
    "Usage: senti plugin repo <command>",
    "",
    "Manage plugin repository sources. Sources may be a git URL or a clean local path.",
    "",
    "Commands:",
    "  repo add <git URL|local path> [--ref <ref>]",
    "  repo update",
    "  repo list [--json]",
  ].join("\n"));
}

function hasJson(args) {
  return args.includes("--json");
}

function stripFlags(args) {
  const out = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--json") continue;
    if (args[i] === "--ref") {
      i += 1;
      continue;
    }
    out.push(args[i]);
  }
  return out;
}

function refArg(args) {
  const index = args.indexOf("--ref");
  if (index === -1) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("-")) throw new Error("Missing value for --ref");
  return value;
}

function output(value, json) {
  if (json) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) console.log(formatLine(item));
    return;
  }
  console.log(formatLine(value));
}

function formatLine(value) {
  if (typeof value === "string") return value;
  if (value.id && value.status) return `${value.id} ${value.status} ${value.commit || ""}`.trim();
  if (value.id && value.source) return `${value.id} ${maskPluginSource(value.source)} ${value.commit || ""}`.trim();
  if (value.id && value.repo) return `${value.id} repo=${value.repo} ${value.commit || ""}`.trim();
  return JSON.stringify(value);
}

export async function main() {
  const root = repoRoot();
  const args = process.argv.slice(2);
  const [command, ...rest] = args;

  if (!command || command === "-h" || command === "--help") {
    printHelp();
    return;
  }

  try {
    if (command === "repo") {
      const [repoCommand, ...repoRest] = rest;
      if (!repoCommand || repoCommand === "-h" || repoCommand === "--help") {
        printRepoHelp();
        return;
      }
      if (repoCommand === "add") {
        const source = stripFlags(repoRest)[0];
        if (!source) throw new Error("Usage: senti plugin repo add <git URL|local path>");
        output(addPluginRepo(root, source, refArg(repoRest)), false);
        return;
      }
      if (repoCommand === "update") {
        output(updatePluginRepos(root), hasJson(repoRest));
        return;
      }
      if (repoCommand === "list") {
        const config = readProjectConfig(root);
        output(config.plugin.repos, hasJson(repoRest));
        return;
      }
      throw new Error(`unknown plugin repo command: ${repoCommand}`);
    }

    if (command === "find") {
      output(findPluginCandidates(root), hasJson(rest));
      return;
    }
    if (command === "install") {
      const id = stripFlags(rest)[0];
      if (!id) throw new Error("Usage: senti plugin install <id>");
      output(installPlugin(root, id), false);
      return;
    }
    if (command === "list") {
      output(listInstalledPlugins(root), hasJson(rest));
      return;
    }
    if (command === "enable" || command === "disable") {
      const id = stripFlags(rest)[0];
      if (!id) throw new Error(`Usage: senti plugin ${command} <id>`);
      output(setPluginEnabled(root, id, command === "enable"), false);
      return;
    }
    if (command === "sync") {
      output(syncInstalledPlugins(root), hasJson(rest));
      return;
    }
    if (command === "update-all") {
      output(syncInstalledPlugins(root, { update: true }), hasJson(rest));
      return;
    }

    throw new Error(`unknown plugin command: ${command}`);
  } catch (err) {
    console.error(maskPluginSource(err.message || String(err)));
    process.exit(EXIT_ERROR);
  }
}
