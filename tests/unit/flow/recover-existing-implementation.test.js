import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { attachCanonicalCommandResultArtifact } from "../../../src/flow/lib/canonical-command-result.js";
import RunRecoverExistingImplementationCommand from "../../../src/flow/lib/run-recover-existing-implementation.js";
import { findActiveNode } from "../../../src/flow/definition.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { FlowAtStepFixture, makeFlowManager } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const SPEC_ID = "001-existing-implementation";

describe("recover existing implementation", () => {
  let root;

  afterEach(() => {
    if (root) removeTmpDir(root);
    root = null;
  });

  function fixture({ payload = { version: "1", result: "block", preflight: { invalid_paths: ["src/implementation.js"] } } } = {}) {
    root = createTmpDir("recover-existing-implementation-");
    const flowManager = makeFlowManager(root);
    const scenario = new FlowAtStepFixture({
      flowManager,
      specId: SPEC_ID,
      runId: "run-existing-implementation",
      request: "Revalidate an already implemented flow.",
      execution: { mode: "branch", baseBranch: "main", featureBranch: "feature/001-existing-implementation" },
      specRecord: { goal: "Revalidate an already implemented flow.", requirements: [] },
      targetStep: "scenario-validity",
    }).create();
    flowManager.publishCurrentAttemptResult({
      specId: SPEC_ID,
      commandResult: attachCanonicalCommandResultArtifact({ result: "block" }, {
        logicalKey: "scenario.validity",
        payload,
      }),
    });
    return { flowManager, state: scenario.state() };
  }

  it("records the fixed canonical recovery Activity and promotes post-implementation verification", () => {
    const { flowManager, state } = fixture();

    const result = new RunRecoverExistingImplementationCommand().execute({
      root,
      flowState: state,
      flowManager,
      expectRunId: state.runId,
      expectSpec: state.specId,
      expectNoIssue: true,
    });

    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.data.activeStep, "test-execute");
    assert.deepEqual(result.data.skipped, ["scenario-validity", "test-review"]);
    assert.deepEqual(result.data.preflightInvalidPaths, ["src/implementation.js"]);
    const refreshed = flowManager.loadReadOnly(SPEC_ID);
    assert.equal(findActiveNode(refreshed)?.stepId, "test-execute");
    assert.equal(findStepById(refreshed.steps, "scenario-validity")?.status, "skipped");
    assert.equal(findStepById(refreshed.steps, "test-review")?.status, "skipped");
    assert.equal(findStepById(refreshed.steps, "implement")?.status, "done");
    assert.equal(findStepById(refreshed.steps, "test-execute")?.status, "in_progress");
    assert.equal(flowManager.activityLedger(SPEC_ID).at(-1).transition.operation, "recover_existing_implementation");
    const historicalScenario = JSON.parse(flowManager.readArtifact({
      specId: SPEC_ID,
      logicalKey: "scenario.validity",
      consumerNodeId: "implement",
    }).bytes.toString("utf8"));
    assert.deepEqual(historicalScenario.attempts.at(-1).artifact.payload.preflight.invalid_paths, ["src/implementation.js"]);
  });

  it("rejects missing exact target guards before reading canonical evidence", () => {
    const { flowManager, state } = fixture();

    const result = new RunRecoverExistingImplementationCommand().execute({
      root,
      flowState: state,
      flowManager,
    });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "EXISTING_IMPLEMENTATION_RECOVERY_GUARDS_REQUIRED");
    assert.match(result.errors[0].messages.join(" "), /--expect-run-id/);
  });

  it("rejects scenario-validity history without an implementation-target preflight block", () => {
    const { flowManager, state } = fixture({ payload: { version: "1", result: "pass", summary: [] } });

    const result = new RunRecoverExistingImplementationCommand().execute({
      root,
      flowState: state,
      flowManager,
      expectRunId: state.runId,
      expectSpec: state.specId,
      expectNoIssue: true,
    });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "EXISTING_IMPLEMENTATION_RECOVERY_EVIDENCE_INVALID");
  });

  it("exposes the guarded recovery command through the flow registry", () => {
    const entry = FLOW_COMMANDS.run["recover-existing-implementation"];
    assert.ok(entry);
    assert.match(entry.help, /Usage: sennel flow run recover-existing-implementation/);
    assert.ok(entry.args.options.includes("--expect-run-id"));
  });
});
