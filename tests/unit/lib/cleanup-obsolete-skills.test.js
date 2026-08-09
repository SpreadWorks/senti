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
      "senrail.flow-plan",
      "senrail.flow-impl",
      "senrail.flow-finalize",
      "senrail.flow",
      "senrail.flow-auto",
    ];
    setupProject(tmp, installed);

    const templatesDir = path.join(tmp, "_templates");
    setupActiveTemplates(templatesDir, [
      "senrail.flow",
      "senrail.flow-auto",
      "senrail.flow-resume",
      "senrail.flow-status",
      "senrail.flow-sync",
    ]);

    const result = cleanupObsoleteSkills(tmp, [templatesDir]);

    const removed = result.map((r) => r.name).sort();
    assert.deepEqual(removed, [
      "senrail.flow-finalize",
      "senrail.flow-impl",
      "senrail.flow-plan",
    ]);

    for (const base of [".claude", ".agents"]) {
      assert.ok(!fs.existsSync(path.join(tmp, base, "skills", "senrail.flow-plan")));
      assert.ok(!fs.existsSync(path.join(tmp, base, "skills", "senrail.flow-impl")));
      assert.ok(!fs.existsSync(path.join(tmp, base, "skills", "senrail.flow-finalize")));
      assert.ok(fs.existsSync(path.join(tmp, base, "skills", "senrail.flow")));
      assert.ok(fs.existsSync(path.join(tmp, base, "skills", "senrail.flow-auto")));
    }
  });

  it("dry-run mode reports removals without touching the filesystem", () => {
    tmp = createTmpDir();
    setupProject(tmp, ["senrail.flow-plan", "senrail.flow"]);
    const templatesDir = path.join(tmp, "_templates");
    setupActiveTemplates(templatesDir, ["senrail.flow"]);

    const result = cleanupObsoleteSkills(tmp, [templatesDir], { dryRun: true });
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "senrail.flow-plan");

    assert.ok(fs.existsSync(path.join(tmp, ".claude", "skills", "senrail.flow-plan")));
    assert.ok(fs.existsSync(path.join(tmp, ".agents", "skills", "senrail.flow-plan")));
  });

  it("ignores non-senrail skills (does not touch third-party skills)", () => {
    tmp = createTmpDir();
    setupProject(tmp, ["senrail.flow-plan", "my-custom-skill"]);
    const templatesDir = path.join(tmp, "_templates");
    setupActiveTemplates(templatesDir, ["senrail.flow"]);

    const result = cleanupObsoleteSkills(tmp, [templatesDir]);
    const removed = result.map((r) => r.name);
    assert.deepEqual(removed, ["senrail.flow-plan"]);

    assert.ok(fs.existsSync(path.join(tmp, ".claude", "skills", "my-custom-skill")));
  });

  it("prunes retired namespaces even when an active plugin still declares them", () => {
    tmp = createTmpDir();
    setupProject(tmp, ["sdd-forge.flow", "senti.flow", "user.skill"]);
    const templatesDir = path.join(tmp, "_templates");
    setupActiveTemplates(templatesDir, ["senrail.flow", "sdd-forge.flow", "senti.flow"]);

    const result = cleanupObsoleteSkills(tmp, [templatesDir]);

    assert.deepEqual(result.map((entry) => entry.name).sort(), ["sdd-forge.flow", "senti.flow"]);
    for (const base of [".claude", ".agents"]) {
      assert.equal(fs.existsSync(path.join(tmp, base, "skills", "sdd-forge.flow")), false);
      assert.equal(fs.existsSync(path.join(tmp, base, "skills", "senti.flow")), false);
      assert.ok(fs.existsSync(path.join(tmp, base, "skills", "user.skill")));
    }
  });

  it("prunes a retired skill even when its deployed root is a symlink", () => {
    tmp = createTmpDir();
    setupProject(tmp, ["senrail.flow"]);
    const templatesDir = path.join(tmp, "_templates");
    setupActiveTemplates(templatesDir, ["senrail.flow"]);
    for (const base of [".claude", ".agents"]) {
      fs.symlinkSync(
        "missing-retired-skill",
        path.join(tmp, base, "skills", "senti.flow"),
      );
    }

    const result = cleanupObsoleteSkills(tmp, [templatesDir]);

    assert.deepEqual(result.map((entry) => entry.name), ["senti.flow"]);
    for (const base of [".claude", ".agents"]) {
      assert.equal(fs.existsSync(path.join(tmp, base, "skills", "senti.flow")), false);
      assert.throws(() => fs.lstatSync(path.join(tmp, base, "skills", "senti.flow")), { code: "ENOENT" });
    }
  });
});
