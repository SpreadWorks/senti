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
      "sdd-forge.flow-plan",
      "sdd-forge.flow-impl",
      "sdd-forge.flow-finalize",
      "sdd-forge.flow",
      "sdd-forge.flow-auto",
    ];
    setupProject(tmp, installed);

    const templatesDir = path.join(tmp, "_templates");
    setupActiveTemplates(templatesDir, [
      "sdd-forge.flow",
      "sdd-forge.flow-auto",
      "sdd-forge.flow-resume",
      "sdd-forge.flow-status",
      "sdd-forge.flow-sync",
    ]);

    const result = cleanupObsoleteSkills(tmp, [templatesDir]);

    const removed = result.map((r) => r.name).sort();
    assert.deepEqual(removed, [
      "sdd-forge.flow-finalize",
      "sdd-forge.flow-impl",
      "sdd-forge.flow-plan",
    ]);

    for (const base of [".claude", ".agents"]) {
      assert.ok(!fs.existsSync(path.join(tmp, base, "skills", "sdd-forge.flow-plan")));
      assert.ok(!fs.existsSync(path.join(tmp, base, "skills", "sdd-forge.flow-impl")));
      assert.ok(!fs.existsSync(path.join(tmp, base, "skills", "sdd-forge.flow-finalize")));
      assert.ok(fs.existsSync(path.join(tmp, base, "skills", "sdd-forge.flow")));
      assert.ok(fs.existsSync(path.join(tmp, base, "skills", "sdd-forge.flow-auto")));
    }
  });

  it("dry-run mode reports removals without touching the filesystem", () => {
    tmp = createTmpDir();
    setupProject(tmp, ["sdd-forge.flow-plan", "sdd-forge.flow"]);
    const templatesDir = path.join(tmp, "_templates");
    setupActiveTemplates(templatesDir, ["sdd-forge.flow"]);

    const result = cleanupObsoleteSkills(tmp, [templatesDir], { dryRun: true });
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "sdd-forge.flow-plan");

    assert.ok(fs.existsSync(path.join(tmp, ".claude", "skills", "sdd-forge.flow-plan")));
    assert.ok(fs.existsSync(path.join(tmp, ".agents", "skills", "sdd-forge.flow-plan")));
  });

  it("ignores non-sdd-forge skills (does not touch third-party skills)", () => {
    tmp = createTmpDir();
    setupProject(tmp, ["sdd-forge.flow-plan", "my-custom-skill"]);
    const templatesDir = path.join(tmp, "_templates");
    setupActiveTemplates(templatesDir, ["sdd-forge.flow"]);

    const result = cleanupObsoleteSkills(tmp, [templatesDir]);
    const removed = result.map((r) => r.name);
    assert.deepEqual(removed, ["sdd-forge.flow-plan"]);

    assert.ok(fs.existsSync(path.join(tmp, ".claude", "skills", "my-custom-skill")));
  });
});
