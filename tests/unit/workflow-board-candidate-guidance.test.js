import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");

function readProjectFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("workflow board candidate guidance", () => {
  it("moves decision-ready issue-log candidates to post-flow guidance", () => {
    const prompt = readProjectFile("src/flow/prompts/impl/finalize-cleanup.md");
    const skill = readProjectFile("src/skills/sdd-forge.flow/SKILL.md");

    assert.doesNotMatch(prompt, /Pre-cleanup: workflow board integration/);
    assert.doesNotMatch(prompt, /Do not ask the user to choose from title-only candidates/);
    assert.doesNotMatch(prompt, /target: affected step \/ command \/ artifact \/ feature/);
    assert.doesNotMatch(prompt, /sdd-forge workflow issue-log-import/);
    assert.doesNotMatch(prompt, /sdd-forge workflow add/);

    assert.match(skill, /Post-flow: workflow board integration/);
    assert.match(skill, /Only when finalize-cleanup succeeded, `sdd-forge flow get status` reports `active:false`, and `workflow\.flowIntegration` equals `"enable"`/);
    assert.match(skill, /\.sdd-forge\/last-finalized-spec/);
    assert.match(skill, /sdd-forge workflow issue-log-import --spec <lastFinalizedSpec>/);
    assert.match(skill, /Process only the bounded `data\.candidates` array returned by that one issue-log-import invocation/);
    assert.match(skill, /Before presenting or adding any candidate, screen it for board readiness and show target, problem, cause or evidence, improvement direction, and board reason/);
    assert.match(skill, /Run `sdd-forge workflow add` only for candidates the user approved/);
    assert.match(skill, /Treat issue-log-import and workflow add failures as post-processing failures after flow completion/);
  });

  it("requires manual workflow drafts to include target, problem, cause, and improvement direction", () => {
    const skill = readProjectFile("src/skills/sdd-forge.workflow/SKILL.md");

    assert.match(skill, /A board draft body must include target, problem, cause, improvement direction, and why it belongs on the board/);
    assert.match(skill, /Do not propose unnecessary items/);
    assert.match(skill, /Do not ask the user to choose from title-only candidates/);
    assert.match(skill, /Do not use speculative wording such as "probably" \/ "おそらく"/);
  });
});
