import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson } from "../support/builders/tmp-dir.js";
import { resolveIncludes } from "../../src/lib/include.js";
import { stripDataMarkers } from "../../src/docs/lib/directive-parser.js";
import { loadRules, expandSkillRulesDirectives } from "../../src/lib/skill-rules.js";

const CMD = join(process.cwd(), "src/sennel.js");
const CMD_ARGS_PREFIX = ["setup"];
const PKG_DIR = join(process.cwd(), "src");
const SKILL_SOURCES_DIR = join(PKG_DIR, "skills");
const MAX_SKILL_SOURCES = 64;

/** Non-interactive CLI args */
const NI_ARGS = [
  "--name", "test-proj",
  "--type", "base",
  "--purpose", "developer-guide",
  "--tone", "polite",
];

function resolveSkillFile(name) {
  // Skill deployment recognizes the canonical SKILL.md source only.
  const skillFile = join(SKILL_SOURCES_DIR, name, "SKILL.md");
  return fs.existsSync(skillFile) ? skillFile : null;
}

function listSkillSourceNames() {
  const skillSourceNames = fs.readdirSync(SKILL_SOURCES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && resolveSkillFile(entry.name) !== null)
    .map((entry) => entry.name);
  assert.ok(
    skillSourceNames.length <= MAX_SKILL_SOURCES,
    `expected at most ${MAX_SKILL_SOURCES} skill sources`,
  );
  return skillSourceNames;
}

function assertSkillNamesUseNamespace(skillNames, label) {
  for (const skillName of skillNames) {
    assert.ok(skillName.startsWith("sennel."), `${label}/${skillName} should use sennel.* naming`);
  }
}

function assertDeployedSkillFiles(skillsDir) {
  const skillNames = fs.readdirSync(skillsDir);
  assert.ok(
    skillNames.length <= MAX_SKILL_SOURCES,
    `expected at most ${MAX_SKILL_SOURCES} deployed skills under ${skillsDir}`,
  );
  for (const skillName of skillNames) {
    const skillPath = join(skillsDir, skillName, "SKILL.md");
    assert.ok(fs.existsSync(skillPath), `${skillPath} should exist`);
    const stat = fs.lstatSync(skillPath);
    assert.ok(!stat.isSymbolicLink(), `${skillPath} should not be a symlink`);
    assert.ok(stat.isFile(), `${skillPath} should be a regular file`);
  }
}

