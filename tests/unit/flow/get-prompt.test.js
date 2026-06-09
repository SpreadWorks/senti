/**
 * tests/unit/flow/get-prompt.test.js
 *
 * Tests for `flow get prompt <kind>` — returns structured prompt data.
 */

import { describe, it, afterEach } from "node:test";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { join } from "path";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
const FLOW_CMD = join(process.cwd(), "src/flow.js");

describe("flow get prompt", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupFlowState(dir) {
    const specId = "001-test";
    const state = {
      spec: `specs/${specId}/spec.md`,
      baseBranch: "main",
      featureBranch: "feature/001-test",
      steps: buildInitialSteps(),
      requirements: [],
      tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
      currentTaskId: null,
    };
    makeFlowManager(dir).save(state);
    makeFlowManager(dir).addActiveFlow(specId, "local");
  }

  function writeSpecJson(dir, specId = "001-test") {
    const specDir = path.join(dir, "specs", specId);
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, "spec.json"), JSON.stringify({
      goal: "Approval view goal",
      background: "",
      scope: { in: [], out: [] },
      constraints: [],
      design_principles: [],
      overview: { modules: [], data_flow: [], decisions: [] },
      requirements: [{ id: "R1", desc: "Approve this." }],
      acceptance_criteria: ["Approved."],
      clarifications: [],
      alternatives_considered: [],
      open_questions: [],
      tasks: [{ id: "T-1", title: "Task one", goal: "Task goal", parent: null, origin: "plan", added_round: 0, status: "pending" }],
    }, null, 2));
    return specDir;
  }

  it("returns error for removed plan.approach kind", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    try {
      execFileSync(
        "node", [FLOW_CMD, "get", "prompt", "plan.approach"],
        { encoding: "utf8", env: { ...process.env, SENTI_WORK_ROOT: tmp } },
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
      { encoding: "utf8", env: { ...process.env, SENTI_WORK_ROOT: tmp } },
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
        { encoding: "utf8", env: { ...process.env, SENTI_WORK_ROOT: tmp } },
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
      { encoding: "utf8", env: { ...process.env, SENTI_WORK_ROOT: tmp } },
    );
    const envelope = JSON.parse(result);
    assert.ok(envelope.data.description);
    assert.ok(envelope.data.choices.length >= 2);
  });

  it("renders spec.md for the approval prompt from spec.json", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const specDir = writeSpecJson(tmp);

    const result = execFileSync(
      "node", [FLOW_CMD, "get", "prompt", "plan.approval"],
      { encoding: "utf8", env: { ...process.env, SENTI_WORK_ROOT: tmp } },
    );
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    const md = fs.readFileSync(path.join(specDir, "spec.md"), "utf8");
    assert.match(md, /Approval view goal/);
    assert.match(md, /R1/);
    assert.deepEqual(envelope.data.artifacts.specView, [
      "specs/001-test/spec.md",
      "specs/001-test/tasks/T-1.md",
    ]);
  });

  it("finalize.merge-strategy is removed as a known kind", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    try {
      execFileSync(
        "node", [FLOW_CMD, "get", "prompt", "finalize.merge-strategy"],
        { encoding: "utf8", env: { ...process.env, SENTI_WORK_ROOT: tmp } },
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
