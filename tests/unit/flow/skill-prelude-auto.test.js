import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SKILL_PATH = path.join(process.cwd(), "src/skills/senti.flow/SKILL.md");

function readSkill() {
  return fs.readFileSync(SKILL_PATH, "utf8");
}

describe("senti.flow skill prelude auto flow", () => {
  it("uses the auto prompt as an intent confirmation with Goal and Scope", () => {
    const text = readSkill();

    assert.match(text, /Preflight summary and auto-mode eligibility check/);
    assert.match(text, /Goal.*Scope.*description/s);
    assert.match(text, /This prompt is also the intent confirmation/);
    assert.match(text, /summary is correct; AI proceeds without confirmations/);
  });

  it("does not skip Draft Q1 merely because autoApprove is true", () => {
    const text = readSkill();

    assert.doesNotMatch(text, /\*\*autoApprove skip:\*\* if `autoApprove: true`/);
    assert.match(text, /Preflight auto skip/);
    assert.match(text, /accepted preflight Goal \+ Scope \+ description/);
  });

  it("documents bounded preflight refinement through preparing request updates", () => {
    const text = readSkill();

    assert.match(text, /flow set request "<Goal\/Scope\/description text>" --run-id <runId>/);
    assert.match(text, /Retry this preflight refinement at most 2 times/);
    assert.match(text, /If still ineligible, continue with the normal B\.1/);
  });

  it("prepares from the accepted preflight auto defaults when B.1 is skipped", () => {
    const text = readSkill();

    assert.match(text, /B\.0\.5 auto default when preflight auto was accepted/);
    assert.match(text, /Worktree: `senti flow prepare --title "\.\.\." --base <branch> --worktree --run-id <runId>`/);
  });

  it("does not block new flow prelude with target-aware status checks", () => {
    const text = readSkill();
    const entry = text.slice(text.indexOf("### A. Entry"), text.indexOf("### A.0 Route choice"));

    assert.match(entry, /do not run `--expect-issue`, `--expect-spec`, or `--expect-run-id` before B\. Prelude/);
    assert.match(entry, /must not be blocked by unrelated active flows/);
    assert.doesNotMatch(entry, /senti flow get status --expect-issue <n>/);
  });
});
