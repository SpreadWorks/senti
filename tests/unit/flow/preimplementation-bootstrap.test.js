import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { findActiveNode } from "../../../src/flow/definition.js";
import { attachCanonicalCommandResultArtifact } from "../../../src/flow/lib/canonical-command-result.js";
import GetNextActionCommand from "../../../src/flow/lib/get-next-action.js";
import RunPreimplementationBootstrapCommand, {
  inspectPreimplementationBootstrap,
} from "../../../src/flow/lib/run-preimplementation-bootstrap.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { FlowAtStepFixture, makeFlowManager } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

let root;

afterEach(() => {
  if (root) removeTmpDir(root);
  root = null;
});

function scenarioValidityBlock({ invalidPaths = ["src/flow/lib/run-scenario-validity.js"] } = {}) {
  return {
    version: "1",
    result: "block",
    preflight: { invalid_paths: invalidPaths },
  };
}

function publishScenarioValidity(flowManager, specId, payload) {
  flowManager.publishCurrentAttemptResult({
    specId,
    commandResult: attachCanonicalCommandResultArtifact({ result: "block" }, {
      logicalKey: "scenario.validity",
      payload,
    }),
  });
}

function bootstrapFixture({ issue = null, payload = scenarioValidityBlock() } = {}) {
  root = createTmpDir("preimplementation-bootstrap-");
  const specId = "001-bootstrap";
  const flowManager = makeFlowManager(root);
  const fixture = new FlowAtStepFixture({
    flowManager,
    specId,
    runId: "bootstrap-run",
    request: "Recover existing bootstrap work.",
    execution: { mode: "branch", baseBranch: "main", featureBranch: "feature/001-bootstrap" },
    issue,
    specRecord: { goal: "Recover existing bootstrap work.", requirements: [] },
    targetStep: "scenario-validity",
  }).create();
  publishScenarioValidity(flowManager, specId, payload);
  return { specId, flowManager, state: fixture.state() };
}

test("preimplementation bootstrap records canonical preflight recovery and resumes implement", () => {
  const { specId, flowManager, state } = bootstrapFixture();

  const result = new RunPreimplementationBootstrapCommand().execute({
    root,
    flowState: state,
    flowManager,
    expectRunId: state.runId,
    expectSpec: state.specId,
    expectNoIssue: true,
  });

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.data.preflightInvalidPaths, ["src/flow/lib/run-scenario-validity.js"]);
  const refreshed = flowManager.loadReadOnly(specId);
  assert.equal(findActiveNode(refreshed)?.stepId, "implement");
  assert.equal(findStepById(refreshed.steps, "scenario-validity")?.status, "skipped");
  assert.equal(findStepById(refreshed.steps, "test-review")?.status, "skipped");
  assert.equal(findStepById(refreshed.steps, "implement")?.status, "in_progress");
  assert.equal(flowManager.activityLedger(specId).at(-1).transition.operation, "preimplementation_bootstrap");
});

test("next action dispatches a guarded canonical preimplementation bootstrap recovery", async () => {
  const { flowManager, state } = bootstrapFixture({ issue: 473 });
  const plan = inspectPreimplementationBootstrap({ flowManager, state });

  assert.deepEqual(plan?.invalidPaths, ["src/flow/lib/run-scenario-validity.js"]);

  const result = await new GetNextActionCommand().execute({
    root,
    flowState: state,
    flowManager,
  });

  assert.equal(result.directive.kind, "execute_command");
  assert.equal(result.directive.actionId, "RECOVER_PREIMPLEMENTATION_BOOTSTRAP");
  assert.match(result.directive.nextAction, /^sennel flow run preimplementation-bootstrap /);
  assert.match(result.directive.nextAction, /--expect-run-id 'bootstrap-run'/);
  assert.match(result.directive.nextAction, /--expect-spec '001-bootstrap'/);
  assert.match(result.directive.nextAction, /--expect-issue 473/);
});

test("preimplementation bootstrap rejects a scenario-validity Attempt without a preflight block", () => {
  const { flowManager, state } = bootstrapFixture({
    payload: { version: "1", result: "pass", summary: [] },
  });

  const result = new RunPreimplementationBootstrapCommand().execute({
    root,
    flowState: state,
    flowManager,
    expectRunId: state.runId,
    expectSpec: state.specId,
    expectNoIssue: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "PREIMPLEMENTATION_BOOTSTRAP_EVIDENCE_INVALID");
});
