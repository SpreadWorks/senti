// spec: R1 R2 R3 R4 R5 R6 R7
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function postFlowSection(content) {
  const marker = "Post-flow: workflow board integration";
  const start = content.indexOf(marker);
  assert.notEqual(start, -1, "post-flow workflow board integration section is missing");
  const rest = content.slice(start);
  const nextHeading = rest.slice(marker.length).search(/\n## /);
  return nextHeading === -1 ? rest : rest.slice(0, marker.length + nextHeading);
}

function assertPostFlowAfterLoopExit(content) {
  const loopExit = content.indexOf("### Loop exit condition");
  const postFlow = content.indexOf("Post-flow: workflow board integration");

  assert.notEqual(loopExit, -1, "loop exit condition section is missing");
  assert.notEqual(postFlow, -1, "post-flow workflow board integration section is missing");
  assert.ok(
    postFlow > loopExit,
    "post-flow workflow board integration must appear after the loop exit condition"
  );
}

function assertPostFlowGuidance(content) {
  assertPostFlowAfterLoopExit(content);
  const section = postFlowSection(content);
  assert.match(section, /flow is complete|flow は完了しています/);
  assert.match(section, /optional post-flow|任意の後処理/);
  assert.match(section, /Only when finalize-cleanup succeeded, `sdd-forge flow get status` reports `active:false`, and `workflow\.flowIntegration` equals `"enable"`/);
  assert.match(section, /\.sdd-forge\/last-finalized-spec/);
  assert.match(section, /main repo|main repository|main repo 側/);
  assert.match(section, /sdd-forge workflow issue-log-import --spec <lastFinalizedSpec>/);
  assert.match(
    section,
    /Process only the bounded `data\.candidates` array returned by that one issue-log-import invocation/
  );
  assert.match(
    section,
    /Before presenting or adding any candidate, screen it for board readiness and show target, problem, cause or evidence, improvement direction, and board reason for each displayed candidate/
  );
  assert.match(
    section,
    /Run `sdd-forge workflow add` only for candidates the user approved/
  );
  assert.match(
    section,
    /Treat issue-log-import and workflow add failures as post-processing failures after flow completion; report them without changing the flow completion state/
  );
}

test("R1: finalize-cleanup prompt no longer contains pre-cleanup board registration", () => {
  const cleanup = read("src/flow/prompts/impl/finalize-cleanup.md");

  assert.doesNotMatch(cleanup, /Pre-cleanup: workflow board integration/);
  assert.doesNotMatch(cleanup, /issue-log-import/);
  assert.doesNotMatch(cleanup, /workflow add/);
});

test("R2: source flow skill contains post-flow completion wording", () => {
  const skill = read("src/skills/sdd-forge.flow/SKILL.md");

  assertPostFlowGuidance(skill);
});

test("R3: source flow skill gates post-flow handling on cleanup success, inactive flow, and flowIntegration", () => {
  const section = postFlowSection(read("src/skills/sdd-forge.flow/SKILL.md"));

  assert.match(
    section,
    /Only when finalize-cleanup succeeded, `sdd-forge flow get status` reports `active:false`, and `workflow\.flowIntegration` equals `"enable"`/
  );
});

test("R4: source flow skill uses last-finalized-spec for issue-log import", () => {
  const section = postFlowSection(read("src/skills/sdd-forge.flow/SKILL.md"));

  assert.match(section, /\.sdd-forge\/last-finalized-spec/);
  assert.match(section, /main repo|main repository|main repo 側/);
  assert.match(section, /sdd-forge workflow issue-log-import --spec <lastFinalizedSpec>/);
});

test("R5: source flow skill screens bounded candidates and adds only approved drafts", () => {
  const section = postFlowSection(read("src/skills/sdd-forge.flow/SKILL.md"));

  assert.match(
    section,
    /Process only the bounded `data\.candidates` array returned by that one issue-log-import invocation/
  );
  assert.match(
    section,
    /Before presenting or adding any candidate, screen it for board readiness and show target, problem, cause or evidence, improvement direction, and board reason for each displayed candidate/
  );
  assert.match(
    section,
    /Run `sdd-forge workflow add` only for candidates the user approved/
  );
});

test("R6: source flow skill treats post-flow failures as non-completion failures", () => {
  const section = postFlowSection(read("src/skills/sdd-forge.flow/SKILL.md"));

  assert.match(
    section,
    /Treat issue-log-import and workflow add failures as post-processing failures after flow completion; report them without changing the flow completion state/
  );
});

test("R7: generated flow skills include post-flow guidance after upgrade", () => {
  const agentsSkill = read(".agents/skills/sdd-forge.flow/SKILL.md");
  const claudeSkill = read(".claude/skills/sdd-forge.flow/SKILL.md");

  assertPostFlowGuidance(agentsSkill);
  assertPostFlowGuidance(claudeSkill);
});
