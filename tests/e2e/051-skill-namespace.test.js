import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { spawnSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson } from "../helpers/tmp-dir.js";
import { resolveIncludes } from "../../src/lib/include.js";
import { stripDataMarkers } from "../../src/docs/lib/directive-parser.js";
import { loadRules, expandSkillRulesDirectives } from "../../src/lib/skill-rules.js";

const CMD = join(process.cwd(), "src/sdd-forge.js");
const CMD_ARGS_PREFIX = ["setup"];
const PKG_DIR = join(process.cwd(), "src");

/** Non-interactive CLI args */
const NI_ARGS = [
  "--name", "test-proj",
  "--type", "webapp",
  "--purpose", "developer-guide",
  "--tone", "polite",
];

describe("051: skill namespace with dot separator", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  describe("src/templates/skills/ naming", () => {
    it("template directories use sdd-forge.* naming", () => {
      const templatesDir = join(process.cwd(), "src", "templates", "skills");
      const dirs = fs.readdirSync(templatesDir).filter(
        (d) => fs.existsSync(join(templatesDir, d, "SKILL.md"))
          || fs.existsSync(join(templatesDir, d, "SKILL.en.md")),
      );
      assert.ok(dirs.length > 0, "should have skill templates");
      for (const d of dirs) {
        assert.ok(d.startsWith("sdd-forge."), `template dir "${d}" should start with "sdd-forge."`);
      }
    });

    it("SKILL.md name fields use sdd-forge.* naming", () => {
      const templatesDir = join(process.cwd(), "src", "templates", "skills");
      const dirs = fs.readdirSync(templatesDir).filter(
        (d) => fs.existsSync(join(templatesDir, d, "SKILL.md"))
          || fs.existsSync(join(templatesDir, d, "SKILL.en.md")),
      );
      for (const d of dirs) {
        const skillFile = fs.existsSync(join(templatesDir, d, "SKILL.md"))
          ? join(templatesDir, d, "SKILL.md")
          : join(templatesDir, d, "SKILL.en.md");
        const content = fs.readFileSync(skillFile, "utf8");
        const match = content.match(/^name:\s*(.+)$/m);
        assert.ok(match, `skill in "${d}" should have a name field`);
        assert.ok(match[1].startsWith("sdd-forge."), `name "${match[1]}" should start with "sdd-forge."`);
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
        env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp, SDD_FORGE_SOURCE_ROOT: tmp },
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

      for (const d of claudeDirs) {
        assert.ok(d.startsWith("sdd-forge."), `.claude/skills/${d} should use sdd-forge.* naming`);
      }
      for (const d of agentsDirs) {
        assert.ok(d.startsWith("sdd-forge."), `.agents/skills/${d} should use sdd-forge.* naming`);
      }
    });

    it("skill files are real files, not symlinks", () => {
      tmp = createTmpDir();
      writeJson(tmp, "package.json", { name: "test-proj" });

      spawnSync("node", [CMD, ...CMD_ARGS_PREFIX, ...NI_ARGS], {
        encoding: "utf8",
        cwd: tmp,
        timeout: 10000,
        env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp, SDD_FORGE_SOURCE_ROOT: tmp },
      });

      const claudeSkills = join(tmp, ".claude", "skills");
      for (const d of fs.readdirSync(claudeSkills)) {
        const skillPath = join(claudeSkills, d, "SKILL.md");
        assert.ok(fs.existsSync(skillPath), `${skillPath} should exist`);
        const stat = fs.lstatSync(skillPath);
        assert.ok(!stat.isSymbolicLink(), `${skillPath} should not be a symlink`);
        assert.ok(stat.isFile(), `${skillPath} should be a regular file`);
      }

      const agentsSkills = join(tmp, ".agents", "skills");
      for (const d of fs.readdirSync(agentsSkills)) {
        const skillPath = join(agentsSkills, d, "SKILL.md");
        assert.ok(fs.existsSync(skillPath), `${skillPath} should exist`);
        const stat = fs.lstatSync(skillPath);
        assert.ok(!stat.isSymbolicLink(), `${skillPath} should not be a symlink`);
      }
    });

    it("skill content matches templates", () => {
      tmp = createTmpDir();
      writeJson(tmp, "package.json", { name: "test-proj" });

      spawnSync("node", [CMD, ...CMD_ARGS_PREFIX, ...NI_ARGS], {
        encoding: "utf8",
        cwd: tmp,
        timeout: 10000,
        env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp, SDD_FORGE_SOURCE_ROOT: tmp },
      });

      const templatesDir = join(process.cwd(), "src", "templates", "skills");
      const templateDirs = fs.readdirSync(templatesDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      for (const d of templateDirs) {
        // setup uses lang=en by default (NI_ARGS), so SKILL.en.md is expected
        const templateFile = fs.existsSync(join(templatesDir, d, "SKILL.md"))
          ? join(templatesDir, d, "SKILL.md")
          : join(templatesDir, d, "SKILL.en.md");
        if (!fs.existsSync(templateFile)) continue;
        const rawContent = fs.readFileSync(templateFile, "utf8");
        // Resolve includes + skill-rule expansion + marker strip to match what deploySkills actually writes (spec 252).
        const includedContent = resolveIncludes(rawContent, {
          baseDir: join(templatesDir, d),
          pkgDir: PKG_DIR,
          templatesDir: join(PKG_DIR, "templates"),
          presetsDir: join(PKG_DIR, "presets"),
          lang: "en",
          sourceFile: templateFile,
        });
        const expandedContent = expandSkillRulesDirectives(includedContent, loadRules());
        const templateContent = stripDataMarkers(expandedContent);
        const claudeContent = fs.readFileSync(join(tmp, ".claude", "skills", d, "SKILL.md"), "utf8");
        const agentsContent = fs.readFileSync(join(tmp, ".agents", "skills", d, "SKILL.md"), "utf8");
        assert.equal(claudeContent, templateContent, `.claude/skills/${d}/SKILL.md should match template`);
        assert.equal(agentsContent, templateContent, `.agents/skills/${d}/SKILL.md should match template`);
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
        env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp, SDD_FORGE_SOURCE_ROOT: tmp },
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
        env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp, SDD_FORGE_SOURCE_ROOT: tmp },
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
        env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp, SDD_FORGE_SOURCE_ROOT: tmp },
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
