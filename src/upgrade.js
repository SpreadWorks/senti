#!/usr/bin/env node
/**
 * senti/upgrade.js
 *
 * Upgrade skill-derived files (skills, AGENTS.md Spec-Driven Development section) to match
 * the currently installed senti version.
 *
 * Safe to run repeatedly — only overwrites skill-managed content. config.json
 * is migrated in place for supported legacy shapes while preserving user agent
 * profiles/providers; package built-ins are resolved at runtime instead of
 * being copied during normal upgrade. context.json is untouched.
 *
 * Usage:
 *   senti upgrade [--dry-run]
 */

import fs from "fs";
import path from "path";
import { repoRoot, parseArgs } from "./lib/cli.js";
import { EXIT_ERROR } from "./lib/constants.js";
import { loadConfig, sentiConfigPath, sentiDir } from "./lib/config.js";
import { container } from "./lib/container.js";
import { translate } from "./lib/i18n.js";
import { validatePresetChain } from "./lib/presets.js";
import { officialPresetPluginRoot } from "./lib/official-plugins.js";
import { ensureOfficialPackage, installPlugin, loadPluginRegistry } from "./lib/plugin-registry.js";
import {
  deploySkills,
  deploySkillsFromDir,
  cleanupObsoleteSkills,
  MAIN_SKILLS_DIR,
} from "./lib/skills.js";
import { deployPresetCopies } from "./lib/preset-deploy.js";
import { writeUpgradeResultArtifact } from "./flow/lib/test-artifacts.js";
import { normalizeSentiGitignore } from "./lib/gitignore.js";

class RenameRule {
  constructor(from, to) {
    this.from = from;
    this.to = to;
  }

  apply(text) {
    return text.split(this.from).join(this.to);
  }
}

export class RenameMigration {
  constructor(root) {
    this.root = root;
    this.textRules = [
      new RenameRule(".sdd-forge", ".senti"),
      new RenameRule("sdd-forge", "senti"),
      new RenameRule("SDD-FORGE", "SENTI"),
      new RenameRule("SDD_FORGE", "SENTI"),
      new RenameRule("SDD_WORK_ROOT", "SENTI_WORK_ROOT"),
      new RenameRule("SDD_SOURCE_ROOT", "SENTI_SOURCE_ROOT"),
      new RenameRule("sdd_forge", "senti"),
      new RenameRule("SddForge", "Senti"),
      new RenameRule("sddForge", "senti"),
      new RenameRule("SddConfig", "SentiConfig"),
      new RenameRule("sddConfig", "sentiConfig"),
      new RenameRule("sddDir", "sentiDir"),
      new RenameRule("sddOutput", "sentiOutput"),
      new RenameRule("sddPhase", "sentiPhase"),
      new RenameRule("agents.sdd", "agents.senti"),
      new RenameRule("AGENTS.sdd", "AGENTS.senti"),
      new RenameRule("SDD Forge", "senti"),
      new RenameRule("SDD section", "Spec-Driven Development section"),
      new RenameRule("SDD セクション", "Spec-Driven Development セクション"),
      new RenameRule("The SDD Flow", "The Spec-Driven Development Flow"),
      new RenameRule("SDD flow", "Spec-Driven Development flow"),
      new RenameRule("SDD フロー", "Spec-Driven Development フロー"),
      new RenameRule("sdd:gate", "senti:gate"),
    ];
  }

  run({ dryRun = false } = {}) {
    const changed = [];
    this.migrateManagedDirectory(changed, { dryRun });
    this.migrateLegacySkillDirectories(changed, { dryRun });
    this.migrateRenamedPaths(changed, { dryRun });
    for (const file of this.listTextTargets()) {
      const before = fs.readFileSync(file, "utf8");
      const after = this.normalizeTextTarget(file, this.renameText(before));
      if (after !== before) {
        if (!dryRun) fs.writeFileSync(file, after, "utf8");
        changed.push(path.relative(this.root, file));
      }
    }
    return changed;
  }

