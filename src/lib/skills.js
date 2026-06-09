/**
 * Shared skill deployment logic used by both setup and upgrade.
 */

import fs from "fs";
import path from "path";
import { PKG_DIR } from "./cli.js";
import { resolveIncludes } from "./include.js";
import { stripDataMarkers } from "../docs/lib/directive-parser.js";
import { loadRules, expandSkillRulesDirectives } from "./skill-rules.js";

/** Canonical path to the bundled main skill source directory. */
export const MAIN_SKILLS_DIR = path.join(PKG_DIR, "skills");

/** Directories under workRoot where skills are deployed. */
const SKILL_TARGET_BASES = [".agents", ".claude"];

function deployedSkillsDir(workRoot, base) {
  return path.join(workRoot, base, "skills");
}

function listSkillDirNames(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/**
 * Resolve the skill source file in the given directory.
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
    }
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}

/**
 * Deploy every SKILL.md found under skillsDir into both
 * .agents/skills/<name>/SKILL.md and .claude/skills/<name>/SKILL.md.
 *
 * @param {object} args
 * @param {string} args.skillsDir      Absolute path to a skills source directory
 * @param {string} args.workRoot       Project root directory
 * @param {boolean} [args.dryRun=false]
 * @returns {{ name: string, status: "updated" | "unchanged" }[]}
 */
export function deploySkillsFromDir({ skillsDir, workRoot, dryRun = false }) {
  const skillDirs = listSkillDirNames(skillsDir);
  if (skillDirs.length === 0) return [];

  // Phase 1: pre-expand all skills in memory. Throws on any rule expansion error
  // (atomicity per R24/R30: no file is written if any expansion fails).
  const rules = loadRules();
  const planned = [];
  for (const name of skillDirs) {
    const srcPath = resolveSkillFile(path.join(skillsDir, name));
    if (!srcPath) continue;
    const rawContent = fs.readFileSync(srcPath, "utf8");
    const includedContent = resolveIncludes(rawContent, {
      baseDir: path.dirname(srcPath),
      pkgDir: PKG_DIR,
      skillsDir: MAIN_SKILLS_DIR,
      presetsDir: path.join(PKG_DIR, "presets"),
      sourceFile: srcPath,
    });
    const expandedContent = expandSkillRulesDirectives(includedContent, rules);
    const finalContent = stripDataMarkers(expandedContent);
    planned.push({ name, srcPath, finalContent });
  }

  // Phase 2: write outputs.
  const results = [];
  for (const { name, finalContent } of planned) {
    const pendingTargets = [];
    for (const base of SKILL_TARGET_BASES) {
      const dest = path.join(deployedSkillsDir(workRoot, base), name, "SKILL.md");
      let current = false;
      try {
        const stat = fs.lstatSync(dest);
        current = !stat.isSymbolicLink() && fs.readFileSync(dest, "utf8") === finalContent;
      } catch (err) {
        if (err.code !== "ENOENT") throw err;
      }
      if (!current) pendingTargets.push(dest);
    }

    if (pendingTargets.length === 0) {
      results.push({ name, status: "unchanged" });
      continue;
    }

    if (!dryRun) {
      for (const dest of pendingTargets) {
        removeIfSymlink(dest);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, finalContent, "utf8");
      }
    }

    results.push({ name, status: "updated" });
  }

  return results;
}

/**
 * Deploy skill files from the bundled `src/skills/` directory.
 *
 * @param {string} workRoot  Project root directory
 * @param {object} [opts]
 * @param {boolean} [opts.dryRun=false]  If true, skip writing files
 * @returns {{ name: string, status: "updated" | "unchanged" }[]}
 */
export function deploySkills(workRoot, opts = {}) {
  return deploySkillsFromDir({
    skillsDir: MAIN_SKILLS_DIR,
    workRoot,
    dryRun: opts.dryRun,
  });
}

/**
 * Remove senti.* skill directories from .claude/skills/ and .agents/skills/
 * that are no longer present in any of the provided skill source directories.
 *
 * Skills found in any of the active skill source directories are kept; all others are removed.
 *
 * @param {string} workRoot          Project root directory
 * @param {string[]} activeSkillSourceDirs  All active skill source directories (main + experimental)
 * @param {object} [opts]
 * @param {boolean} [opts.dryRun=false]
 * @returns {{ name: string, status: "removed" }[]}
 */
export function cleanupObsoleteSkills(workRoot, activeSkillSourceDirs, opts = {}) {
  const { dryRun = false } = opts;

  const validNames = new Set(activeSkillSourceDirs.flatMap((dir) => listSkillDirNames(dir)));

  const obsoleteNamesByBase = new Map();
  for (const base of SKILL_TARGET_BASES) {
    const deployedDir = deployedSkillsDir(workRoot, base);
    const obsoleteNames = listSkillDirNames(deployedDir)
      .filter((name) => name.startsWith("senti."))
      .filter((name) => !validNames.has(name));
    if (obsoleteNames.length > 0) {
      obsoleteNamesByBase.set(base, obsoleteNames);
    }
  }

  if (!dryRun) {
    for (const [base, names] of obsoleteNamesByBase) {
      for (const name of names) {
        fs.rmSync(path.join(deployedSkillsDir(workRoot, base), name), { recursive: true, force: true });
      }
    }
  }

  // Report one entry per skill name, even when it was removed from multiple target bases.
  const removedNames = [...new Set([...obsoleteNamesByBase.values()].flat())];
  return removedNames.map((name) => ({ name, status: "removed" }));
}
