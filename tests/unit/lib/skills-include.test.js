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
import { deploySkills } from "../../../src/lib/skills.js";

describe("deploySkills include resolution", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupConfiguredTmpProject() {
    tmp = createTmpDir();
    fs.mkdirSync(path.join(tmp, ".sdd-forge"), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, ".sdd-forge", "config.json"),
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

    const flowPath = path.join(projectDir, ".agents", "skills", "sdd-forge.flow", "SKILL.md");
    if (fs.existsSync(flowPath)) {
      const content = fs.readFileSync(flowPath, "utf8");
      // Choice Format partial content should be expanded
      assert.ok(
        content.includes("Description") || content.includes("description") || content.includes("choices"),
        "flow SKILL.md should contain expanded Choice Format content",
      );
      assert.ok(
        content.includes("Every turn that asks the user to choose, decide, or confirm MUST contain all five sections"),
        "flow SKILL.md should enforce Choice Format for confirmation questions",
      );
      assert.ok(
        content.includes("ABSOLUTELY PROHIBITED"),
        "flow SKILL.md should explicitly disallow free-form questions without exceptions",
      );
    }
  });
});
