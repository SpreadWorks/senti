/**
 * tests/unit/flow/resolve-active-flow.test.js
 *
 * Tests for the makeFlowManager().resolveActiveFlow() shared helper in flow-state.js.
 */

import { describe, it, afterEach } from "node:test";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { FlowTargetExpectation } from "../../../src/lib/flow-target-guard.js";
describe("resolveActiveFlow", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupFlow(dir, specId = "001-test", issue = Number(specId.slice(0, 3))) {
    const state = {
      specId: specId,
      baseBranch: "main",
      featureBranch: `feature/${specId}`,
      runId: `run-${specId}`,
      steps: buildInitialSteps(),
      requirements: [],
      tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
      currentTaskId: null,
    };
    if (issue != null) state.issue = issue;
    makeFlowManager(dir).create(state);
    makeFlowManager(dir).addActiveFlow(specId, "local");
    return state;
  }

  it("returns flow from flowState when provided", () => {
    tmp = createTmpDir();
    const state = setupFlow(tmp);
    const result = makeFlowManager(tmp).resolveActiveFlow(state);
    assert.ok(result);
    assert.equal(result.specId, "001-test");
    assert.equal(result.state.specId, state.specId);
  });

  it("accepts an exact AND selector set against a preloaded flow", () => {
    tmp = createTmpDir();
    const state = setupFlow(tmp, "001-bound", 443);

    const result = makeFlowManager(tmp).resolveActiveFlow(state, {
      selectRunId: "run-001-bound",
      selectIssue: 443,
      selectSpecId: "001-bound",
    });

    assert.equal(result.state, state);
    assert.equal(result.specId, "001-bound");
  });

  it("rejects a conflicting selector against a preloaded flow without returning another flow", () => {
    tmp = createTmpDir();
    const state = setupFlow(tmp, "001-bound", 443);
    setupFlow(tmp, "002-foreign", 444);
    let returned = null;

    assert.throws(
      () => {
        returned = makeFlowManager(tmp).resolveActiveFlow(state, {
          selectRunId: "run-001-bound",
          selectIssue: 444,
          selectSpecId: "001-bound",
        });
      },
      (error) => error.code === "ACTIVE_FLOW_MISMATCH"
        && error.data?.expectedRunId === "run-001-bound"
        && error.data?.activeRunId === "run-001-bound"
        && error.data?.expectedIssue === 444
        && error.data?.activeIssue === 443,
    );
    assert.equal(returned, null);
  });

  // spec: R8
  it("requires one AND match instead of first-candidate or selector-OR fallback", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "001-first", 443);
    setupFlow(tmp, "002-second", 443);
    setupFlow(tmp, "003-foreign", 444);
    const manager = makeFlowManager(tmp);

    const exact = manager.resolveActiveFlow(null, {
      selectRunId: "run-002-second",
      selectIssue: 443,
      selectSpecId: "002-second",
    });
    assert.equal(exact.specId, "002-second");

    assert.throws(
      () => manager.resolveActiveFlow(null, { selectIssue: 443 }),
      (error) => error.code === "FLOW_TARGET_AMBIGUOUS"
        && error.data?.matchCount === 2,
    );
    assert.throws(
      () => manager.resolveActiveFlow(null, {
        selectRunId: "run-001-first",
        selectIssue: 444,
      }),
      (error) => error.code === "FLOW_TARGET_NOT_FOUND"
        && error.data?.matchCount === 0,
    );
  });

  // spec: R9
  it("classifies preparing targets as exact, ambiguous, or not found without selecting an active flow", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "001-active", 445);
    const manager = makeFlowManager(tmp);
    manager.createPreparingFlow("run-preparing-first", { issue: 446, request: "first" });
    manager.createPreparingFlow("run-preparing-second", { issue: 446, request: "second" });

    const exact = manager.resolveExplicitFlowTarget(new FlowTargetExpectation({
      expectRunId: "run-preparing-second",
      expectIssue: 446,
    }));
    assert.equal(exact.preparing, true);
    assert.equal(exact.state.runId, "run-preparing-second");

    assert.throws(
      () => manager.resolveExplicitFlowTarget(new FlowTargetExpectation({ expectIssue: 446 })),
      (error) => error.code === "FLOW_TARGET_AMBIGUOUS"
        && error.data?.matchCount === 2,
    );
    assert.throws(
      () => manager.resolveExplicitFlowTarget(new FlowTargetExpectation({
        expectRunId: "run-preparing-second",
        expectIssue: 445,
      })),
      (error) => error.code === "FLOW_TARGET_NOT_FOUND"
        && error.data?.matchCount === 0,
    );
  });

  it("falls back to loadActiveFlows when flowState is null", () => {
    tmp = createTmpDir();
    setupFlow(tmp);
    const result = makeFlowManager(tmp).resolveActiveFlow(null);
    assert.ok(result);
    assert.equal(result.specId, "001-test");
  });

  it("returns null when no flow exists", () => {
    tmp = createTmpDir();
    const result = makeFlowManager(tmp).resolveActiveFlow(null);
    assert.equal(result, null);
  });

  it("does not discover unregistered branch or worktree flow files during normal active resolution", () => {
    tmp = createTmpDir();
    for (const specId of ["001-stale", "002-stale"]) {
      const specDir = path.join(tmp, "specs", specId);
      fs.mkdirSync(specDir, { recursive: true });
      fs.writeFileSync(path.join(specDir, "flow.json"), JSON.stringify({
        specId: specId,
        baseBranch: "main",
        featureBranch: `feature/${specId}`,
        steps: buildInitialSteps(),
        requirements: [],
        tasks: [],
        currentTaskId: null,
      }));
    }

    const result = makeFlowManager(tmp).resolveActiveFlow(null);
    assert.equal(result, null);
  });

  it("throws when multiple active flows exist", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "001-first");
    // Add a second active flow
    const state2 = {
      specId: "002-second",
      baseBranch: "main",
      featureBranch: "feature/002-second",
      runId: "run-002-second",
      issue: 2,
      steps: buildInitialSteps(),
      requirements: [],
    };
    makeFlowManager(tmp).create(state2);
    makeFlowManager(tmp).addActiveFlow("002-second", "local");

    assert.throws(
      () => makeFlowManager(tmp).resolveActiveFlow(null),
      /multiple active flows/i,
    );
  });

  it("selects a specific flow via opts.selectSpecId when multiple are active", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "001-first");
    const state2 = {
      specId: "002-second",
      baseBranch: "main",
      featureBranch: "feature/002-second",
      runId: "run-002-second",
      issue: 2,
      steps: buildInitialSteps(),
      requirements: [],
    };
    makeFlowManager(tmp).create(state2);
    makeFlowManager(tmp).addActiveFlow("002-second", "local");

    const result = makeFlowManager(tmp).resolveActiveFlow(null, { selectSpecId: "002-second" });
    assert.ok(result);
    assert.equal(result.specId, "002-second");
  });

  it("selects a specific flow via opts.selectRunId when multiple are active", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "001-first");
    const state2 = {
      specId: "002-second",
      baseBranch: "main",
      featureBranch: "feature/002-second",
      runId: "run-002-second",
      issue: 2,
      steps: buildInitialSteps(),
      requirements: [],
    };
    makeFlowManager(tmp).create(state2);
    makeFlowManager(tmp).addActiveFlow("002-second", "local");

    const result = makeFlowManager(tmp).resolveActiveFlow(null, { selectRunId: "run-002-second" });
    assert.ok(result);
    assert.equal(result.specId, "002-second");
  });

  it("selects a specific flow via opts.selectIssue when multiple are active", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "001-first");
    const state2 = {
      specId: "002-second",
      baseBranch: "main",
      featureBranch: "feature/002-second",
      runId: "run-002-second",
      issue: 222,
      steps: buildInitialSteps(),
      requirements: [],
    };
    makeFlowManager(tmp).create(state2);
    makeFlowManager(tmp).addActiveFlow("002-second", "local");

    const result = makeFlowManager(tmp).resolveActiveFlow(null, { selectIssue: 222 });
    assert.ok(result);
    assert.equal(result.specId, "002-second");
  });

  it("selects the unique Issue-less flow via opts.selectNoIssue", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "001-with-issue", 1);
    setupFlow(tmp, "002-no-issue", null);

    const result = makeFlowManager(tmp).resolveActiveFlow(null, { selectNoIssue: true });

    assert.equal(result.specId, "002-no-issue");
    assert.equal(Object.hasOwn(result.state, "issue"), false);
  });

  it("returns the structured not-found error when no Issue-less flow is active", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "001-first", 1);
    setupFlow(tmp, "002-second", 2);

    assert.throws(
      () => makeFlowManager(tmp).resolveActiveFlow(null, { selectNoIssue: true }),
      (error) => error.code === "FLOW_TARGET_NOT_FOUND"
        && error.data?.matchCount === 0
        && error.data?.expectedIssue === null
        && /not found.*no Issue/i.test(error.message),
    );
  });

  it("returns the structured ambiguity error when multiple Issue-less flows are active", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "001-first", null);
    setupFlow(tmp, "002-second", null);

    assert.throws(
      () => makeFlowManager(tmp).resolveActiveFlow(null, { selectNoIssue: true }),
      (error) => error.code === "FLOW_TARGET_AMBIGUOUS"
        && error.data?.matchCount === 2
        && error.data?.expectedIssue === null
        && /ambiguous.*no Issue/i.test(error.message),
    );
  });

  it("throws a clear error when selectSpecId is not in active flows", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "001-first");

    assert.throws(
      () => makeFlowManager(tmp).resolveActiveFlow(null, { selectSpecId: "999-bogus" }),
      (error) => error.code === "FLOW_TARGET_NOT_FOUND"
        && error.data?.expectedSpec === "999-bogus",
    );
  });
});
