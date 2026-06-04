import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");

function readProjectFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

describe("workflow board candidate guidance", () => {
  it("requires decision-ready issue-log candidates before finalize cleanup prompts the user", () => {
    const prompt = readProjectFile("src/flow/prompts/impl/finalize-cleanup.md");

    assert.match(prompt, /Do not ask the user to choose from title-only candidates/);
    assert.match(prompt, /target: affected step \/ command \/ artifact \/ feature/);
    assert.match(prompt, /problem: what happened and why it matters/);
    assert.match(prompt, /cause: observed cause or evidence; do not write "probably"/);
    assert.match(prompt, /improvement direction: what should change to prevent recurrence/);
    assert.match(prompt, /board reason: why this belongs on the board now/);
    assert.match(prompt, /raw diagnostic entries, duplicates, one-off agent mistakes/);
  });

  it("requires manual workflow drafts to include target, problem, cause, and improvement direction", () => {
    const skill = readProjectFile("src/skills/sdd-forge.workflow/SKILL.md");

    assert.match(skill, /A board draft body must include target, problem, cause, improvement direction, and why it belongs on the board/);
    assert.match(skill, /Do not propose unnecessary items/);
    assert.match(skill, /Do not ask the user to choose from title-only candidates/);
    assert.match(skill, /Do not use speculative wording such as "probably" \/ "おそらく"/);
  });
});
