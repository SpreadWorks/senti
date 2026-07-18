// spec: R7
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseImplReviewFindings, runImplReview } from "../../../src/flow/commands/review.js";
import GetNextActionCommand from "../../../src/flow/lib/get-next-action.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { targetMismatchEnvelopeForInput } from "../../../src/lib/flow-target-guard.js";
import { findStepById, flattenSteps } from "../../../src/flow/lib/step-tree.js";
import { makeFlowManager } from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { reviewMetricPayload } from "./fixture-assertions.js";

function improvement(index, requirementId = "R7") {
  return {
    title: `Improvement ${index}`,
    failureMode: "refactor",
    file: "src/example.js",
    requirementId,
    issue: `Observable issue ${index}.`,
    suggestion: `Replace branch ${index}.`,
    rationale: "Requirement-scoped review evidence.",
  };
}

describe("impl-review large output and resume", () => {
  it("R7: validates exactly 41 findings and resumes guarded impl-review state", async () => {
    const requirementIds = new Set(["R7"]);
    const valid = Array.from({ length: 41 }, (_, index) => improvement(index + 1));
    const parsed = parseImplReviewFindings(JSON.stringify({
      blockingFindings: [],
      nonBlockingImprovements: valid,
    }), { requirementIds });
    assert.equal(parsed.nonBlockingImprovements.length, 41);

    const invalid = valid.map((item) => ({ ...item }));
    invalid[40].requirementId = "R404";
    assert.throws(() => parseImplReviewFindings(JSON.stringify({
      blockingFindings: [],
      nonBlockingImprovements: invalid,
    }), { requirementIds }), /requirementId|schema/i);

    const root = createTmpDir();
    try {
      const specId = "001-resume";
      fs.mkdirSync(path.join(root, "specs", specId), { recursive: true });
      fs.writeFileSync(path.join(root, "specs", specId, "spec.json"), JSON.stringify({ requirements: [] }));
      const steps = buildInitialSteps();
      for (const step of flattenSteps(steps)) step.status = "pending";
      findStepById(steps, "impl-review").status = "in_progress";
      const state = {
        spec: `specs/${specId}/spec.json`,
        runId: "resume-run-id",
        issue: 437,
        baseBranch: "main",
        featureBranch: "feature/001-resume",
        steps,
        metrics: [],
        requirements: [],
        tasks: [],
        currentTaskId: null,
      };
      const manager = makeFlowManager(root);
      manager.create(state);
      manager.addActiveFlow(specId, "local");

      const flowManager = makeFlowManager(root).forRoot(root, { specId });
      const flowState = flowManager.load(specId);
      const input = {
        expectRunId: "resume-run-id",
        expectIssue: 437,
        expectSpec: specId,
      };
      assert.equal(targetMismatchEnvelopeForInput({
        type: "get",
        key: "next-action",
        input,
        flowState,
      }), null);
      const envelope = new GetNextActionCommand().execute({ root, flowState, flowManager });
      assert.equal(envelope.step, "impl-review");
      assert.equal(envelope.action, "run-review");
      assert.deepEqual(manager.load().metrics, []);

      const reviewResult = await runImplReview({
        root,
        flow: state,
        reviewOutput: JSON.stringify({ blockingFindings: [], nonBlockingImprovements: [] }),
        touchedFiles: new Set(),
      });
      await FLOW_COMMANDS.run.review.post({
        phase: null,
        root,
        flowState: state,
        flowManager: manager,
      }, reviewResult);

      const resumed = manager.load();
      const metric = resumed.metrics.at(-1);
      assert.equal(reviewResult.artifacts.verdict, "PASS");
      assert.equal(findStepById(resumed.steps, "impl-review").status, "done");
      assert.equal(metric.taskId, null);
      assert.equal(typeof metric.ts, "string");
      assert.deepEqual(reviewMetricPayload(metric), {
        phase: "impl",
        counter: "reviewRetry",
        delta: 0,
        reset: true,
      });
      assert.equal(fs.existsSync(path.join(root, "specs", specId, "review.md")), true);
      assert.equal(fs.existsSync(path.join(root, "specs", specId, "impl-review.json")), true);
    } finally {
      removeTmpDir(root);
    }
  });
});