describe("051: skill namespace with dot separator", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  describe("src/skills/ naming", () => {
    it("skill source directories use sennel.* naming", () => {
      const skillSourceNames = listSkillSourceNames();
      assert.ok(skillSourceNames.length > 0, "should have skill sources");
      assertSkillNamesUseNamespace(skillSourceNames, "src/skills");
    });

    it("SKILL.md name fields use sennel.* naming", () => {
      const skillSourceNames = listSkillSourceNames();
      for (const skillName of skillSourceNames) {
        const skillFile = resolveSkillFile(skillName);
        const content = fs.readFileSync(skillFile, "utf8");
        const match = content.match(/^name:\s*(.+)$/m);
        assert.ok(match, `skill in "${skillName}" should have a name field`);
        assert.ok(match[1].startsWith("sennel."), `name "${match[1]}" should start with "sennel."`);
      }
    });
  });

  describe("setup deploys skills without symlinks", () => {
    it("copies skills directly to .claude/skills/ and .agents/skills/", () => {
      tmp = createTmpDir();
      writeJson(tmp, "package.json", { name: "test-proj" });

      const result = spawnSync("node", [CMD, ...CMD_ARGS_PREFIX, ...NI_ARGS], {
        encoding: "utf8",
        cwd: tmp,
        timeout: 10000,
        env: { ...process.env, SENNEL_WORK_ROOT: tmp, SENNEL_SOURCE_ROOT: tmp },
      });
      assert.equal(result.status, 0, `stderr: ${result.stderr}`);

      const claudeSkills = join(tmp, ".claude", "skills");
      const agentsSkills = join(tmp, ".agents", "skills");

      // Both directories should exist
      assert.ok(fs.existsSync(claudeSkills), ".claude/skills/ should exist");
      assert.ok(fs.existsSync(agentsSkills), ".agents/skills/ should exist");

      // Check skill directories use new naming
      const claudeDirs = fs.readdirSync(claudeSkills);
      const agentsDirs = fs.readdirSync(agentsSkills);
      assert.ok(claudeDirs.length > 0, "should have skills in .claude/skills/");
      assert.ok(agentsDirs.length > 0, "should have skills in .agents/skills/");

      assertSkillNamesUseNamespace(claudeDirs, ".claude/skills");
      assertSkillNamesUseNamespace(agentsDirs, ".agents/skills");
    });

    it("skill files are real files, not symlinks", () => {
      tmp = createTmpDir();
      writeJson(tmp, "package.json", { name: "test-proj" });

      spawnSync("node", [CMD, ...CMD_ARGS_PREFIX, ...NI_ARGS], {
        encoding: "utf8",
        cwd: tmp,
        timeout: 10000,
        env: { ...process.env, SENNEL_WORK_ROOT: tmp, SENNEL_SOURCE_ROOT: tmp },
      });

      const claudeSkills = join(tmp, ".claude", "skills");
      const agentsSkills = join(tmp, ".agents", "skills");
      assertDeployedSkillFiles(claudeSkills);
      assertDeployedSkillFiles(agentsSkills);
    });

    it("skill content matches bundled skill sources", () => {
      tmp = createTmpDir();
      writeJson(tmp, "package.json", { name: "test-proj" });

      spawnSync("node", [CMD, ...CMD_ARGS_PREFIX, ...NI_ARGS], {
        encoding: "utf8",
        cwd: tmp,
        timeout: 10000,
        env: { ...process.env, SENNEL_WORK_ROOT: tmp, SENNEL_SOURCE_ROOT: tmp },
      });

      const skillSourceNames = listSkillSourceNames();

      for (const skillName of skillSourceNames) {
        const sourceFile = resolveSkillFile(skillName);
        const rawContent = fs.readFileSync(sourceFile, "utf8");
        // Resolve includes + skill-rule expansion + marker strip to match what deploySkills actually writes (spec 252).
        const includedContent = resolveIncludes(rawContent, {
          baseDir: join(SKILL_SOURCES_DIR, skillName),
          pkgDir: PKG_DIR,
          skillsDir: SKILL_SOURCES_DIR,
          presetsDir: join(PKG_DIR, "presets"),
          sourceFile,
        });
        const expandedContent = expandSkillRulesDirectives(includedContent, loadRules());
        const sourceContent = stripDataMarkers(expandedContent);
        const claudeContent = fs.readFileSync(join(tmp, ".claude", "skills", skillName, "SKILL.md"), "utf8");
        const agentsContent = fs.readFileSync(join(tmp, ".agents", "skills", skillName, "SKILL.md"), "utf8");
        assert.equal(claudeContent, sourceContent, `.claude/skills/${skillName}/SKILL.md should match skill source`);
        assert.equal(agentsContent, sourceContent, `.agents/skills/${skillName}/SKILL.md should match skill source`);
      }
    });
  });

  describe("AGENTS.md / CLAUDE.md independent management", () => {
    it("setup creates AGENTS.md as a real file (not symlink) in non-interactive mode", () => {
      tmp = createTmpDir();
      writeJson(tmp, "package.json", { name: "test-proj" });

      spawnSync("node", [CMD, ...CMD_ARGS_PREFIX, ...NI_ARGS], {
        encoding: "utf8",
        cwd: tmp,
        timeout: 10000,
        env: { ...process.env, SENNEL_WORK_ROOT: tmp, SENNEL_SOURCE_ROOT: tmp },
      });

      const agentsPath = join(tmp, "AGENTS.md");
      if (fs.existsSync(agentsPath)) {
        const stat = fs.lstatSync(agentsPath);
        assert.ok(!stat.isSymbolicLink(), "AGENTS.md should not be a symlink");
      }
    });

    it("setup creates CLAUDE.md as a real file (not symlink) in non-interactive mode", () => {
      tmp = createTmpDir();
      writeJson(tmp, "package.json", { name: "test-proj" });

      spawnSync("node", [CMD, ...CMD_ARGS_PREFIX, ...NI_ARGS], {
        encoding: "utf8",
        cwd: tmp,
        timeout: 10000,
        env: { ...process.env, SENNEL_WORK_ROOT: tmp, SENNEL_SOURCE_ROOT: tmp },
      });

      const claudePath = join(tmp, "CLAUDE.md");
      if (fs.existsSync(claudePath)) {
        const stat = fs.lstatSync(claudePath);
        assert.ok(!stat.isSymbolicLink(), "CLAUDE.md should not be a symlink");
      }
    });

    it("setup does not create any symlinks", () => {
      tmp = createTmpDir();
      writeJson(tmp, "package.json", { name: "test-proj" });

      spawnSync("node", [CMD, ...CMD_ARGS_PREFIX, ...NI_ARGS], {
        encoding: "utf8",
        cwd: tmp,
        timeout: 10000,
        env: { ...process.env, SENNEL_WORK_ROOT: tmp, SENNEL_SOURCE_ROOT: tmp },
      });

      // Recursively check no symlinks exist
      function checkNoSymlinks(dir) {
        if (!fs.existsSync(dir)) return;
        for (const entry of fs.readdirSync(dir)) {
          const full = join(dir, entry);
          const stat = fs.lstatSync(full);
          assert.ok(!stat.isSymbolicLink(), `${full} should not be a symlink`);
          if (stat.isDirectory()) checkNoSymlinks(full);
        }
      }
      checkNoSymlinks(join(tmp, ".claude"));
      checkNoSymlinks(join(tmp, ".agents"));
      // Check root-level md files
      for (const f of ["CLAUDE.md", "AGENTS.md"]) {
        const p = join(tmp, f);
        if (fs.existsSync(p)) {
          assert.ok(!fs.lstatSync(p).isSymbolicLink(), `${f} should not be a symlink`);
        }
      }
    });
  });
});
