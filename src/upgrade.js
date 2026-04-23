#!/usr/bin/env node
/**
 * sdd-forge/upgrade.js
 *
 * Upgrade template-derived files (skills, AGENTS.md SDD section) to match
 * the currently installed sdd-forge version.
 *
 * Safe to run repeatedly — only overwrites template-managed content.
 * Does NOT touch config.json or context.json.
 *
 * Usage:
 *   sdd-forge upgrade [--dry-run]
 */

import fs from "fs";
import path from "path";
import { repoRoot, parseArgs, PKG_DIR } from "./lib/cli.js";
import { EXIT_ERROR } from "./lib/constants.js";
import { loadConfig, sddConfigPath } from "./lib/config.js";
import { translate } from "./lib/i18n.js";
import { validatePresetChain } from "./lib/presets.js";
import { deploySkills, deployProjectSkills, cleanupObsoleteSkills, MAIN_SKILLS_TEMPLATES_DIR } from "./lib/skills.js";


// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseUpgradeArgs(argv) {
  return parseArgs(argv, {
    flags: ["--dry-run"],
    options: [],
    defaults: { dryRun: false },
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const cli = parseUpgradeArgs(process.argv.slice(2));

  if (cli.help) {
    const { translate: tr } = await import("./lib/i18n.js");
    const tu = tr();
    const h = tu.raw("ui:help.cmdHelp.upgrade");
    const o = h.options;
    const files = h.updatedFiles || [];
    console.log([
      h.usage, "", `  ${h.desc}`, `  ${h.descDetail}`, "",
      "Updated files:",
      ...files.map((f) => `  ${f}`),
      "", "Options:", `  ${o.dryRun}`, `  ${o.help}`,
    ].join("\n"));
    return;
  }

  const root = repoRoot();
  const config = loadConfig(root);
  const t = translate();
  const dryRun = cli.dryRun;

  // Fail-fast: chapters ↔ templates static integrity check (spec 218).
  if (config.type) {
    try {
      validatePresetChain(config.type, root, {
        languages: config.docs?.languages || [],
        configChapters: config.chapters,
      });
    } catch (e) {
      console.error(e.message);
      process.exit(EXIT_ERROR);
    }
  }

  if (dryRun) {
    console.log(t("ui:upgrade.dryRunHeader"));
  }

  function logSkillResults(results) {
    for (const { name, status } of results) {
      if (status === "updated") {
        console.log(t("ui:upgrade.skillUpdated", { name }));
      } else {
        console.log(t("ui:upgrade.skillUnchanged", { name }));
      }
    }
  }

  // 1. Skills upgrade
  const validTemplatesDirs = [MAIN_SKILLS_TEMPLATES_DIR];
  let skillResults;
  try {
    skillResults = deploySkills(root, config.lang, { dryRun });
  } catch (e) {
    console.error(`upgrade failed: ${e.message}`);
    process.exit(EXIT_ERROR);
  }
  logSkillResults(skillResults);

  // 1b. Experimental skills (opt-in via config flags)
  if (config.experimental?.workflow?.enable === true) {
    const expDir = path.join(PKG_DIR, "..", "experimental", "workflow", "templates", "skills");
    validTemplatesDirs.push(expDir);
    const expResults = deployProjectSkills(root, expDir, config.lang, { dryRun });
    logSkillResults(expResults);
    skillResults.push(...expResults);
  }

  // 1c. Remove obsolete sdd-forge.* skills no longer in any template directory
  const removedSkills = cleanupObsoleteSkills(root, validTemplatesDirs, { dryRun });
  for (const { name } of removedSkills) {
    console.log(t("ui:upgrade.skillRemoved", { name }));
  }

  // 2. Migrate chapters format (string[] → object[])
  const configPath = sddConfigPath(root);
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (Array.isArray(raw.chapters) && raw.chapters.length > 0 && typeof raw.chapters[0] === "string") {
      raw.chapters = raw.chapters.map((name) => ({ chapter: name }));
      if (!dryRun) {
        fs.writeFileSync(configPath, JSON.stringify(raw, null, 2) + "\n", "utf8");
      }
      console.log(`[upgrade] migrated chapters to new format (${raw.chapters.length} entries)`);
    }
  } catch (_) {
    // config.json missing or unreadable — skip
  }

  // Summary
  const hasChanges = skillResults.some((r) => r.status === "updated") || removedSkills.length > 0;
  if (!hasChanges) {
    console.log(t("ui:upgrade.noChanges"));
  } else if (dryRun) {
    console.log(t("ui:upgrade.dryRunFooter"));
  } else {
    console.log(t("ui:upgrade.done"));
  }
}


export { main };
