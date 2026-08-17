// spec: R11
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import * as reviewCommand from "../../../src/flow/commands/review.js";
import * as runGate from "../../../src/flow/lib/run-gate.js";

const workUnitModuleUrl = new URL("../../../src/flow/lib/work-unit.js", import.meta.url);

async function loadWorkUnitModule() {
  assert.equal(fs.existsSync(workUnitModuleUrl), true, "src/flow/lib/work-unit.js must exist");
  return import(workUnitModuleUrl);
}

test("R11: retained review and gate surfaces do not create WorkUnit checkpoints", async () => {
  const {
    createMemoryWorkUnitCheckpointStore,
    shouldUseWorkUnitsForReviewPhase,
  } = await loadWorkUnitModule();
  assert.equal(typeof shouldUseWorkUnitsForReviewPhase, "function");
  assert.equal(typeof reviewCommand.runSingleShotImplReviewWithDependencies, "function");
  assert.equal(typeof reviewCommand.runNonImplReviewWithDependencies, "function");
  assert.equal(typeof runGate.runGatePhaseWithDependencies, "function");

  assert.equal(shouldUseWorkUnitsForReviewPhase({ phase: "impl", mode: "loop" }), true);
  assert.equal(shouldUseWorkUnitsForReviewPhase({ phase: "impl", mode: "single-shot" }), false);
  assert.equal(shouldUseWorkUnitsForReviewPhase({ phase: "impl-gate", mode: "gate" }), false);
  assert.equal(shouldUseWorkUnitsForReviewPhase({ phase: "integration-gate", mode: "gate" }), false);
  assert.equal(shouldUseWorkUnitsForReviewPhase({ phase: "test-review", mode: "review" }), false);
  assert.equal(shouldUseWorkUnitsForReviewPhase({ phase: "draft-review", mode: "review" }), false);
  assert.equal(shouldUseWorkUnitsForReviewPhase({ phase: "spec-review", mode: "review" }), false);

  const specDir = fs.mkdtempSync(path.join(os.tmpdir(), "senti-retained-surfaces-"));
  const checkpointDir = path.join(specDir, "review-history", "work-units");
  const checkpointStore = createMemoryWorkUnitCheckpointStore({ specDir, namespace: "impl-review" });

  await reviewCommand.runSingleShotImplReviewWithDependencies({
    specDir,
    checkpointStore,
    reviewText: JSON.stringify({ blockingFindings: [], nonBlockingImprovements: [] }),
  });
  for (const phase of ["test", "draft", "spec"]) {
    await reviewCommand.runNonImplReviewWithDependencies({
      phase,
      specDir,
      checkpointStore,
      reviewText: JSON.stringify({ verdict: "PASS", findings: [] }),
    });
  }
  for (const phase of ["task-impl", "integration"]) {
    await runGate.runGatePhaseWithDependencies({
      phase,
      specDir,
      checkpointStore,
      gateResult: { verdict: "PASS", observations: [] },
    });
  }

  assert.equal(fs.existsSync(checkpointDir), false);
  assert.deepEqual(checkpointStore.recordsByNamespace("impl-review"), []);
});
