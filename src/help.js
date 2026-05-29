#!/usr/bin/env node
/**
 * sdd-forge/help.js
 *
 * Display available commands.
 * Language is determined by .sdd-forge/config.json lang, defaulting to "en".
 */

import { getPackageVersion } from "./lib/cli.js";
import { translate } from "./lib/i18n.js";

/** Command layout — name keys correspond to ui.json help.commands.* */
const LAYOUT = [
  { name: "help" },
  { section: "Project" },
  { name: "setup" },
  { name: "upgrade" },
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
  { section: "Workflow" },
  { name: "workflow" },
  { section: "Info" },
  { name: "presets list" },
];

function main() {
  const t = translate();
  const version = getPackageVersion();

  const commands = LAYOUT.map((entry) => {
    if (entry.section) return entry;
    return { name: entry.name, desc: t(`ui:help.commands.${entry.name}`) };
  });

  const maxName = Math.max(...commands.filter((c) => c.name).map((c) => c.name.length));

  console.log("");
  console.log(`  \x1b[1mSDD Forge\x1b[0m v${version} — ${t("ui:help.title")}`);
  console.log("");
  console.log(`  ${t("ui:help.usage")}`);
  console.log("");

  for (const cmd of commands) {
    if (cmd.section) {
      console.log("");
      console.log(`  \x1b[2m${cmd.section}\x1b[0m`);
      continue;
    }
    const padded = cmd.name.padEnd(maxName + 2);
    console.log(`    ${padded}\x1b[2m${cmd.desc}\x1b[0m`);
  }

  console.log("");
  console.log(`  ${t("ui:help.runHelp")}`);
  console.log("");
}

export { main, LAYOUT as commands };

