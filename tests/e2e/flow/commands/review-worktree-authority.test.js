import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { NextActionPlanner } from "../../../../src/flow/lib/get-next-action.js";
import RunRecoverReviewPassCommand from "../../../../src/flow/lib/run-recover-review-pass.js";
import { RunReviewCommand } from "../../../../src/flow/lib/run-review.js";
import { FlowManager } from "../../../../src/lib/flow-manager.js";
import { makeFlowState, moveFlowToStep } from "../../../helpers/flow-setup.js";
import { commitAll, initGitRepo } from "../../../helpers/git-repo.js";
import { createTmpDir, removeTmpDir } from "../../../helpers/tmp-dir.js";
import { createInitialDraftArtifactRevision } from "../../../../src/flow/lib/draft-artifact-promotion.js";

const SPEC_ID = "496-review-authority";
const SPEC_PATH = `specs/${SPEC_ID}/spec.json`;
const GENERATED_AT = "2026-08-04T00:00:00.000Z";

function writeFile(root, relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function writeJson(root, relativePath, value) {
  writeFile(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

function reviewProjection() {
  return {
    version: 1,
    phase: "spec",
    generatedAt: GENERATED_AT,
    verdict: "PASS",
    summary: "The reviewed target is unchanged.",
    blockingFindings: [],
    nonBlockingImprovements: [],
  };
}

function writePassArtifacts(root) {
  const projection = reviewProjection();
  writeJson(root, `specs/${SPEC_ID}/spec-review.json`, projection);
  writeJson(root, `specs/${SPEC_ID}/review-history/spec-attempt-001.json`, {
    ...projection,
    sourceArtifact: "spec-review.json",
    attempt: 1,
    findings: [],
  });
}

function draftQuestionsProjection(sourceDraftRevision) {
  return {
    version: 2,
    phase: "draft-questions",
    sourceDraft: "draft.json",
    sourceDraftRevision,
    generatedAt: GENERATED_AT,
    verdict: "PASS",
    summary: "The draft questions review target is unchanged.",
    blockingFindings: [],
    advisoryFindings: [],
    repairTargets: [],
  };
}

function writeDraftQuestionsPassArtifacts(root, sourceDraftRevision) {
  const projection = draftQuestionsProjection(sourceDraftRevision);
  writeJson(root, `specs/${SPEC_ID}/draft-review-questions.json`, projection);
  writeJson(root, `specs/${SPEC_ID}/review-history/draft-questions-attempt-001.json`, {
    ...projection,
    sourceArtifact: "draft-review-questions.json",
    attempt: 1,
    findings: [],
  });
}

function providerPass(root, executionRoot, {
  changeTarget = false,
  blockEvidenceStore = false,
} = {}) {
  return (_command, _args, options) => {
    assert.equal(path.resolve(options.cwd), path.resolve(executionRoot));
    writePassArtifacts(root);
    if (changeTarget) {
      writeFile(executionRoot, "src/subject.js", "export const subject = 'changed during review';\n");
    }
    if (blockEvidenceStore) {
      writeFile(root, `specs/${SPEC_ID}/review-evidence`, "not a directory\n");
    }
    return {
      ok: true,
      status: 0,
      stdout: "Spec review PASS. Review found no required fixes.",
      stderr: [
        `Results saved to specs/${SPEC_ID}/spec-review.json`,
        "blockingCount=0 improvementCount=0 proposalCount=0",
        "verdict=PASS proposalCount=0",
      ].join("\n"),
      signal: null,
      killed: false,
    };
  };
}

function draftQuestionsProviderPass(root, executionRoot, sourceDraftRevision) {
  return (_command, _args, options) => {
    assert.equal(path.resolve(options.cwd), path.resolve(executionRoot));
    writeDraftQuestionsPassArtifacts(root, sourceDraftRevision);
    return {
      ok: true,
      status: 0,
      stdout: "Draft questions review PASS. Review found no required fixes.",
      stderr: [
        `Results saved to specs/${SPEC_ID}/draft-review-questions.json`,
        "[draft-questions-review] verdict=PASS findings=0 retryPhase=draft-questions",
      ].join("\n"),
      signal: null,
      killed: false,
    };
  };
}

function prepareWorktreeFixture(parent, { currentStepId = "spec-review" } = {}) {
  const root = path.join(parent, "main");
  const executionRoot = path.join(parent, "worktree");
  fs.mkdirSync(root, { recursive: true });
  writeJson(root, ".senti/config.json", {
    name: "review-authority-fixture",
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
  });
  writeFile(root, "src/subject.js", "export const subject = 'stable';\n");
  writeJson(root, SPEC_PATH, {
    goal: "Keep review identity bound to the execution checkout.",
    requirements: [{ id: "R1", desc: "Keep the target stable.", priority: "must" }],
    tasks: [{ id: "T-1", test_strategy: "Exercise worktree review promotion." }],
  });
  const draftPath = path.join(root, `specs/${SPEC_ID}/draft.json`);
  writeJson(root, `specs/${SPEC_ID}/draft.json`, {
    goal: "Keep draft review bound to the finalized canonical draft.",
    qa: [],
  });
  writeJson(root, "specs/other-active-flow/spec.json", {
    goal: "Unrelated active Flow.",
    requirements: [],
    tasks: [],
  });
  initGitRepo(root);
  commitAll(root, "fixture baseline");
  execFileSync("git", ["worktree", "add", "-q", "-b", "feature/review-authority", executionRoot], {
    cwd: root,
  });

  const otherState = moveFlowToStep(makeFlowState({
    specId: "other-active-flow",
    runId: "run-other-active-flow",
    issue: 495,
  }), "spec-review");
  const otherManager = new FlowManager({ root, mainRoot: root, inWorktree: false });
  otherManager.create(otherState);
  otherManager.addActiveFlow(otherState.specId, "branch");

  const flowState = moveFlowToStep(makeFlowState({
    specId: SPEC_ID,
    runId: "run-review-authority",
    issue: 496,
  }), currentStepId);
  flowState.draftArtifactRevision = createInitialDraftArtifactRevision({
    state: flowState,
    draftPath,
  }).toJSON();
  if (currentStepId === "draft-questions-review") {
    flowState.draftArtifactRevision.sourceStepId = "draft";
  }
  const flowManager = new FlowManager({ root, mainRoot: root, inWorktree: false });
  flowManager.create(flowState);
  flowManager.addActiveFlow(flowState.specId, "worktree");

  writeJson(root, `specs/${SPEC_ID}/plugin-artifacts/workflow/prepare.json`, {
    runId: flowState.runId,
  });
  writeJson(root, "specs/other-active-flow/plugin-artifacts/workflow/prepare.json", {
    runId: otherState.runId,
  });
  return {
    root,
    executionRoot,
    flowManager,
    draftArtifactRevision: flowState.draftArtifactRevision,
  };
}

class FailFirstMutationAfterEffects {
  constructor(delegate) {
    this.delegate = delegate;
    this.failed = false;
  }

  load(...args) {
    return this.delegate.load(...args);
  }

  loadReadOnly(...args) {
    return this.delegate.loadReadOnly(...args);
  }

  mutate(mutator, options) {
    if (!this.failed) {
      this.failed = true;
      const detached = structuredClone(this.delegate.load());
      mutator(detached);
      const error = new Error("flow state changed before canonical registration committed");
      error.code = "FLOW_STATE_ATOMIC_STALE";
      throw error;
    }
    return this.delegate.mutate(mutator, options);
  }
}

describe("worktree review authority", () => {
  let temporaryRoot;

  afterEach(() => {
    if (temporaryRoot) removeTmpDir(temporaryRoot);
    temporaryRoot = null;
  });

  it("promotes PASS exactly once without mixing base-side artifacts from active Flows", async () => {
    temporaryRoot = createTmpDir("review-worktree-authority-");
    const fixture = prepareWorktreeFixture(temporaryRoot);
    const command = new RunReviewCommand({
      runCommand: providerPass(fixture.root, fixture.executionRoot),
    });

    const result = await command.execute({
      root: fixture.root,
      executionRoot: fixture.executionRoot,
      phase: "spec",
      config: { agent: {} },
      flowState: fixture.flowManager.load(),
      flowManager: fixture.flowManager,
    });

    assert.equal(result.result, "ok", JSON.stringify(result));
    const state = fixture.flowManager.loadReadOnly();
    assert.equal(state.reviewConvergence.records.length, 1);
    const record = state.reviewConvergence.records[0];
    assert.equal(record.evidence.disposition, "PASS");
    assert.equal(record.toolingOutcome, null);
    assert.equal(record.finalizedEvidenceAvailable, true);
    assert.equal(
      record.targetState.entries.some((entry) => entry.path.includes("plugin-artifacts")),
      false,
    );
    assert.equal(
      record.targetState.entries.some((entry) => entry.path.startsWith("specs/other-active-flow/")),
      false,
    );
    assert.equal(
      fs.readdirSync(path.join(fixture.root, `specs/${SPEC_ID}/review-evidence`)).length,
      1,
    );
  });

  it("reproduces draft-questions review authority in a worktree without a false stale stop", async () => {
    temporaryRoot = createTmpDir("review-worktree-draft-questions-");
    const fixture = prepareWorktreeFixture(temporaryRoot, {
      currentStepId: "draft-questions-review",
    });
    const command = new RunReviewCommand({
      runCommand: draftQuestionsProviderPass(
        fixture.root,
        fixture.executionRoot,
        fixture.draftArtifactRevision,
      ),
    });

    const result = await command.execute({
      root: fixture.root,
      executionRoot: fixture.executionRoot,
      phase: "draft",
      config: { agent: {} },
      flowState: fixture.flowManager.load(),
      flowManager: fixture.flowManager,
    });

    assert.equal(result.result, "ok", JSON.stringify(result));
    assert.equal(result.next, "draft-refine");
    const state = fixture.flowManager.loadReadOnly();
    assert.equal(state.reviewConvergence.records.length, 1);
    const record = state.reviewConvergence.records[0];
    assert.equal(record.phase, "draft-questions");
    assert.equal(record.evidence.disposition, "PASS");
    assert.equal(record.finalizedEvidenceAvailable, true);
    assert.equal(
      record.targetState.entries.some((entry) => entry.path.includes("plugin-artifacts")),
      false,
    );
    assert.equal(
      record.targetState.entries.some((entry) => entry.path.startsWith("specs/other-active-flow/")),
      false,
    );
    assert.equal(
      fs.readdirSync(path.join(fixture.root, `specs/${SPEC_ID}/review-evidence`)).length,
      1,
    );
  });

  it("fails closed when the execution checkout actually changes during review", async () => {
    temporaryRoot = createTmpDir("review-worktree-stale-");
    const fixture = prepareWorktreeFixture(temporaryRoot);
    const command = new RunReviewCommand({
      runCommand: providerPass(fixture.root, fixture.executionRoot, { changeTarget: true }),
    });

    const result = await command.execute({
      root: fixture.root,
      executionRoot: fixture.executionRoot,
      phase: "spec",
      config: { agent: {} },
      flowState: fixture.flowManager.load(),
      flowManager: fixture.flowManager,
    });

    assert.equal(result.ok, false, JSON.stringify(result));
    assert.equal(result.errors[0].code, "STALE_REVIEW_TARGET");
    assert.equal(fixture.flowManager.loadReadOnly().reviewConvergence, undefined);
    assert.equal(
      fs.existsSync(path.join(fixture.root, `specs/${SPEC_ID}/review-evidence`)),
      false,
    );
  });

  it("records finalized evidence after a registration CAS failure and returns guarded recovery", async () => {
    temporaryRoot = createTmpDir("review-worktree-recovery-");
    const fixture = prepareWorktreeFixture(temporaryRoot);
    const interruptedManager = new FailFirstMutationAfterEffects(fixture.flowManager);
    const command = new RunReviewCommand({
      runCommand: providerPass(fixture.root, fixture.executionRoot),
    });

    const result = await command.execute({
      root: fixture.root,
      executionRoot: fixture.executionRoot,
      phase: "spec",
      config: { agent: {} },
      flowState: interruptedManager.load(),
      flowManager: interruptedManager,
    });

    assert.equal(result.ok, false, JSON.stringify(result));
    assert.equal(result.errors[0].code, "REVIEW_TOOLING_ERROR");
    const state = fixture.flowManager.loadReadOnly();
    const record = state.reviewConvergence.records[0];
    assert.equal(record.toolingAttempts, 0);
    assert.equal(record.toolingOutcome.stage, "result_recording");
    assert.equal(record.finalizedEvidenceAvailable, true);
    assert.equal(record.evidence.disposition, "PASS");
    assert.equal(
      fs.existsSync(path.join(fixture.root, `specs/${SPEC_ID}`, record.canonicalEvidenceRef)),
      true,
    );

    const plan = new NextActionPlanner().build({
      root: fixture.root,
      executionRoot: fixture.executionRoot,
      mainRoot: fixture.root,
      flowState: state,
      flowManager: fixture.flowManager,
    });
    assert.equal(plan.result.directive.actionId, "RECOVER_CANONICAL_REVIEW_PASS");
    assert.match(
      plan.result.directive.nextAction,
      /^senti flow run recover-review-pass --phase spec /,
    );
    assert.match(plan.result.directive.nextAction, /--expect-run-id 'run-review-authority'/);
    assert.match(plan.result.directive.nextAction, /--expect-spec '496-review-authority'/);
    assert.match(plan.result.directive.nextAction, /--expect-issue 496/);

    const recovery = new RunRecoverReviewPassCommand().execute({
      root: fixture.root,
      executionRoot: fixture.executionRoot,
      flowState: state,
      flowManager: fixture.flowManager,
      phase: "spec",
      expectRunId: "run-review-authority",
      expectSpec: SPEC_ID,
      expectIssue: 496,
    });
    assert.equal(recovery.ok, true, JSON.stringify(recovery));
    const recoveredRecord = fixture.flowManager.loadReadOnly().reviewConvergence.records[0];
    assert.equal(recoveredRecord.toolingAttempts, 0);
    assert.equal(recoveredRecord.toolingOutcome, null);
    assert.equal(recoveredRecord.finalizedEvidenceAvailable, true);
  });

  it("does not advertise finalized evidence when the canonical write never completed", async () => {
    temporaryRoot = createTmpDir("review-worktree-no-evidence-");
    const fixture = prepareWorktreeFixture(temporaryRoot);
    const command = new RunReviewCommand({
      runCommand: providerPass(fixture.root, fixture.executionRoot, {
        blockEvidenceStore: true,
      }),
    });

    const result = await command.execute({
      root: fixture.root,
      executionRoot: fixture.executionRoot,
      phase: "spec",
      config: { agent: {} },
      flowState: fixture.flowManager.load(),
      flowManager: fixture.flowManager,
    });

    assert.equal(result.ok, false, JSON.stringify(result));
    assert.equal(result.errors[0].code, "REVIEW_TOOLING_ERROR");
    const record = fixture.flowManager.loadReadOnly().reviewConvergence.records[0];
    assert.equal(record.toolingOutcome.stage, "canonical_write");
    assert.equal(record.finalizedEvidenceAvailable, false);
    assert.equal(record.evidence, null);
  });
});
