#!/usr/bin/env node
/**
 * senti/help.js
 *
 * Display available commands.
 * Language is determined by .senti/config.json lang, defaulting to "en".
 */

import { getPackageVersion } from "./lib/cli.js";
import { translate } from "./lib/i18n.js";
import { loadPluginRegistry } from "./lib/plugin-registry.js";

/** Command layout — name keys correspond to ui.json help.commands.* */
const LAYOUT = [
  { name: "help" },
  { section: "Project" },
  { name: "setup" },
  { name: "upgrade" },
  { name: "plugin" },
  { section: "Docs" },
  { name: "docs build" },
  { name: "docs scan" },
  { name: "docs enrich" },
  { name: "docs init" },
  { name: "docs data" },
  { name: "docs text" },
  { name: "docs readme" },
  { name: "docs forge" },
  { name: "docs review" },
  { name: "docs translate" },
  { name: "docs changelog" },
  { name: "docs agents" },
  { name: "docs snapshot" },
  { section: "Flow" },
  { name: "flow get" },
  { name: "flow set" },
  { name: "flow run" },
  { section: "Metrics" },
  { name: "metrics token" },
  { section: "Info" },
  { name: "presets list" },
];

function localizedCommand(command, lang) {
  const localized = command.locale?.[lang] || {};
  return {
    ...command,
    desc: localized.desc || command.desc || command.description || command.help || "",
    help: localized.help || command.help || "",
    subcommands: (command.subcommands || []).map((sub) => {
      const subLocalized = sub.locale?.[lang] || {};
      return { ...sub, desc: subLocalized.desc || sub.desc || sub.description || "", help: subLocalized.help || sub.help || "" };
    }),
  };
}

function pluginCommands(root, lang) {
  try {
    return [...loadPluginRegistry(root).commands.values()].map((command) => localizedCommand(command, lang));
  } catch (_) {
    return [];
  }
}

export async function renderHelp({ root = process.cwd(), argv = [], lang = null } = {}) {
  const t = translate();
  const effectiveLang = lang || "en";
  const plugins = pluginCommands(root, effectiveLang);
  const target = argv.find((arg) => arg !== "--help" && arg !== "-h") || null;
  const subTarget = target ? argv.filter((arg) => arg !== "--help" && arg !== "-h")[1] : null;
  const pluginTarget = target ? plugins.find((command) => command.name === target) : null;

  if (pluginTarget && subTarget) {
    const sub = pluginTarget.subcommands.find((entry) => entry.name === subTarget);
    if (sub) return [sub.help || `Usage: senti ${pluginTarget.name} ${sub.name}`, "", sub.desc || ""].join("\n");
  }
  if (pluginTarget) {
    const lines = [pluginTarget.help || `Usage: senti ${pluginTarget.name}`, ""];
    if (pluginTarget.desc) lines.push(pluginTarget.desc);
    if (pluginTarget.subcommands.length) {
      lines.push("", "Subcommands:");
      for (const sub of pluginTarget.subcommands) lines.push(`  ${sub.name}  ${sub.desc || ""}`.trimEnd());
    }
    return lines.join("\n");
  }

  const version = getPackageVersion();

  const commands = LAYOUT.map((entry) => {
    if (entry.section) return entry;
    return { name: entry.name, desc: t(`ui:help.commands.${entry.name}`) };
  });
  if (plugins.length) {
    commands.push({ section: "Plugins" });
    for (const command of plugins) {
      commands.push({
        name: command.name,
        desc: `${command.desc || ""}${command.experimental ? " [experimental]" : ""}`.trim(),
      });
    }
  }

  const maxName = Math.max(...commands.filter((c) => c.name).map((c) => c.name.length));
  const lines = [];
  lines.push("");
  lines.push(`  senti v${version} - ${t("ui:help.title")}`);
  lines.push("");
  lines.push(`  ${t("ui:help.usage")}`);
  lines.push("");

  for (const cmd of commands) {
    if (cmd.section) {
      lines.push("");
      lines.push(`  ${cmd.section}`);
      continue;
    }
    const padded = cmd.name.padEnd(maxName + 2);
    lines.push(`    ${padded}${cmd.desc}`);
  }

  lines.push("");
  lines.push(`  ${t("ui:help.runHelp")}`);
  lines.push("");
  return lines.join("\n");
}

async function main() {
  console.log(await renderHelp({ root: process.cwd(), argv: process.argv.slice(2) }));
}

export { main, LAYOUT as commands };
