import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { createInitialDraftArtifactRevision } from "../../../src/flow/lib/draft-artifact-promotion.js";
import {
  applyReviewEvidenceTransition,
  ReviewDisposition,
  ReviewEvidence,
} from "../../../src/flow/lib/review-convergence.js";
import { ReviewEvidenceStore, resolveCurrentReviewTreeSha } from "../../../src/flow/lib/review-evidence-store.js";
import {
  inspectCanonicalReviewPassRecovery,
} from "../../../src/flow/lib/run-recover-review-pass.js";
import RunRecoverReviewPassCommand from "../../../src/flow/lib/run-recover-review-pass.js";
import { flowReviewRouteForPhase } from "../../../src/flow/lib/review-route.js";
import { ReviewTargetAuthority } from "../../../src/flow/lib/review-target-authority.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { makeFlowState, moveFlowToStep } from "../../helpers/flow-setup.js";
import { commitAll, initGitRepo } from "../../helpers/git-repo.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const SPEC_ID = "001-review-pass-recovery";
const SPEC_PATH = `specs/${SPEC_ID}/spec.json`;
const RUN_ID = "run-review-pass-recovery";
const ISSUE = 501;

function writeFile(root, relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function writeJson(root, relativePath, value) {
  writeFile(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function passProjection(phase, generatedAt, sourceDraftRevision = null) {
  return {
    version: sourceDraftRevision == null ? 1 : 2,
    phase,
    ...(sourceDraftRevision && {
      sourceDraft: "draft.json",
      sourceDraftRevision,
      blockingFindings: [],
      advisoryFindings: [],
      repairTargets: [],
    }),
    generatedAt,
    verdict: "PASS",
    summary: `Canonical ${phase} PASS projection.`,
    phaseOwnedMetadata: { source: "provider projection" },
  };
}

function prepareRecoveryFixture(root, { phase, activeStepId }) {
  writeJson(root, ".senti/config.json", {
    name: "review-pass-recovery",
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
  });
  writeFile(root, "src/example.js", "export const example = true;\n");
  writeJson(root, SPEC_PATH, {
    goal: "Recover an overwritten review projection.",
    requirements: [{ id: "R1", desc: "Keep canonical review evidence.", priority: "must" }],
    tasks: [{ id: "T-1", test_strategy: "Verify the recovery." }],
  });
  const draftPath = path.join(root, `specs/${SPEC_ID}/draft.json`);
  writeJson(root, `specs/${SPEC_ID}/draft.json`, {
    goal: "Recover a finalized canonical draft review projection.",
    qa: [],
  });
  initGitRepo(root);
  commitAll(root, "fixture baseline");

  const route = flowReviewRouteForPhase(phase);
  const state = moveFlowToStep(makeFlowState({
    runId: RUN_ID,
    issue: ISSUE,
    specId: SPEC_ID,
    featureBranch: "feature/review-pass-recovery",
  }), activeStepId);
  if (phase.startsWith("draft-")) {
    state.draftArtifactRevision = createInitialDraftArtifactRevision({
      state,
      draftPath,
    }).toJSON();
    state.draftArtifactRevision.sourceStepId = phase === "draft-coverage"
      ? "draft-refine"
      : "draft";
  }
  const treeSha = resolveCurrentReviewTreeSha(root, SPEC_PATH);
  const targetState = ReviewTargetAuthority.fromContext({
    root,
    executionRoot: root,
    flowState: state,
  }).captureTargetStateForPhase(phase);
  const capturedAt = "2026-07-29T01:02:03.000Z";
  const evidence = new ReviewEvidence({
    phase,
    taskId: null,
    treeSha,
    provenance: {
      provider: "fixture-reviewer",
      invocationId: `fixture-${phase}`,
      capturedAt,
    },
    disposition: new ReviewDisposition({ value: "PASS" }),
  });
  applyReviewEvidenceTransition(state, evidence, {
    configuredSemanticMaxAttempts: 4,
    targetStateDigest: targetState.digest,
    targetState,
  });
  const record = state.reviewConvergence.records.find((entry) => entry.phase === phase);
  record.toolingAttempts = 1;
  record.finalizedEvidenceAvailable = false;
  record.blocker = {
    kind: "tooling_attempts_exhausted",
    reason: "review is already completed for this target",
  };
  record.toolingOutcome = {
    kind: "TOOLING_ERROR",
    stage: "result_recording",
    attempt: 2,
    maxAttempts: 2,
    remainingAttempts: 0,
    reason: "review is already completed for this target",
    permissionRelated: false,
  };
  state.stepAttempts = [{
    runId: RUN_ID,
    taskId: null,
    stepId: route.reviewStepId,
    attempt: 1,
    outcome: {
      kind: "decision",
      terminal: true,
      nextAction: route.passNextStepId,
      decision: "PASS",
    },
    recordedAt: capturedAt,
  }];

  const manager = new FlowManager({ root, mainRoot: root, inWorktree: false });
  manager.create(state);
  manager.addActiveFlow(SPEC_ID, "branch");
  const specDir = path.join(root, `specs/${SPEC_ID}`);
  new ReviewEvidenceStore({ root, specDir }).write(evidence);
  const projection = passProjection(phase, capturedAt, state.draftArtifactRevision ?? null);
  writeJson(root, `${path.relative(root, specDir)}/review-history/${phase}-attempt-001.json`, {
    ...projection,
    sourceArtifact: route.projectionFile,
    attempt: 1,
    findings: [],
  });
  writeJson(root, `${path.relative(root, specDir)}/${route.projectionFile}`, {
    version: 1,
    phase,
    generatedAt: "2026-07-29T01:03:00.000Z",
    verdict: "REJECTED",
    blockingFindings: [{ title: "overwritten projection" }],
  });
  return {
    manager,
    route,
    projection,
    originalProjection: fs.readFileSync(path.join(specDir, route.projectionFile), "utf8"),
  };
}

describe("canonical review PASS recovery", () => {
  let tmp;

  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  for (const [phase, activeStepId] of [
    ["draft-questions", "draft-refine"],
    ["draft-coverage", "draft-gate"],
    ["spec", "spec-gate"],
    ["test", "implement"],
    ["impl", "impl-gate"],
  ]) {
    it(`recovers the ${phase} provider projection through the shared review route contract`, () => {
      tmp = createTmpDir(`recover-${phase}-pass-`);
      const fixture = prepareRecoveryFixture(tmp, { phase, activeStepId });
      const activeState = fixture.manager.loadReadOnly();
      const plan = inspectCanonicalReviewPassRecovery({
        root: tmp,
        state: activeState,
        phase,
      });
      assert.ok(plan);
      assert.equal(plan.route, fixture.route);

      const result = new RunRecoverReviewPassCommand().execute({
        root: tmp,
        flowState: activeState,
        flowManager: fixture.manager,
        phase,
        expectRunId: RUN_ID,
        expectSpec: SPEC_PATH,
        expectIssue: ISSUE,
      });

      assert.equal(result.ok, true, JSON.stringify(result));
      assert.equal(result.data.recovered, true);
      assert.equal(result.data.idempotent, false);
      assert.deepEqual(
        JSON.parse(fs.readFileSync(path.join(tmp, `specs/${SPEC_ID}`, fixture.route.projectionFile), "utf8")),
        fixture.projection,
      );
      const recovered = fixture.manager.loadReadOnly();
      const record = recovered.reviewConvergence.records.find((entry) => entry.phase === phase);
      assert.equal(record.evidence.disposition, "PASS");
      assert.equal(record.toolingAttempts, 0);
      assert.equal(record.finalizedEvidenceAvailable, true);
      assert.equal(record.blocker, null);
      assert.equal(record.toolingOutcome, null);
      assert.equal(recovered.canonicalReviewPassRecoveries.length, 1);
      const downstream = findStepById(recovered.steps, fixture.route.passNextStepId);
      assert.equal(downstream.status, "in_progress");
      assert.equal(
        recovered.canonicalReviewPassRecoveries[0].invalidatedDownstreamStep,
        fixture.route.passNextStepId,
      );
      if (fixture.route.downstreamGatePhase) {
        assert.equal(
          recovered.metrics.findLast((entry) => (
            entry.phase === fixture.route.downstreamGatePhase
            && entry.counter === "gateRetry"
          ))?.reset,
          true,
        );
      }

      const idempotent = new RunRecoverReviewPassCommand().execute({
        root: tmp,
        flowState: recovered,
        flowManager: fixture.manager,
        phase,
        expectRunId: RUN_ID,
        expectSpec: SPEC_PATH,
        expectIssue: ISSUE,
      });
      assert.equal(idempotent.ok, true, JSON.stringify(idempotent));
      assert.equal(idempotent.data.idempotent, true);
      assert.equal(fixture.manager.loadReadOnly().canonicalReviewPassRecoveries.length, 1);
    });
  }

  it("rejects stale canonical evidence after the reviewed target changes", () => {
    tmp = createTmpDir("recover-stale-review-pass-");
    const fixture = prepareRecoveryFixture(tmp, { phase: "spec", activeStepId: "spec-gate" });
    writeJson(tmp, SPEC_PATH, {
      goal: "The reviewed target changed after PASS.",
      requirements: [{ id: "R1", desc: "Different requirement.", priority: "must" }],
      tasks: [{ id: "T-1", test_strategy: "Different verification." }],
    });
    const activeState = fixture.manager.loadReadOnly();

    const result = new RunRecoverReviewPassCommand().execute({
      root: tmp,
      flowState: activeState,
      flowManager: fixture.manager,
      phase: "spec",
      expectRunId: RUN_ID,
      expectSpec: SPEC_PATH,
      expectIssue: ISSUE,
    });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "REVIEW_PASS_RECOVERY_NOT_ELIGIBLE");
    assert.equal(
      fs.readFileSync(path.join(tmp, `specs/${SPEC_ID}`, fixture.route.projectionFile), "utf8"),
      fixture.originalProjection,
    );
    assert.equal(fixture.manager.loadReadOnly().canonicalReviewPassRecoveries, undefined);
  });

  it("requires all exact target guards and exposes them in the command registry", () => {
    tmp = createTmpDir("recover-review-pass-guards-");
    const fixture = prepareRecoveryFixture(tmp, { phase: "spec", activeStepId: "spec-gate" });
    const activeState = fixture.manager.loadReadOnly();
    const result = new RunRecoverReviewPassCommand().execute({
      root: tmp,
      flowState: activeState,
      flowManager: fixture.manager,
      phase: "spec",
    });
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "REVIEW_PASS_RECOVERY_GUARDS_REQUIRED");

    const entry = FLOW_COMMANDS.run["recover-review-pass"];
    assert.ok(entry);
    assert.ok(entry.args.options.includes("--phase"));
    assert.ok(entry.args.options.includes("--expect-run-id"));
    assert.match(entry.help, /canonical PASS/);
  });
});
