#!/usr/bin/env node
/**
 * sennel/upgrade.js
 *
 * Upgrade skill-derived files (skills, AGENTS.md Spec-Driven Development section) to match
 * the currently installed sennel version.
 *
 * Safe to run repeatedly — only overwrites skill-managed content. config.json
 * is validated but never rewritten by a normal upgrade. context.json is
 * untouched. Legacy product directories are handled only by explicit migrate
 * mode so normal runtime has no compatibility behavior.
 *
 * Usage:
 *   sennel upgrade [--migrate] [--dry-run]
 */

import fs from "node:fs";
import path from "path";
import { repoRoot, parseArgs } from "./lib/cli.js";
import { EXIT_ERROR } from "./lib/constants.js";
import { DEFAULT_LANG, loadConfig } from "./lib/config.js";
import { container } from "./lib/container.js";
import { translate } from "./lib/i18n.js";
import { validatePresetChain } from "./lib/presets.js";
import { enabledPluginSkillSourceDirs } from "./lib/plugin-registry.js";
import {
  deploySkills,
  deploySkillsFromDir,
  cleanupObsoleteSkills,
  MAIN_SKILLS_DIR,
} from "./lib/skills.js";
import { deployPresetCopies } from "./lib/preset-deploy.js";
import { createUpgradeResultArtifact } from "./flow/lib/test-artifacts.js";
import {
  AGENT_CONFIG_FILE_NAMES,
  AGENTS_FLOW_DIRECTIVE_RE,
  refreshAgentFlowFile,
} from "./lib/agent-config-files.js";
import { removeLegacyAgentArtifacts } from "./lib/legacy-agent-artifact-cleanup.js";

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

function resolveActiveUpgradeFlow() {
  if (!container.has("flowManager")) return null;
  try {
    const flowManager = container.get("flowManager");
    const state = flowManager.load();
    if (state?.schemaRevision !== 3 || !state.specId || !state.baseBranch) return null;
    return {
      state,
      flowManager,
    };
  } catch (_) {
    return null;
  }
}

function createUpgradeLogger() {
  return {
    log(message = "") {
      const text = String(message);
      console.log(text);
    },
    error(message = "") {
      const text = String(message);
      console.error(text);
    },
  };
}

function resultFromSummary(exitCode, hasChanges) {
  if (exitCode !== 0) return "failed";
  return hasChanges ? "success-updated" : "success-no-change";
}

function writeActiveUpgradeArtifact({ root, activeFlow, command, dryRun, exitCode, result, summary }) {
  if (!activeFlow) return;
  const artifact = createUpgradeResultArtifact({
    root,
    baseBranch: activeFlow.state.baseBranch,
    command,
    dryRun,
    exitCode,
    result,
    summary,
  });
  activeFlow.flowManager.publishUpgradeResult({
    specId: activeFlow.state.specId,
    artifact: {
      logicalKey: "upgrade.result",
      mediaType: "application/json",
      bytes: Buffer.from(`${JSON.stringify(artifact.toJSON(), null, 2)}\n`, "utf8"),
    },
  });
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
  if (migration.normalUpgradeExpectedFailure) {
    logger.error("[upgrade] DRY-RUN: normal upgrade validation is expected to fail; no normal-upgrade files would be changed.");
    return;
  }
  const activeSkillDirs = [MAIN_SKILLS_DIR, ...(migration.pluginSkillDirs || [])];
  for (const skillsDir of migration.pluginSkillDirs || []) {
    for (const result of deploySkillsFromDir({ skillsDir, workRoot: root, dryRun: true })) {
      if (result.status === "unchanged") {
        logger.log(`[upgrade] DRY-RUN: leave enabled plugin skill ${result.name}/SKILL.md unchanged`);
      }
      for (const target of result.targets) {
        logger.log(`[upgrade] DRY-RUN: deploy enabled plugin skill ${result.name}/SKILL.md to ${path.relative(root, target)}`);
      }
    }
  }
  for (const result of deploySkills(root, { dryRun: true, force: true })) {
    for (const target of result.targets) {
      logger.log(`[upgrade] DRY-RUN: replace canonical skill ${result.name}/SKILL.md at ${path.relative(root, target)}`);
    }
  }
  const removed = cleanupObsoleteSkills(root, activeSkillDirs, { dryRun: true });
  for (const result of removed) {
    for (const target of result.targets) {
      logger.log(`[upgrade] DRY-RUN: remove obsolete skill directory ${path.relative(root, target)}`);
    }
  }
  try {
    const cleanup = removeLegacyAgentArtifacts(root, { dryRun: true });
    if (cleanup.removedHandler) {
      logger.log("[upgrade] DRY-RUN: remove .codex/hooks/sennel-flow-final-response-guard.mjs");
    }
    if (cleanup.updatedConfig) {
      const action = cleanup.removedConfig ? "remove" : "update";
      logger.log(`[upgrade] DRY-RUN: ${action} .codex/hooks.json to remove the legacy Flow hook`);
    }
  } catch (error) {
    logger.error(`[upgrade] DRY-RUN: subsequent normal upgrade would fail: ${error.message}`);
    return false;
  }
  for (const fileName of AGENT_CONFIG_FILE_NAMES) {
    const filePath = path.join(root, fileName);
    const hasManagedBlock = fs.existsSync(filePath)
      && AGENTS_FLOW_DIRECTIVE_RE.test(fs.readFileSync(filePath, "utf8"));
    logger.log(hasManagedBlock
      ? `[upgrade] DRY-RUN: check managed ${fileName} block and refresh it if package or preset content differs.`
      : `[upgrade] DRY-RUN: leave ${fileName} unchanged because no managed block exists.`);
  }
  for (const destination of deployPresetCopies(root, {
    presetKeys: ["base"],
    languages: ["en", "ja"],
    dryRun: true,
  })) {
    logger.log(`[upgrade] DRY-RUN: copy bundled preset file ${path.relative(root, destination)}`);
  }
  return true;
}


// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function runNormalUpgrade(cli) {
  const root = repoRoot();
  const activeFlow = resolveActiveUpgradeFlow();
  const logger = createUpgradeLogger();
  const command = ["sennel", "upgrade", ...process.argv.slice(2)].join(" ");
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
    for (const skillsDir of enabledPluginSkillSourceDirs(root)) {
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
    });
    process.exit(EXIT_ERROR);
  }
  logSkillResults(skillResults);
  summary.skills.updated = skillResults.filter((r) => r.status === "updated").length;
  summary.skills.unchanged = skillResults.filter((r) => r.status === "unchanged").length;

  // Remove obsolete canonical and explicitly retired product skill namespaces.
  const removedSkills = cleanupObsoleteSkills(root, [MAIN_SKILLS_DIR, ...enabledPluginSkillSourceDirs(root)], { dryRun });
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
    const previewSucceeded = previewNormalUpgrade(root, outcome, logger);
    if (outcome.normalUpgradeExpectedFailure || !previewSucceeded) process.exitCode = EXIT_ERROR;
    return;
  }
  return runNormalUpgrade(cli);
}


export { main };
