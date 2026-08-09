/**
 * tests/unit/lib/skills-include.test.js
 *
 * Verify that deploySkills() resolves include directives
 * and produces expanded output without include markers.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { deploySkills, deploySkillsFromDir } from "../../../src/lib/skills.js";

describe("deploySkills include resolution", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupConfiguredTmpProject() {
    tmp = createTmpDir();
    fs.mkdirSync(path.join(tmp, ".senrail"), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, ".senrail", "config.json"),
      JSON.stringify({ lang: "en", type: "base", docs: { languages: ["en"], defaultLanguage: "en" } }),
    );
    return tmp;
  }

  it("deployed SKILL.md contains no include directives", () => {
    const projectDir = setupConfiguredTmpProject();

    const results = deploySkills(projectDir);
    assert.ok(results.length > 0, "should deploy at least one skill");

    for (const { name } of results) {
      const agentsPath = path.join(tmp, ".agents", "skills", name, "SKILL.md");
      if (!fs.existsSync(agentsPath)) continue;
      const content = fs.readFileSync(agentsPath, "utf8");
      assert.ok(
        !content.includes('<!-- include('),
        `${name}/SKILL.md should not contain include directives, found: ${content.match(/<!-- include\([^)]+\) -->/)?.[0]}`,
      );
    }
  });

  it("deployed content includes partials content", () => {
    const projectDir = setupConfiguredTmpProject();

    deploySkills(projectDir);

    const flowPath = path.join(projectDir, ".agents", "skills", "senrail.flow", "SKILL.md");
    if (fs.existsSync(flowPath)) {
      const content = fs.readFileSync(flowPath, "utf8");
      // Choice Format partial content should be expanded
      assert.ok(
        content.includes("Description") || content.includes("description") || content.includes("choices"),
        "flow SKILL.md should contain expanded Choice Format content",
      );
      assert.ok(
        content.includes("Every turn that asks the user to choose between two or more real outcomes MUST contain all five sections"),
        "flow SKILL.md should enforce Choice Format for real user decisions",
      );
      assert.ok(
        content.includes("ABSOLUTELY PROHIBITED"),
        "flow SKILL.md should explicitly disallow free-form questions without exceptions",
      );
    }

  });

  it("lets the bundled canonical skill replace a colliding plugin skill", () => {
    const projectDir = setupConfiguredTmpProject();
    const pluginSkills = path.join(tmp, "plugin-skills");
    fs.mkdirSync(path.join(pluginSkills, "senrail.flow"), { recursive: true });
    fs.writeFileSync(
      path.join(pluginSkills, "senrail.flow", "SKILL.md"),
      "plugin collision must not survive\n",
    );

    deploySkillsFromDir({ skillsDir: pluginSkills, workRoot: projectDir });
    deploySkills(projectDir, { force: true });

    for (const base of [".agents", ".claude"]) {
      const deployed = fs.readFileSync(path.join(projectDir, base, "skills", "senrail.flow", "SKILL.md"), "utf8");
      assert.doesNotMatch(deployed, /plugin collision must not survive/);
    }
  });

  it("replaces dangling canonical skill-root symlinks during a forced deployment", () => {
    const projectDir = setupConfiguredTmpProject();
    for (const base of [".agents", ".claude"]) {
      const skillRoot = path.join(projectDir, base, "skills", "senrail.flow");
      fs.mkdirSync(path.dirname(skillRoot), { recursive: true });
      fs.symlinkSync("missing-skill-root", skillRoot);
    }

    deploySkills(projectDir, { force: true });

    for (const base of [".agents", ".claude"]) {
      const skillRoot = path.join(projectDir, base, "skills", "senrail.flow");
      assert.ok(fs.lstatSync(skillRoot).isDirectory());
      assert.ok(fs.existsSync(path.join(skillRoot, "SKILL.md")));
    }
  });
});
