import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import {
  CanonicalAutoCheckInputError,
  isSpecApproved,
  resolveAutoCheckInputForFlow,
  resolvePreparingAutoCheckInput,
} from "../../../src/flow/lib/resolve-auto-check-input.js";
import { CanonicalAutoCheckScenario, makeFlowManager } from "../../support/infrastructure/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";

describe("resolve-auto-check-input — canonical and preparing authorities", () => {
  let root;

  beforeEach(() => { root = createTmpDir("resolve-input-"); });
  afterEach(() => { removeTmpDir(root); });

  function stepsWith(doneIds = []) {
    const steps = buildInitialSteps();
    for (const id of doneIds) {
      const step = findStepById(steps, id);
      if (step) step.status = "done";
    }
    return steps;
  }

  function canonical({ issue = null, request = "implement X", draft = null, approval = false } = {}) {
    const flowManager = makeFlowManager(root);
    const scenario = new CanonicalAutoCheckScenario({
      flowManager,
      specId: "001-test",
      runId: "run-001-test",
      issue,
      request,
      execution: { mode: "direct" },
    }).create();
    if (draft !== null) scenario.draftGateDone(draft);
    if (approval) scenario.approvalDone();
    return { flowManager, scenario };
  }

  function resolveCanonical(fixture) {
    return resolveAutoCheckInputForFlow({
      flowManager: fixture.flowManager,
      state: fixture.scenario.state(),
    });
  }

  it("detects a completed approval Step", () => {
    assert.equal(isSpecApproved({ steps: stepsWith(["approval"]) }), true);
  });

  it("does not treat a pending approval Step as approved", () => {
    assert.equal(isSpecApproved({ steps: stepsWith([]) }), false);
  });

  it("does not confuse a completed gate with approval", () => {
    assert.equal(isSpecApproved({ steps: stepsWith(["gate"]) }), false);
  });

  it("treats malformed non-persisted input as unapproved", () => {
    assert.equal(isSpecApproved({}), false);
    assert.equal(isSpecApproved(null), false);
  });

  it("reads request and linked Issue snapshot from the canonical catalog", () => {
    const output = resolveCanonical(canonical({ issue: 42, request: "add logging" }));
    assert.equal(output.skip, false);
    assert.match(output.text, /add logging/);
    assert.match(output.text, /Issue #42/);
  });

  it("appends the cataloged draft after draft-gate", () => {
    const output = resolveCanonical(canonical({
      issue: 10,
      request: "implement X",
      draft: JSON.stringify({ goal: "DRAFT_MARKER 内容が続く" }),
    }));
    assert.equal(output.skip, false);
    assert.match(output.text, /implement X[\s\S]*DRAFT_MARKER/);
    assert.deepEqual(output.goalGate, { checked: true, passed: true });
  });

  it("fails closed when a cataloged draft disappears", () => {
    const fixture = canonical({ draft: JSON.stringify({ goal: "saved" }) });
    const artifact = fixture.flowManager.readArtifact({
      specId: fixture.scenario.specId,
      logicalKey: "draft",
      consumerNodeId: "spec",
    });
    fs.unlinkSync(fixture.scenario.flow.location().resolve(artifact.relativePath));
    assert.throws(() => resolveCanonical(fixture), /Version authority path does not exist/);
  });

  it("skips evaluation after canonical approval", () => {
    const output = resolveCanonical(canonical({ issue: 10, approval: true }));
    assert.deepEqual(output, { skip: true, reason: "spec approved" });
  });

  it("approval takes precedence over an existing cataloged draft", () => {
    const output = resolveCanonical(canonical({
      issue: 10,
      draft: JSON.stringify({ goal: "ignored draft" }),
      approval: true,
    }));
    assert.equal(output.skip, true);
  });

  it("uses request and Issue number for a pre-creation record", () => {
    const output = resolvePreparingAutoCheckInput({ issue: 10, request: "implement X", steps: [] });
    assert.equal(output.skip, false);
    assert.match(output.text, /implement X[\s\S]*Issue #10/);
  });

  it("uses a captured preparing Issue body instead of the number literal", () => {
    const output = resolvePreparingAutoCheckInput({
      issue: 77,
      request: "implement Y",
      issueBody: "ISSUE_BODY_MARKER 詳細説明",
      steps: [],
    });
    assert.match(output.text, /implement Y[\s\S]*ISSUE_BODY_MARKER/);
    assert.doesNotMatch(output.text, /Issue #77/);
  });

  it("fails closed when a canonical linked-Issue snapshot disappears", () => {
    const fixture = canonical({ issue: 99, request: "implement W" });
    const artifact = fixture.flowManager.readArtifact({
      specId: fixture.scenario.specId,
      logicalKey: "issue.snapshot",
      consumerNodeId: "draft",
    });
    fs.unlinkSync(fixture.scenario.flow.location().resolve(artifact.relativePath));
    assert.throws(() => resolveCanonical(fixture), /Version authority path does not exist/);
  });

  it("falls back to the Issue number only before canonical creation", () => {
    const output = resolvePreparingAutoCheckInput({ issue: 55, request: "implement V", steps: [] });
    assert.match(output.text, /Issue #55/);
  });

  it("treats an empty preparing Issue body as absent", () => {
    const output = resolvePreparingAutoCheckInput({ issue: 1, request: "rq", issueBody: "", steps: [] });
    assert.match(output.text, /Issue #1/);
  });

  it("rejects routing a prepared Flow through the preparing input API", () => {
    assert.throws(
      () => resolvePreparingAutoCheckInput({ specId: "001-test", request: "invalid" }),
      CanonicalAutoCheckInputError,
    );
  });
});
