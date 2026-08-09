#!/usr/bin/env node
/**
 * senrail/upgrade.js
 *
 * Upgrade skill-derived files (skills, AGENTS.md Spec-Driven Development section) to match
 * the currently installed senrail version.
 *
 * Safe to run repeatedly — only overwrites skill-managed content. config.json
 * is validated but never rewritten by a normal upgrade. context.json is
 * untouched. Legacy product directories are handled only by explicit migrate
 * mode so normal runtime has no compatibility behavior.
 *
 * Usage:
 *   senrail upgrade [--migrate] [--dry-run]
 */

import path from "path";
import { repoRoot, parseArgs } from "./lib/cli.js";
import { EXIT_ERROR } from "./lib/constants.js";
import { DEFAULT_LANG, loadConfig } from "./lib/config.js";
import { container } from "./lib/container.js";
import { translate } from "./lib/i18n.js";
import { validatePresetChain } from "./lib/presets.js";
import { loadPluginRegistry } from "./lib/plugin-registry.js";
import {
  deploySkills,
  deploySkillsFromDir,
  cleanupObsoleteSkills,
  MAIN_SKILLS_DIR,
} from "./lib/skills.js";
import { deployPresetCopies } from "./lib/preset-deploy.js";
import { writeUpgradeResultArtifact } from "./flow/lib/test-artifacts.js";
import { AGENT_CONFIG_FILE_NAMES, refreshAgentFlowFile } from "./lib/agent-config-files.js";
import { removeLegacyAgentArtifacts } from "./lib/legacy-agent-artifact-cleanup.js";
import { relativeFlowSpecFile } from "./lib/flow-workspace.js";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

export function parseUpgradeArgs(argv) {
  return parseArgs(argv, {
    flags: ["--dry-run", "--migrate"],
    options: [],
    defaults: { dryRun: false, migrate: false },
  });
}

