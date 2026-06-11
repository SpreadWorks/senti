import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");

function readProjectFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("workflow board candidate guidance", () => {
  it("moves decision-ready issue-log candidates to plugin lifecycle hooks", () => {
    const prompt = readProjectFile("src/flow/prompts/impl/finalize-cleanup.md");
    const skill = readProjectFile("src/skills/senti.flow/SKILL.md");
    const hook = readProjectFile("src/official-plugins/senti-workflow-plugin/hooks/issue-start.js");

    assert.doesNotMatch(prompt, /Pre-cleanup: workflow board integration/);
    assert.doesNotMatch(prompt, /Do not ask the user to choose from title-only candidates/);
    assert.doesNotMatch(prompt, /target: affected step \/ command \/ artifact \/ feature/);
    assert.doesNotMatch(prompt, /senti workflow issue-log-import/);
    assert.doesNotMatch(prompt, /senti workflow add/);

    assert.match(skill, /Post-flow: plugin lifecycle/);
    assert.match(skill, /implemented by plugin hooks and issue-log candidates/);
    assert.doesNotMatch(skill, /workflow\.flowIntegration/);
    assert.doesNotMatch(skill, /senti workflow issue-log-import/);
    assert.doesNotMatch(skill, /senti workflow add/);

    assert.match(hook, /context\.config\.flowIntegration/);
    assert.match(hook, /issue-start/);
  });

  it("requires manual workflow drafts to include target, problem, cause, and improvement direction", () => {
    const skill = readProjectFile("src/skills/senti.workflow/SKILL.md");

    assert.match(skill, /A board draft body must include target, problem, cause, improvement direction, and why it belongs on the board/);
    assert.match(skill, /Do not propose unnecessary items/);
    assert.match(skill, /Do not ask the user to choose from title-only candidates/);
    assert.match(skill, /Do not use speculative wording such as "probably" \/ "おそらく"/);
  });
});
