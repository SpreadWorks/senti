/**
 * tests/unit/lib/cleanup-obsolete-skills.test.js
 *
 * Regression tests for cleanupObsoleteSkills(): when the consolidated
 * mainline flow skill replaces the three legacy skills, upgrade-time
 * cleanup should remove exactly the legacy skills and preserve unrelated
 * skills (R10 from spec 206).
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { cleanupObsoleteSkills } from "../../../src/lib/skills.js";

function setupProject(tmp, installedSkills) {
  for (const base of [".claude", ".agents"]) {
    for (const name of installedSkills) {
      const dir = path.join(tmp, base, "skills", name);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "SKILL.md"), `---\nname: ${name}\n---\n`);
    }
  }
}

function setupActiveTemplates(validTemplatesDir, templateNames) {
  for (const name of templateNames) {
    const dir = path.join(validTemplatesDir, name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), `---\nname: ${name}\n---\n`);
  }
}

describe("cleanupObsoleteSkills — consolidated flow skill scenario (R10)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("removes legacy flow-plan/impl/finalize and preserves unrelated skills", () => {
    tmp = createTmpDir();
    const installed = [
      "senti.flow-plan",
      "senti.flow-impl",
      "senti.flow-finalize",
      "senti.flow",
      "senti.flow-auto",
    ];
    setupProject(tmp, installed);

    const templatesDir = path.join(tmp, "_templates");
    setupActiveTemplates(templatesDir, [
      "senti.flow",
      "senti.flow-auto",
      "senti.flow-resume",
      "senti.flow-status",
      "senti.flow-sync",
    ]);

    const result = cleanupObsoleteSkills(tmp, [templatesDir]);

    const removed = result.map((r) => r.name).sort();
    assert.deepEqual(removed, [
      "senti.flow-finalize",
      "senti.flow-impl",
      "senti.flow-plan",
    ]);

    for (const base of [".claude", ".agents"]) {
      assert.ok(!fs.existsSync(path.join(tmp, base, "skills", "senti.flow-plan")));
      assert.ok(!fs.existsSync(path.join(tmp, base, "skills", "senti.flow-impl")));
      assert.ok(!fs.existsSync(path.join(tmp, base, "skills", "senti.flow-finalize")));
      assert.ok(fs.existsSync(path.join(tmp, base, "skills", "senti.flow")));
      assert.ok(fs.existsSync(path.join(tmp, base, "skills", "senti.flow-auto")));
    }
  });

  it("dry-run mode reports removals without touching the filesystem", () => {
    tmp = createTmpDir();
    setupProject(tmp, ["senti.flow-plan", "senti.flow"]);
    const templatesDir = path.join(tmp, "_templates");
    setupActiveTemplates(templatesDir, ["senti.flow"]);

    const result = cleanupObsoleteSkills(tmp, [templatesDir], { dryRun: true });
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "senti.flow-plan");

    assert.ok(fs.existsSync(path.join(tmp, ".claude", "skills", "senti.flow-plan")));
    assert.ok(fs.existsSync(path.join(tmp, ".agents", "skills", "senti.flow-plan")));
  });

  it("ignores non-senti skills (does not touch third-party skills)", () => {
    tmp = createTmpDir();
    setupProject(tmp, ["senti.flow-plan", "my-custom-skill"]);
    const templatesDir = path.join(tmp, "_templates");
    setupActiveTemplates(templatesDir, ["senti.flow"]);

    const result = cleanupObsoleteSkills(tmp, [templatesDir]);
    const removed = result.map((r) => r.name);
    assert.deepEqual(removed, ["senti.flow-plan"]);

    assert.ok(fs.existsSync(path.join(tmp, ".claude", "skills", "my-custom-skill")));
  });
});
