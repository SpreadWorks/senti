/**
 * Shared skill deployment logic used by both setup and upgrade.
 */

import fs from "fs";
import path from "path";
import { PKG_DIR } from "./cli.js";
import { resolveIncludes } from "./include.js";
import { stripDataMarkers } from "../docs/lib/directive-parser.js";
import { loadRules, expandSkillRulesDirectives } from "./skill-rules.js";

/** Canonical path to the bundled main skill templates directory. */
export const MAIN_SKILLS_TEMPLATES_DIR = path.join(PKG_DIR, "templates", "skills");

/** Directories under workRoot where skills are deployed. */
const SKILL_TARGET_BASES = [".agents", ".claude"];

/**
 * Resolve the skill template file in the given directory.
 */
function resolveSkillFile(skillDir) {
  const file = path.join(skillDir, "SKILL.md");
  if (fs.existsSync(file)) return file;
  return null;
}

/**
 * Remove a file if it is a symbolic link (no-op otherwise).
 */
function removeIfSymlink(filePath) {
  try {
    if (fs.lstatSync(filePath).isSymbolicLink()) {
      fs.unlinkSync(filePath);
      return true;
    }
  } catch (err) { if (err.code !== "ENOENT") console.error(err); }
  return false;
}

/**
 * Deploy every SKILL.md found under templatesDir into both
 * .agents/skills/<name>/SKILL.md and .claude/skills/<name>/SKILL.md.
 *
 * @param {object} args
 * @param {string} args.templatesDir   Absolute path to a skills templates directory
 * @param {string} args.workRoot       Project root directory
 * @param {string} args.lang           Language code for include resolution
 * @param {boolean} [args.dryRun=false]
 * @returns {{ name: string, status: "updated" | "unchanged" }[]}
 */
