// spec: R11 R12 R22
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

describe("Plan-phase gate prompt files", () => {
  test("R11: gate.md contains the spec.json scan instruction with literal authored field names", async () => {
    const text = fs.readFileSync(path.join(repoRoot, "src/flow/prompts/plan/gate.md"), "utf8");
    const requiredFragments = [
      "scan these fields in",
      "spec.json",
      "goal",
      "background",
      "scope.in",
      "scope.out",
      "constraints",
      "design_principles",
      "requirements",
      "acceptance_criteria",
      "alternatives_considered",
      "open_questions",
      "tasks",
    ];
    for (const frag of requiredFragments) {
      assert.match(text, new RegExp(frag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `gate.md must mention '${frag}'`);
    }
  });

  test("R11: gate.md displays every reason row from data.artifacts.reasons (multi-row enumeration)", async () => {
    const text = fs.readFileSync(path.join(repoRoot, "src/flow/prompts/plan/gate.md"), "utf8");
    assert.match(text, /every (row|reason)/i, "gate.md must instruct displaying every row in data.artifacts.reasons");
  });

  test("R12: gate-draft.md contains the draft.json scan instruction with literal authored field names", async () => {
    const text = fs.readFileSync(path.join(repoRoot, "src/flow/prompts/plan/gate-draft.md"), "utf8");
    const requiredFragments = [
      "scan these fields in",
      "draft.json",
      "goal",
      "analysis",
      "scopeVerification",
      "impactOnExisting",
      "qa",
      "openQuestions",
    ];
    for (const frag of requiredFragments) {
      assert.match(text, new RegExp(frag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `gate-draft.md must mention '${frag}'`);
    }
  });

  test("R22: gate.md includes task-spec id derivation rule (basename of task markdown without .md)", async () => {
    const text = fs.readFileSync(path.join(repoRoot, "src/flow/prompts/plan/gate.md"), "utf8");
    assert.match(text, /task-spec/i, "gate.md must address task-spec phase");
    assert.match(text, /tasks\[/, "gate.md must reference spec.json.tasks[<id>]");
  });
});
