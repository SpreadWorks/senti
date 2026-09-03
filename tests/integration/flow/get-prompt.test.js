/**
 * tests/integration/flow/get-prompt.test.js
 *
 * Tests for `flow get prompt <kind>` — returns structured prompt data.
 */

import { describe, it, afterEach } from "node:test";
import { FreshFlowFixture, makeFlowManager } from "../../support/infrastructure/flow-setup.js";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { join } from "path";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";
import GetPromptCommand from "../../../src/flow/lib/get-prompt.js";
import { FlowTargetExpectation } from "../../../src/lib/flow-target-guard.js";
const FLOW_CMD = join(process.cwd(), "src/flow.js");

describe("flow get prompt", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function specRecord(taskId = "T-1") {
    return {
      goal: "Approval view goal",
      background: "",
      scope: { in: [], out: [] },
      constraints: [],
      design_principles: [],
      overview: { modules: [], data_flow: [], decisions: [] },
      requirements: [{ id: "R1", desc: "Approve this.", task_ids: [taskId] }],
      acceptance_criteria: ["Approved."],
      clarifications: [],
      alternatives_considered: [],
      open_questions: [],
      tasks: [],
    };
  }

  function setupFlowState(dir, {
    specId = "001-test",
    runId = "run-001-test",
    issue = 1001,
    taskId = "T-1",
  } = {}) {
    return new FreshFlowFixture({
      flowManager: makeFlowManager(dir),
      specId,
      runId,
      issue,
      issueSnapshot: `Issue ${issue} immutable fixture body`,
      execution: { mode: "direct" },
      specRecord: specRecord(taskId),
    }).create().addTask({
      id: taskId,
      title: "Task one",
      goal: "Task goal",
      parent: null,
      origin: "plan",
      added_round: 0,
      status: "pending",
    }).registerActive();
  }

  it("returns error for removed plan.approach kind", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    try {
      execFileSync(
        "node", [FLOW_CMD, "get", "prompt", "plan.approach"],
        { encoding: "utf8", env: { ...process.env, SENNEL_WORK_ROOT: tmp } },
      );
      assert.fail("should exit non-zero");
    } catch (err) {
      const envelope = JSON.parse(err.stdout);
      assert.equal(envelope.ok, false);
      assert.equal(envelope.errors[0].level, "fatal");
      assert.ok(
        envelope.errors[0].messages[0].includes("unknown kind"),
        `should mention unknown kind: ${envelope.errors[0].messages[0]}`,
      );
    }
  });

  it("returns empty choices for hybrid kind plan.draft", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const result = execFileSync(
      "node", [FLOW_CMD, "get", "prompt", "plan.draft"],
      { encoding: "utf8", env: { ...process.env, SENNEL_WORK_ROOT: tmp } },
    );
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.phase, "plan");
    assert.equal(envelope.data.step, "draft");
    assert.deepEqual(envelope.data.choices, []);
  });

  it("returns error for unknown kind", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    try {
      execFileSync(
        "node", [FLOW_CMD, "get", "prompt", "unknown.kind"],
        { encoding: "utf8", env: { ...process.env, SENNEL_WORK_ROOT: tmp } },
      );
      assert.fail("should exit non-zero");
    } catch (err) {
      const envelope = JSON.parse(err.stdout);
      assert.equal(envelope.ok, false);
      assert.equal(envelope.errors[0].level, "fatal");
    }
  });

  it("includes description field for static kinds", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const result = execFileSync(
      "node", [FLOW_CMD, "get", "prompt", "finalize.mode"],
      { encoding: "utf8", env: { ...process.env, SENNEL_WORK_ROOT: tmp } },
    );
    const envelope = JSON.parse(result);
    assert.ok(envelope.data.description);
    assert.ok(envelope.data.choices.length >= 2);
  });

  it("keeps the approval prompt read-only instead of rendering a persistent spec view", () => {
    tmp = createTmpDir();
    const fixture = setupFlowState(tmp);
    const specDir = fixture.location().directory;

    const result = execFileSync(
      "node", [
        FLOW_CMD,
        "get",
        "prompt",
        "plan.approval",
        "--expect-run-id",
        "run-001-test",
        "--expect-issue",
        "1001",
        "--expect-spec",
        "001-test",
      ],
      { encoding: "utf8", env: { ...process.env, SENNEL_WORK_ROOT: tmp } },
    );
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.artifacts, undefined);
    assert.equal(
      fs.existsSync(path.join(specDir, ".runtime", "spec-render", "spec.md")),
      false,
    );
  });

  it("uses a project approval locale override when no preset type is configured", () => {
    tmp = createTmpDir();
    const localeDirectory = path.join(tmp, ".sennel", "locale", "en");
    fs.mkdirSync(localeDirectory, { recursive: true });
    fs.writeFileSync(path.join(localeDirectory, "messages.json"), `${JSON.stringify({
      flow: {
        approvalDecision: {
          question: "Project-local approval question",
          approve: "Project-local approve",
        },
      },
    })}\n`);

    const prompt = new GetPromptCommand().execute({
      kind: "plan.approval",
      root: tmp,
      config: { lang: "en" },
      flowState: null,
    });

    assert.equal(prompt.description, "Project-local approval question");
    assert.equal(prompt.choices[0].label, "Project-local approve");
  });

  it("fails with ACTIVE_FLOW_MISMATCH when approval prompt target guard does not match", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);

    try {
      execFileSync(
        "node", [
          FLOW_CMD,
          "get",
          "prompt",
          "plan.approval",
          "--expect-run-id",
          "run-001-test",
          "--expect-issue",
          "1002",
          "--expect-spec",
          "001-test",
        ],
        { encoding: "utf8", env: { ...process.env, SENNEL_WORK_ROOT: tmp } },
      );
      assert.fail("should exit non-zero");
    } catch (err) {
      const envelope = JSON.parse(err.stdout);
      assert.equal(envelope.ok, false);
      assert.equal(envelope.errors[0].code, "ACTIVE_FLOW_MISMATCH");
      assert.equal(envelope.data.expectedIssue, 1002);
      assert.equal(envelope.data.activeIssue, 1001);
      assert.equal(envelope.data.expectedRunId, "run-001-test");
      assert.equal(envelope.data.activeRunId, "run-001-test");
      assert.equal(envelope.data.expectedSpec, "001-test");
      assert.equal(envelope.data.activeSpec, "001-test");
    }
  });

  it("keeps the explicitly selected approval prompt read-only when multiple flows are active", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const second = setupFlowState(tmp, {
      specId: "002-second",
      runId: "run-002-second",
      issue: 1002,
      taskId: "T-2",
    });
    const specDir = second.location().directory;

    const manager = makeFlowManager(tmp);
    const target = manager.resolveExplicitFlowTarget(new FlowTargetExpectation({
      expectRunId: "run-002-second",
      expectIssue: 1002,
      expectSpec: "002-second",
    }));
    assert.equal(target.specId, "002-second");
    const result = new GetPromptCommand().execute({
      kind: "plan.approval",
      config: { lang: "en" },
      root: tmp,
      flowManager: manager.forRoot(tmp, { specId: target.specId }),
      flowState: target.state,
    });
    assert.equal(result.artifacts, undefined);
    assert.equal(
      fs.existsSync(path.join(specDir, ".runtime", "spec-render", "spec.md")),
      false,
    );
  });

  it("finalize.merge-strategy is removed as a known kind", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    try {
      execFileSync(
        "node", [FLOW_CMD, "get", "prompt", "finalize.merge-strategy"],
        { encoding: "utf8", env: { ...process.env, SENNEL_WORK_ROOT: tmp } },
      );
      assert.fail("finalize.merge-strategy should no longer be a known kind");
    } catch (err) {
      const envelope = JSON.parse(err.stdout);
      assert.equal(envelope.ok, false);
      assert.ok(
        envelope.errors[0].messages[0].includes("unknown kind"),
        `error should mention unknown kind: ${envelope.errors[0].messages[0]}`,
      );
    }
  });
});