function deploySkillsFromDir({ templatesDir, workRoot, lang, dryRun = false, _ruleCache = null }) {
  if (!fs.existsSync(templatesDir)) return [];

  const agentsSkillsDir = path.join(workRoot, SKILL_TARGET_BASES[0], "skills");
  const claudeSkillsDir = path.join(workRoot, SKILL_TARGET_BASES[1], "skills");

  const skillDirs = fs.readdirSync(templatesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  // Phase 1: pre-expand all skills in memory. Throws on any rule expansion error
  // (atomicity per R24/R30: no file is written if any expansion fails).
  const rules = _ruleCache || loadRules();
  const planned = [];
  for (const name of skillDirs) {
    const srcPath = resolveSkillFile(path.join(templatesDir, name));
    if (!srcPath) continue;
    const rawContent = fs.readFileSync(srcPath, "utf8");
    const includedContent = resolveIncludes(rawContent, {
      baseDir: path.dirname(srcPath),
      pkgDir: PKG_DIR,
      templatesDir: path.join(PKG_DIR, "templates"),
      presetsDir: path.join(PKG_DIR, "presets"),
      lang: lang || "en",
      sourceFile: srcPath,
    });
    const expandedContent = expandSkillRulesDirectives(includedContent, rules);
    const finalContent = stripDataMarkers(expandedContent);
    planned.push({ name, srcPath, finalContent });
  }

  // Phase 2: write outputs (no further failure expected here).
  const results = [];
  for (const { name, finalContent } of planned) {
    const agentsDest = path.join(agentsSkillsDir, name, "SKILL.md");
    const claudeDest = path.join(claudeSkillsDir, name, "SKILL.md");

    let needsUpdateAgents = true;
    let needsUpdateClaude = true;
    try {
      const stat = fs.lstatSync(agentsDest);
      if (!stat.isSymbolicLink()) {
        const existing = fs.readFileSync(agentsDest, "utf8");
        if (existing === finalContent) needsUpdateAgents = false;
      }
    } catch (err) {
      if (err.code !== "ENOENT") console.error(err);
    }
    try {
      const stat = fs.lstatSync(claudeDest);
      if (!stat.isSymbolicLink()) {
        const existing = fs.readFileSync(claudeDest, "utf8");
        if (existing === finalContent) needsUpdateClaude = false;
      }
    } catch (err) {
      if (err.code !== "ENOENT") console.error(err);
    }

    if (!needsUpdateAgents && !needsUpdateClaude) {
      results.push({ name, status: "unchanged" });
      continue;
    }

    if (!dryRun) {
      if (needsUpdateAgents) {
        removeIfSymlink(agentsDest);
        fs.mkdirSync(path.dirname(agentsDest), { recursive: true });
        fs.writeFileSync(agentsDest, finalContent, "utf8");
      }
      if (needsUpdateClaude) {
        removeIfSymlink(claudeDest);
        fs.mkdirSync(path.dirname(claudeDest), { recursive: true });
        fs.writeFileSync(claudeDest, finalContent, "utf8");
      }
    }

    results.push({ name, status: "updated" });
  }

  return results;
}

/**
 * Deploy skill files from the bundled `src/templates/skills/` directory.
 *
 * @param {string} workRoot  Project root directory
 * @param {string} lang      Language code for include resolution (e.g. "en", "ja"). Does not affect template file selection (always SKILL.md).
 * @param {object} [opts]
 * @param {boolean} [opts.dryRun=false]  If true, skip writing files
 * @returns {{ name: string, status: "updated" | "unchanged" }[]}
 */
export function deploySkills(workRoot, lang, opts = {}) {
  return deploySkillsFromDir({
    templatesDir: MAIN_SKILLS_TEMPLATES_DIR,
    workRoot,
    lang,
    dryRun: opts.dryRun,
  });
}

/**
 * Deploy skill files from a project-local templates directory.
 * Used for opt-in skills that ship outside the main src/templates/skills/
 * (e.g. experimental features enabled via config flags).
 *
 * @param {string} workRoot       Project root directory
 * @param {string} templatesDir   Absolute path to a skills templates directory
 * @param {string} lang           Language code for include resolution
 * @param {object} [opts]
 * @param {boolean} [opts.dryRun=false]
 * @returns {{ name: string, status: "updated" | "unchanged" }[]}
 */
export function deployProjectSkills(workRoot, templatesDir, lang, opts = {}) {
  return deploySkillsFromDir({
    templatesDir,
    workRoot,
    lang,
    dryRun: opts.dryRun,
  });
}

/**
 * Remove sdd-forge.* skill directories from .claude/skills/ and .agents/skills/
 * that are no longer present in any of the provided template directories.
 *
 * Only directories whose names start with "sdd-forge." are considered.
 * Skills found in any of the validTemplatesDirs are kept; all others are removed.
 *
 * @param {string} workRoot          Project root directory
 * @param {string[]} validTemplatesDirs  All active skill template directories (main + experimental)
 * @param {object} [opts]
 * @param {boolean} [opts.dryRun=false]
 * @returns {{ name: string, status: "removed" }[]}
 */
export function cleanupObsoleteSkills(workRoot, validTemplatesDirs, opts = {}) {
  const { dryRun = false } = opts;

  const validNames = new Set(
    validTemplatesDirs.flatMap((dir) => {
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    })
  );

  const obsoleteNames = new Set();
  for (const base of SKILL_TARGET_BASES) {
    const skillsDir = path.join(workRoot, base, "skills");
    if (!fs.existsSync(skillsDir)) continue;
    for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !entry.name.startsWith("sdd-forge.")) continue;
      if (!validNames.has(entry.name)) obsoleteNames.add(entry.name);
    }
  }

  if (!dryRun) {
    for (const name of obsoleteNames) {
      for (const base of SKILL_TARGET_BASES) {
        fs.rmSync(path.join(workRoot, base, "skills", name), { recursive: true, force: true });
      }
    }
  }

  return [...obsoleteNames].map((name) => ({ name, status: "removed" }));
}
