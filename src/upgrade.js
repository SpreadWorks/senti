#!/usr/bin/env node
/**
 * sdd-forge/upgrade.js
 *
 * Upgrade skill-derived files (skills, AGENTS.md SDD section) to match
 * the currently installed sdd-forge version.
 *
 * Safe to run repeatedly — only overwrites skill-managed content. config.json
 * is migrated in place additively (chapters format; agent default profiles +
 * their referenced providers, add-only with existing user values preserved);
 * agent `default` / `useProfile` are never touched. context.json is untouched.
 *
 * Usage:
 *   sdd-forge upgrade [--dry-run]
 */

import fs from "fs";
import path from "path";
import { repoRoot, parseArgs } from "./lib/cli.js";
import { EXIT_ERROR } from "./lib/constants.js";
import { loadConfig, sddConfigPath } from "./lib/config.js";
import { container } from "./lib/container.js";
import { mergeAgentDefaults } from "./lib/agent-defaults.js";
import { translate } from "./lib/i18n.js";
import { validatePresetChain } from "./lib/presets.js";
import {
  deploySkills,
  cleanupObsoleteSkills,
  MAIN_SKILLS_DIR,
} from "./lib/skills.js";
import { deployPresetCopies } from "./lib/preset-deploy.js";
import { writeUpgradeResultArtifact } from "./flow/lib/test-artifacts.js";


// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

export function parseUpgradeArgs(argv) {
  return parseArgs(argv, {
    flags: ["--dry-run"],
    options: [],
    defaults: { dryRun: false },
  });
}

function resolveActiveUpgradeFlow(root) {
  if (!container.has("flowManager")) return null;
  try {
    const state = container.get("flowManager").load();
    if (!state?.spec || !state.baseBranch) return null;
    return {
      state,
      specDir: path.dirname(path.resolve(root, state.spec)),
    };
  } catch (_) {
    return null;
  }
}

function createUpgradeLogger() {
  const lines = [];
  return {
    log(message = "") {
      const text = String(message);
      lines.push(text);
      console.log(text);
    },
    error(message = "") {
      const text = String(message);
      lines.push(text);
      console.error(text);
    },
    rawOutput() {
      return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
    },
  };
}

function resultFromSummary(exitCode, hasChanges) {
  if (exitCode !== 0) return "failed";
  return hasChanges ? "success-updated" : "success-no-change";
}

