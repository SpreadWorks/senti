/**
 * tests/unit/flow/resolve-active-flow.test.js
 *
 * Tests for the makeFlowManager().resolveActiveFlow() shared helper in flow-state.js.
 */

import { describe, it, afterEach } from "node:test";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import assert from "node:assert/strict";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
describe("resolveActiveFlow", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupFlow(dir, specId = "001-test") {
    const state = {
      spec: `specs/${specId}/spec.md`,
      baseBranch: "main",
      featureBranch: `feature/${specId}`,
      steps: buildInitialSteps(),
      requirements: [],
      tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
      currentTaskId: null,
    };
    makeFlowManager(dir).save(state);
    makeFlowManager(dir).addActiveFlow(specId, "local");
    return state;
  }

  it("returns flow from flowState when provided", () => {
    tmp = createTmpDir();
    const state = setupFlow(tmp);
    const result = makeFlowManager(tmp).resolveActiveFlow(state);
    assert.ok(result);
    assert.equal(result.specId, "001-test");
    assert.deepEqual(result.state.spec, state.spec);
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

  it("throws when multiple active flows exist", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "001-first");
    // Add a second active flow
    const state2 = {
      spec: "specs/002-second/spec.md",
      baseBranch: "main",
      featureBranch: "feature/002-second",
      steps: buildInitialSteps(),
      requirements: [],
    };
    makeFlowManager(tmp).save(state2);
    makeFlowManager(tmp).addActiveFlow("002-second", "local");

    assert.throws(
      () => makeFlowManager(tmp).resolveActiveFlow(null),
      /multiple active flows/i,
    );
  });
});
