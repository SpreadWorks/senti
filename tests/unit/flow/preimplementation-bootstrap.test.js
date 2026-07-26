import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";

import { FlowManager } from "../../../src/lib/flow-manager.js";
import { findActiveNode } from "../../../src/flow/definition.js";
import RunPreimplementationBootstrapCommand from "../../../src/flow/lib/run-preimplementation-bootstrap.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { makeFlowState, moveFlowToStep } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

let tmp;

afterEach(() => {
  if (tmp) removeTmpDir(tmp);
  tmp = null;
});

function writeJson(root, relativePath, value) {
  const file = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

test("preimplementation bootstrap records the preflight recovery and resumes implement", () => {
  tmp = createTmpDir("preimplementation-bootstrap-");
  const spec = "specs/001-bootstrap/spec.json";
  writeJson(tmp, spec, { goal: "Recover existing bootstrap work.", requirements: [] });
  writeJson(tmp, "specs/001-bootstrap/scenario-validity-result.json", {
    version: "1",
    result: "block",
    preflight: { invalid_paths: ["src/flow/lib/run-scenario-validity.js"] },
  });
  const state = moveFlowToStep(makeFlowState({
    runId: "bootstrap-run",
    spec,
    repairBaseline: { ref: "refs/senti/flows/bootstrap-run/baseline" },
  }), "scenario-validity");
  const manager = new FlowManager({ root: tmp, mainRoot: tmp, inWorktree: false });
  manager.create(state);
  manager.addActiveFlow("001-bootstrap", "branch");
  const activeState = manager.loadReadOnly();

  const result = new RunPreimplementationBootstrapCommand().execute({
    root: tmp,
    flowState: activeState,
    flowManager: manager,
    expectRunId: activeState.runId,
    expectSpec: activeState.spec,
    expectNoIssue: true,
  });

  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.data.preflightInvalidPaths, ["src/flow/lib/run-scenario-validity.js"]);
  const refreshed = manager.loadReadOnly();
  assert.equal(findActiveNode(refreshed)?.stepId, "implement");
  assert.equal(findStepById(refreshed.steps, "scenario-validity")?.status, "skipped");
  assert.equal(findStepById(refreshed.steps, "test-review")?.status, "skipped");
  assert.equal(findStepById(refreshed.steps, "implement")?.status, "in_progress");
});

test("preimplementation bootstrap rejects a missing preflight block", () => {
  tmp = createTmpDir("preimplementation-bootstrap-evidence-");
  const spec = "specs/001-bootstrap/spec.json";
  writeJson(tmp, spec, { goal: "Reject missing evidence.", requirements: [] });
  const state = moveFlowToStep(makeFlowState({
    runId: "bootstrap-run",
    spec,
    repairBaseline: { ref: "refs/senti/flows/bootstrap-run/baseline" },
  }), "scenario-validity");
  const manager = new FlowManager({ root: tmp, mainRoot: tmp, inWorktree: false });
  manager.create(state);
  manager.addActiveFlow("001-bootstrap", "branch");

  const result = new RunPreimplementationBootstrapCommand().execute({
    root: tmp,
    flowState: manager.loadReadOnly(),
    flowManager: manager,
    expectRunId: state.runId,
    expectSpec: state.spec,
    expectNoIssue: true,
  });

  assert.equal(result.ok, false);
  assert.equal(result.errors[0].code, "PREIMPLEMENTATION_BOOTSTRAP_EVIDENCE_INVALID");
});