function resolveActiveUpgradeFlow(root) {
  if (!container.has("flowManager")) return null;
  try {
    const state = container.get("flowManager").load();
    if (!state?.specId || !state.baseBranch) return null;
    return {
      state,
      specDir: path.dirname(path.resolve(root, relativeFlowSpecFile(state))),
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

function pluginSkillSourceDirs(root) {
  try {
    const registry = loadPluginRegistry(root);
    const dirs = [];
    const seen = new Set();
    for (const manifest of registry.manifests) {
      for (const skill of manifest.contributions.skills || []) {
        const declared = skill.path.endsWith("/SKILL.md")
          ? path.dirname(path.dirname(skill.path))
          : path.dirname(skill.path);
        const dir = path.join(manifest.root, declared);
        if (seen.has(dir)) continue;
        seen.add(dir);
        dirs.push(dir);
      }
    }
    return dirs;
  } catch (_) {
    return [];
  }
}

function printUpgradeHelp(logger) {
  const h = translate().raw("ui:help.cmdHelp.upgrade");
  const files = h.updatedFiles || [];
  logger.log([
    h.usage, "", `  ${h.desc}`, `  ${h.descDetail}`, "",
    "Updated files:",
    ...files.map((file) => `  ${file}`),
    "", "Options:", h.options.migrate, h.options.dryRun, h.options.help,
  ].join("\n"));
}

function previewNormalUpgrade(root, migration, logger) {
  logger.log("[upgrade] DRY-RUN: normal upgrade plan after directory migration:");
  const activeSkillDirs = [MAIN_SKILLS_DIR, ...(migration.pluginSkillDirs || [])];
  for (const skillsDir of migration.pluginSkillDirs || []) {
    for (const result of deploySkillsFromDir({ skillsDir, workRoot: root, dryRun: true })) {
      logger.log(`[upgrade] DRY-RUN: deploy enabled plugin skill ${result.name}/SKILL.md`);
    }
  }
  for (const result of deploySkills(root, { dryRun: true, force: true })) {
    logger.log(`[upgrade] DRY-RUN: replace canonical skill ${result.name}/SKILL.md`);
  }
  const removed = cleanupObsoleteSkills(root, activeSkillDirs, { dryRun: true });
  for (const result of removed) logger.log(`[upgrade] DRY-RUN: remove obsolete skill ${result.name}`);
  logger.log("[upgrade] DRY-RUN: refresh managed AGENTS.md and CLAUDE.md blocks after config validation.");
  logger.log("[upgrade] DRY-RUN: refresh bundled base preset copies after config validation.");
  if (migration.normalUpgradeExpectedFailure) {
    logger.error("[upgrade] DRY-RUN: normal upgrade validation is expected to fail; no normal-upgrade files were written.");
  }
}


// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function runNormalUpgrade(cli) {
  const root = repoRoot();
  const activeFlow = resolveActiveUpgradeFlow(root);
  const logger = createUpgradeLogger();
  const command = ["senrail", "upgrade", ...process.argv.slice(2)].join(" ");
  const dryRun = cli.dryRun;

  const summary = {
    skills: { updated: 0, unchanged: 0, removed: 0 },
    legacyAgentArtifacts: { removed: 0, unchanged: 0 },
    presets: { copied: 0 },
    agentFiles: { updated: 0, unchanged: 0, missing: 0 },
    config: { changed: false },
  };

  const config = loadConfig(root);
  const t = translate();

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

  // Plugins may add skills, but bundled product skills are the final authority
  // for a name collision.
  let skillResults = [];
  try {
    for (const skillsDir of pluginSkillSourceDirs(root)) {
      skillResults.push(...deploySkillsFromDir({ skillsDir, workRoot: root, dryRun }));
    }
    // Bundled product skills win over plugins that declare a colliding name.
    skillResults.push(...deploySkills(root, { dryRun, force: true }));
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

  // Remove obsolete canonical and explicitly retired product skill namespaces.
  const removedSkills = cleanupObsoleteSkills(root, [MAIN_SKILLS_DIR, ...pluginSkillSourceDirs(root)], { dryRun });
  summary.skills.removed = removedSkills.length;
  for (const { name } of removedSkills) {
    logger.log(t("ui:upgrade.skillRemoved", { name }));
  }

  try {
    const cleanup = removeLegacyAgentArtifacts(root, { dryRun });
    const removed = Number(cleanup.removedHandler) + Number(cleanup.updatedConfig);
    if (removed > 0) {
      summary.legacyAgentArtifacts.removed += removed;
      logger.log("[upgrade] removed legacy agent-host Flow hook artifacts");
    } else {
      summary.legacyAgentArtifacts.unchanged += 1;
    }
  } catch (e) {
    logger.error(`upgrade failed: ${e.message}`);
    writeActiveUpgradeArtifact({
      root,
      activeFlow,
      command,
      dryRun,
      exitCode: EXIT_ERROR,
      result: "failed",
      summary: { ...summary, error: `legacy agent artifact cleanup failed: ${e.message}` },
      rawOutput: logger.rawOutput(),
    });
    process.exit(EXIT_ERROR);
  }

  if (!dryRun) {
    const presetCopies = deployPresetCopies(root, {
      presetKeys: ["base"],
      languages: config.docs?.languages?.length ? config.docs.languages : ["en", "ja"],
    });
    summary.presets.copied = presetCopies.length;
  }

  const agentFileResults = AGENT_CONFIG_FILE_NAMES.map((fileName) =>
    refreshAgentFlowFile(path.join(root, fileName), config.lang || DEFAULT_LANG, {
      dryRun,
      projectRoot: root,
      presetTypes: config.type || "base",
    }));
  for (const result of agentFileResults) {
    summary.agentFiles[result.status] += 1;
    if (result.status === "updated") {
      logger.log(t("ui:upgrade.agentFileUpdated", { file: result.file }));
    } else if (result.status === "unchanged") {
      logger.log(t("ui:upgrade.agentFileUnchanged", { file: result.file }));
    } else {
      logger.log(t("ui:upgrade.agentFileMissing", { file: result.file }));
    }
  }

  // Summary
  const hasChanges = skillResults.some((r) => r.status === "updated")
    || removedSkills.length > 0
    || summary.legacyAgentArtifacts.removed > 0
    || summary.agentFiles.updated > 0
    || summary.presets.copied > 0;
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

async function main() {
  const cli = parseUpgradeArgs(process.argv.slice(2));
  if (cli.help) {
    printUpgradeHelp(createUpgradeLogger());
    return;
  }
  if (!cli.migrate) return runNormalUpgrade(cli);

  const root = repoRoot();
  const logger = createUpgradeLogger();
  const { UpgradeDirectoryMigration } = await import("./lib/upgrade-migration.js");
  const migration = new UpgradeDirectoryMigration(root, { dryRun: cli.dryRun, logger });
  const outcome = migration.run();
  if (!outcome.shouldRunUpgrade) return;
  if (cli.dryRun) {
    previewNormalUpgrade(root, outcome, logger);
    if (outcome.normalUpgradeExpectedFailure) process.exitCode = EXIT_ERROR;
    return;
  }
  return runNormalUpgrade(cli);
}


export { main };
