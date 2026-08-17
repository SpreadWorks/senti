// spec: R7 R10 R13 R14 R18
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";

const repoRoot = path.resolve(import.meta.dirname, "../../../");
const skillTemplate = path.join(repoRoot, "src/templates/skills/sdd-forge.flow/SKILL.md");
const worktreeModePartial = path.join(repoRoot, "src/templates/partials/worktree-mode.md");
const promptCleanup = path.join(repoRoot, "src/flow/prompts/impl/finalize-cleanup.md");
const promptCommit = path.join(repoRoot, "src/flow/prompts/impl/finalize-commit.md");
const promptMerge = path.join(repoRoot, "src/flow/prompts/impl/finalize-merge.md");
const promptSync = path.join(repoRoot, "src/flow/prompts/impl/finalize-sync.md");
const skillReportShowTest = path.join(repoRoot, "tests/unit/flow/skill-report-show-wiring.test.js");

function readFileText(p) {
  return fs.readFileSync(p, "utf8");
}

test("R7: skill template SKILL.md does not contain post-cleanup 'flow report show' MUST instruction", () => {
  const text = readFileText(skillTemplate);
  // The MUST line referencing flow report show after cleanup must be removed
  // (we still allow generic mentions in commands reference if any)
  const mustReportShow = /MUST[\s\S]{0,400}flow report show/i.test(text);
  assert.equal(
    mustReportShow,
    false,
    "SKILL.md must not require AI to manually run 'flow report show' after cleanup",
  );
});

test("R7: skill template SKILL.md does not contain post-cleanup 'cd <mainRepoPath>' MUST instruction", () => {
  const text = readFileText(skillTemplate);
  const mustCdMain = /MUST[\s\S]{0,400}cd <mainRepoPath>/.test(text);
  assert.equal(
    mustCdMain,
    false,
    "SKILL.md must not require AI to manually 'cd <mainRepoPath>' after cleanup",
  );
});

test("R10: template files contain no 'flow report show' / 'cd <mainRepoPath>' / 'flow set step.*finalize-' patterns", () => {
  const skill = readFileText(skillTemplate);
  const partial = readFileText(worktreeModePartial);
  for (const [name, text] of [["SKILL.md", skill], ["worktree-mode.md", partial]]) {
    assert.equal(/flow report show/.test(text), false, `${name} should not contain 'flow report show'`);
    assert.equal(/cd <mainRepoPath>|cd <main-repository-path>/.test(text), false, `${name} should not contain 'cd <mainRepoPath>' / 'cd <main-repository-path>'`);
    assert.equal(/flow set step\s+finalize-/.test(text), false, `${name} should not contain 'flow set step finalize-*'`);
  }
});

test("R13: finalize-cleanup.md prompt instructs reading envelope.data.report.text and not flow report show", () => {
  const text = readFileText(promptCleanup);
  assert.match(
    text,
    /data\.report\.text|envelope\.data\.report|report\.text/,
    "finalize-cleanup.md must instruct AI to read envelope.data.report.text",
  );
  assert.equal(
    /flow report show/.test(text),
    false,
    "finalize-cleanup.md must not retain 'flow report show' instruction",
  );
});

test("R13: finalize-{commit,merge,sync}.md prompts do not contain 'cd <mainRepoPath>' or 'flow set step.*finalize-'", () => {
  for (const p of [promptCommit, promptMerge, promptSync]) {
    const text = readFileText(p);
    assert.equal(/cd <mainRepoPath>|cd <main-repository-path>/.test(text), false, `${path.basename(p)}: 'cd <mainRepoPath>' must not appear`);
    assert.equal(/flow set step\s+finalize-/.test(text), false, `${path.basename(p)}: 'flow set step finalize-*' must not appear`);
  }
});

test("R14: skill-report-show-wiring.test.js no longer asserts SKILL.md must contain 'flow report show' MUST", () => {
  const text = readFileText(skillReportShowTest);
  // The legacy assertion must not require 'flow report show' MUST presence anymore.
  // It is acceptable for the file to assert ABSENCE of legacy strings (negative assertion).
  const requiresFlowReportShowPresence =
    /assert.*ok[\s\S]{0,200}flow report show|toContain[\s\S]{0,200}flow report show|includes\(['"]flow report show/i.test(text);
  assert.equal(
    requiresFlowReportShowPresence,
    false,
    "skill-report-show-wiring.test.js must no longer assert SKILL.md contains 'flow report show'",
  );
});

test("R18: worktree-mode.md does not require post-cleanup 'cd <main-repository-path>' as next step", () => {
  const text = readFileText(worktreeModePartial);
  // Either rewritten or removed
  assert.equal(
    /cleanup.{0,300}cd <main-repository-path>/is.test(text),
    false,
    "worktree-mode.md must no longer mandate 'cd <main-repository-path>' as the post-cleanup next command",
  );
});