function writeActiveUpgradeArtifact({ root, activeFlow, command, dryRun, exitCode, result, summary, rawOutput }) {
  if (!activeFlow) return;
  writeUpgradeResultArtifact({
    root,
    specDir: activeFlow.specDir,
    baseBranch: activeFlow.state.baseBranch,
    command,
    dryRun,
    exitCode,
    result,
    summary,
    rawOutput,
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const cli = parseUpgradeArgs(process.argv.slice(2));
  const root = repoRoot();
  const activeFlow = resolveActiveUpgradeFlow(root);
  const logger = createUpgradeLogger();
  const command = ["sdd-forge", "upgrade", ...process.argv.slice(2)].join(" ");

  if (cli.help) {
    const { translate: tr } = await import("./lib/i18n.js");
    const tu = tr();
    const h = tu.raw("ui:help.cmdHelp.upgrade");
    const o = h.options;
    const files = h.updatedFiles || [];
    logger.log([
      h.usage, "", `  ${h.desc}`, `  ${h.descDetail}`, "",
      "Updated files:",
      ...files.map((f) => `  ${f}`),
      "", "Options:", `  ${o.dryRun}`, `  ${o.help}`,
    ].join("\n"));
    return;
  }

  const config = loadConfig(root);
  const t = translate();
  const dryRun = cli.dryRun;
  const summary = {
    skills: { updated: 0, unchanged: 0, removed: 0 },
    presets: { copied: 0 },
    config: { changed: false },
  };

  // Fail-fast: chapters ↔ preset chain static integrity check (spec 218).
  if (config.type) {
    try {
      validatePresetChain(config.type, root, {
        languages: config.docs?.languages || [],
        configChapters: config.chapters,
      });
    } catch (e) {
      logger.error(e.message);
      writeActiveUpgradeArtifact({
        root,
        activeFlow,
        command,
        dryRun,
        exitCode: EXIT_ERROR,
        result: "failed",
        summary: { ...summary, error: e.message },
        rawOutput: logger.rawOutput(),
      });
      process.exit(EXIT_ERROR);
    }
  }

  if (dryRun) {
    logger.log(t("ui:upgrade.dryRunHeader"));
  }

  function logSkillResults(results) {
    for (const { name, status } of results) {
      if (status === "updated") {
        logger.log(t("ui:upgrade.skillUpdated", { name }));
      } else {
        logger.log(t("ui:upgrade.skillUnchanged", { name }));
      }
    }
  }

  // Skills upgrade — single unconditional source (MAIN_SKILLS_DIR).
  let skillResults;
  try {
    skillResults = deploySkills(root, { dryRun });
  } catch (e) {
    logger.error(`upgrade failed: ${e.message}`);
    writeActiveUpgradeArtifact({
      root,
      activeFlow,
      command,
      dryRun,
      exitCode: EXIT_ERROR,
      result: "failed",
      summary: { ...summary, error: `upgrade failed: ${e.message}` },
      rawOutput: logger.rawOutput(),
    });
    process.exit(EXIT_ERROR);
  }
  logSkillResults(skillResults);
  summary.skills.updated = skillResults.filter((r) => r.status === "updated").length;
  summary.skills.unchanged = skillResults.filter((r) => r.status === "unchanged").length;

  // Remove obsolete sdd-forge.* skills no longer in the skill source directory
  const removedSkills = cleanupObsoleteSkills(root, [MAIN_SKILLS_DIR], { dryRun });
  summary.skills.removed = removedSkills.length;
  for (const { name } of removedSkills) {
    logger.log(t("ui:upgrade.skillRemoved", { name }));
  }

  if (!dryRun) {
    const presetCopies = deployPresetCopies(root, {
      presetKeys: ["base"],
      languages: config.docs?.languages?.length ? config.docs.languages : ["en", "ja"],
    });
    summary.presets.copied = presetCopies.length;
  }

  // Migrate config.json in place (chapters format + agent defaults). Single read/write.
  const configPath = sddConfigPath(root);
  let configChanged = false;
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));

    // Migrate chapters format (string[] → object[])
    if (Array.isArray(raw.chapters) && raw.chapters.length > 0 && typeof raw.chapters[0] === "string") {
      raw.chapters = raw.chapters.map((name) => ({ chapter: name }));
      configChanged = true;
      logger.log(`[upgrade] migrated chapters to new format (${raw.chapters.length} entries)`);
    }

    // Seed default agent profiles + their referenced providers (add-only; existing
    // user values win). Only when an agent section already exists — never impose
    // agent config on projects that don't use it. default/useProfile untouched.
    if (raw.agent && typeof raw.agent === "object") {
      const merged = mergeAgentDefaults(raw.agent);
      if (merged.changed) {
        configChanged = true;
        const parts = [];
        if (merged.addedProfiles.length) parts.push(`profiles: ${merged.addedProfiles.join(", ")}`);
        if (merged.addedSlots.length) parts.push(`slots: ${merged.addedSlots.length}`);
        if (merged.addedProviders.length) parts.push(`providers: ${merged.addedProviders.join(", ")}`);
        logger.log(`[upgrade] added agent defaults (${parts.join("; ")})`);
      }
    }

    if (configChanged && !dryRun) {
      fs.writeFileSync(configPath, JSON.stringify(raw, null, 2) + "\n", "utf8");
    }
  } catch (_) {
    // config.json missing or unreadable — skip
  }
  summary.config.changed = configChanged;

  // Summary
  const hasChanges = skillResults.some((r) => r.status === "updated") || removedSkills.length > 0 || configChanged;
  if (!hasChanges) {
    logger.log(t("ui:upgrade.noChanges"));
  } else if (dryRun) {
    logger.log(t("ui:upgrade.dryRunFooter"));
  } else {
    logger.log(t("ui:upgrade.done"));
  }

  try {
    writeActiveUpgradeArtifact({
      root,
      activeFlow,
      command,
      dryRun,
      exitCode: 0,
      result: resultFromSummary(0, hasChanges),
      summary,
      rawOutput: logger.rawOutput(),
    });
  } catch (e) {
    logger.error(`upgrade artifact write failed: ${e.message}`);
    process.exit(EXIT_ERROR);
  }
}


export { main };
