/**
 * tests/integration/task-decomposition/t1-entry-enforcement.test.js
 *
 * Spec 226 / T-1: タスク必須化の入口強制。
 * guardrail (task-single-responsibility) の追加、plan prompts (spec.md,
 * draft.md) の強化、spec gate の structural check 層への tasks 空 FAIL 判定
 * 追加、を検証する。
 *
 * REQ-1 / REQ-12 / REQ-13 / REQ-14 に対応。
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateSchema } from "../../../src/lib/schema-validate.js";
import { checkSpecJson } from "../../../src/flow/lib/run-gate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..");

function readGuardrailJson() {
  const filePath = path.join(ROOT, "src", "presets", "base", "guardrail.json");
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readPrompt(relPath) {
  return fs.readFileSync(path.join(ROOT, "src", "flow", "prompts", relPath), "utf8");
}

function loadSpecSchema() {
  const schemaPath = path.join(ROOT, "src", "flow", "schemas", "spec.schema.json");
  return JSON.parse(fs.readFileSync(schemaPath, "utf8"));
}

/** Build a minimal valid spec object with optional overrides. */
function makeSpec(overrides = {}) {
  return {
    goal: "Test goal",
    scope: { in: ["a"], out: ["b"] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    background: "",
    requirements: [],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
    ...overrides,
  };
}

describe("T-1: entry enforcement (guardrail + prompts + spec gate tasks check)", () => {
  it("guardrail.json includes task-single-responsibility with phase=[spec, task-spec]", () => {
    const data = readGuardrailJson();
    const entry = data.guardrails.find((g) => g.id === "task-single-responsibility");
    assert.ok(entry, "task-single-responsibility guardrail must exist in base/guardrail.json");
    assert.deepEqual(
      entry.meta.phase,
      ["spec", "task-spec"],
      "phase must be exactly [spec, task-spec]",
    );
    assert.equal(entry.meta.category, "process");
  });

  it("plan/spec.md prompt contains Task Decomposition Rules markers", () => {
    const text = readPrompt("plan/spec.md");
    assert.ok(
      /## Task Decomposition Rules/m.test(text),
      "spec.md prompt must contain '## Task Decomposition Rules' section heading",
    );
    assert.ok(
      /spec\.json\.tasks\[\]/.test(text),
      "spec.md prompt must reference spec.json.tasks[]",
    );
  });

  it("plan/draft.md prompt contains concern-based decomposition notice", () => {
    const text = readPrompt("plan/draft.md");
    assert.ok(
      /concern/.test(text),
      "draft.md prompt must mention concern-based decomposition",
    );
    assert.ok(
      /task-single-responsibility/.test(text),
      "draft.md prompt must reference the task-single-responsibility guardrail",
    );
  });

  it("spec gate structural check rejects spec.json with empty tasks[]", () => {
    const spec = makeSpec({ tasks: [] });
    const issues = checkSpecJson(spec);
    assert.ok(issues.length > 0, "checkSpecJson must return issues for empty tasks[]");
    const tasksIssue = issues.find((i) => /tasks.*empty/i.test(i));
    assert.ok(tasksIssue, "issues must include a message about empty tasks array");
  });

  it("spec gate structural check rejects spec.json with undefined tasks", () => {
    const spec = makeSpec();
    // tasks is not set, so it is undefined
    const issues = checkSpecJson(spec);
    assert.ok(issues.length > 0, "checkSpecJson must return issues for undefined tasks");
    const tasksIssue = issues.find((i) => /tasks.*missing/i.test(i));
    assert.ok(tasksIssue, "issues must include a message about missing tasks field");
  });

  it("spec gate accepts spec.json with non-empty tasks[]", () => {
    const spec = makeSpec({
      tasks: [
        {
          id: "T-1",
          title: "Test task",
          goal: "A valid test task",
          origin: "plan",
          added_round: 0,
          status: "pending",
          parent: null,
          test_strategy: "Run focused unit tests.",
        },
      ],
    });
    const issues = checkSpecJson(spec);
    const tasksIssues = issues.filter((i) => /^tasks:/.test(i));
    assert.equal(tasksIssues.length, 0, "checkSpecJson must not report tasks issues for non-empty valid tasks");
  });

  it("existing spec.json (tasks undefined) is still valid under JSON schema", () => {
    const schema = loadSpecSchema();
    const spec = makeSpec();
    // tasks is absent — the schema does not list "tasks" in "required",
    // so an existing spec.json without a tasks field should pass schema validation.
    const errors = validateSchema(spec, schema);
    assert.deepEqual(errors, [], "spec without tasks must pass JSON schema validation");
  });
});
