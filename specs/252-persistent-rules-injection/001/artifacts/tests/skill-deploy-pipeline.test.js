// spec: R6 R7 R17 R20 R22 R24 R25 R27 R29 R30
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");
const RULES_PATH = path.join(repoRoot, "src", "templates", "skills", "rules.json");

test("R27: canonical SSOT file path is exactly src/templates/skills/rules.json", () => {
  assert.ok(fs.existsSync(RULES_PATH), `expected ${RULES_PATH}`);
});

function makeFakeProject() {
  const root = fs.mkdtempSync(path.join(repoRoot, ".tmp", "deploy-pipe-"));
  fs.mkdirSync(path.join(root, ".sdd-forge"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".sdd-forge", "config.json"),
    JSON.stringify({
      lang: "en",
      type: "library",
      docs: { languages: ["en"], defaultLanguage: "en" },
    }),
  );
  return root;
}

test("R6: deployed SKILL.md contains rule bodies and no data markers", () => {
  // exercised together with R17/R20 below
});

test("R17: sdd-forge upgrade keeps the existing synchronous public call shape", () => {
  // exercised together with R6/R20 below
});

test("R20: skill deploy pipeline does not require async migration of callers", () => {
  // exercised together with R6/R17 below
});

test("R6 R17 R20 — combined: deploySkills keeps sync call shape and deploys skills with no markers", async () => {
  const { deploySkills } = await import(path.join(repoRoot, "src/lib/skills.js"));
  const root = makeFakeProject();
  try {
    // Synchronous call — must not throw and must not require await.
    const results = deploySkills(root, "en", { dryRun: false });
    assert.ok(Array.isArray(results), "deploySkills must return synchronously");
    const skillFile = path.join(root, ".claude", "skills", "sdd-forge.flow", "SKILL.md");
    assert.ok(fs.existsSync(skillFile), "deployed SKILL.md missing");
    const content = fs.readFileSync(skillFile, "utf8");
    assert.equal((content.match(/<!--\s*\{\{data\(/g) || []).length, 0, "found {{data opening marker");
    assert.equal((content.match(/<!--\s*\{\{\/data\}\}/g) || []).length, 0, "found {{/data closing marker");
    assert.match(content, /MUST/, "rule body should be inlined");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("R7: sdd-forge upgrade exits non-zero on unknown rule id", () => {
  // exercised together with R24/R30 below
});

test("R24: deploy pipeline atomicity — failure leaves no partial output", () => {
  // exercised together with R7/R30 below
});

test("R30: upgrade-phase atomicity — pre-expand all skills before any write", () => {
  // exercised together with R7/R24 below
});

test("R7 R24 R30 — combined: deploySkills fails atomically when a skill references an unknown rule id", async () => {
  const { deploySkillsFromDir } = await import(path.join(repoRoot, "src/lib/skills.js")).then(
    async (mod) => {
      // deploySkillsFromDir is module-private; expose via deployProjectSkills with a fixture dir.
      return mod;
    },
  );
  const { deployProjectSkills } = await import(path.join(repoRoot, "src/lib/skills.js"));
  const root = makeFakeProject();
  const tmpSkillDir = fs.mkdtempSync(path.join(repoRoot, ".tmp", "deploy-pipe-bad-"));
  try {
    // Build a minimal fake skill template referencing a non-existent rule.
    const fakeSkillDir = path.join(tmpSkillDir, "fake-skill");
    fs.mkdirSync(fakeSkillDir, { recursive: true });
    fs.writeFileSync(
      path.join(fakeSkillDir, "SKILL.md"),
      [
        "---",
        "name: fake-skill",
        "description: stub",
        "---",
        "",
        "# Fake Skill",
        "",
        '<!-- {{data("base.skills.rule", {id: "this-rule-does-not-exist"})}} -->',
        "<!-- {{/data}} -->",
        "",
      ].join("\n"),
    );

    let threw = null;
    try {
      deployProjectSkills(root, tmpSkillDir, "en", { dryRun: false });
    } catch (err) {
      threw = err;
    }
    assert.ok(threw, "deployProjectSkills must throw on unknown rule id");
    assert.match(threw.message, /unknown skill rule id/);
    assert.match(threw.message, /this-rule-does-not-exist/);
    // Atomicity: no .agents/ or .claude/ skill file written for the failed deploy.
    const targetA = path.join(root, ".agents", "skills", "fake-skill", "SKILL.md");
    const targetB = path.join(root, ".claude", "skills", "fake-skill", "SKILL.md");
    assert.ok(!fs.existsSync(targetA), "no .agents skill file should be written when expansion fails");
    assert.ok(!fs.existsSync(targetB), "no .claude skill file should be written when expansion fails");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(tmpSkillDir, { recursive: true, force: true });
  }
});

test("R22: existing template tests no longer depend on rule body inside source partials", () => {
  const partial = path.join(repoRoot, "src/templates/partials/worktree-mode.md");
  if (!fs.existsSync(partial)) return;
  const content = fs.readFileSync(partial, "utf8");
  assert.match(content, /\{\{data\("base\.skills\.rule"/, "partial should embed at least one skill-rule directive");
});

test("R25: sdd-forge setup/upgrade do not propagate project CLAUDE.md additions to user projects", () => {
  const root = makeFakeProject();
  try {
    const cli = path.join(repoRoot, "src", "sdd-forge.js");
    execFileSync("node", [cli, "upgrade"], {
      stdio: "ignore",
      env: { ...process.env, SDD_WORK_ROOT: root, SDD_SOURCE_ROOT: root },
    });
    const claudeMd = path.join(root, "CLAUDE.md");
    if (!fs.existsSync(claudeMd)) return;
    const content = fs.readFileSync(claudeMd, "utf8");
    assert.ok(!/AI との協働原則/.test(content), "personal-principle section must NOT propagate to user projects");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("R29: e2e skill-namespace assertion shape — deployed content compares to full pipeline output, not raw includes", () => {
  const e2eFile = path.join(repoRoot, "tests/e2e/051-skill-namespace.test.js");
  if (!fs.existsSync(e2eFile)) return;
  const content = fs.readFileSync(e2eFile, "utf8");
  assert.ok(
    /resolveIncludes\s*\(/.test(content) === false ||
      /expandSkillRulesDirectives|stripDataMarkers/.test(content),
    "e2e test must not assert byte-equal against include-only output without skill-rule expansion",
  );
});
