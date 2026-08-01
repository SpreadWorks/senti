import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SKILL_PATH = path.join(process.cwd(), "src/skills/senti.flow/SKILL.md");
const CORE_PRINCIPLE_PATH = path.join(
  process.cwd(),
  "src/skills/partials/core-principle.md",
);

function readSkill() {
  return fs.readFileSync(SKILL_PATH, "utf8");
}

function readCorePrinciple() {
  return fs.readFileSync(CORE_PRINCIPLE_PATH, "utf8");
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

  it("allows parallel flow prelude only through an explicit preparing runId", () => {
    const text = readSkill();
    const entry = text.slice(text.indexOf("### A. Entry"), text.indexOf("### B. Prelude"));
    const prelude = text.slice(text.indexOf("### B. Prelude"), text.indexOf("B.0. **Initialize flow state**"));

    assert.match(entry, /`active: true` is not by itself a reason to stop/);
    assert.match(entry, /parallel flows are allowed/);
    assert.match(entry, /explicit preparing `runId`/);
    assert.match(prelude, /may be run even when another flow is active/);
    assert.match(prelude, /Before `prepare`, run `senti flow get status <runId> --expect-run-id <runId>`/);
    assert.match(prelude, /Never run bare `senti flow prepare` while an unrelated flow is active/);
    assert.doesNotMatch(prelude, /Concurrent flow prelude is out of scope/);
    assert.doesNotMatch(entry, /must not be blocked by unrelated active flows/);
  });

  it("verifies the promoted runId target immediately after prepare", () => {
    const text = readSkill();
    const prepare = text.slice(text.indexOf("B.4. **Prepare spec"), text.indexOf("Proceed to **C. Dispatcher loop**"));

    assert.match(prepare, /After a successful prepare, immediately verify the promoted target/);
    assert.match(prepare, /senti flow get status <runId> --expect-run-id <runId> --expect-issue <n> --expect-spec <spec>/);
    assert.match(prepare, /senti flow get status <runId> --expect-run-id <runId> --expect-issue <n>/);
    assert.match(prepare, /senti flow get status <runId> --expect-run-id <runId> --expect-spec <spec>/);
    assert.match(prepare, /branch \/ worktree/);
    assert.match(prepare, /ACTIVE_FLOW_MISMATCH/);
  });

  it("keeps dispatcher continuation target-bound after prepare", () => {
    const text = readSkill();
    const dispatcher = text.slice(text.indexOf("### C. Dispatcher loop"), text.indexOf("## Post-flow"));

    assert.match(text, /CLI-returned opaque binding tokens/);
    assert.match(dispatcher, /senti flow get next-action --expect-binding <token>/);
    assert.match(dispatcher, /senti flow set auto on --expect-binding <token>/);
    assert.match(dispatcher, /senti flow set auto off --expect-binding <token>/);
    assert.match(dispatcher, /cannot accept the\s+CLI-generated binding, STOP/s);
    assert.match(dispatcher, /senti flow get status <targetRunId> --expect-binding <token>/);
    assert.match(text, /Reference forms below omit `--expect-binding <token>`/);
    assert.doesNotMatch(text, /targetGuardArgs/);
    assert.match(text, /Do not proceed past a step whose `requires_approval` is `true`/);
    assert.match(text, /Do not start `finalize-commit` without its required user confirmation/);
    assert.doesNotMatch(text, /Do not finalize without user confirmation\./);
  });

  it("does not keep read-only runId repair as a public continuation contract", () => {
    const text = readSkill();
    const core = readCorePrinciple();

    assert.doesNotMatch(core, /transcri(?:be|ption)/i);
    assert.doesNotMatch(text, /transcri(?:be|ption)/i);
    assert.match(core, /Treat `ACTIVE_FLOW_MISMATCH` as a no-mutation boundary/);
    assert.match(core, /Do not retry a\s+target-sensitive command by editing guard strings/s);
    assert.match(core, /Store runId and binding values returned by the CLI as opaque tokens/);
  });

  it("does not include automatic route choice for non-explicit requests", () => {
    const text = readSkill();

    assert.doesNotMatch(text, /A\.0 Route choice/);
    assert.doesNotMatch(text, /whether to use Spec-Driven Development flow or direct editing/);
    assert.doesNotMatch(text, /new feature\/fix\/Issue request/);
    assert.match(text, /explicitly invokes Spec-Driven Development flow/);
    assert.match(text, /explicit new flow-start request/);
    assert.match(text, /no explicit flow-start request/);
  });
});
