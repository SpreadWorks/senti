// spec: R1 R2 R3 R4 R5 R6

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..", "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function normalize(text) {
  return text.replace(/\r\n/g, "\n").trim();
}

function extractAgentsSentiBlock(text) {
  const start = '<!-- {{data("agents.senti")}} -->';
  const end = "<!-- {{/data}} -->";
  const startIndex = text.indexOf(start);
  assert.notEqual(startIndex, -1, "generated agent file must contain agents.senti start marker");
  const endIndex = text.indexOf(end, startIndex);
  assert.notEqual(endIndex, -1, "generated agent file must contain agents.senti end marker");
  return text.slice(startIndex + start.length, endIndex);
}

function assertNoAutomaticStartupWording(label, text) {
  const forbidden = [
    /AskUserQuestion/,
    /present a 2-way choice/i,
    /direct edit.*Spec-Driven Development workflow/s,
    /直接修正.*Spec-Driven Development フロー/s,
    /2 択提示/,
    /When in doubt, mark flow as Recommended/i,
    /判定が迷う場合は flow を Recommended/,
    /did not explicitly invoke Spec-Driven Development flow.*A\.0 Route choice/s,
    /A\.0 Route choice/,
    /use Spec-Driven Development flow or direct editing/,
  ];
  for (const pattern of forbidden) {
    assert.equal(pattern.test(text), false, `${label} still contains automatic startup wording: ${pattern}`);
  }
}

// R1: AGENTS templates must not require ordinary requests to choose flow/direct edit.
test("R1: AGENTS templates use explicit-start-only policy", () => {
  const english = read("src/presets/base/templates/en/AGENTS.senti.md");
  const japanese = read("src/presets/base/templates/ja/AGENTS.senti.md");

  assertNoAutomaticStartupWording("English AGENTS template", english);
  assertNoAutomaticStartupWording("Japanese AGENTS template", japanese);
  assert.match(english, /Start the Spec-Driven Development flow only when the user explicitly instructs it/i);
  assert.match(japanese, /ユーザーが.*明示.*開始/);
});

// R2: senti.flow entry guidance must only start new flows on explicit instruction.
test("R2: senti.flow skill entry guidance has no non-explicit route choice", () => {
  const skill = read("src/skills/senti.flow/SKILL.md");

  assertNoAutomaticStartupWording("senti.flow skill", skill);
  assert.doesNotMatch(skill, /chooses Spec-Driven Development flow for a feature\/fix request/i);
  assert.match(skill, /explicitly (invokes|requests|instructs)/i);
  assert.match(skill, /active flow.*C\. Dispatcher loop/s);
});

// R3: retained flow surfaces must be documented after removing automatic startup.
test("R3: retained manual-start and active-continuation surfaces remain mapped", () => {
  const skill = read("src/skills/senti.flow/SKILL.md");

  assertNoAutomaticStartupWording("senti.flow retained-surface guidance", skill);
  assert.match(skill, /B\. Prelude/);
  assert.match(skill, /C\. Dispatcher loop/);
  assert.match(skill, /ACTIVE_FLOW_MISMATCH/);
  assert.match(skill, /auto-check/);
  assert.match(skill, /senti flow set init/);
  assert.match(skill, /senti flow prepare/);
});

// R4: regression coverage must fail if legacy startup policy returns.
test("R4: old mandatory startup policy is absent from all policy sources", () => {
  const policySources = [
    ["src/presets/base/templates/en/AGENTS.senti.md", read("src/presets/base/templates/en/AGENTS.senti.md")],
    ["src/presets/base/templates/ja/AGENTS.senti.md", read("src/presets/base/templates/ja/AGENTS.senti.md")],
    ["src/skills/senti.flow/SKILL.md", read("src/skills/senti.flow/SKILL.md")],
  ];

  for (const [label, text] of policySources) assertNoAutomaticStartupWording(label, text);
});

// R5: source skill/preset edits must refresh generated artifacts.
test("R5: upgrade refreshes generated skill or preset artifacts", () => {
  const sourceSkill = read("src/skills/senti.flow/SKILL.md");
  const generatedSkillPaths = [
    ".agents/skills/senti.flow/SKILL.md",
    ".claude/skills/senti.flow/SKILL.md",
  ];
  for (const generatedSkillPath of generatedSkillPaths) {
    assert.equal(fs.existsSync(path.join(repoRoot, generatedSkillPath)), true, `${generatedSkillPath} must exist`);
    const generatedSkill = read(generatedSkillPath);
    assertNoAutomaticStartupWording(generatedSkillPath, generatedSkill);
    assert.match(generatedSkill, /explicitly (invokes|requests|instructs)/i);
  }
  assert.match(sourceSkill, /explicitly (invokes|requests|instructs)/i);

  const fileMap = JSON.parse(read("specs/314-explicit-flow-start-only/file-map.json"));
  assert.ok(fileMap.R5?.includes("specs/314-explicit-flow-start-only/upgrade-result.json"));
  assert.ok(fileMap.R5?.includes("specs/314-explicit-flow-start-only/upgrade-evidence.md"));
  assert.ok(fileMap.R5?.includes(".agents/skills/senti.flow/SKILL.md"));
  assert.ok(fileMap.R5?.includes(".claude/skills/senti.flow/SKILL.md"));

  assert.equal(
    normalize(read(".senti/presets/base/guardrail.json")),
    normalize(read("src/presets/base/guardrail.json")),
    "generated base guardrail preset must match source",
  );
  assert.equal(
    normalize(read(".senti/presets/base/guardrail-rewrite-rubric.md")),
    normalize(read("src/presets/base/guardrail-rewrite-rubric.md")),
    "generated base guardrail rewrite rubric must match source",
  );
});

// R6: generated readable agent guidance must be refreshed or verified.
test("R6: generated AGENTS and CLAUDE guidance do not retain automatic startup wording", () => {
  const generatedTargets = ["AGENTS.md"];
  if (fs.existsSync(path.join(repoRoot, "CLAUDE.md"))) generatedTargets.push("CLAUDE.md");
  const sourceTemplate = normalize(read("src/presets/base/templates/ja/AGENTS.senti.md"));

  for (const relativePath of generatedTargets) {
    const generated = read(relativePath);
    assertNoAutomaticStartupWording(relativePath, generated);
    const block = normalize(extractAgentsSentiBlock(generated));
    assert.ok(
      block.includes(sourceTemplate),
      `${relativePath} agents.senti block must include the current Japanese AGENTS.senti source template`,
    );
  }
});
