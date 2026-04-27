/**
 * tests/unit/flow/get-next-action.test.js
 *
 * Contract tests for `flow get next-action` (spec 203 / cac6/T5).
 *
 * Verifies that the CLI command returns a statically-determined
 * next-action envelope based on the current in_progress step at either
 * the flow or task level, with the 3 approval points wired correctly.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { join } from "path";
import fs from "node:fs";
import os from "node:os";
import pathMod from "node:path";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import {
  FLOW_STEPS,
  TASK_STEPS_PLAN,
  buildInitialSteps,
  buildInitialTaskSteps,
} from "../../../src/lib/flow-helpers.js";
import { validateSchema } from "../../../src/lib/schema-validate.js";

const CLI = join(process.cwd(), "src/sdd-forge.js");

function runCli(tmp, args) {
  try {
    const out = execFileSync("node", [CLI, ...args], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
    });
    return { envelope: JSON.parse(out), exitCode: 0 };
  } catch (err) {
    const stdout = err.stdout?.toString() || "";
    return { envelope: stdout ? JSON.parse(stdout) : null, exitCode: err.status || 1 };
  }
}

function setupActiveFlow(tmp, overrides = {}) {
  const specId = "001-test";
  const state = {
    spec: `specs/${specId}/spec.md`,
    baseBranch: "main",
    featureBranch: "feature/001-test",
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
    currentTaskId: null,
    ...overrides,
  };
  const fm = makeFlowManager(tmp);
  fm.save(state);
  fm.addActiveFlow(specId, "local");
  return state;
}

function setFlowStepInProgress(state, stepId) {
  for (const s of state.steps) s.status = "pending";
  const step = state.steps.find((x) => x.id === stepId);
  assert.ok(step, `step ${stepId} must exist in FLOW_STEPS`);
  step.status = "in_progress";
}

function setTaskStepInProgress(state, taskId, stepId) {
  const task = state.tasks.find((t) => t.id === taskId);
  assert.ok(task, `task ${taskId} must exist`);
  for (const s of task.steps) s.status = "pending";
  const step = task.steps.find((x) => x.id === stepId);
  assert.ok(step, `task step ${stepId} must exist`);
  step.status = "in_progress";
  state.currentTaskId = taskId;
}

describe("flow get next-action", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  describe("envelope shape (REQ-1)", () => {
    it("returns 7-field data object in envelope", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "draft");
      makeFlowManager(tmp).save(state);

      const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);
      assert.equal(exitCode, 0);
      assert.equal(envelope.ok, true);
      assert.equal(envelope.type, "get");
      assert.equal(envelope.key, "next-action");
      const d = envelope.data;
      assert.ok("taskId" in d, "taskId field present");
      assert.ok("step" in d, "step field present");
      assert.ok("action" in d, "action field present");
      assert.ok("instructions" in d, "instructions field present");
      assert.ok("context" in d, "context field present");
      assert.ok("output_schema" in d, "output_schema field present");
      assert.ok("requires_approval" in d, "requires_approval field present");
    });
  });

  describe("active flow missing (REQ-2)", () => {
    it("returns ok:false and non-zero exit when no active flow", () => {
      tmp = createTmpDir();
      const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);
      assert.equal(envelope.ok, false);
      assert.notEqual(exitCode, 0);
      const msgs = envelope.errors.flatMap((e) => e.messages);
      assert.ok(msgs.some((m) => /no active flow/i.test(m)), "error mentions no active flow");
    });
  });

  describe("task-level target (REQ-3)", () => {
    it("returns task step fields when currentTaskId non-null", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp, {
        tasks: [{
          id: "001",
          spec: "tasks/001-foo.md",
          origin: "plan",
          parent: null,
          status: "in_progress",
          steps: buildInitialTaskSteps("plan"),
          requirements: [],
        }],
      });
      setTaskStepInProgress(state, "001", "impl");
      makeFlowManager(tmp).save(state);

      const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
      assert.equal(envelope.ok, true);
      assert.equal(envelope.data.taskId, "001");
      assert.equal(envelope.data.step, "impl");
      assert.equal(envelope.data.action, "run-impl");
    });
  });

  describe("flow-level fallback (REQ-4)", () => {
    it("returns flow step when currentTaskId is null", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "gate");
      makeFlowManager(tmp).save(state);

      const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
      assert.equal(envelope.ok, true);
      assert.equal(envelope.data.taskId, null);
      assert.equal(envelope.data.step, "gate");
    });
  });

  describe("approval points (REQ-5)", () => {
    it("flow approval step has requires_approval: true", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "approval");
      makeFlowManager(tmp).save(state);
      const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
      assert.equal(envelope.data.requires_approval, true);
    });

    it("flow integration-evaluate step has requires_approval: true", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "integration-evaluate");
      makeFlowManager(tmp).save(state);
      const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
      assert.equal(envelope.data.requires_approval, true);
    });

    it("flow finalize step has requires_approval: true", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "finalize");
      makeFlowManager(tmp).save(state);
      const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
      assert.equal(envelope.data.requires_approval, true);
    });

    it("all other rule-defined steps have requires_approval: false", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      const falsyFlowSteps = [
        "draft", "gate-draft", "spec", "gate", "test",
        "implement", "gate-impl",
        "integration-run-all-tests",
        "review",
      ];
      for (const id of falsyFlowSteps) {
        setFlowStepInProgress(state, id);
        makeFlowManager(tmp).save(state);
        const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
        assert.equal(envelope.ok, true, `ok for flow.${id}`);
        assert.equal(envelope.data.requires_approval, false, `requires_approval false for flow.${id}`);
      }
    });
  });

  describe("context descriptor (REQ-7)", () => {
    it("context contains kinds array of strings and paths object", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "spec");
      makeFlowManager(tmp).save(state);
      const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
      const ctx = envelope.data.context;
      assert.ok(Array.isArray(ctx.kinds), "kinds is array");
      assert.ok(ctx.kinds.every((k) => typeof k === "string"), "kinds are strings");
      assert.ok(typeof ctx.paths === "object" && ctx.paths !== null, "paths is object");
    });

    it("context does not include resolved file contents", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "spec");
      makeFlowManager(tmp).save(state);
      const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
      const ctx = envelope.data.context;
      // No raw content fields — only path descriptors
      for (const v of Object.values(ctx.paths)) {
        assert.ok(typeof v === "string" && !v.includes("\n"), "path values are single-line strings (not file contents)");
      }
    });
  });

  describe("output_schema (REQ-8, REQ-10)", () => {
    it("returns inline JSON Schema with a type field", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "gate");
      makeFlowManager(tmp).save(state);
      const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
      const schema = envelope.data.output_schema;
      assert.equal(typeof schema, "object");
      assert.equal(typeof schema.type, "string");
    });

    it("returned schema is usable by validateSchema stand-alone", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "gate");
      makeFlowManager(tmp).save(state);
      const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
      const schema = envelope.data.output_schema;
      const valid = { verdict: "pass" };
      const invalid = { verdict: 123 };
      assert.deepEqual(validateSchema(valid, schema), []);
      assert.notEqual(validateSchema(invalid, schema).length, 0);
    });
  });

  describe("NO_IN_PROGRESS_STEP auto-recovery (spec 219 / REQ-3)", () => {
    it("promotes first pending step when no in_progress exists, then returns envelope", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      // Simulate a post-gate state: branch/prepare-spec/draft/gate-draft all done,
      // next pending step is `spec`. No step is currently in_progress.
      const prefixDone = ["branch", "prepare-spec", "draft", "gate-draft"];
      for (const s of state.steps) {
        s.status = prefixDone.includes(s.id) ? "done" : "pending";
      }
      makeFlowManager(tmp).save(state);

      const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);
      assert.equal(exitCode, 0, "exits cleanly via auto-recovery");
      assert.equal(envelope.ok, true);
      assert.equal(envelope.data.taskId, null);
      assert.equal(envelope.data.step, "spec", "first pending step (`spec`) was promoted");

      // State should be persisted: the promoted step now has in_progress status.
      const reloaded = makeFlowManager(tmp).load();
      const promoted = reloaded.steps.find((s) => s.id === "spec");
      assert.equal(promoted.status, "in_progress", "fallback persists the promotion to flow.json");
    });

    it("still errors NO_IN_PROGRESS_STEP when every step is done/skipped", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      for (const s of state.steps) s.status = "done";
      makeFlowManager(tmp).save(state);

      const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);
      assert.equal(envelope.ok, false);
      assert.notEqual(exitCode, 0);
      const msgs = envelope.errors.flatMap((e) => e.messages);
      assert.ok(msgs.some((m) => /NO_IN_PROGRESS_STEP/i.test(m)), "error is NO_IN_PROGRESS_STEP when nothing left");
    });
  });

  describe("rule missing (REQ-9)", () => {
    it("returns ok:false when in_progress step has no rule entry", () => {
      tmp = createTmpDir();
      // `branch` is a FLOW_STEP but not in context-rules.json (automatic step)
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "branch");
      makeFlowManager(tmp).save(state);
      const { envelope, exitCode } = runCli(tmp, ["flow", "get", "next-action"]);
      assert.equal(envelope.ok, false);
      assert.notEqual(exitCode, 0);
      const msgs = envelope.errors.flatMap((e) => e.messages);
      assert.ok(msgs.some((m) => m.includes("branch")), "error mentions offending step");
    });
  });

  describe("task step coverage (plan + addition origins)", () => {
    it("each TASK_STEPS_PLAN step resolves to a rule", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp, {
        tasks: [{
          id: "001",
          spec: "tasks/001-foo.md",
          origin: "plan",
          parent: null,
          status: "in_progress",
          steps: buildInitialTaskSteps("plan"),
          requirements: [],
        }],
      });
      for (const stepId of TASK_STEPS_PLAN) {
        setTaskStepInProgress(state, "001", stepId);
        makeFlowManager(tmp).save(state);
        const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
        assert.equal(envelope.ok, true, `task.${stepId} has rule`);
        assert.equal(envelope.data.taskId, "001");
        assert.equal(envelope.data.step, stepId);
      }
    });

  });

  describe("data-only extensibility (REQ-11)", () => {
    it("new flow step can be added via JSON only, no code change required", () => {
      tmp = createTmpDir();
      // Stage a standalone schema dir with a fabricated `__test-new-step__` rule,
      // proving the resolver is purely data-driven.
      const stubDir = fs.mkdtempSync(pathMod.join(os.tmpdir(), "next-action-stub-"));
      fs.mkdirSync(pathMod.join(stubDir, "next-action"));
      fs.writeFileSync(
        pathMod.join(stubDir, "context-rules.json"),
        JSON.stringify({
          flow: {
            "__test-new-step__": {
              action: "test-action",
              instructions_key: "test.key",
              context_kinds: ["spec"],
              output_schema_ref: "next-action/__test__.schema.json",
              requires_approval: false,
            },
          },
          task: {},
        }),
      );
      fs.writeFileSync(
        pathMod.join(stubDir, "next-action", "__test__.schema.json"),
        JSON.stringify({ type: "object", required: ["ok"], properties: { ok: { type: "boolean" } } }),
      );

      // Stage a prompt markdown for the fabricated step under a separate tmp dir.
      // After spec 203 / cac6/T6, adding a new step requires both context-rules.json
      // entry AND a markdown file at <prompts-root>/<phase>/<step>.md.
      const promptsStubDir = fs.mkdtempSync(pathMod.join(os.tmpdir(), "next-action-prompts-stub-"));
      fs.mkdirSync(pathMod.join(promptsStubDir, "test"));
      fs.writeFileSync(
        pathMod.join(promptsStubDir, "test", "key.md"),
        "stub prompt content for __test-new-step__",
      );

      try {
        const state = setupActiveFlow(tmp, {
          steps: [{ id: "__test-new-step__", status: "in_progress" }],
        });
        makeFlowManager(tmp).save(state);

        const out = execFileSync("node", [CLI, "flow", "get", "next-action"], {
          encoding: "utf8",
          env: {
            ...process.env,
            SDD_FORGE_WORK_ROOT: tmp,
            SDD_FORGE_NEXT_ACTION_SCHEMA_DIR: stubDir,
            // T6 added the prompts-dir override; staging both schema and prompt
            // dirs is what keeps REQ-11 (data-only extensibility) intact.
            SDD_FORGE_NEXT_ACTION_PROMPTS_DIR: promptsStubDir,
          },
        });
        const envelope = JSON.parse(out);
        assert.equal(envelope.ok, true);
        assert.equal(envelope.data.step, "__test-new-step__");
        assert.equal(envelope.data.action, "test-action");
        assert.equal(envelope.data.output_schema.type, "object");
      } finally {
        fs.rmSync(stubDir, { recursive: true, force: true });
        fs.rmSync(promptsStubDir, { recursive: true, force: true });
      }
    });
  });

  describe("instructions identifier (spec 203 scope, not T6)", () => {
    it("instructions is an object with a `key` field (identifier, not body)", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "spec");
      makeFlowManager(tmp).save(state);
      const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
      const ins = envelope.data.instructions;
      assert.equal(typeof ins, "object");
      assert.equal(typeof ins.key, "string");
      assert.ok(ins.key.length > 0);
    });
  });

  describe("instructions content (spec 203 / cac6/T6)", () => {
    it("instructions includes resolved content alongside the key (flow scope)", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "spec");
      makeFlowManager(tmp).save(state);
      const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
      const ins = envelope.data.instructions;
      assert.equal(typeof ins.key, "string");
      assert.equal(typeof ins.content, "string");
      assert.ok(ins.content.length > 0, "content non-empty for flow.spec");
    });

    it("instructions includes resolved content for task scope", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp, {
        tasks: [{
          id: "001",
          spec: "tasks/001-foo.md",
          origin: "plan",
          parent: null,
          status: "in_progress",
          steps: buildInitialTaskSteps("plan"),
          requirements: [],
        }],
      });
      setTaskStepInProgress(state, "001", "impl");
      makeFlowManager(tmp).save(state);
      const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
      const ins = envelope.data.instructions;
      assert.equal(typeof ins.content, "string");
      assert.ok(ins.content.length > 0, "content non-empty for task.impl");
    });

    it("content matches the on-disk prompt file for the resolved key", () => {
      tmp = createTmpDir();
      const state = setupActiveFlow(tmp);
      setFlowStepInProgress(state, "draft");
      makeFlowManager(tmp).save(state);
      const { envelope } = runCli(tmp, ["flow", "get", "next-action"]);
      const ins = envelope.data.instructions;
      // ins.key is "plan.draft" → src/flow/prompts/plan/draft.md
      const parts = ins.key.split(".");
      const stepName = parts.pop();
      const filePath = pathMod.join(process.cwd(), "src", "flow", "prompts", ...parts, `${stepName}.md`);
      const onDisk = fs.readFileSync(filePath, "utf8");
      assert.equal(ins.content, onDisk, "CLI returns exact file content");
    });
  });
});