  recordChange(changed, rel) {
    if (!changed.includes(rel)) changed.push(rel);
  }

  renameText(text) {
    let next = text;
    for (const rule of this.textRules) next = rule.apply(next);
    next = next.replace(/\bSDD\b/g, "Spec-Driven Development");
    next = next.replace(/\bsdd\b/g, "senti");
    return next;
  }

  normalizeTextTarget(file, text) {
    const rel = path.relative(this.root, file).split(path.sep).join("/");
    if (rel === ".gitignore") return normalizeSentiGitignore(text, { appendIfMissing: false });
    return text;
  }

  migrateManagedDirectory(changed, { dryRun }) {
    const legacyDir = path.join(this.root, ".sdd-forge");
    if (!fs.existsSync(legacyDir)) return;

    for (const rel of this.listFilesUnder(legacyDir)) {
      const src = path.join(legacyDir, rel);
      const dest = path.join(this.root, ".senti", rel);
      if (this.isExcludedPath(src)) continue;
      if (fs.existsSync(dest)) continue;
      if (!dryRun) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.renameSync(src, dest);
      }
      this.recordChange(changed, path.relative(this.root, dest));
    }
  }

  migrateLegacySkillDirectories(changed, { dryRun }) {
    for (const base of [".agents", ".claude"]) {
      const skillsDir = path.join(this.root, base, "skills");
      if (!fs.existsSync(skillsDir)) continue;
      for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
        if (!entry.isDirectory() || !entry.name.startsWith("sdd-forge.")) continue;

        const src = path.join(skillsDir, entry.name);
        const destName = this.renamePath(entry.name);
        const dest = path.join(skillsDir, destName);
        if (!dryRun) {
          if (fs.existsSync(dest)) {
            fs.rmSync(src, { recursive: true, force: true });
          } else {
            fs.renameSync(src, dest);
          }
        }
        this.recordChange(changed, path.relative(this.root, dest));
      }
    }
  }

  migrateRenamedPaths(changed, { dryRun }) {
    const files = this.listFilesUnder(this.root)
      .map((rel) => path.join(this.root, rel))
      .filter((file) => !this.isExcludedPath(file))
      .sort((a, b) => b.length - a.length);

    for (const src of files) {
      const rel = path.relative(this.root, src).split(path.sep).join("/");
      const renamedRel = this.renamePath(rel);
      if (renamedRel === rel) continue;

      const dest = path.join(this.root, ...renamedRel.split("/"));
      if (fs.existsSync(dest)) continue;
      if (!dryRun) {
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.renameSync(src, dest);
      }
      this.recordChange(changed, renamedRel);
    }
  }

  renamePath(rel) {
    return rel
      .split(".sdd-forge").join(".senti")
      .split("sdd-forge").join("senti")
      .split("AGENTS.sdd").join("AGENTS.senti")
      .split("agents.sdd").join("agents.senti");
  }

  listTextTargets() {
    return this.listFilesUnder(this.root)
      .map((rel) => path.join(this.root, rel))
      .filter((file) => !this.isExcludedPath(file))
      .filter((file) => !this.isLegacyManagedFile(file))
      .filter((file) => !this.isLegacySkillFile(file))
      .filter((file) => !this.isMigrationSource(file))
      .filter((file) => !this.isProjectLocalCreatingPresetsGuide(file))
      .filter((file) => this.isTextFile(file));
  }

  listFilesUnder(dir) {
    const out = [];
    if (!fs.existsSync(dir)) return out;
    const walk = (current, prefix = "") => {
      for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
        const rel = path.join(prefix, entry.name);
        const full = path.join(current, entry.name);
        if (this.isExcludedPath(full)) continue;
        if (entry.isDirectory()) walk(full, rel);
        else if (entry.isFile()) out.push(rel);
      }
    };
    walk(dir);
    return out;
  }

  isExcludedPath(file) {
    const rel = path.relative(this.root, file).split(path.sep).join("/");
    const segments = rel.split("/");
    if (rel === ".git" || rel.startsWith(".git/")) return true;
    if (segments.includes("node_modules")) return true;
    if (rel === "docs" || rel.startsWith("docs/")) return true;
    if (rel === "specs" || rel.startsWith("specs/")) return true;
    if (rel === ".tmp" || rel.startsWith(".tmp/")) return true;
    if (rel.startsWith(".claude/projects/")) return true;
    if (rel.startsWith(".sdd-forge/worktree/")) return true;
    if (rel.startsWith(".sdd-forge/.tmp/")) return true;
    if (rel.startsWith(".sdd-forge/agent-work/")) return true;
    if (rel.startsWith(".sdd-forge/agent-cache/")) return true;
    if (rel.startsWith(".sdd-forge/tmp/")) return true;
    if (rel.startsWith(".senti/worktree/")) return true;
    if (rel.startsWith(".senti/.tmp/")) return true;
    if (rel.startsWith(".senti/agent-work/")) return true;
    if (rel.startsWith(".senti/agent-cache/")) return true;
    if (rel.startsWith(".senti/tmp/")) return true;
    return false;
  }

  isMigrationSource(file) {
    const rel = path.relative(this.root, file).split(path.sep).join("/");
    return rel === "src/upgrade.js";
  }

  isProjectLocalCreatingPresetsGuide(file) {
    const rel = path.relative(this.root, file).split(path.sep).join("/");
    return /^\.senti\/templates\/[^/]+\/docs\/creating_presets\.md$/.test(rel);
  }

  isLegacyManagedFile(file) {
    const rel = path.relative(this.root, file).split(path.sep).join("/");
    return rel.startsWith(".sdd-forge/");
  }

  isLegacySkillFile(file) {
    const rel = path.relative(this.root, file).split(path.sep).join("/");
    return rel.startsWith(".agents/skills/sdd-forge.") || rel.startsWith(".claude/skills/sdd-forge.");
  }

  isTextFile(file) {
    try {
      const buf = fs.readFileSync(file);
      return !buf.includes(0);
    } catch (_) {
      return false;
    }
  }
}


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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function migrateConfigForUpgrade(raw) {
  const next = clone(raw || {});
  let changed = false;
  let migratedChapters = 0;

  if (Array.isArray(next.chapters) && next.chapters.length > 0 && typeof next.chapters[0] === "string") {
    next.chapters = next.chapters.map((name) => ({ chapter: name }));
    changed = true;
    migratedChapters = next.chapters.length;
  }

  return { config: next, changed, migratedChapters };
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

function pluginSkillSourceDirs(root) {
  try {
    const registry = loadPluginRegistry(root);
    const dirs = [];
    const seen = new Set();
    for (const manifest of registry.manifests) {
      for (const skill of manifest.contributions.skills || []) {
        const dir = path.join(manifest.root, path.dirname(skill.path));
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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function copyDirectory(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(from, to);
    } else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

function normalizeTypeList(types) {
  return (Array.isArray(types) ? types : [types]).filter(Boolean);
}

function legacyPresetKeys(root) {
  const dir = path.join(root, ".senti", "presets");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((key) => key !== "base")
    .sort();
}

function ensureSource(config, source) {
  const plugin = config.plugin;
  const existing = plugin.sources.find((entry) => entry.id === source.id);
  if (existing) return false;
  plugin.sources.push(source);
  return true;
}

function localPresetManifest(key, legacyDir, providerPreset) {
  const manifestPath = path.join(legacyDir, "preset.json");
  if (fs.existsSync(manifestPath)) {
    let manifest;
    try {
      manifest = readJson(manifestPath);
    } catch (err) {
      throw new Error(`legacy preset migration failed for ${key}/preset.json: ${err.message}`);
    }
    return {
      parent: manifest.parent || null,
      label: manifest.label || key,
      aliases: manifest.aliases || [],
      scan: manifest.scan || {},
      chapters: manifest.chapters || [],
    };
  }
  if (providerPreset) {
    return {
      parent: providerPreset.parent || null,
      label: providerPreset.label || key,
      aliases: providerPreset.aliases || [],
      scan: providerPreset.scan || {},
      chapters: providerPreset.chapters || [],
    };
  }
  return { parent: null, label: key, aliases: [], scan: {}, chapters: [] };
}

function localPresetPluginManifest(keys) {
  return {
    name: "local-presets",
    type: "preset",
    files: ["plugin.json", "presets/"],
    contributions: {
      presets: keys.map((key) => ({ key, path: `presets/${key}` })),
    },
  };
}

function migrateLegacyPresetDirectories(root, { dryRun, logger }) {
  const legacyRoot = path.join(root, ".senti", "presets");
  const keys = legacyPresetKeys(root);
  if (keys.length === 0) return false;
  if (dryRun) return true;

  const sourceRoot = path.join(sentiDir(root), "plugin-sources", "local-presets");
  const sourcePresetRoot = path.join(sourceRoot, "presets");
  const registry = loadPluginRegistry(root);
  fs.rmSync(sourcePresetRoot, { recursive: true, force: true });

  for (const key of keys) {
    const legacyDir = path.join(legacyRoot, key);
    const dest = path.join(sourcePresetRoot, key);
    copyDirectory(legacyDir, dest);
    const manifest = localPresetManifest(key, legacyDir, registry.resolvePreset(key));
    writeJson(path.join(dest, "preset.json"), manifest);
  }

  writeJson(path.join(sourceRoot, "plugin.json"), localPresetPluginManifest(keys));

  const config = readJson(sentiConfigPath(root));
  if (!config.plugin || typeof config.plugin !== "object") config.plugin = {};
  if (!Array.isArray(config.plugin.sources)) config.plugin.sources = [];
  if (!Array.isArray(config.plugin.packages)) config.plugin.packages = [];
  const changed = ensureSource(config, {
    id: "local-presets",
    type: "local",
    path: ".senti/plugin-sources/local-presets",
  });
  if (changed) writeJson(sentiConfigPath(root), config);
  installPlugin(root, "local-presets");
  fs.rmSync(legacyRoot, { recursive: true, force: true });
  logger.log(`[upgrade] migrated legacy presets to local plugin: ${keys.join(", ")}`);
  return true;
}

function shouldInstallOfficialProvider(root, config) {
  const nonBaseTypes = normalizeTypeList(config.type).filter((type) => type !== "base");
  if (nonBaseTypes.length === 0) return false;
  const legacy = new Set(legacyPresetKeys(root));
  if (nonBaseTypes.every((type) => legacy.has(type))) {
    const sources = config.plugin?.sources || [];
    return sources.length > 0 || Boolean(officialPresetPluginRoot());
  }
  return true;
}

export function migratePluginConfigNamespaces(raw) {
  const next = structuredClone(raw || {});
  if (!next.plugin || typeof next.plugin !== "object") next.plugin = {};
  if (!next.plugin.config || typeof next.plugin.config !== "object") next.plugin.config = {};

  if (Array.isArray(next.plugin.repos)) {
    next.plugin.sources = next.plugin.repos.map((repo) => {
      const source = repo.source || "";
      return {
        id: repo.id,
        type: /^(https?:\/\/|git@|ssh:\/\/|file:\/\/)/.test(source) ? "git" : "local",
        ...(/^(https?:\/\/|git@|ssh:\/\/|file:\/\/)/.test(source) ? { url: source } : { path: source }),
        ...(repo.ref ? { ref: repo.ref } : {}),
      };
    });
    delete next.plugin.repos;
  }
  if (Array.isArray(next.plugin.packages)) {
    next.plugin.packages = next.plugin.packages.map((pkg) => {
      const out = { ...pkg };
      if (out.repo && !out.source) out.source = out.repo;
      delete out.repo;
      return out;
    });
  }
  return next;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const cli = parseUpgradeArgs(process.argv.slice(2));
  const root = repoRoot();
  const activeFlow = resolveActiveUpgradeFlow(root);
  const logger = createUpgradeLogger();
  const command = ["senti", "upgrade", ...process.argv.slice(2)].join(" ");
  const dryRun = cli.dryRun;

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

  const summary = {
    skills: { updated: 0, unchanged: 0, removed: 0 },
    presets: { copied: 0 },
    plugins: { changed: false },
    config: { changed: false },
    rename: { changed: 0 },
  };

  const renameChanges = new RenameMigration(root).run({ dryRun });
  summary.rename.changed = renameChanges.length;
  for (const rel of renameChanges) {
    logger.log(`[upgrade] migrated rename target: ${rel}`);
  }

  const configPath = sentiConfigPath(root);
  let preConfigChanged = false;
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const migrated = migratePluginConfigNamespaces(raw);
    preConfigChanged = JSON.stringify(migrated) !== JSON.stringify(raw);
    if (preConfigChanged && !dryRun) {
      fs.writeFileSync(configPath, JSON.stringify(migrated, null, 2) + "\n", "utf8");
      logger.log("[upgrade] migrated plugin config namespaces");
    }
  } catch (_) {
    // config.json missing or unreadable — loadConfig will handle normal failures.
  }

  const config = loadConfig(root);
  const t = translate();

  if (!dryRun) {
    try {
      if (shouldInstallOfficialProvider(root, config)) {
        ensureOfficialPackage(root, {
          id: "official-presets",
          sourceRoot: officialPresetPluginRoot(),
        });
        summary.plugins.changed = true;
        logger.log("[upgrade] enabled official preset plugin");
      }
      if (migrateLegacyPresetDirectories(root, { dryRun, logger })) {
        summary.plugins.changed = true;
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
        summary: { ...summary, error: `upgrade failed: ${e.message}` },
        rawOutput: logger.rawOutput(),
      });
      process.exit(EXIT_ERROR);
    }
  }

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
    for (const skillsDir of pluginSkillSourceDirs(root)) {
      skillResults.push(...deploySkillsFromDir({ skillsDir, workRoot: root, dryRun }));
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
      summary: { ...summary, error: `upgrade failed: ${e.message}` },
      rawOutput: logger.rawOutput(),
    });
    process.exit(EXIT_ERROR);
  }
  logSkillResults(skillResults);
  summary.skills.updated = skillResults.filter((r) => r.status === "updated").length;
  summary.skills.unchanged = skillResults.filter((r) => r.status === "unchanged").length;

  // Remove obsolete senti.* skills no longer in the skill source directory
  const removedSkills = cleanupObsoleteSkills(root, [MAIN_SKILLS_DIR, ...pluginSkillSourceDirs(root)], { dryRun });
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

  // Migrate config.json in place. Single read/write.
  let configChanged = preConfigChanged;
  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf8"));
    const migrated = migrateConfigForUpgrade(raw);
    if (migrated.migratedChapters > 0) {
      configChanged = true;
      logger.log(`[upgrade] migrated chapters to new format (${migrated.migratedChapters} entries)`);
    }
    if (migrated.changed) configChanged = true;

    if (configChanged && !dryRun) {
      fs.writeFileSync(configPath, JSON.stringify(migrated.config, null, 2) + "\n", "utf8");
    }
  } catch (_) {
    // config.json missing or unreadable — skip
  }
  summary.config.changed = configChanged;

  // Summary
  const hasChanges = renameChanges.length > 0 || skillResults.some((r) => r.status === "updated") || removedSkills.length > 0 || configChanged || summary.plugins.changed;
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
