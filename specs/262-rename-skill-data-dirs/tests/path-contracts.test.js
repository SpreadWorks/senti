// spec: R1 R2 R3 R4 R5 R6 R7 R8
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { resolveIncludes } from "../../../src/lib/include.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function read(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function assertNoPatternInFiles(files, pattern, message) {
  const offenders = files.filter((file) => pattern.test(read(file)));
  assert.deepEqual(offenders, [], message);
}

test("R1: bundled skill sources live under src/skills", () => {
  assert.equal(exists("src/templates"), false, "src/templates wrapper must be removed");
  assert.equal(exists("src/skills/rules.json"), true);
  assert.equal(exists("src/skills/sdd-forge.flow/SKILL.md"), true);
  assert.equal(exists("src/skills/sdd-forge.flow-auto/SKILL.md"), true);
  assert.equal(exists("src/skills/sdd-forge.flow-status/SKILL.md"), true);
  assert.equal(exists("src/skills/sdd-forge.flow-resume/SKILL.md"), true);
  assert.equal(exists("src/skills/sdd-forge.flow-sync/SKILL.md"), true);
});

test("R2: skill partial includes use @skills", () => {
  assert.equal(exists("src/skills/partials/core-principle.md"), true);
  assert.equal(exists("src/skills/partials/worktree-mode.md"), true);

  const skillFiles = [];
  function collectSkillFiles(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        collectSkillFiles(full);
      } else if (entry.name.endsWith("SKILL.md") || entry.name.endsWith(".md")) {
        skillFiles.push(path.relative(ROOT, full).split(path.sep).join("/"));
      }
    }
  }
  collectSkillFiles(path.join(ROOT, "src/skills"));
  skillFiles.sort();
  assertNoPatternInFiles(skillFiles, /@templates\//, "skill source files must not use @templates/");

  const source = '<!-- include("@skills/partials/core-principle.md") -->';
  const expanded = resolveIncludes(source, {
    baseDir: path.join(ROOT, "src", "skills", "sdd-forge.flow"),
    pkgDir: path.join(ROOT, "src"),
    skillsDir: path.join(ROOT, "src", "skills"),
    presetsDir: path.join(ROOT, "src", "presets"),
  });
  assert.match(expanded, /requires_approval/);
});

test("R3: common DataSources live under src/data", () => {
  assert.equal(exists("src/docs/data"), false, "src/docs/data must be removed");
  for (const file of ["agents.js", "docs.js", "lang.js", "project.js", "skills.js", "text.js"]) {
    assert.equal(exists(`src/data/${file}`), true, `missing src/data/${file}`);
  }

  const resolverFactory = read("src/docs/lib/resolver-factory.js");
  assert.match(resolverFactory, /src\/data|["']\.\.\/\.\.\/data["']/);
  assert.doesNotMatch(resolverFactory, /["']\.\.\/data["']/);
});

test("R4: experimental workflow skills use the new source path", () => {
  assert.equal(exists("experimental/workflow/templates/skills"), false);
  assert.equal(exists("experimental/workflow/skills/sdd-forge.exp.workflow/SKILL.md"), true);

  const upgrade = read("src/upgrade.js");
  const skills = read("src/lib/skills.js");
  assert.match(skills, /EXPERIMENTAL_WORKFLOW_SKILLS_DIR/);
  assert.match(skills, /experimental["'],\s*["']workflow["'],\s*["']skills["']/);
  assert.match(upgrade, /EXPERIMENTAL_WORKFLOW_SKILLS_DIR/);
  assert.doesNotMatch(upgrade, /experimental["'],\s*["']workflow["'],\s*["']templates["'],\s*["']skills["']/);
});

test("R5: production path consumers use the new names", () => {
  const productionFiles = [
    "src/lib/skills.js",
    "src/lib/include.js",
    "src/upgrade.js",
    "src/docs/lib/resolver-factory.js",
  ];

  assert.match(read("src/lib/skills.js"), /MAIN_SKILLS_DIR/);
  assert.doesNotMatch(read("src/lib/skills.js"), /MAIN_SKILLS_TEMPLATES_DIR/);
  assert.match(read("src/lib/include.js"), /@skills\//);
  assert.doesNotMatch(read("src/lib/include.js"), /@templates\//);
  assertNoPatternInFiles(
    productionFiles,
    /src\/templates\/skills|src\/templates\/partials|src\/docs\/data|experimental\/workflow\/templates\/skills/,
    "production path consumers must not contain stale paths",
  );
});

test("R6: spec-local and shared tests cover the new contracts", () => {
  const self = read("specs/262-rename-skill-data-dirs/tests/path-contracts.test.js");
  assert.match(self, /^\/\/ spec: R1 R2 R3 R4 R5 R6 R7 R8$/m);

  const existingTestFiles = [
    "tests/unit/skills/partials/ai-question-style.test.js",
    "tests/unit/skills/partials/worktree-mode.test.js",
    "tests/unit/skills/finalize-self-contained.test.js",
    "tests/unit/flow/skill-report-show-wiring.test.js",
    "tests/unit/flow/ctx-dispatch.test.js",
    "tests/unit/flow/skill-no-external-deps.test.js",
    "tests/unit/flow/prompt-i18n.test.js",
    "tests/unit/lib/include.test.js",
    "tests/unit/presets/preset-scan-integrity.test.js",
    "tests/unit/docs/lib/layout-and-nav.test.js",
    "tests/e2e/051-skill-namespace.test.js",
  ].filter((file) => exists(file));

  assert.ok(existingTestFiles.length >= 8, "expected updated shared regression tests to remain present");
  assertNoPatternInFiles(existingTestFiles, /src\/templates|src\/docs\/data|@templates\//, "tests must not use stale paths");
});

test("R7: guidance points at src/skills while preserving src/presets", () => {
  const guidanceFiles = [
    "AGENTS.md",
    "src/presets/base/templates/en/AGENTS.sdd.md",
    "src/presets/base/templates/ja/AGENTS.sdd.md",
  ];

  for (const file of guidanceFiles) {
    const content = read(file);
    assert.doesNotMatch(content, /src\/templates\//);
    assert.match(content, /src\/skills\//);
    assert.match(content, /src\/presets\//);
  }

  if (exists("src/CLAUDE.md")) {
    assert.doesNotMatch(read("src/CLAUDE.md"), /src\/templates\//);
  }
});

test("R8: upgrade exits 0 and generated skill artifacts use the new source", () => {
  const upgradeEvidence = JSON.parse(read("specs/262-rename-skill-data-dirs/upgrade-verification.json"));
  assert.equal(upgradeEvidence.command, "sdd-forge upgrade");
  assert.equal(upgradeEvidence.exitCode, 0);

  const generated = [
    ".agents/skills/sdd-forge.flow/SKILL.md",
    ".claude/skills/sdd-forge.flow/SKILL.md",
  ];

  for (const file of generated) {
    const evidence = upgradeEvidence.generatedSkillChecks.find((item) => item.path === file);
    assert.ok(evidence, `missing upgrade evidence for ${file}`);
    assert.equal(evidence.exists, true, `${file} should exist after upgrade`);
    assert.equal(evidence.containsRawTemplatesDirective, false, `${file} should not contain @templates/`);
    assert.equal(evidence.containsRequiresApproval, true, `${file} should include expanded flow content`);
    assert.equal(exists(file), true, `missing generated skill ${file}`);
    assert.doesNotMatch(read(file), /@templates\//);
    assert.match(read(file), /requires_approval/);
  }
});
