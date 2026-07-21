import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import SetStepCommand from "../../../src/flow/lib/set-step.js";
import {
  buildRepairFingerprint,
  completeImplRepair,
  ImplRepairTransitionIntent,
  prepareImplTriageArtifact,
  recoverImplRepairTransaction,
} from "../../../src/flow/lib/impl-repair-artifacts.js";
import {
  ExplicitRecoveryTransition,
  NormalStepTransition,
} from "../../../src/flow/lib/step-transition-policy.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const SPEC_PATH = "specs/001-test/spec.json";

function writeFile(root, relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function writeJson(root, relativePath, value) {
  writeFile(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

describe("set step impl-repair completion", () => {
  let tmp;

  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  it("commits only the normal transition when the downstream reset range is empty", async () => {
    tmp = createTmpDir("set-step-impl-repair-empty-reset-");
    writeJson(tmp, SPEC_PATH, { goal: "repair fixture" });
    writeFile(tmp, "src/repair-target.js", "export const value = 'before';\n");
    const previousFingerprint = buildRepairFingerprint({ root: tmp, specPath: SPEC_PATH });
    const specDir = path.join(tmp, "specs/001-test");
    writeJson(tmp, "specs/001-test/review-source.json", {
      repairFingerprint: previousFingerprint.hash,
      blockingFindings: [{ findingId: "F-1" }],
      nonBlockingImprovements: [],
    });
    prepareImplTriageArtifact({
      specDir,
      sourceStep: "impl-review",
      sourceArtifact: "review-source.json",
      findings: [{ findingId: "F-1", suggestion: "Update the repair target." }],
      fingerprint: previousFingerprint,
    });
    writeJson(tmp, "specs/001-test/test-execute-result.json", {
      repairFingerprint: previousFingerprint.hash,
    });
    writeFile(tmp, "src/repair-target.js", "export const value = 'after';\n");

    const state = {
      spec: SPEC_PATH,
      steps: [{ id: "impl-repair", status: "in_progress" }],
      tasks: [],
      currentTaskId: null,
    };
    const commits = [];
    const flowManager = {
      load: () => state,
      updateStepStatuses(transitions, options) {
        commits.push({ transitions, options });
        state.steps[0].status = transitions[0].requestedStatus;
      },
    };

    const result = await new SetStepCommand().execute({
      root: tmp,
      flowManager,
      id: "impl-repair",
      status: "done",
    });

    assert.equal(state.steps[0].status, "done");
    assert.equal(commits.length, 1);
    assert.equal(commits[0].transitions.length, 1);
    assert.ok(commits[0].transitions[0] instanceof NormalStepTransition);
    assert.ok(!commits[0].transitions.some((entry) => entry instanceof ExplicitRecoveryTransition));
    assert.deepEqual(commits[0].options, { taskId: null });
    assert.equal(result.id, "impl-repair");
    assert.equal(result.invalidations.length, 1);
    assert.equal(fs.existsSync(path.join(specDir, "test-execute-result.json")), false);

    const ledger = JSON.parse(fs.readFileSync(path.join(specDir, "impl-repair.json"), "utf8"));
    assert.equal(ledger.entries.length, 1);
    const issueLog = JSON.parse(fs.readFileSync(path.join(specDir, "issue-log.json"), "utf8"));
    assert.equal(issueLog.entries.length, 1);
    assert.equal(issueLog.entries[0].normalizedFindingId, "F-1");
  });

  it("recovers post-commit effects from the atomic transition intent", () => {
    tmp = createTmpDir("set-step-impl-repair-intent-recovery-");
    writeJson(tmp, SPEC_PATH, { goal: "repair fixture" });
    writeFile(tmp, "src/repair-target.js", "export const value = 'before';\n");
    const previousFingerprint = buildRepairFingerprint({ root: tmp, specPath: SPEC_PATH });
    const specDir = path.join(tmp, "specs/001-test");
    writeJson(tmp, "specs/001-test/review-source.json", {
      repairFingerprint: previousFingerprint.hash,
      blockingFindings: [{ findingId: "F-1" }],
      nonBlockingImprovements: [],
    });
    prepareImplTriageArtifact({
      specDir,
      sourceStep: "impl-review",
      sourceArtifact: "review-source.json",
      findings: [{ findingId: "F-1", suggestion: "Update the repair target." }],
      fingerprint: previousFingerprint,
    });
    writeJson(tmp, "specs/001-test/test-execute-result.json", {
      repairFingerprint: previousFingerprint.hash,
    });
    writeFile(tmp, "src/repair-target.js", "export const value = 'after';\n");

    const state = {
      spec: SPEC_PATH,
      steps: [{ id: "impl-repair", status: "in_progress" }],
      tasks: [],
      currentTaskId: null,
    };
    const completed = completeImplRepair({ root: tmp, state, resetStepIds: [] });
    new ImplRepairTransitionIntent(completed.transaction).applyTo(state);
    state.steps[0].status = "done";
    assert.equal(fs.existsSync(path.join(specDir, "impl-repair-transaction.json")), false);

    const flowManager = {
      load: () => state,
      mutate(mutator) { mutator(state); },
    };
    const recovered = recoverImplRepairTransaction({ root: tmp, state, flowManager });

    assert.equal(recovered.entry.id, "repair-001");
    assert.equal(state.implRepairTransaction, undefined);
    assert.equal(fs.existsSync(path.join(specDir, "impl-repair-transaction.json")), false);
    assert.equal(fs.existsSync(path.join(specDir, "test-execute-result.json")), false);
    const ledger = JSON.parse(fs.readFileSync(path.join(specDir, "impl-repair.json"), "utf8"));
    assert.equal(ledger.entries.length, 1);
  });
});
