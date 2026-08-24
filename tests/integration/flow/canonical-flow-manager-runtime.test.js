import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, it } from "node:test";

import { FlowManager } from "../../../src/lib/flow-manager.js";
import { AgentTimeout } from "../../../src/lib/agent-timeout.js";
import { GIT_REPOSITORY_LOCATION_ENVIRONMENT } from "../../../src/lib/git-repository-environment.js";
import { container } from "../../../src/lib/container.js";
import {
  FlowArtifactAttemptHistory,
  FlowArtifactAttemptRecord,
} from "../../../src/lib/flow-artifact-contract.js";
import { CanonicalFlowCreateRequest } from "../../../src/flow/lib/canonical-flow-manager-store.js";
import {
  CurrentFlowSpecRecord,
  CurrentFlowStateStore,
} from "../../../src/flow/lib/current-flow-state.js";
import GetNextActionCommand from "../../../src/flow/lib/get-next-action.js";
import RunDispatchCommand from "../../../src/flow/lib/run-dispatch.js";
import {
  FLOW_DISPATCH_INVOCATION_ENV,
  FLOW_DISPATCH_INVOCATION_ID_ENV,
} from "../../../src/flow/lib/dispatch-invocation.js";
import RunFinalRegressionCommand from "../../../src/flow/lib/run-final-regression.js";
import RunReportCommand from "../../../src/flow/lib/run-report.js";
import RunReviewCommand from "../../../src/flow/lib/run-review.js";
import FlowReviewCommand from "../../../src/flow/commands/review.js";
import {
  reconcileCompletedReviewWorkUnits,
  ReviewWorkUnit,
} from "../../../src/flow/lib/review-work-unit.js";
import { attachedCanonicalReviewWorkUnit } from "../../../src/flow/lib/canonical-review-artifacts.js";
import SetReviewEvidenceCommand from "../../../src/flow/lib/set-review-evidence.js";
import RunRecoverReviewPassCommand from "../../../src/flow/lib/run-recover-review-pass.js";
import RunUpdateOverviewCommand from "../../../src/flow/lib/run-update-overview.js";
import RunGateCommand, { executeGateSideEffects } from "../../../src/flow/lib/run-gate.js";
import { readCurrentGateTransitionFacts } from "../../../src/flow/lib/gate-transition-facts.js";
import {
  resolveGateTransition,
  resolveNonGateTransition,
  scenarioValidityTransitionDefinition,
  testExecuteTransitionDefinition,
} from "../../../src/flow/definition.js";
import RunRepairPlanGateCommand from "../../../src/flow/lib/run-repair-plan-gate.js";
import RunSettleFailureCommand from "../../../src/flow/lib/run-settle-failure.js";
import RunSettleReviewTransitionCommand from "../../../src/flow/lib/run-settle-review-transition.js";
import RunRepairTestReviewCommand from "../../../src/flow/lib/run-repair-test-review.js";
import RunScenarioValidityCommand from "../../../src/flow/lib/run-scenario-validity.js";
import RunTestExecuteCommand from "../../../src/flow/lib/run-test-execute.js";
import RunTestResultReviewCommand from "../../../src/flow/lib/run-test-result-review.js";
import RunAcceptanceReviewCommand, {
  AcceptanceReviewResponseSource,
  buildAcceptancePrompt,
} from "../../../src/flow/lib/run-acceptance-review.js";
import SetAcceptanceDecisionCommand from "../../../src/flow/lib/set-acceptance-decision.js";
import {
  attachCanonicalCommandResultArtifact,
  attachedCanonicalCommandResultArtifact,
  attachedCanonicalCommandResultPublications,
} from "../../../src/flow/lib/canonical-command-result.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { emptySpecStub } from "../../../src/lib/spec-json.js";
import {
  WorkerArtifactHandoffCoordinator,
  WorkerArtifactHandoffRequest,
  WorkerArtifactMutationAuthoritySnapshot,
  SourceWorkerEffect,
  sealWorkerArtifactHandoff,
} from "../../../src/flow/lib/worker-artifact-handoff.js";
import {
  FlowOutboxIdentity,
  FlowOutboxRecoveryClaim,
  FlowOutboxRecoveryRequiredError,
  FlowOutboxStore,
} from "../../../src/flow/lib/flow-outbox.js";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";
import { commitAll, initGitRepo } from "../../support/infrastructure/git-repo.js";
import { validWorkerHandoffSpec } from "../../support/infrastructure/worker-artifact.js";
import {
  canonicalFixtureProducerResult,
  FlowAtStepFixture,
  TaskLifecycleFixture,
} from "../../support/infrastructure/flow-setup.js";
import { validateCanonicalUpgradeEvidence } from "../../../src/flow/lib/test-artifacts.js";
import { ReviewTargetAuthority } from "../../../src/flow/lib/review-target-authority.js";
import {
  CanonicalTestArtifactStore,
  CanonicalTestSourceProvenanceError,
  CanonicalTestSourceRevision,
} from "../../../src/flow/lib/canonical-test-artifacts.js";
import { buildRepairFingerprint } from "../../../src/flow/lib/repair-fingerprint.js";
import { decisionContextForActiveFlow } from "../../../src/flow/lib/nonblocking.js";
import { readCurrentTestChainTransitionFacts } from "../../../src/flow/lib/test-chain-transition-facts.js";

const roots = [];

function root() {
  const value = createTmpDir("canonical-flow-manager-");
  roots.push(value);
  return value;
}

function initializeReviewSource(rootPath) {
  fs.writeFileSync(path.join(rootPath, "README.md"), "review checkout fixture\n");
  initGitRepo(rootPath);
  commitAll(rootPath, "review source");
}

function rejectedTestReviewCommand(onOutputDirectory) {
  return new RunReviewCommand({
    resolveTreeSha: () => "a".repeat(40),
    resolveTargetStateDigest: () => "b".repeat(64),
    runCommand(_command, _args, options) {
      const outputDirectory = options.env.SENNEL_REVIEW_OUTPUT_DIR;
      onOutputDirectory(outputDirectory);
      fs.writeFileSync(path.join(outputDirectory, "test-review.json"), `${JSON.stringify({
        version: 1,
        phase: "test",
        generatedAt: "2026-08-23T00:00:00.000Z",
        verdict: "REJECTED",
        coverageArtifact: "test-coverage.json",
        sourceTestArtifactRevision: JSON.parse(options.env.SENNEL_REVIEW_TEST_ARTIFACT_REVISION),
        blockingFindings: [{
          findingId: "test-review-finding",
          fingerprint: "f".repeat(64),
          summary: "The test omits a required behavior.",
        }],
        advisoryFindings: [],
      })}\n`);
      ReviewWorkUnit.fromEnvironment(options.env).seal();
      return { ok: true, status: 0, stdout: "", stderr: "", signal: null, killed: false };
    },
  });
}

function request(specId = "001-canonical-manager", overrides = {}) {
  return new CanonicalFlowCreateRequest({
    specId,
    runId: "canonical-manager-run",
    request: "Keep the request exactly as supplied.",
    execution: { mode: "direct" },
    policy: { autoApprove: false, nonblocking: null },
    flowId: "canonical-manager-flow",
    flowVersionId: "canonical-manager-flow-v1",
    specRecord: new CurrentFlowSpecRecord({ ...emptySpecStub(), tasks: [] }, { specId }),
    ...overrides,
  });
}

function runtimeLog(runId, sequence) {
  return {
    runId,
    sequence,
    attempt: 1,
    command: "flow run fixture",
    startedAt: "2026-08-13T00:00:00.000Z",
    endedAt: "2026-08-13T00:00:01.000Z",
    exitCode: 0,
  };
}

function leaves(nodes, values = []) {
  for (const node of nodes) {
    if (!node.children || node.children.length === 0) values.push(node);
    else leaves(node.children, values);
  }
  return values;
}

function advanceTo(manager, specId, nodeId, { onActive = null } = {}) {
  if (onActive !== null && typeof onActive !== "function") {
    throw new TypeError("canonical Flow advance onActive must be a function or null");
  }
  const ordered = leaves(manager.load(specId).steps);
  const targetIndex = ordered.findIndex((entry) => entry.id === nodeId);
  assert.ok(targetIndex >= 0, `missing canonical Flow node: ${nodeId}`);
  for (const entry of ordered.slice(0, targetIndex)) {
    manager.updateStepStatus({ stepId: entry.id, requestedStatus: "in_progress" }, { specId });
    onActive?.(entry.id);
    confirmFixtureStep(manager, entry.id, { specId });
  }
  manager.updateStepStatus({ stepId: nodeId, requestedStatus: "in_progress" }, { specId });
}

/**
 * A setup-only normal completion has the same primary result transaction as
 * a real producer. This keeps fixture progress from manufacturing an
 * impossible artifactless completed producer.
 */
function confirmFixtureStep(manager, stepId, opts = {}) {
  if (Object.hasOwn(opts, "canonicalCommandResult")) {
    return manager.updateStepStatus({ stepId, requestedStatus: "done" }, opts);
  }
  const state = manager.canonicalState(opts.specId);
  const canonicalCommandResult = canonicalFixtureProducerResult(state, stepId, {
    flowManager: manager,
    specId: opts.specId,
  });
  return manager.updateStepStatus(
    { stepId, requestedStatus: "done" },
    canonicalCommandResult === null ? opts : { ...opts, canonicalCommandResult },
  );
}

function attemptHistoryBytes(nodeId, logicalKey, payload, attempt = 1) {
  const history = new FlowArtifactAttemptHistory(Array.from({ length: attempt }, (_, index) => (
    new FlowArtifactAttemptRecord({
      attempt: index + 1,
      payload: {
        nodeId,
        outcome: "completed",
        result: { result: "ok" },
        artifact: { logicalKey, payload },
      },
    })
  )));
  return Buffer.from(`${JSON.stringify(history.toJSON(), null, 2)}\n`, "utf8");
}

function publishAttemptArtifact(manager, specId, nodeId, logicalKey, payload) {
  const attempt = manager.canonicalState(specId).attempt.sequence;
  manager.publishArtifacts({
    specId,
    nodeId,
    artifactWrites: [{
      logicalKey,
      mediaType: "application/json",
      bytes: attemptHistoryBytes(nodeId, logicalKey, payload, attempt),
    }],
  });
}

function canonicalIdentity(state) {
  const value = state.toJSON();
  return {
    schemaRevision: value.schemaRevision,
    flowId: value.flowId,
    flowVersionId: value.flowVersionId,
    runId: value.runId,
    specId: value.specId,
    request: value.request,
    version: value.version,
    execution: value.execution,
  };
}

function catalogDescriptorReferences(catalog) {
  return catalog.toJSON().artifacts.map((artifact) => ({
    logicalKey: artifact.logicalKey,
    kind: artifact.kind,
    relativePath: artifact.relativePath,
    mediaType: artifact.mediaType,
    authority: artifact.authority,
    memberId: artifact.memberId,
    publicationStep: artifact.publicationStep,
    retention: artifact.retention,
  }));
}

function catalogArtifactReferences(catalog) {
  return catalogDescriptorReferences(catalog).map(({ publicationStep, ...reference }) => reference);
}

/** A production-API fixture for the V1 worker-owned test collection. */
function canonicalTestTreeHandoffScenario(specId, invocationId) {
  const repository = root();
  const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
  const created = manager.createFresh(request(specId, {
    specRecord: new CurrentFlowSpecRecord({ ...validWorkerHandoffSpec(), tasks: [] }, { specId }),
  }));
  manager.addActiveFlow(created.specId, "direct");
  advanceTo(manager, created.specId, "test");
  manager.publishArtifacts({
    specId: created.specId,
    nodeId: "test",
    artifactWrites: [{
      logicalKey: "tests.source",
      parameters: { testPath: "obsolete.test.js" },
      mediaType: "text/javascript",
      bytes: Buffer.from("// spec: R1\n", "utf8"),
    }],
  });
  const coordinator = new WorkerArtifactHandoffCoordinator();
  const context = {
    root: repository,
    mainRoot: repository,
    executionRoot: repository,
    specId: created.specId,
    flowManager: manager,
  };
  const handoff = coordinator.createRequest({
    ctx: context,
    state: manager.load(created.specId),
    invocation: {
      id: invocationId,
      target: { digest: "b".repeat(64) },
      action: { digest: "a".repeat(64), nextAction: { step: "test" } },
    },
  });
  return Object.freeze({ repository, manager, created, coordinator, context, handoff });
}

function writeCanonicalTestTreePayload(handoff) {
  const replacementPath = path.join(handoff.payloadPath("spec-tests"), "current.test.js");
  fs.writeFileSync(replacementPath, [
    "// spec: R1",
    'import assert from "node:assert/strict";',
    'import test from "node:test";',
    "",
    'test("R1: replaces the cataloged test collection", () => {',
    "  assert.equal(true, true);",
    "});",
    "",
  ].join("\n"));
}

function acceptanceInputWrites(manager, specId) {
  const location = manager.specLocation(specId);
  const executionRaw = Buffer.from("canonical acceptance test execution raw\n", "utf8");
  let repairFingerprint = null;
  const currentRepairFingerprint = () => {
    if (repairFingerprint === null) {
      repairFingerprint = buildRepairFingerprint({
        root: location.repositoryRoot,
        artifactRoot: location.repositoryRoot,
        specPath: location.relativeSpecFile,
      }).hash;
    }
    return repairFingerprint;
  };
  const testSourceRevision = () => new CanonicalTestArtifactStore({
    flowManager: manager,
    state: manager.load(specId),
  }).testSourceRevision().digest;
  const executionIdentity = () => {
    const execution = manager.readArtifact({
      specId,
      logicalKey: "test.execute",
      consumerNodeId: "test-result-review",
    });
    const activity = manager.activityLedger(specId).find((entry) => entry.id === execution.descriptor.activityId);
    return {
      historyAttempt: JSON.parse(execution.bytes.toString("utf8")).attempts.at(-1).attempt,
      producerActivityId: activity.id,
      attemptId: activity.attemptId,
      sequence: activity.sequence,
    };
  };
  return new Map([
    ["test", () => manager.publishArtifacts({ specId, nodeId: "test", artifactWrites: [{
      logicalKey: "tests.source", parameters: { testPath: "acceptance.fixture.test.js" }, mediaType: "text/javascript",
      bytes: Buffer.from("import test from 'node:test';\ntest('R-1: acceptance fixture', () => {});\n", "utf8"),
    }] })],
    ["scenario-validity", () => publishAttemptArtifact(manager, specId, "scenario-validity", "scenario.validity", {
      version: "1",
      testSourceRevision: testSourceRevision(),
      command: "node --test artifacts/tests/scenario.test.js",
      process: { started: true, exitCode: 0, signal: null, timedOut: false, spawnError: null },
      result: "pass",
      raw_output_path: location.relativeArtifact("scenario.validity.raw-log"),
      summary: [],
    })],
    ["test-execute", () => {
      manager.writeRuntimeArtifact({
        specId,
        nodeId: "test-execute",
        artifact: { logicalKey: "test.execute.raw-log", mediaType: "text/plain", bytes: executionRaw },
      });
      return publishAttemptArtifact(manager, specId, "test-execute", "test.execute", {
      version: "2",
      repairFingerprint: currentRepairFingerprint(),
      testSourceRevision: testSourceRevision(),
      rawEvidenceFingerprint: crypto.createHash("sha256").update(executionRaw).digest("hex"),
      process: { started: true, exitCode: 0, signal: null, timedOut: false, spawnError: null },
      raw_output_path: location.relativeArtifact("test.execute.raw-log"),
      summary: [],
      regression: { required: false, result: "skipped", mode: "none", category: "docs-only", reason: "fixture", classified_paths: [], trigger_relevant_changed_files: [], changed_files: [] },
      });
    }],
    ["test-result-review", () => {
      return publishAttemptArtifact(manager, specId, "test-result-review", "test.result.review", {
      verdict: "pass",
      checked_items: [{ check: "project_regression_verification", result: "pass", detail: "fixture regression evidence" }],
      result_file_path: location.relativeArtifact("test.execute"),
      raw_output_path: location.relativeArtifact("test.execute.raw-log"),
      repairFingerprint: currentRepairFingerprint(),
      testSourceRevision: testSourceRevision(),
      testExecute: executionIdentity(),
      rawEvidenceFingerprint: crypto.createHash("sha256").update(executionRaw).digest("hex"),
    });
    }],
    ["impl-review", () => publishAttemptArtifact(manager, specId, "impl-review", "impl.review", {
      version: 1,
      phase: "impl",
      verdict: "PASS",
      summary: "Canonical implementation review passed.",
      blockingFindings: [],
      nonBlockingImprovements: [],
      canonicalEvidence: { phase: "impl", disposition: "PASS", findings: [] },
    })],
    ["impl-gate", () => publishAttemptArtifact(manager, specId, "impl-gate", "impl.gate", {
      result: "pass",
      artifacts: { phase: "integration", issues: [], evaluations: [], observations: [] },
    })],
    ["retro", () => manager.publishArtifacts({
      specId,
      nodeId: "retro",
      artifactWrites: [{
      logicalKey: "retro",
      mediaType: "application/json",
      bytes: Buffer.from(`${JSON.stringify({
        mode: "attempt-history",
        date: "2026-08-13T00:00:00.000Z",
        summary: { not_done: 0 },
        requirements: [{ id: "R-1", status: "done" }],
      }, null, 2)}\n`, "utf8"),
    }],
    })],
  ]);
}

class FixtureAcceptanceResponseSource extends AcceptanceReviewResponseSource {
  constructor(response) {
    super();
    this.response = structuredClone(response);
    this.contexts = [];
  }

  load(context) {
    this.contexts.push(structuredClone(context));
    return structuredClone(this.response);
  }
}

function acceptanceRiskReviewResult() {
  return attachCanonicalCommandResultArtifact({
    result: "ok",
    verdict: "user_decision_required",
  }, {
    logicalKey: "acceptance.review",
    payload: {
      version: 2,
      repairFingerprint: "a".repeat(64),
      mechanicalBlockers: [],
      hardBlockers: [],
      requirementJudgments: [{
        requirementId: "R-1",
        status: "notVerifiable",
        requestRefs: ["flow.request"],
        requirementRefs: ["spec.json#R-1"],
        diffRefs: [],
        repairRefs: ["acceptance:no-repair"],
        testRefs: [],
        missingEvidence: ["A deliberate acceptance-risk decision is required."],
      }],
      deferredFindings: [],
      userDecision: null,
      verdict: "user_decision_required",
    },
  });
}

async function beginAcceptanceRiskDecision({ manager, created, repository }) {
  advanceTo(manager, created.specId, "acceptance-review");
  const ctx = {
    root: repository,
    mainRoot: repository,
    executionRoot: repository,
    specId: created.specId,
    flowManager: manager,
    flowState: manager.load(created.specId),
  };
  await FLOW_COMMANDS.run["acceptance-review"].post(ctx, acceptanceRiskReviewResult());
  assert.equal(manager.load(created.specId).currentNodeId, "acceptance-decision");
  return ctx;
}

afterEach(() => {
  container.reset();
  for (const directory of roots.splice(0)) removeTmpDir(directory);
});

describe("FlowManager canonical Version-1 runtime", () => {
  it("creates, locates, and reloads only specs/<specId>/001/flow.json", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    const location = manager.specLocation(created.specId);

    assert.equal(manager.pathFor(created.specId), location.flowStateFile);
    assert.equal(location.relativeDirectory, `specs/${created.specId}/001`);
    assert.equal(fs.existsSync(location.flowStateFile), true);
    assert.equal(fs.existsSync(path.join(repository, "specs", created.specId, "flow.json")), false);
    assert.equal(fs.existsSync(path.join(location.directory, "flow-version.json")), false);
    assert.equal(fs.existsSync(location.activitiesFile), true);
    assert.equal(fs.existsSync(location.specFile), true);
    assert.equal(fs.existsSync(location.catalogFile), true);
    assert.equal(fs.existsSync(path.join(location.directory, ".runtime")), true);
    assert.ok(leaves(created.steps).every((step) => step.status === "pending"));

    manager.addActiveFlow(created.specId, "direct");
    const loaded = manager.load();
    assert.equal(loaded.request, "Keep the request exactly as supplied.");
    assert.equal(loaded.schemaRevision, 3);
    assert.equal(loaded.execution.mode, "direct");
  });

  it("reuses a per-spec Version Store but replaces its directory authority after recreation", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const specId = "001-runtime-store-recreation";
    const created = manager.createFresh(request(specId));
    const first = manager._store.runtime.store(specId);

    assert.strictEqual(manager._store.runtime.store(specId), first);
    const location = manager.specLocation(created.specId);
    const directStore = new CurrentFlowStateStore({
      directory: location.directory,
      definition: manager._store.definition,
      runtimeLockLocation: location.runtimeLock("runtime.lock.current-flow-state"),
    });
    directStore.lock.acquire();
    try {
      assert.throws(
        () => manager._store.runtime.load(specId),
        (error) => error?.code === "FLOW_STATE_ATOMIC_BUSY",
      );
    } finally {
      directStore.lock.release();
    }

    fs.rmSync(location.directory, { recursive: true, force: true });
    assert.throws(() => manager._store.runtime.load(specId), /authority|root does not exist/);

    const recreated = manager.createFresh(request(specId));
    const second = manager._store.runtime.store(specId);
    assert.notStrictEqual(second, first);
    assert.equal(recreated.specId, specId);
    assert.equal(manager._store.runtime.load(specId).confirmationOrder, 1);
  });

  it("publishes system-owned upgrade evidence through the Version catalog", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-upgrade-result"));
    manager.addActiveFlow(created.specId, "direct");
    const payload = {
      version: 1,
      command: "sennel upgrade",
      dryRun: false,
      exitCode: 0,
      result: "success-no-change",
      summary: { skills: { updated: 0, unchanged: 1, removed: 0 } },
      failureReason: null,
      checkedPaths: [],
    };

    manager.publishUpgradeResult({
      specId: created.specId,
      artifact: {
        logicalKey: "upgrade.result",
        mediaType: "application/json",
        bytes: Buffer.from(`${JSON.stringify(payload)}\n`, "utf8"),
      },
    });

    const resolved = manager.readArtifact({
      specId: created.specId,
      logicalKey: "upgrade.result",
      consumerNodeId: "impl-gate",
    });
    assert.equal(resolved.relativePath, "steps/upgrade-result.json");
    assert.deepEqual(JSON.parse(resolved.bytes.toString("utf8")), payload);
  });

  it("rejects malformed system-owned upgrade evidence before catalog publication", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-upgrade-result-malformed"));
    manager.addActiveFlow(created.specId, "direct");

    assert.throws(
      () => manager.publishUpgradeResult({
        specId: created.specId,
        artifact: {
          logicalKey: "upgrade.result",
          mediaType: "application/json",
          bytes: Buffer.from("{ malformed JSON", "utf8"),
        },
      }),
      /canonical upgrade result must be JSON/,
    );
    assert.equal(manager.readArtifact({
      specId: created.specId,
      logicalKey: "upgrade.result",
      consumerNodeId: "impl-gate",
      optional: true,
    }), null);
  });

  it("validates cataloged upgrade evidence by logical key", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-upgrade-catalog-validation"));
    manager.addActiveFlow(created.specId, "direct");
    const state = manager.load(created.specId);
    const requiredPaths = ["src/skills/sennel.flow/SKILL.md"];
    const missing = validateCanonicalUpgradeEvidence({
      flowManager: manager,
      state,
      consumerNodeId: "impl-gate",
      currentRequiredPaths: requiredPaths,
    });
    assert.equal(missing.ok, false);
    assert.equal(missing.reason, "upgrade-result.json missing");

    manager.publishUpgradeResult({
      specId: created.specId,
      artifact: {
        logicalKey: "upgrade.result",
        mediaType: "application/json",
        bytes: Buffer.from(`${JSON.stringify({
          version: 1,
          command: "sennel upgrade",
          dryRun: false,
          exitCode: 0,
          result: "success-updated",
          summary: {},
          failureReason: null,
          checkedPaths: requiredPaths,
        })}\n`, "utf8"),
      },
    });

    assert.equal(validateCanonicalUpgradeEvidence({
      flowManager: manager,
      state: manager.load(created.specId),
      consumerNodeId: "impl-gate",
      currentRequiredPaths: requiredPaths,
    }).ok, true);
  });

  it("rejects dry-run upgrade evidence even when its checked paths match", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-upgrade-dry-run-evidence"));
    manager.addActiveFlow(created.specId, "direct");
    const requiredPaths = ["src/skills/sennel.flow/SKILL.md"];
    assert.throws(
      () => manager.publishUpgradeResult({
        specId: created.specId,
        artifact: {
          logicalKey: "upgrade.result",
          mediaType: "application/json",
          bytes: Buffer.from(`${JSON.stringify({
            version: 1,
            command: "sennel upgrade --dry-run",
            dryRun: true,
            exitCode: 0,
            result: "success-updated",
            summary: {},
            failureReason: null,
            checkedPaths: requiredPaths,
          })}\n`, "utf8"),
        },
      }),
      /must record a materialized upgrade/,
    );
    assert.equal(manager.readArtifact({
      specId: created.specId,
      logicalKey: "upgrade.result",
      consumerNodeId: "impl-gate",
      optional: true,
    }), null);
  });

  it("routes normal manager step transitions and Task addition through the Activity Store", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    manager.createFresh(request());
    manager.addActiveFlow("001-canonical-manager", "direct");

    manager.updateStepStatus({ stepId: "branch", requestedStatus: "in_progress" });
    confirmFixtureStep(manager, "branch");
    manager.updateStepStatus({ stepId: "prepare-spec", requestedStatus: "in_progress" });
    confirmFixtureStep(manager, "prepare-spec");
    manager.addTask({
      id: "T-1",
      key: "implement-task",
      title: "Implement task",
      goal: "Verify canonical Task ownership.",
      origin: "plan",
      added_round: 0,
      status: "pending",
    });

    const location = manager.specLocation("001-canonical-manager");
    const state = manager.load();
    const task = state.tasks.find((entry) => entry.id === "T-1");
    const activities = fs.readFileSync(location.activitiesFile, "utf8")
      .trim().split("\n").map((line) => JSON.parse(line));

    assert.equal(state.steps[0].children[0].status, "done");
    assert.deepEqual(task.steps.map((step) => step.id), ["T-1-impl", "T-1-review", "T-1-gate"]);
    assert.equal(activities.at(-1).transition.operation, "add_task");
    assert.equal(activities.at(-1).nodeId, "impl");
    const taskLocation = location.taskArtifactLocation("T-1");
    assert.equal(fs.existsSync(taskLocation.implDirectory), true);
    assert.equal(fs.existsSync(taskLocation.reviewDirectory), true);
    assert.equal(fs.existsSync(taskLocation.gateDirectory), true);
    const persistedSpec = JSON.parse(fs.readFileSync(location.specFile, "utf8"));
    assert.equal(persistedSpec.tasks[0].id, "T-1");

    const reloaded = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    assert.deepEqual(
      reloaded.load("001-canonical-manager").tasks.find((entry) => entry.id === "T-1").steps.map((step) => step.id),
      ["T-1-impl", "T-1-review", "T-1-gate"],
    );
    assert.equal(fs.existsSync(taskLocation.implDirectory), true);
    assert.equal(fs.existsSync(taskLocation.reviewDirectory), true);
    assert.equal(fs.existsSync(taskLocation.gateDirectory), true);
  });

  it("routes Task runtime metadata aliases to the active materialized child", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");
    confirmFixtureStep(manager, "branch");
    confirmFixtureStep(manager, "prepare-spec");
    manager.addTask({
      id: "T-1",
      key: "runtime-metadata-task",
      title: "Runtime metadata task",
      goal: "Resolve runtime metadata through a materialized Task child.",
      origin: "plan",
      added_round: 0,
      status: "pending",
    });

    const location = manager.specLocation(created.specId);
    const taskImplIndex = leaves(manager.load(created.specId).steps)
      .findIndex((step) => step.id === "T-1-impl");
    for (const step of leaves(manager.load(created.specId).steps).slice(0, taskImplIndex)) {
      if (step.status === "pending") confirmFixtureStep(manager, step.id);
    }
    manager.updateStepStatus({ stepId: "T-1-impl", requestedStatus: "in_progress" });
    manager.setStepRuntimeLog("task-impl", runtimeLog(created.runId, 1));
    confirmFixtureStep(manager, "T-1-impl");
    manager.updateStepStatus({ stepId: "T-1-review", requestedStatus: "in_progress" });
    manager.setStepRuntimeLog("task-review", runtimeLog(created.runId, 2));
    confirmFixtureStep(manager, "T-1-review");
    manager.updateStepStatus({ stepId: "T-1-gate", requestedStatus: "in_progress" });
    manager.setStepRuntimeLog("task-gate", runtimeLog(created.runId, 3));
    manager.setStepRuntimeLog("T-1-gate", runtimeLog(created.runId, 4));

    for (const [nodeId, sequence] of [["T-1-impl", 1], ["T-1-review", 2], ["T-1-gate", 4]]) {
      const record = JSON.parse(fs.readFileSync(
        path.join(location.directory, ".runtime", "step-metadata", `${nodeId}.json`),
        "utf8",
      ));
      assert.equal(record.nodeId, nodeId);
      assert.equal(record.sequence, sequence);
    }
    assert.equal(fs.existsSync(path.join(location.directory, ".runtime", "step-metadata", "task-impl.json")), false);
    assert.equal(fs.existsSync(path.join(location.directory, ".runtime", "step-metadata", "task-review.json")), false);
    assert.equal(fs.existsSync(path.join(location.directory, ".runtime", "step-metadata", "task-gate.json")), false);
  });

  it("runs the normal spec gate through the V1 catalog and confirms its result through the Store", async () => {
    const repository = root();
    const specRecord = {
      ...emptySpecStub(),
      goal: "Persist canonical gate output.",
      requirements: [{ id: "R-1", desc: "The gate result is cataloged." }],
      acceptance_criteria: ["R-1 gate result is retained by its producer Step."],
      tasks: [],
    };
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-canonical-spec-gate", {
      specRecord: new CurrentFlowSpecRecord(specRecord, { specId: "001-canonical-spec-gate" }),
    }));
    manager.addActiveFlow(created.specId, "direct");
    manager.addTask({
      id: "T-1",
      key: "canonical-gate-task",
      title: "Canonical gate task",
      goal: "Exercise the canonical gate.",
      test_strategy: "Validate the V1 gate result contract.",
      origin: "plan",
      added_round: 0,
      status: "pending",
    });
    const ordered = leaves(manager.load(created.specId).steps);
    const gateIndex = ordered.findIndex((entry) => entry.id === "spec-gate");
    assert.ok(gateIndex > 0);
    for (const entry of ordered.slice(0, gateIndex)) {
      confirmFixtureStep(manager, entry.id);
    }
    manager.updateStepStatus({ stepId: "spec-gate", requestedStatus: "in_progress" });
    const ctx = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      phase: "spec",
      config: {},
      skipGuardrail: true,
      flowManager: manager,
      flowState: manager.load(created.specId),
    };

    const result = await new RunGateCommand().execute(ctx);
    assert.equal(result.result, "pass");
    await FLOW_COMMANDS.run.gate.post(ctx, result);

    const history = JSON.parse(manager.readArtifact({
      specId: created.specId,
      logicalKey: "spec.gate",
      consumerNodeId: "approval",
    }).bytes.toString("utf8"));
    assert.deepEqual(history.attempts.map((entry) => entry.attempt), [1]);
    assert.equal(history.attempts[0].artifact.payload.result, "pass");
    assert.equal(leaves(manager.load(created.specId).steps)
      .find((entry) => entry.id === "spec-gate").status, "done");
    const location = manager.specLocation(created.specId);
    assert.equal(fs.existsSync(path.join(location.directory, "spec-gate-result.json")), false);
    assert.equal(fs.existsSync(path.join(location.directory, "flow-version.json")), false);
  });

  it("publishes a non-pass gate Attempt without a legacy result/source sibling", async () => {
    const repository = root();
    fs.writeFileSync(path.join(repository, "README.md"), "canonical gate failure\n");
    initGitRepo(repository);
    commitAll(repository, "initial");
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-canonical-spec-gate-fail", {
      specRecord: new CurrentFlowSpecRecord({ ...emptySpecStub(), tasks: [] }, {
        specId: "001-canonical-spec-gate-fail",
      }),
    }));
    manager.addActiveFlow(created.specId, "direct");
    manager.addTask({
      id: "T-1",
      key: "canonical-gate-fail-task",
      title: "Canonical gate failure task",
      goal: "Exercise non-pass persistence.",
      test_strategy: "Validate the V1 failure result contract.",
      origin: "plan",
      added_round: 0,
      status: "pending",
    });
    const ordered = leaves(manager.load(created.specId).steps);
    const gateIndex = ordered.findIndex((entry) => entry.id === "spec-gate");
    for (const entry of ordered.slice(0, gateIndex)) {
      confirmFixtureStep(manager, entry.id);
    }
    manager.updateStepStatus({ stepId: "spec-gate", requestedStatus: "in_progress" });
    const ctx = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      phase: "spec",
      config: {},
      skipGuardrail: true,
      flowManager: manager,
      flowState: manager.load(created.specId),
    };

    const result = await new RunGateCommand().execute(ctx);
    assert.equal(result.result, "fail");
    await FLOW_COMMANDS.run.gate.post(ctx, result);

    const history = JSON.parse(manager.readArtifact({
      specId: created.specId,
      logicalKey: "spec.gate",
      consumerNodeId: "approval",
    }).bytes.toString("utf8"));
    assert.deepEqual(history.attempts.map((entry) => entry.attempt), [1]);
    assert.equal(history.attempts[0].artifact.payload.result, "fail");
    const facts = readCurrentGateTransitionFacts({
      flowManager: manager,
      flowState: manager.load(created.specId),
      phase: "spec",
    });
    assert.ok(facts);
    assert.equal(facts.result, "fail");
    assert.equal(facts.failure.category, "semantic");
    assert.equal(facts.lineage.sourceFingerprint.length, 64);
    assert.equal(facts.lineage.canonicalFingerprint.length, 64);
    assert.notEqual(facts.lineage.sourceFingerprint, facts.lineage.canonicalFingerprint);
    assert.equal(facts.lineage.sourceRevisionFingerprint, history.attempts[0].artifact.payload.artifacts.gateTransitionLineage);
    assert.equal(facts.lineage.canonicalRevisionFingerprint, history.attempts[0].artifact.payload.artifacts.gateTransitionLineage);
    assert.equal(facts.integrityFailure, null);
    const reloadedManager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const reloadedFacts = readCurrentGateTransitionFacts({
      flowManager: reloadedManager,
      flowState: reloadedManager.load(created.specId),
      phase: "spec",
    });
    assert.deepEqual(reloadedFacts.toJSON(), facts.toJSON());
    assert.deepEqual(
      resolveGateTransition(reloadedFacts).toJSON(),
      resolveGateTransition(facts).toJSON(),
    );
    const beforeBypassState = manager.canonicalState(created.specId).toJSON();
    const beforeBypassActivities = manager.activityLedger(created.specId);
    await assert.rejects(
      new RunGateCommand().execute({ ...ctx, flowState: manager.load(created.specId) }),
      /canonical gate admission rejected evaluation/,
    );
    assert.deepEqual(manager.canonicalState(created.specId).toJSON(), beforeBypassState);
    assert.deepEqual(manager.activityLedger(created.specId), beforeBypassActivities);
    assert.equal(leaves(manager.load(created.specId).steps)
      .find((entry) => entry.id === "spec-gate").status, "in_progress");
    const location = manager.specLocation(created.specId);
    assert.equal(fs.existsSync(path.join(location.directory, "spec-gate-result.json")), false);
    assert.equal(fs.existsSync(path.join(location.directory, "spec-gate-source.json")), false);
  });

  it("keeps a mechanically blocked acceptance review in its V1 Attempt while cataloging its evidence", async () => {
    const repository = root();
    fs.writeFileSync(path.join(repository, "README.md"), "canonical acceptance\n");
    initGitRepo(repository);
    commitAll(repository, "initial");
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-canonical-acceptance"));
    manager.addActiveFlow(created.specId, "direct");
    advanceTo(manager, created.specId, "acceptance-review");
    const ctx = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      flowManager: manager,
      flowState: manager.load(created.specId),
    };

    const result = await new RunAcceptanceReviewCommand().execute(ctx);
    assert.equal(result.verdict, "blocked");
    assert.equal(attachedCanonicalCommandResultArtifact(result).logicalKey, "acceptance.review");
    await FLOW_COMMANDS.run["acceptance-review"].post(ctx, result);

    const history = JSON.parse(manager.readArtifact({
      specId: created.specId,
      logicalKey: "acceptance.review",
      consumerNodeId: "final-regression",
    }).bytes.toString("utf8"));
    assert.deepEqual(history.attempts.map((entry) => entry.attempt), [1]);
    assert.equal(history.attempts[0].artifact.payload.verdict, "blocked");
    assert.equal(manager.load(created.specId).currentNodeId, "acceptance-review");
    const location = manager.specLocation(created.specId);
    assert.equal(fs.existsSync(path.join(location.directory, "acceptance-review.json")), false);
    assert.equal(fs.existsSync(path.join(location.directory, "steps", "acceptance-review", "result.json")), true);
  });

  it("keeps the acceptance worker evidence contract while rewinding from cataloged V1 inputs", async () => {
    const repository = root();
    fs.writeFileSync(path.join(repository, "README.md"), "canonical acceptance base\n");
    initGitRepo(repository);
    commitAll(repository, "initial");
    fs.writeFileSync(path.join(repository, "README.md"), "canonical acceptance changed\n");
    fs.writeFileSync(path.join(repository, "untracked-source.js"), "export const acceptanceInput = true;\n");
    const specId = "001-canonical-acceptance-contract";
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request(specId, {
      execution: { mode: "direct", baseBranch: "main" },
      specRecord: new CurrentFlowSpecRecord({
        ...emptySpecStub(),
        requirements: [{ id: "R-1", desc: "Canonical input stays stable." }],
        tasks: [],
      }, { specId }),
    }));
    manager.addActiveFlow(created.specId, "direct");
    const inputs = acceptanceInputWrites(manager, created.specId);
    advanceTo(manager, created.specId, "acceptance-review", {
      onActive: (nodeId) => inputs.get(nodeId)?.(),
    });
    const source = new FixtureAcceptanceResponseSource({
      requirementJudgments: [{
        requirementId: "R-1",
        status: "notMet",
        requestRefs: ["flow.request"],
        requirementRefs: ["spec.json#R-1"],
        diffRefs: ["diff:README.md"],
        repairRefs: ["acceptance:no-repair"],
        testRefs: ["test-execute-result.json#R-1"],
        missingEvidence: [],
      }],
      deferredFindingDispositions: [],
    });
    const ctx = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      flowManager: manager,
      flowState: manager.load(created.specId),
    };

    const result = await new RunAcceptanceReviewCommand({ responseSource: source }).execute(ctx);
    assert.equal(result.verdict, "repair_required");
    assert.equal(source.contexts.length, 1);
    const [context] = source.contexts;
    assert.deepEqual(Object.keys(context.evidence), [
      "originalRequest",
      "requirements",
      "diff",
      "repairEvidence",
      "upgradeEvidence",
      "testEvidence",
      "reviewEvidence",
      "deferredFindings",
      "deferredFindingEvidence",
    ]);
    assert.match(context.evidence.diff, /diff --git a\/README\.md b\/README\.md/);
    assert.match(context.evidence.diff, /diff --git a\/untracked-source\.js b\/untracked-source\.js/);
    assert.equal(
      context.evidence.testEvidence["test-result-review.json"].result_file_path,
      `specs/${specId}/test-execute-result.json`,
    );
    assert.equal(
      context.evidence.testEvidence["test-result-review.json"].raw_output_path,
      `specs/${specId}/tests/.raw/test-execution.log`,
    );
    const prompt = buildAcceptancePrompt(context);
    const promptEvidence = JSON.parse(prompt.userPrompt.slice("## Acceptance Evidence\n".length));
    assert.deepEqual(Object.keys(promptEvidence), Object.keys(context.evidence));
    const durableExecution = JSON.parse(manager.readArtifact({
      specId: created.specId,
      logicalKey: "test.execute",
      consumerNodeId: "acceptance-review",
    }).bytes.toString("utf8"));
    assert.equal(
      durableExecution.attempts[0].artifact.payload.raw_output_path,
      manager.specLocation(created.specId).relativeArtifact("test.execute.raw-log"),
    );

    await FLOW_COMMANDS.run["acceptance-review"].post(ctx, result);
    const state = manager.load(created.specId);
    assert.equal(state.currentNodeId, "impl-triage");
    const next = await new GetNextActionCommand().execute({ ...ctx, flowState: state });
    assert.notEqual(next.directive?.actionId, "SETTLE_CANONICAL_FAILURE");
    assert.equal(leaves(state.steps).find((entry) => entry.id === "acceptance-review").status, "invalidated");
    const history = JSON.parse(manager.readArtifact({
      specId: created.specId,
      logicalKey: "acceptance.review",
      consumerNodeId: "acceptance-decision",
    }).bytes.toString("utf8"));
    assert.equal(history.attempts[0].artifact.payload.verdict, "repair_required");
    const transition = manager.activityLedger(created.specId).at(-1);
    assert.equal(transition.transition.operation, "repair_acceptance_review");
    assert.equal(transition.nodeId, "acceptance-review");
    assert.equal(transition.transition.attempt.nodeId, "impl-triage");
    assert.equal(transition.references.artifacts[0].label, "acceptance.review");
    const handoff = WorkerArtifactHandoffRequest.create({
      mainRoot: repository,
      executionRoot: repository,
      state,
      flowManager: manager,
      invocation: {
        id: "acceptance-repair-triage-invocation",
        action: {
          digest: crypto.createHash("sha256").update("acceptance-repair-triage").digest("hex"),
          nextAction: { step: "impl-triage", taskId: null },
        },
      },
    });
    assert.deepEqual(handoff.inputs.map((input) => input.name), ["spec.json", "acceptance-review.json"]);
    assert.notEqual(handoff.inputDigest, handoff.inputRevision);
  });

  it("binds every stable acceptance repair finding through sealed triage and journal reload", async () => {
    const repository = root();
    const specId = "001-canonical-acceptance-hard-blockers";
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request(specId, {
      specRecord: new CurrentFlowSpecRecord({
        ...emptySpecStub(),
        requirements: [{ id: "R-1", desc: "Repair all acceptance findings." }],
        tasks: [],
      }, { specId }),
    }));
    manager.addActiveFlow(created.specId, "direct");
    advanceTo(manager, created.specId, "acceptance-review");
    const ctx = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      flowManager: manager,
      flowState: manager.load(created.specId),
    };
    const hardBlockers = ["DF-acceptance-a", "DF-acceptance-b"].map((findingId) => ({
      findingId,
      sourceStep: "impl-review",
      sourceArtifact: "steps/impl/review/result.json",
      sourceFindingId: findingId,
      finalDisposition: "blocking",
      evidenceRefs: [`steps/impl/review/result.json#${findingId}`],
    }));
    const review = {
      version: 2,
      repairFingerprint: "a".repeat(64),
      mechanicalBlockers: [],
      hardBlockers,
      requirementJudgments: [{
        requirementId: "R-1",
        status: "notMet",
        requestRefs: ["flow.request"],
        requirementRefs: ["spec.json#R-1"],
        diffRefs: ["diff:README.md"],
        repairRefs: ["acceptance:no-repair"],
        testRefs: ["test-execute-result.json#R-1"],
        missingEvidence: [],
      }],
      deferredFindings: hardBlockers,
      userDecision: null,
      verdict: "repair_required",
    };
    await FLOW_COMMANDS.run["acceptance-review"].post(ctx, attachCanonicalCommandResultArtifact({
      result: "ok",
      verdict: "repair_required",
    }, { logicalKey: "acceptance.review", payload: review }));

    const state = manager.load(created.specId);
    assert.equal(state.currentNodeId, "impl-triage");
    const coordinator = new WorkerArtifactHandoffCoordinator({
      now: () => new Date("2026-08-18T00:00:00.000Z"),
    });
    const handoff = coordinator.createRequest({
      ctx,
      state,
      invocation: {
        id: "acceptance-hard-blocker-triage",
        action: {
          digest: crypto.createHash("sha256").update("acceptance-hard-blocker-triage").digest("hex"),
          nextAction: { step: "impl-triage", taskId: null },
        },
      },
    });
    assert.deepEqual(handoff.inputs.map((input) => input.name), ["spec.json", "acceptance-review.json"]);
    assert.deepEqual(handoff.inputs[1].document.hardBlockers.map((entry) => entry.findingId), [
      "DF-acceptance-a", "DF-acceptance-b",
    ]);
    const authority = WorkerArtifactMutationAuthoritySnapshot.capture(handoff);
    const effect = new SourceWorkerEffect({
      version: 1,
      stepId: "impl-triage",
      completionStatus: "done",
      requirements: [],
      files: [],
      issues: [],
      overview: null,
      triage: {
        dispositions: [
          { findingKey: "requirement:R-1", disposition: "apply", rationale: "The failed requirement needs an implementation repair." },
          { findingKey: "hard-blocker:DF-acceptance-a", disposition: "apply", rationale: "The first canonical blocker requires repair." },
          { findingKey: "hard-blocker:DF-acceptance-b", disposition: "apply", rationale: "The second canonical blocker requires repair." },
        ],
      },
      repair: null,
    });
    fs.writeFileSync(handoff.payloadPath("effects.json"), `${JSON.stringify(effect.toJSON(), null, 2)}\n`);
    sealWorkerArtifactHandoff({
      requestPath: handoff.requestPath,
      invocationId: handoff.dispatchInvocationId,
      now: () => new Date("2026-08-18T00:00:01.000Z"),
    });
    const reconciliation = coordinator.reconcile({ ctx, request: handoff, mutationAuthority: authority });
    assert.equal(reconciliation.completed, true);

    const reloadedManager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const reloaded = reloadedManager.load(created.specId);
    assert.equal(reloaded.currentNodeId, "impl-repair");
    const triage = JSON.parse(reloadedManager.readArtifact({
      specId: created.specId,
      logicalKey: "impl.triage",
      consumerNodeId: "impl-repair",
    }).bytes.toString("utf8"));
    assert.deepEqual(triage.dispositions.map((entry) => entry.findingKey), [
      "requirement:R-1",
      "hard-blocker:DF-acceptance-a",
      "hard-blocker:DF-acceptance-b",
    ]);
    const route = reloadedManager.activityLedger(created.specId).findLast((activity) => (
      activity.transition.operation === "repair_acceptance_review"
    ));
    assert.ok(route);
    assert.equal(route.references.artifacts[0].label, "acceptance.review");
    const triageRoute = reloadedManager.activityLedger(created.specId).findLast((activity) => (
      activity.transition.operation === "triage_implementation_for_repair"
    ));
    assert.ok(triageRoute);
    assert.equal(triageRoute.nodeId, "impl-triage");
    assert.equal(triageRoute.transition.attempt.nodeId, "impl-repair");
    assert.notEqual(triageRoute.attemptId, triageRoute.transition.attempt.id);
  });

  it("uses fixed dual-identity source triage routes for applying and rejecting findings", () => {
    for (const scenario of [
      {
        disposition: "apply",
        operation: "triage_implementation_for_repair",
        target: "impl-repair",
        repairStatus: "in_progress",
      },
      {
        disposition: "reject",
        operation: "triage_implementation_no_repair",
        target: "impl-gate",
        repairStatus: "skipped",
      },
    ]) {
      const repository = root();
      const specId = `001-canonical-triage-${scenario.disposition}`;
      const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
      const created = manager.createFresh(request(specId, {
        specRecord: new CurrentFlowSpecRecord({ ...validWorkerHandoffSpec(), tasks: [] }, { specId }),
      }));
      manager.addActiveFlow(created.specId, "direct");
      advanceTo(manager, created.specId, "impl-triage");
      const handoffDigest = scenario.disposition === "apply" ? "a".repeat(64) : "b".repeat(64);
      manager.confirmSourceWorkerHandoff({
        specId: created.specId,
        effect: new SourceWorkerEffect({
          version: 1,
          stepId: "impl-triage",
          completionStatus: "done",
          requirements: [], files: [], issues: [], overview: null, repair: null,
          triage: {
            dispositions: [{
              findingKey: "finding-1",
              disposition: scenario.disposition,
              rationale: "The canonical triage route has a fixed target.",
            }],
          },
        }),
        handoffDigest,
        result: {
          outcome: "passed",
          summary: "Worker handoff confirmed for impl-triage.",
          confirmedAt: "2026-08-18T00:00:00.000Z",
          artifactRefs: [
            { kind: "worker-handoff", id: handoffDigest },
            { kind: "worker-handoff-request", id: "c".repeat(64) },
          ],
        },
      });
      const reloaded = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
      const state = reloaded.load(created.specId);
      assert.equal(state.currentNodeId, scenario.target, scenario.disposition);
      assert.equal(leaves(state.steps).find((entry) => entry.id === "impl-repair").status, scenario.repairStatus);
      const activity = reloaded.activityLedger(created.specId).at(-1);
      assert.equal(activity.transition.operation, scenario.operation);
      assert.equal(activity.nodeId, "impl-triage");
      assert.equal(activity.transition.attempt.nodeId, scenario.target);
      assert.notEqual(activity.attemptId, activity.transition.attempt.id);
    }
  });

  it("records an explicit acceptance-risk decision without overwriting review evidence", async () => {
    const repository = root();
    const specId = "001-canonical-acceptance-decision";
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request(specId, {
      specRecord: new CurrentFlowSpecRecord({
        ...emptySpecStub(),
        requirements: [{ id: "R-1", desc: "An explicit decision remains durable." }],
        tasks: [],
      }, { specId }),
    }));
    manager.addActiveFlow(created.specId, "direct");
    await beginAcceptanceRiskDecision({ manager, created, repository });

    const result = new SetAcceptanceDecisionCommand().execute({
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      choice: "accept_risk_and_continue",
      flowManager: manager,
      flowState: manager.load(created.specId),
    });
    assert.equal(result.next, "final-regression");
    const reviewHistory = JSON.parse(manager.readArtifact({
      specId: created.specId,
      logicalKey: "acceptance.review",
      consumerNodeId: "acceptance-decision",
    }).bytes.toString("utf8"));
    const decisionHistory = JSON.parse(manager.readArtifact({
      specId: created.specId,
      logicalKey: "acceptance.decision",
      consumerNodeId: "final-regression",
    }).bytes.toString("utf8"));
    const issueLog = JSON.parse(manager.readArtifact({
      specId: created.specId,
      logicalKey: "issue.log",
      consumerNodeId: "final-regression",
    }).bytes.toString("utf8"));

    assert.deepEqual(reviewHistory.attempts.map((entry) => entry.attempt), [1]);
    assert.equal(reviewHistory.attempts[0].artifact.payload.userDecision, null);
    assert.equal(decisionHistory.attempts[0].artifact.payload.choice, "accept_risk_and_continue");
    assert.equal(issueLog.entries[0].step, "acceptance-decision");
    assert.equal(manager.load(created.specId).currentNodeId, "final-regression");
  });

  it("parks the canonical Flow after an explicit acceptance-risk abort", async () => {
    const repository = root();
    const specId = "001-canonical-acceptance-abort";
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request(specId, {
      specRecord: new CurrentFlowSpecRecord({
        ...emptySpecStub(),
        requirements: [{ id: "R-1", desc: "An abort remains durable." }],
        tasks: [],
      }, { specId }),
    }));
    manager.addActiveFlow(created.specId, "direct");
    await beginAcceptanceRiskDecision({ manager, created, repository });

    const result = new SetAcceptanceDecisionCommand().execute({
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      choice: "abort",
      flowManager: manager,
      flowState: manager.load(created.specId),
    });

    assert.equal(result.next, "parked");
    const state = manager.load(created.specId);
    assert.equal(state.lifecycle, "parked");
    assert.equal(state.currentNodeId, null);
    assert.equal(manager.restartFlow(created.specId).resumable, true);
    const decisions = JSON.parse(manager.readArtifact({
      specId: created.specId,
      logicalKey: "acceptance.decision",
      consumerNodeId: "final-regression",
    }).bytes.toString("utf8"));
    assert.equal(decisions.attempts[0].artifact.payload.choice, "abort");
    assert.equal(manager.artifactCatalog(created.specId).artifacts
      .some((entry) => entry.logicalKey === "issue.log"), false);
  });

  it("routes a passing canonical acceptance result through its no-op decision to final regression", async () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-canonical-acceptance-pass"));
    manager.addActiveFlow(created.specId, "direct");
    advanceTo(manager, created.specId, "acceptance-review");
    const result = attachCanonicalCommandResultArtifact({
      result: "ok",
      verdict: "pass",
    }, {
      logicalKey: "acceptance.review",
      payload: {
        version: 2,
        repairFingerprint: "b".repeat(64),
        mechanicalBlockers: [],
        hardBlockers: [],
        requirementJudgments: [],
        deferredFindings: [],
        userDecision: null,
        verdict: "pass",
      },
    });
    const ctx = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      flowManager: manager,
      flowState: manager.load(created.specId),
    };
    await FLOW_COMMANDS.run["acceptance-review"].post(ctx, result);

    const state = manager.load(created.specId);
    const decision = leaves(state.steps).find((entry) => entry.id === "acceptance-decision");
    assert.equal(decision.status, "done");
    assert.equal(state.currentNodeId, "final-regression");
    const history = JSON.parse(manager.readArtifact({
      specId: created.specId,
      logicalKey: "acceptance.review",
      consumerNodeId: "final-regression",
    }).bytes.toString("utf8"));
    assert.equal(history.attempts[0].artifact.payload.verdict, "pass");
  });

  it("rejects an artifactless no-op from an explicit acceptance-risk decision", async () => {
    const repository = root();
    const specId = "001-canonical-noop-risk-bypass";
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request(specId, {
      specRecord: new CurrentFlowSpecRecord({
        ...emptySpecStub(),
        requirements: [{ id: "R-1", desc: "An explicit decision cannot become a no-op." }],
        tasks: [],
      }, { specId }),
    }));
    manager.addActiveFlow(created.specId, "direct");
    await beginAcceptanceRiskDecision({ manager, created, repository });

    assert.throws(
      () => manager.completeAcceptanceDecisionNoOp({ specId: created.specId }),
      (error) => error?.code === "CANONICAL_ACCEPTANCE_DECISION_NOOP_NOT_AUTHORIZED",
    );
    assert.throws(
      () => manager.updateStepStatus({ stepId: "acceptance-decision", requestedStatus: "done" }, { specId: created.specId }),
      (error) => error?.code === "CANONICAL_PRODUCER_ARTIFACT_NOT_READY",
    );
    assert.equal(manager.load(created.specId).currentNodeId, "acceptance-decision");
  });

  it("resumes a same-schema PASS no-op recorded before the final-regression claim", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-canonical-legacy-pass-noop"));
    manager.addActiveFlow(created.specId, "direct");
    advanceTo(manager, created.specId, "acceptance-review");
    const result = attachCanonicalCommandResultArtifact({ result: "ok", verdict: "pass" }, {
      logicalKey: "acceptance.review",
      payload: {
        version: 2,
        repairFingerprint: "c".repeat(64),
        mechanicalBlockers: [],
        hardBlockers: [],
        requirementJudgments: [],
        deferredFindings: [],
        userDecision: null,
        verdict: "pass",
      },
    });
    manager.publishCurrentAttemptResult({ specId: created.specId, commandResult: result });
    manager.confirmCurrentAttempt({ specId: created.specId });
    manager.updateStepStatus({ stepId: "acceptance-decision", requestedStatus: "in_progress" }, { specId: created.specId });
    manager._store.runtime.confirmAttempt({
      specId: created.specId,
      activityId: "same-schema-legacy-acceptance-noop",
      result: {
        outcome: "passed",
        summary: "legacy PASS acceptance no-op",
        confirmedAt: "2026-08-20T00:00:00.000Z",
        artifactRefs: [],
      },
      references: { evaluations: [], findings: [], repairs: [], artifacts: [] },
    });
    const interrupted = manager.canonicalState(created.specId);
    assert.equal(interrupted.current, null);
    assert.equal(interrupted.findNode("acceptance-decision").status, "done");

    const reloaded = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    reloaded.updateStepStatus({ stepId: "final-regression", requestedStatus: "in_progress" }, { specId: created.specId });
    assert.equal(reloaded.load(created.specId).currentNodeId, "final-regression");
  });

  it("routes test execution and result-review artifacts through V1 history and the transient raw contract", async () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");
    advanceTo(manager, created.specId, "test-execute", {
      onActive(nodeId) {
        if (nodeId !== "test") return;
        manager.publishArtifacts({
          specId: created.specId,
          nodeId: "test",
          artifactWrites: [{
            logicalKey: "tests.source",
            parameters: { testPath: "runtime.fixture.test.js" },
            mediaType: "text/javascript",
            bytes: Buffer.from("import test from 'node:test';\ntest('runtime fixture', () => {});\n", "utf8"),
          }],
        });
      },
    });
    manager.writeRuntimeArtifact({
      nodeId: "test-execute",
      artifact: {
        logicalKey: "test.execute.raw-log",
        mediaType: "text/plain",
        bytes: "[sennel] test execution diagnostic\\n",
      },
    });
    const repairFingerprint = buildRepairFingerprint({
      root: repository,
      artifactRoot: repository,
      specPath: manager.specLocation(created.specId).relativeSpecFile,
    });
    const testSourceRevision = new CanonicalTestArtifactStore({
      flowManager: manager,
      state: manager.load(created.specId),
    }).testSourceRevision().digest;
    const executionArtifact = {
      version: "2",
      repairFingerprint: repairFingerprint.hash,
      testSourceRevision,
      rawEvidenceFingerprint: crypto.createHash("sha256").update("[sennel] test execution diagnostic\\n").digest("hex"),
      process: { started: true, exitCode: 0, signal: null, timedOut: false, spawnError: null },
      raw_output_path: manager.specLocation(created.specId).relativeArtifact("test.execute.raw-log"),
      summary: [],
      regression: {
        required: false,
        result: "skipped",
        mode: "none",
        category: "docs-only",
        reason: "no executable project regression is required",
        classified_paths: [],
        trigger_relevant_changed_files: [],
        changed_files: [],
      },
    };
    const executionResult = attachCanonicalCommandResultArtifact({
      result: "ok",
      artifacts: { completed: true },
    }, { logicalKey: "test.execute", payload: executionArtifact });
    const executeCtx = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      phase: "test-execute",
      flowManager: manager,
      flowState: manager.load(created.specId),
    };
    await FLOW_COMMANDS.run["test-execute"].post(executeCtx, executionResult);
    assert.equal(attachedCanonicalCommandResultArtifact(executionResult).logicalKey, "test.execute");
    const executionHistory = JSON.parse(manager.readArtifact({
      specId: created.specId,
      logicalKey: "test.execute",
      consumerNodeId: "test-result-review",
    }).bytes.toString("utf8"));
    assert.deepEqual(executionHistory.attempts.map((entry) => entry.attempt), [1]);
    assert.equal(executionHistory.attempts[0].artifact.payload.version, "2");

    manager.updateStepStatus({ stepId: "test-result-review", requestedStatus: "in_progress" });
    const reviewCtx = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      phase: "test-result-review",
      flowManager: manager,
      flowState: manager.load(created.specId),
    };
    const reviewResult = await new RunTestResultReviewCommand().execute(reviewCtx);
    const reviewAttachment = attachedCanonicalCommandResultArtifact(reviewResult);
    assert.equal(reviewAttachment.logicalKey, "test.result.review");
    assert.equal(reviewAttachment.payload.verdict, "pass");
    assert.deepEqual(reviewResult.changed, [manager.specLocation(created.specId).relativeArtifact("test.result.review")]);
    await FLOW_COMMANDS.run["test-result-review"].post(reviewCtx, reviewResult);
    const reviewHistory = JSON.parse(manager.readArtifact({
      specId: created.specId,
      logicalKey: "test.result.review",
      consumerNodeId: "impl-review",
    }).bytes.toString("utf8"));
    assert.deepEqual(reviewHistory.attempts.map((entry) => entry.attempt), [1]);
    assert.equal(reviewHistory.attempts[0].artifact.payload.verdict, "pass");
    assert.equal(fs.existsSync(path.join(manager.specLocation(created.specId).directory, "test-result-review.md")), false);
  });

  it("projects Definition's partial test-execute block without mutating canonical state", async () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");
    advanceTo(manager, created.specId, "test-execute", {
      onActive(nodeId) {
        if (nodeId !== "test") return;
        manager.publishArtifacts({
          specId: created.specId,
          nodeId: "test",
          artifactWrites: [{
            logicalKey: "tests.source",
            parameters: { testPath: "partial.fixture.test.js" },
            mediaType: "text/javascript",
            bytes: Buffer.from("import test from 'node:test';\ntest('partial fixture', () => {});\n", "utf8"),
          }],
        });
      },
    });
    const testSourceRevision = new CanonicalTestArtifactStore({
      flowManager: manager,
      state: manager.load(created.specId),
    }).testSourceRevision().digest;
    const partialResult = attachCanonicalCommandResultArtifact({ result: "ok", artifacts: {} }, {
      logicalKey: "test.execute",
      payload: {
        version: "2",
        repairFingerprint: "a".repeat(64),
        testSourceRevision,
        rawEvidenceFingerprint: crypto.createHash("sha256").update("").digest("hex"),
        process: { started: true, exitCode: 0, signal: null, timedOut: false, spawnError: null },
        raw_output_path: manager.specLocation(created.specId).relativeArtifact("test.execute.raw-log"),
        summary: [],
        regression: {
          required: false, result: "skipped", mode: "none", category: "docs-only",
          reason: "partial fixture", classified_paths: [], changed_files: [], trigger_relevant_changed_files: [],
        },
      },
    });
    const fresh = await new GetNextActionCommand().execute({
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      flowManager: manager,
      flowState: manager.load(created.specId),
      config: {},
    });
    assert.equal(fresh.directive.kind, "execute_step");
    manager.publishCurrentAttemptResult({ specId: created.specId, commandResult: partialResult });
    const before = {
      state: manager.canonicalState(created.specId).toJSON(),
      activities: manager.activityLedger(created.specId),
      catalog: manager.artifactCatalog(created.specId).toJSON(),
    };
    const next = await new GetNextActionCommand().execute({
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      flowManager: manager,
      flowState: manager.load(created.specId),
      config: {},
    });
    assert.equal(next.directive.kind, "blocked");
    assert.equal(next.directive.code, "TEST_CHAIN_EVIDENCE_BLOCKED");
    assert.equal(next.definitionTransition.operation, "blocked");
    assert.equal(next.definitionTransition.reason, "partial_completion");
    assert.deepEqual({
      state: manager.canonicalState(created.specId).toJSON(),
      activities: manager.activityLedger(created.specId),
      catalog: manager.artifactCatalog(created.specId).toJSON(),
    }, before);
  });

  it("publishes an injected spec-local spawn failure through RunTestExecuteCommand.run", async () => {
    const repository = root();
    fs.writeFileSync(path.join(repository, "README.md"), "test execute command fixture\n");
    initGitRepo(repository);
    commitAll(repository, "fixture baseline");
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-test-execute-public-boundary"));
    manager.addActiveFlow(created.specId, "direct");
    advanceTo(manager, created.specId, "test-execute", {
      onActive(nodeId) {
        if (nodeId !== "test") return;
        manager.publishArtifacts({ specId: created.specId, nodeId: "test", artifactWrites: [{
          logicalKey: "tests.source", parameters: { testPath: "spawn.fixture.test.js" }, mediaType: "text/javascript",
          bytes: Buffer.from("import test from 'node:test';\ntest('spawn fixture', () => {});\n", "utf8"),
        }] });
      },
    });
    const outputDirectory = path.join(repository, ".sennel", "output");
    fs.mkdirSync(outputDirectory, { recursive: true });
    fs.writeFileSync(path.join(outputDirectory, "analysis.json"), "{}\n");
    const services = new Map([
      ["paths", { root: repository }], ["flowManager", manager], ["mainRoot", repository],
      ["config", {}], ["inWorktree", false],
    ]);
    const fakeContainer = { get(name) { return services.get(name); }, has(name) { return services.has(name); } };
    const command = new RunTestExecuteCommand({
      runSpecLocal: async () => ({
        command: "node --test", noTestsDeclared: true,
        result: { started: false, exitCode: null, signal: null, timedOut: false, spawnError: "ENOENT: node unavailable", stdout: "", stderr: "" },
      }),
    });
    const result = await command.run(fakeContainer, {});
    const attached = attachedCanonicalCommandResultArtifact(result);
    assert.equal(attached.logicalKey, "test.execute");
    assert.equal(attached.payload.process.spawnError, "ENOENT: node unavailable");
    assert.match(attached.payload.rawEvidenceFingerprint, /^[a-f0-9]{64}$/);
    await FLOW_COMMANDS.run["test-execute"].post({
      root: repository, mainRoot: repository, executionRoot: repository, specId: created.specId,
      flowManager: manager, flowState: manager.load(created.specId), config: {},
    }, result);
    const state = manager.canonicalState(created.specId);
    assert.equal(state.nextAction().operation, "blocked");
    assert.equal(state.attempt.consumption.semantic, 0);
  });

  it("blocks a raw replacement after test-execute publication without mutating canonical state", async () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-test-execute-raw-replacement"));
    manager.addActiveFlow(created.specId, "direct");
    advanceTo(manager, created.specId, "test-execute", {
      onActive(nodeId) {
        if (nodeId !== "test") return;
        manager.publishArtifacts({ specId: created.specId, nodeId: "test", artifactWrites: [{
          logicalKey: "tests.source", parameters: { testPath: "raw-replacement.fixture.test.js" }, mediaType: "text/javascript",
          bytes: Buffer.from("import test from 'node:test';\ntest('raw replacement fixture', () => {});\n", "utf8"),
        }] });
      },
    });
    const revision = new CanonicalTestArtifactStore({ flowManager: manager, state: manager.load(created.specId) }).testSourceRevision().digest;
    const initialRaw = Buffer.from("initial canonical raw\n", "utf8");
    manager.writeRuntimeArtifact({ specId: created.specId, nodeId: "test-execute", artifact: {
      logicalKey: "test.execute.raw-log", mediaType: "text/plain", bytes: initialRaw,
    } });
    manager.publishCurrentAttemptResult({ specId: created.specId, commandResult: attachCanonicalCommandResultArtifact({ result: "ok", artifacts: {} }, {
      logicalKey: "test.execute", payload: {
        version: "2",
        repairFingerprint: buildRepairFingerprint({ root: repository, artifactRoot: repository, specPath: manager.specLocation(created.specId).relativeSpecFile }).hash,
        testSourceRevision: revision,
        rawEvidenceFingerprint: crypto.createHash("sha256").update(initialRaw).digest("hex"),
        process: { started: true, exitCode: 0, signal: null, timedOut: false, spawnError: null },
        raw_output_path: manager.specLocation(created.specId).relativeArtifact("test.execute.raw-log"), summary: [],
        regression: { required: false, result: "skipped", mode: "none", category: "docs-only", reason: "fixture", classified_paths: [], changed_files: [], trigger_relevant_changed_files: [] },
      },
    }) });
    manager.writeRuntimeArtifact({ specId: created.specId, nodeId: "test-execute", artifact: {
      logicalKey: "test.execute.raw-log", mediaType: "text/plain", bytes: Buffer.from("replacement canonical raw\n", "utf8"),
    } });
    const facts = readCurrentTestChainTransitionFacts({ flowManager: manager, specId: created.specId });
    assert.equal(facts.integrityFailure, "stale_execute_raw_fingerprint");
    const decision = resolveNonGateTransition(facts, testExecuteTransitionDefinition);
    assert.equal(decision.disposition.operation, "blocked");
    assert.deepEqual(decision.plan.actions, []);
    const before = { state: manager.canonicalState(created.specId).toJSON(), activities: manager.activityLedger(created.specId), catalog: manager.artifactCatalog(created.specId).toJSON() };
    const next = await new GetNextActionCommand().execute({
      root: repository, mainRoot: repository, executionRoot: repository, specId: created.specId,
      flowManager: manager, flowState: manager.load(created.specId), config: {},
    });
    assert.equal(next.directive.code, "TEST_CHAIN_EVIDENCE_BLOCKED");
    assert.equal(next.definitionTransition.reason, "stale_execute_raw_fingerprint");
    assert.deepEqual({ state: manager.canonicalState(created.specId).toJSON(), activities: manager.activityLedger(created.specId), catalog: manager.artifactCatalog(created.specId).toJSON() }, before);
  });

  it("persists Definition-owned review retry, exhaustion, tooling block, and scenario repair routes", async () => {
    const setup = (specId, target = "test-execute", versionStoreFaultInjector = null) => {
      const repository = root();
      const manager = new FlowManager({
        root: repository,
        mainRoot: repository,
        inWorktree: false,
        versionStoreFaultInjector,
      });
      const created = manager.createFresh(request(specId));
      manager.addActiveFlow(created.specId, "direct");
      advanceTo(manager, created.specId, target, {
        onActive(nodeId) {
          if (nodeId !== "test") return;
          manager.publishArtifacts({ specId: created.specId, nodeId: "test", artifactWrites: [{
            logicalKey: "tests.source", parameters: { testPath: "definition-route.test.js" }, mediaType: "text/javascript",
            bytes: Buffer.from("import test from 'node:test';\ntest('definition route', () => {});\n", "utf8"),
          }] });
        },
      });
      const testSourceRevision = new CanonicalTestArtifactStore({ flowManager: manager, state: manager.load(created.specId) }).testSourceRevision().digest;
      const raw = Buffer.from("definition route raw evidence\n", "utf8");
      if (target === "test-execute") {
        manager.writeRuntimeArtifact({ specId: created.specId, nodeId: "test-execute", artifact: {
          logicalKey: "test.execute.raw-log", mediaType: "text/plain", bytes: raw,
        } });
      }
      const repairFingerprint = buildRepairFingerprint({ root: repository, artifactRoot: repository, specPath: manager.specLocation(created.specId).relativeSpecFile }).hash;
      return { repository, manager, created, testSourceRevision, raw, repairFingerprint };
    };
    const executionResult = ({ manager, created, testSourceRevision, repairFingerprint, raw }, process = { started: true, exitCode: 0, signal: null, timedOut: false, spawnError: null }) => attachCanonicalCommandResultArtifact({ result: "ok", artifacts: {} }, {
      logicalKey: "test.execute", payload: {
        version: "2", repairFingerprint, testSourceRevision,
        rawEvidenceFingerprint: crypto.createHash("sha256").update(raw).digest("hex"),
        process,
        raw_output_path: manager.specLocation(created.specId).relativeArtifact("test.execute.raw-log"), summary: [],
        regression: { required: false, result: "skipped", mode: "none", category: "docs-only", reason: "fixture", classified_paths: [], changed_files: [], trigger_relevant_changed_files: [] },
      },
    });
    const contextFor = ({ repository, manager, created }, phase) => ({ root: repository, mainRoot: repository, executionRoot: repository,
      specId: created.specId, phase, flowManager: manager, flowState: manager.load(created.specId), config: {} });
    const scenarioBlockResult = ({ manager, created }) => attachCanonicalCommandResultArtifact({ result: "block", artifacts: {} }, {
      logicalKey: "scenario.validity",
      payload: {
        version: "1",
        testSourceRevision: new CanonicalTestArtifactStore({
          flowManager: manager,
          state: manager.load(created.specId),
        }).testSourceRevision().digest,
        command: "node --test",
        process: { started: true, exitCode: 1, signal: null, timedOut: false, spawnError: null }, result: "block",
        raw_output_path: manager.specLocation(created.specId).relativeArtifact("scenario.validity.raw-log"),
        summary: [{ id: "R1", classification: "invalid_test", evidence: {
          test_file: "fixture.test.js", test_name: "R1: fixture", command: "node --test", raw_output_lines: { start_line: 1, end_line: 1 },
        } }],
      },
    });

    const retries = setup("001-test-chain-retry-routes");
    await FLOW_COMMANDS.run["test-execute"].post(contextFor(retries, "test-execute"), executionResult(retries));
    for (let sequence = 1; sequence <= 3; sequence += 1) {
      if (sequence === 1) {
        retries.manager.updateStepStatus({ stepId: "test-result-review", requestedStatus: "in_progress" }, { specId: retries.created.specId });
      }
      const source = retries.manager.readArtifact({ specId: retries.created.specId, logicalKey: "test.execute", consumerNodeId: "test-result-review" });
      const sourceActivity = retries.manager.activityLedger(retries.created.specId).find((entry) => entry.id === source.descriptor.activityId);
      const review = attachCanonicalCommandResultArtifact({ result: "ok", artifacts: {} }, { logicalKey: "test.result.review", payload: {
        verdict: "fail", checked_items: [
          { check: "summary_evidence", result: "fail", detail: "fixture failure" },
          { check: "project_regression_verification", result: "pass", detail: "fixture regression evidence" },
        ], invalid_reason: "fixture failure",
        result_file_path: retries.manager.specLocation(retries.created.specId).relativeArtifact("test.execute"),
        raw_output_path: retries.manager.specLocation(retries.created.specId).relativeArtifact("test.execute.raw-log"),
        repairFingerprint: retries.repairFingerprint, testSourceRevision: retries.testSourceRevision,
        testExecute: { historyAttempt: 1, producerActivityId: sourceActivity.id, attemptId: sourceActivity.attemptId, sequence: sourceActivity.sequence },
        rawEvidenceFingerprint: crypto.createHash("sha256").update(retries.raw).digest("hex"),
      } });
      await FLOW_COMMANDS.run["test-result-review"].post(contextFor(retries, "test-result-review"), review);
      const state = retries.manager.canonicalState(retries.created.specId);
      if (sequence < 3) {
        assert.equal(state.nextAction().operation, "retry");
        retries.manager.beginNextAction(retries.created.specId);
      } else {
        assert.equal(state.nextAction().operation, "blocked");
        assert.equal(state.attempt.failure.retryable, false);
        assert.equal(state.attempt.failure.code, "TEST_CHAIN_RETRY_EXHAUSTED");
      }
    }

    const tooling = setup("001-test-chain-tooling-route");
    const toolingResult = executionResult(tooling, { started: false, exitCode: null, signal: null, timedOut: false, spawnError: "ENOENT" });
    await FLOW_COMMANDS.run["test-execute"].post(contextFor(tooling, "test-execute"), toolingResult);
    const toolingState = tooling.manager.canonicalState(tooling.created.specId);
    assert.equal(toolingState.nextAction().operation, "blocked");
    assert.equal(toolingState.attempt.consumption.semantic, 0);

    const repair = setup("001-scenario-repair-route", "scenario-validity");
    repair.manager.writeRuntimeArtifact({ specId: repair.created.specId, nodeId: "scenario-validity", artifact: {
      logicalKey: "scenario.validity.raw-log", mediaType: "text/plain", bytes: Buffer.from("R1 invalid scenario\n", "utf8"),
    } });
    const scenario = scenarioBlockResult(repair);
    await FLOW_COMMANDS.run["scenario-validity"].post(contextFor(repair, "scenario-validity"), scenario);
    const repairedState = repair.manager.canonicalState(repair.created.specId);
    assert.equal(repairedState.current.at(-1), "test");
    assert.equal(repairedState.nextAction().operation, "resume");
    assert.deepEqual(repairedState.attempt.consumption.toJSON(), { semantic: 0, tooling: 0 });
    assert.equal(repair.manager.activityLedger(repair.created.specId).at(-1).transition.operation, "repair_scenario_validity");
    assert.equal(repair.manager.readArtifact({
      specId: repair.created.specId, logicalKey: "issue.log", consumerNodeId: "test",
    }) !== null, true);

    let failScenarioSettlement = true;
    const interrupted = setup("001-scenario-repair-atomicity", "scenario-validity", ({ phase, activity }) => {
      if (failScenarioSettlement && phase === "activity-appended"
        && activity.transition.operation === "repair_scenario_validity") {
        throw new Error("simulated scenario settlement interruption");
      }
    });
    interrupted.manager.writeRuntimeArtifact({ specId: interrupted.created.specId, nodeId: "scenario-validity", artifact: {
      logicalKey: "scenario.validity.raw-log", mediaType: "text/plain", bytes: Buffer.from("R1 interrupted scenario\n", "utf8"),
    } });
    const interruptedResult = scenarioBlockResult(interrupted);
    await assert.rejects(
      FLOW_COMMANDS.run["scenario-validity"].post(contextFor(interrupted, "scenario-validity"), interruptedResult),
      /simulated scenario settlement interruption/,
    );
    const afterInterruptedSettlement = interrupted.manager.canonicalState(interrupted.created.specId);
    assert.equal(afterInterruptedSettlement.current.at(-1), "scenario-validity");
    assert.equal(afterInterruptedSettlement.attempt.failure, null);
    assert.equal(interrupted.manager.readArtifact({
      specId: interrupted.created.specId, logicalKey: "issue.log", consumerNodeId: "scenario-validity", optional: true,
    }), null);
    assert.equal(interrupted.manager.activityLedger(interrupted.created.specId).some((activity) => (
      activity.transition.operation === "repair_scenario_validity"
    )), false);

    failScenarioSettlement = false;
    const interruptedFacts = readCurrentTestChainTransitionFacts({
      flowManager: interrupted.manager, specId: interrupted.created.specId,
    });
    const interruptedDecision = resolveNonGateTransition(interruptedFacts, scenarioValidityTransitionDefinition);
    interrupted.manager.applyTestChainTransitionDecision({
      specId: interrupted.created.specId,
      decision: interruptedDecision,
    });
    const settledActivityCount = interrupted.manager.activityLedger(interrupted.created.specId).length;
    interrupted.manager.applyTestChainTransitionDecision({
      specId: interrupted.created.specId,
      decision: interruptedDecision,
    });
    assert.equal(interrupted.manager.activityLedger(interrupted.created.specId).length, settledActivityCount);
    assert.equal(interrupted.manager.canonicalState(interrupted.created.specId).current.at(-1), "test");
    assert.equal(interrupted.manager.readArtifact({
      specId: interrupted.created.specId, logicalKey: "issue.log", consumerNodeId: "test",
    }) !== null, true);

    const restarted = setup("001-test-chain-restarted-attempt", "scenario-validity");
    for (let episode = 1; episode <= 4; episode += 1) {
      restarted.manager.writeRuntimeArtifact({ specId: restarted.created.specId, nodeId: "scenario-validity", artifact: {
        logicalKey: "scenario.validity.raw-log", mediaType: "text/plain",
        bytes: Buffer.from(`R1 restarted scenario episode ${episode}\n`, "utf8"),
      } });
      const result = scenarioBlockResult(restarted);
      if (episode === 4) {
        restarted.manager.publishCurrentAttemptResult({ specId: restarted.created.specId, commandResult: result });
        const restartedFacts = readCurrentTestChainTransitionFacts({
          flowManager: restarted.manager,
          specId: restarted.created.specId,
        });
        assert.ok(restartedFacts.currentAttempt.sequence > 3);
        assert.equal(restarted.manager.canonicalState(restarted.created.specId).attempt.consumption.semantic, 0);
        assert.equal(restartedFacts.retry.used, 1);
        restarted.manager.applyTestChainTransitionDecision({
          specId: restarted.created.specId,
          decision: resolveNonGateTransition(restartedFacts, scenarioValidityTransitionDefinition),
        });
        break;
      }
      await FLOW_COMMANDS.run["scenario-validity"].post(contextFor(restarted, "scenario-validity"), result);
      restarted.manager.publishArtifacts({ specId: restarted.created.specId, nodeId: "test", artifactWrites: [{
        logicalKey: "tests.source",
        parameters: { testPath: "definition-route.test.js" },
        mediaType: "text/javascript",
        bytes: Buffer.from(`import test from 'node:test';\ntest('definition route ${episode}', () => {});\n`, "utf8"),
      }] });
      confirmFixtureStep(restarted.manager, "test", { specId: restarted.created.specId });
      restarted.manager.updateStepStatus({ stepId: "scenario-validity", requestedStatus: "in_progress" }, {
        specId: restarted.created.specId,
      });
    }
    assert.equal(restarted.manager.canonicalState(restarted.created.specId).current.at(-1), "test");

    const advisory = setup("001-test-chain-nonblocking-route", "scenario-validity");
    advisory.manager.activateNonblockingPolicy({ specId: advisory.created.specId, policy: {
      enabled: true, activatedAt: "2026-08-24T00:00:00.000Z", activatedStep: "scenario-validity", reason: "fixture advisory decision",
    } });
    advisory.manager.writeRuntimeArtifact({ specId: advisory.created.specId, nodeId: "scenario-validity", artifact: {
      logicalKey: "scenario.validity.raw-log", mediaType: "text/plain", bytes: Buffer.from("R1 advisory scenario\n", "utf8"),
    } });
    await FLOW_COMMANDS.run["scenario-validity"].post(
      contextFor(advisory, "scenario-validity"),
      scenarioBlockResult(advisory),
    );
    assert.equal(advisory.manager.canonicalState(advisory.created.specId).nextAction().operation, "resume");
    assert.equal(advisory.manager.activityLedger(advisory.created.specId).at(-1).transition.operation, "record_nonblocking");
    assert.deepEqual(decisionContextForActiveFlow(advisory.repository, advisory.manager.load(advisory.created.specId), advisory.manager).allowedActions, ["retry", "continue"]);
    const advisoryDirective = await new GetNextActionCommand().execute(contextFor(advisory, "scenario-validity"));
    assert.equal(advisoryDirective.directive.code, "TEST_CHAIN_NONBLOCKING_DECISION_REQUIRED");
    assert.equal(advisoryDirective.definitionTransition.operation, "await-user-input");

    const stalePolicy = setup("001-test-chain-stale-policy", "scenario-validity");
    stalePolicy.manager.writeRuntimeArtifact({ specId: stalePolicy.created.specId, nodeId: "scenario-validity", artifact: {
      logicalKey: "scenario.validity.raw-log", mediaType: "text/plain", bytes: Buffer.from("R1 stale policy scenario\n", "utf8"),
    } });
    stalePolicy.manager.publishCurrentAttemptResult({
      specId: stalePolicy.created.specId, commandResult: scenarioBlockResult(stalePolicy),
    });
    const stalePolicyDecision = resolveNonGateTransition(readCurrentTestChainTransitionFacts({
      flowManager: stalePolicy.manager, specId: stalePolicy.created.specId,
    }), scenarioValidityTransitionDefinition);
    stalePolicy.manager.activateNonblockingPolicy({ specId: stalePolicy.created.specId, policy: {
      enabled: true, activatedAt: "2026-08-24T00:00:00.000Z", activatedStep: "scenario-validity", reason: "stale plan fixture",
    } });
    const afterPolicyActivation = {
      state: stalePolicy.manager.canonicalState(stalePolicy.created.specId).toJSON(),
      activities: stalePolicy.manager.activityLedger(stalePolicy.created.specId),
      catalog: stalePolicy.manager.artifactCatalog(stalePolicy.created.specId).toJSON(),
    };
    assert.throws(
      () => stalePolicy.manager.applyTestChainTransitionDecision({
        specId: stalePolicy.created.specId, decision: stalePolicyDecision,
      }),
      /Definition plan changed before test-chain settlement/,
    );
    assert.deepEqual({
      state: stalePolicy.manager.canonicalState(stalePolicy.created.specId).toJSON(),
      activities: stalePolicy.manager.activityLedger(stalePolicy.created.specId),
      catalog: stalePolicy.manager.artifactCatalog(stalePolicy.created.specId).toJSON(),
    }, afterPolicyActivation);

    const staleRevision = setup("001-test-chain-stale-state-revision", "scenario-validity");
    staleRevision.manager.writeRuntimeArtifact({ specId: staleRevision.created.specId, nodeId: "scenario-validity", artifact: {
      logicalKey: "scenario.validity.raw-log", mediaType: "text/plain", bytes: Buffer.from("R1 stale revision scenario\n", "utf8"),
    } });
    staleRevision.manager.publishCurrentAttemptResult({
      specId: staleRevision.created.specId, commandResult: scenarioBlockResult(staleRevision),
    });
    const staleRevisionDecision = resolveNonGateTransition(readCurrentTestChainTransitionFacts({
      flowManager: staleRevision.manager, specId: staleRevision.created.specId,
    }), scenarioValidityTransitionDefinition);
    staleRevision.manager.setAutoApprove(true, { specId: staleRevision.created.specId });
    const afterStateRevision = {
      state: staleRevision.manager.canonicalState(staleRevision.created.specId).toJSON(),
      activities: staleRevision.manager.activityLedger(staleRevision.created.specId),
      catalog: staleRevision.manager.artifactCatalog(staleRevision.created.specId).toJSON(),
    };
    assert.throws(
      () => staleRevision.manager.applyTestChainTransitionDecision({
        specId: staleRevision.created.specId, decision: staleRevisionDecision,
      }),
      /Definition plan changed before test-chain settlement/,
    );
    assert.deepEqual({
      state: staleRevision.manager.canonicalState(staleRevision.created.specId).toJSON(),
      activities: staleRevision.manager.activityLedger(staleRevision.created.specId),
      catalog: staleRevision.manager.artifactCatalog(staleRevision.created.specId).toJSON(),
    }, afterStateRevision);

    const staleRaw = setup("001-test-chain-stale-raw", "test-execute");
    staleRaw.manager.publishCurrentAttemptResult({
      specId: staleRaw.created.specId, commandResult: executionResult(staleRaw),
    });
    const staleRawDecision = resolveNonGateTransition(readCurrentTestChainTransitionFacts({
      flowManager: staleRaw.manager, specId: staleRaw.created.specId,
    }), testExecuteTransitionDefinition);
    staleRaw.manager.writeRuntimeArtifact({ specId: staleRaw.created.specId, nodeId: "test-execute", artifact: {
      logicalKey: "test.execute.raw-log", mediaType: "text/plain", bytes: Buffer.from("replacement raw evidence\n", "utf8"),
    } });
    const afterRawReplacement = {
      state: staleRaw.manager.canonicalState(staleRaw.created.specId).toJSON(),
      activities: staleRaw.manager.activityLedger(staleRaw.created.specId),
      catalog: staleRaw.manager.artifactCatalog(staleRaw.created.specId).toJSON(),
    };
    assert.throws(
      () => staleRaw.manager.applyTestChainTransitionDecision({
        specId: staleRaw.created.specId, decision: staleRawDecision,
      }),
      /Definition plan changed before test-chain settlement/,
    );
    assert.deepEqual({
      state: staleRaw.manager.canonicalState(staleRaw.created.specId).toJSON(),
      activities: staleRaw.manager.activityLedger(staleRaw.created.specId),
      catalog: staleRaw.manager.artifactCatalog(staleRaw.created.specId).toJSON(),
    }, afterRawReplacement);
    assert.throws(
      () => interrupted.manager.writeRuntimeArtifact({ specId: interrupted.created.specId, nodeId: "scenario-validity", artifact: {
        logicalKey: "scenario.validity.raw-log", mediaType: "text/plain", bytes: Buffer.from("stale producer write\n", "utf8"),
      } }),
      /producer does not own the active Attempt/,
    );

    let raceArmed = false;
    let rawRaceError = null;
    let rawRaceAttempts = 0;
    let raceManager = null;
    const raced = setup("001-test-chain-raw-write-race", "scenario-validity", ({ phase, activity }) => {
      if (!raceArmed || phase !== "activity-ready-to-append" || activity.transition.operation !== "repair_scenario_validity") return;
      rawRaceAttempts += 1;
      try {
        raceManager.writeRuntimeArtifact({ specId: raced.created.specId, nodeId: "scenario-validity", artifact: {
          logicalKey: "scenario.validity.raw-log", mediaType: "text/plain", bytes: Buffer.from("racing replacement\n", "utf8"),
        } });
      } catch (error) {
        rawRaceError = error;
      }
    });
    raceManager = raced.manager;
    const stableRaw = Buffer.from("R1 lock-race scenario\n", "utf8");
    raced.manager.writeRuntimeArtifact({ specId: raced.created.specId, nodeId: "scenario-validity", artifact: {
      logicalKey: "scenario.validity.raw-log", mediaType: "text/plain", bytes: stableRaw,
    } });
    raced.manager.publishCurrentAttemptResult({
      specId: raced.created.specId, commandResult: scenarioBlockResult(raced),
    });
    const racedDecision = resolveNonGateTransition(readCurrentTestChainTransitionFacts({
      flowManager: raced.manager, specId: raced.created.specId,
    }), scenarioValidityTransitionDefinition);
    raceArmed = true;
    raced.manager.applyTestChainTransitionDecision({ specId: raced.created.specId, decision: racedDecision });
    assert.equal(rawRaceAttempts, 1);
    assert.equal(rawRaceError?.code, "FLOW_ARTIFACT_CATALOG_BUSY");
    assert.deepEqual(raced.manager.readRuntimeArtifact({
      specId: raced.created.specId, logicalKey: "scenario.validity.raw-log", consumerNodeId: "scenario-validity",
    }).bytes, stableRaw);
  });

  it("confirms definition-owned no-op leaves and persists review history through the catalog", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");

    const ordered = leaves(manager.load(created.specId).steps);
    const reviewIndex = ordered.findIndex((entry) => entry.id === "spec-review");
    assert.ok(reviewIndex > 0);
    for (const entry of ordered.slice(0, reviewIndex)) {
      confirmFixtureStep(manager, entry.id);
    }
    manager.updateStepStatus(
      { stepId: "spec-review", requestedStatus: "done" },
      {
        canonicalCommandResult: {
          result: "ok",
          artifacts: { phase: "spec", verdict: "PASS" },
        },
      },
    );

    const resolved = manager.readArtifact({
      specId: created.specId,
      logicalKey: "spec.review",
      consumerNodeId: "spec-triage",
    });
    const history = JSON.parse(resolved.bytes.toString("utf8"));
    const catalog = manager.artifactCatalog(created.specId);
    const descriptor = catalog.resolve("steps/spec-review/result.json");

    assert.deepEqual(history.attempts.map((entry) => entry.attempt), [1]);
    assert.equal(history.attempts[0].result.artifacts.verdict, "PASS");
    assert.equal(descriptor.activityId !== null, true);
    assert.throws(
      () => manager.readArtifact({
        specId: created.specId,
        logicalKey: "spec.review",
        consumerNodeId: "report",
      }),
      /consumer is not authorized/,
    );
  });

  it("records a failed producer Attempt and its result history through one V1 Store transaction", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");
    const ordered = leaves(manager.load(created.specId).steps);
    const finalRegressionIndex = ordered.findIndex((entry) => entry.id === "final-regression");
    assert.ok(finalRegressionIndex > 0);
    for (const entry of ordered.slice(0, finalRegressionIndex)) {
      confirmFixtureStep(manager, entry.id);
    }
    manager.updateStepStatus({ stepId: "final-regression", requestedStatus: "in_progress" });
    const commandResult = attachCanonicalCommandResultArtifact({
      result: "fail",
      artifacts: { failureKind: "infra_failure" },
    }, {
      logicalKey: "final.regression",
      payload: { result: "fail", failureKind: "infra_failure" },
    });

    manager.failCurrentAttempt({
      failure: {
        category: "environment",
        code: "FINAL_REGRESSION_FAILED",
        message: "final-regression failed (infra_failure)",
        retryable: false,
        retryKind: null,
      },
      result: {
        outcome: "failed",
        summary: "final-regression failed (infra_failure)",
        confirmedAt: "2026-08-13T00:00:00.000Z",
        artifactRefs: [],
      },
      commandResult,
    });

    const typed = manager.canonicalState(created.specId);
    assert.equal(typed.attempt.nodeId, "final-regression");
    assert.equal(typed.attempt.failure.code, "FINAL_REGRESSION_FAILED");
    const history = JSON.parse(manager.readArtifact({
      specId: created.specId,
      logicalKey: "final.regression",
      consumerNodeId: "report",
    }).bytes.toString("utf8"));
    assert.deepEqual(history.attempts.map((entry) => entry.attempt), [1]);
    assert.equal(history.attempts[0].artifact.payload.failureKind, "infra_failure");
    const activities = fs.readFileSync(manager.specLocation(created.specId).activitiesFile, "utf8")
      .trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(activities.at(-1).transition.operation, "fail_attempt");
    assert.equal(activities.at(-1).failure.code, "FINAL_REGRESSION_FAILED");
  });

  it("runs final-regression through the canonical raw/result contracts and confirms it through the registry", async () => {
    const repository = root();
    fs.writeFileSync(path.join(repository, "package.json"), JSON.stringify({
      scripts: { test: "node --test final-regression.test.js" },
    }, null, 2));
    fs.writeFileSync(path.join(repository, "final-regression.test.js"), [
      "import test from 'node:test';",
      "import assert from 'node:assert/strict';",
      "test('canonical final regression', () => assert.equal(1, 1));",
      "",
    ].join("\n"));
    initGitRepo(repository);
    commitAll(repository, "initial");
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-canonical-final-regression", {
      execution: { mode: "direct", baseBranch: "main" },
    }));
    manager.addActiveFlow(created.specId, "direct");
    const ordered = leaves(manager.load(created.specId).steps);
    const finalRegressionIndex = ordered.findIndex((entry) => entry.id === "final-regression");
    for (const entry of ordered.slice(0, finalRegressionIndex)) {
      confirmFixtureStep(manager, entry.id);
    }
    manager.updateStepStatus({ stepId: "final-regression", requestedStatus: "in_progress" });
    const ctx = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      phase: "final-regression",
      config: { test: { command: "node --test final-regression.test.js", timeout: 5 } },
      flowManager: manager,
      flowState: manager.load(created.specId),
    };

    const result = await new RunFinalRegressionCommand().execute(ctx);
    assert.equal(result.result, "pass");
    assert.equal(result.next, "report");
    await FLOW_COMMANDS.run["final-regression"].post(ctx, result);

    const location = manager.specLocation(created.specId);
    const history = JSON.parse(manager.readArtifact({
      specId: created.specId,
      logicalKey: "final.regression",
      consumerNodeId: "report",
    }).bytes.toString("utf8"));
    assert.equal(history.attempts[0].artifact.payload.result, "pass");
    assert.equal(history.attempts[0].artifact.payload.rawOutputPath,
      location.relativeArtifact("final.regression.raw-log", { attempt: "001" }));
    assert.equal(fs.existsSync(location.resolve("steps/final-regression/attempt-001.log")), true);
    assert.equal(leaves(manager.load(created.specId).steps)
      .find((step) => step.id === "final-regression").status, "done");
    assert.equal(fs.existsSync(path.join(location.directory, "final-regression-result.json")), false);
  });

  it("delivers a linked-Issue report through the canonical catalog and report outbox", async () => {
    const repository = root();
    fs.writeFileSync(path.join(repository, "README.md"), "canonical report\n");
    fs.writeFileSync(path.join(repository, "final-regression.test.js"), [
      "import test from 'node:test';",
      "import assert from 'node:assert/strict';",
      "test('canonical report final regression', () => assert.equal(1, 1));",
      "",
    ].join("\n"));
    initGitRepo(repository);
    commitAll(repository, "initial");
    const binDirectory = path.join(repository, "bin");
    const ghLog = path.join(repository, "gh.log");
    fs.mkdirSync(binDirectory, { recursive: true });
    fs.writeFileSync(path.join(binDirectory, "gh"), [
      "#!/bin/sh",
      "if [ \"$1\" = \"issue\" ] && [ \"$2\" = \"view\" ]; then exit 0; fi",
      "printf '%s\\n' \"$@\" >> \"$SENNEL_TEST_GH_LOG\"",
      "exit 0",
      "",
    ].join("\n"));
    fs.chmodSync(path.join(binDirectory, "gh"), 0o755);
    const originalPath = process.env.PATH;
    const originalGhLog = process.env.SENNEL_TEST_GH_LOG;
    process.env.PATH = `${binDirectory}:${originalPath}`;
    process.env.SENNEL_TEST_GH_LOG = ghLog;
    try {
      const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
      const created = manager.createFresh(request("001-canonical-linked-report", {
        execution: { mode: "direct", baseBranch: "main" },
        issue: 314,
        issueSnapshot: "# Linked issue\n\nCanonical snapshot.\n",
        specRecord: new CurrentFlowSpecRecord({
          ...emptySpecStub(),
          requirements: [{
            id: "R1",
            desc: "Bind the implementation file map to the report.",
            priority: "must",
            status: "pending",
          }],
          tasks: [],
        }, { specId: "001-canonical-linked-report" }),
      }));
      manager.addActiveFlow(created.specId, "direct");
      const ordered = leaves(manager.load(created.specId).steps);
      const reportIndex = ordered.findIndex((entry) => entry.id === "report");
      assert.ok(reportIndex > 0);
      for (const entry of ordered.slice(0, reportIndex)) {
        if (entry.id === "final-regression") {
          manager.updateStepStatus({ stepId: entry.id, requestedStatus: "in_progress" });
          const finalRegressionContext = {
            root: repository,
            mainRoot: repository,
            executionRoot: repository,
            specId: created.specId,
            phase: "final-regression",
            config: { test: { command: "node --test final-regression.test.js", timeout: 5 } },
            flowManager: manager,
            flowState: manager.load(created.specId),
          };
          const finalRegressionResult = await new RunFinalRegressionCommand().execute(finalRegressionContext);
          await FLOW_COMMANDS.run["final-regression"].post(finalRegressionContext, finalRegressionResult);
          continue;
        }
        if (entry.id === "implement") {
          manager.updateStepStatus({ stepId: entry.id, requestedStatus: "in_progress" });
          manager.updateFileMap({ requirementId: "R1", paths: ["src/report.js"] });
        }
        confirmFixtureStep(manager, entry.id);
      }
      manager.updateStepStatus({ stepId: "report", requestedStatus: "in_progress" });
      const identity = new FlowOutboxIdentity({
        runId: created.runId,
        stepId: "report",
        operation: "report",
      });
      const outbox = new FlowOutboxStore(manager, { specId: created.specId });
      const entry = outbox.beginCommand(identity);
      const ctx = {
        root: repository,
        mainRoot: repository,
        executionRoot: repository,
        specId: created.specId,
        phase: "report",
        flowManager: manager,
        flowState: manager.load(created.specId),
        flowOutboxEntry: entry,
      };

      const result = await new RunReportCommand().execute(ctx);
      const publication = attachedCanonicalCommandResultPublications(result)
        .find((candidate) => candidate.logicalKey === "report");
      assert.equal(result.result, "ok");
      assert.deepEqual(result.changed, [
        "specs/001-canonical-linked-report/001/artifacts/report.json",
      ]);
      assert.equal(publication.payload.data.delivery.status, "done");
      await FLOW_COMMANDS.run.report.post(ctx, result);

      const report = JSON.parse(manager.readArtifact({
        specId: created.specId,
        logicalKey: "report",
        consumerNodeId: "report",
      }).bytes.toString("utf8"));
      assert.equal(report.data.delivery.status, "done");
      assert.equal(report.data.delivery.idempotencyKey, identity.idempotencyKey);
      assert.equal(
        report.data.binding.sourceArtifacts.some((source) => (
          source.path === "specs/001-canonical-linked-report/001/steps/impl/file-map.json"
        )),
        true,
      );
      assert.equal(outbox.status(identity).status, "done");
      assert.equal(leaves(manager.load(created.specId).steps)
        .find((step) => step.id === "report").status, "done");
      assert.equal(fs.existsSync(path.join(manager.specLocation(created.specId).directory, "report.json")), false);
      assert.match(fs.readFileSync(ghLog, "utf8"), new RegExp(`sennel:${identity.idempotencyKey}`));
    } finally {
      process.env.PATH = originalPath;
      if (originalGhLog === undefined) delete process.env.SENNEL_TEST_GH_LOG;
      else process.env.SENNEL_TEST_GH_LOG = originalGhLog;
    }
  });

  it("writes immutable review evidence under its active producer directory", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");

    const ordered = leaves(manager.load(created.specId).steps);
    const reviewIndex = ordered.findIndex((entry) => entry.id === "spec-review");
    for (const entry of ordered.slice(0, reviewIndex)) {
      confirmFixtureStep(manager, entry.id);
    }
    manager.updateStepStatus({ stepId: "spec-review", requestedStatus: "in_progress" });
    const digest = "a".repeat(64);
    const evidence = {
      logicalKey: "review.evidence",
      reviewStep: "spec-review",
      digest,
      mediaType: "application/json",
      bytes: '{"version":1,"verdict":"PASS"}\n',
    };
    const activityCount = manager.activityLedger(created.specId).length;
    manager.publishArtifacts({ nodeId: "spec-review", artifactWrites: [evidence] });

    const relativePath = `steps/spec-review/evidence/${digest}.json`;
    const descriptor = manager.artifactCatalog(created.specId).resolve(relativePath);
    assert.equal(descriptor.logicalKey, "review.evidence");
    assert.equal(fs.existsSync(path.join(manager.specLocation(created.specId).directory, relativePath)), true);
    assert.equal(manager.activityLedger(created.specId).length, activityCount + 1);
    assert.throws(
      () => manager.publishArtifacts({
        nodeId: "spec-review",
        artifactWrites: [{ ...evidence, bytes: '{"version":1,"verdict":"REJECTED"}\n' }],
      }),
      /immutable artifact publication cannot replace existing bytes/,
    );
  });

  it("registers independent advisory review evidence through the V1 catalog without a root-state mutation", () => {
    const repository = root();
    fs.writeFileSync(path.join(repository, "README.md"), "canonical review evidence\n");
    initGitRepo(repository);
    commitAll(repository, "initial");
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-canonical-set-review-evidence"));
    manager.addActiveFlow(created.specId, "direct");
    const ordered = leaves(manager.load(created.specId).steps);
    const reviewIndex = ordered.findIndex((entry) => entry.id === "spec-review");
    for (const entry of ordered.slice(0, reviewIndex)) {
      confirmFixtureStep(manager, entry.id);
    }
    manager.updateStepStatus({ stepId: "spec-review", requestedStatus: "in_progress" });
    const flowState = manager.load(created.specId);
    const ctx = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      flowManager: manager,
      flowState,
    };
    const evidenceFile = ".sennel/output/independent-review.json";
    fs.mkdirSync(path.join(repository, ".sennel", "output"), { recursive: true });
    const authority = ReviewTargetAuthority.fromContext(ctx);
    const fingerprint = authority.captureFingerprint();
    const targetState = authority.captureTargetStateForPhase("spec", fingerprint);
    fs.writeFileSync(path.join(repository, evidenceFile), JSON.stringify({
      version: 1,
      phase: "spec",
      taskId: null,
      treeSha: authority.resolveTreeSha(),
      targetStateDigest: targetState.digest,
      provenance: {
        provider: "independent-reviewer",
        invocationId: "canonical-set-review-evidence",
        capturedAt: "2026-08-14T00:00:00.000Z",
      },
      disposition: "ADVISORY",
      blockingFindings: [],
      advisoryFindings: [{
        findingId: "advisory-catalog-reference",
        summary: "Catalog evidence stays authoritative for advisory handoff.",
        fingerprint: "c".repeat(64),
        evidenceRefs: ["independent-review.json#advisory-catalog-reference"],
        disposition: "informational",
      }],
    }, null, 2) + "\n");

    const result = new SetReviewEvidenceCommand().execute({ ...ctx, file: evidenceFile });
    assert.equal(result.providerInvoked, false);
    assert.equal(result.phase, "spec");
    assert.equal(result.reviewAction.kind, "move_to_acceptance");
    assert.equal(result.reviewAction.handoffFindings.length, 1);
    assert.equal(result.reviewAction.handoffFindings[0].evidenceDigest, result.evidenceDigest);
    assert.match(result.artifactPath, /^steps\/spec-review\/evidence\/[a-f0-9]{64}\.json$/);
    assert.equal(result.reviewAction.handoffFindings[0].canonicalEvidenceRef, result.artifactPath);
    assert.equal(manager.artifactCatalog(created.specId).resolve(result.artifactPath).logicalKey, "review.evidence");
    const evidence = manager.readCatalogArtifact({
      specId: created.specId,
      relativePath: result.artifactPath,
      consumerNodeId: "spec-triage",
    });
    assert.equal(JSON.parse(evidence.bytes.toString("utf8")).disposition, "ADVISORY");
    assert.equal(Object.hasOwn(manager.load(created.specId), "reviewConvergence"), false);
    const activityCount = manager.activityLedger(created.specId).length;
    assert.throws(
      () => new SetReviewEvidenceCommand().execute({ ...ctx, file: evidenceFile }),
      (error) => error?.code === "REVIEW_ALREADY_COMPLETED",
    );
    assert.equal(manager.activityLedger(created.specId).length, activityCount);
  });

  it("does not send a Version-1 review through the retired PASS projection recovery writer", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-canonical-review-recovery"));
    manager.addActiveFlow(created.specId, "direct");
    const result = new RunRecoverReviewPassCommand().execute({
      root: repository,
      executionRoot: repository,
      flowState: manager.load(created.specId),
      flowManager: manager,
      phase: "spec",
      expectRunId: "canonical-manager-run",
      expectSpec: created.specId,
      expectNoIssue: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "REVIEW_PASS_RECOVERY_NOT_ELIGIBLE");
    assert.equal(Object.hasOwn(manager.load(created.specId), "reviewConvergence"), false);
  });

  it("runs the normal spec-review worker in a transient V1 work unit and confirms its result through the Store", async () => {
    const repository = root();
    initializeReviewSource(repository);
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");
    const ordered = leaves(manager.load(created.specId).steps);
    const reviewIndex = ordered.findIndex((entry) => entry.id === "spec-review");
    for (const entry of ordered.slice(0, reviewIndex)) {
      confirmFixtureStep(manager, entry.id);
    }
    manager.updateStepStatus({ stepId: "spec-review", requestedStatus: "in_progress" });

    let invocation = null;
    const review = new RunReviewCommand({
      resolveTreeSha: () => "a".repeat(40),
      resolveTargetStateDigest: () => "b".repeat(64),
      runCommand(command, args, options) {
        invocation = { command, args, options };
        const outputDirectory = options.env.SENNEL_REVIEW_OUTPUT_DIR;
        const specSource = JSON.parse(options.env.SENNEL_REVIEW_SPEC_SOURCE);
        assert.equal(specSource.logicalKey, "spec.record");
        assert.equal(specSource.logicalPath, "spec.json");
        assert.equal(specSource.sourcePath.startsWith(`${outputDirectory}${path.sep}`), true);
        assert.deepEqual(
          JSON.parse(fs.readFileSync(specSource.sourcePath, "utf8")),
          JSON.parse(manager.readArtifact({
            specId: created.specId,
            logicalKey: "spec.record",
            consumerNodeId: "spec-review",
          }).bytes.toString("utf8")),
        );
        assert.equal(options.env.SENNEL_REVIEW_FILE_MAP_SOURCE, undefined);
        fs.writeFileSync(path.join(outputDirectory, "spec-review.json"), JSON.stringify({
          verdict: "PASS",
          blockingFindings: [],
          nonBlockingImprovements: [],
        }, null, 2) + "\n");
        ReviewWorkUnit.fromEnvironment(options.env).seal();
        return {
          ok: true,
          status: 0,
          stdout: "NO_PROPOSALS\n",
          stderr: "  [spec-review] verdict=PASS proposalCount=0\n",
          signal: null,
          killed: false,
        };
      },
    });
    const ctx = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      phase: "spec",
      flowManager: manager,
      flowState: manager.load(created.specId),
      config: {},
    };

    const foreignRoot = root();
    initializeReviewSource(foreignRoot);
    const dynamicConfig = ["GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0"];
    const inheritedGitEnvironment = Object.fromEntries(
      [...GIT_REPOSITORY_LOCATION_ENVIRONMENT, ...dynamicConfig].map((name) => [name, process.env[name]]),
    );
    const globalConfig = path.join(foreignRoot, "global.gitconfig");
    fs.writeFileSync(globalConfig, "[user]\n  name = Review Worker\n");
    Object.assign(process.env, {
      GIT_DIR: path.join(foreignRoot, ".git"),
      GIT_WORK_TREE: foreignRoot,
      GIT_INDEX_FILE: path.join(foreignRoot, ".git", "index"),
      GIT_OBJECT_DIRECTORY: path.join(foreignRoot, ".git", "objects"),
      GIT_ALTERNATE_OBJECT_DIRECTORIES: path.join(foreignRoot, ".git", "objects"),
      GIT_COMMON_DIR: path.join(foreignRoot, ".git"),
      GIT_CEILING_DIRECTORIES: foreignRoot,
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "core.worktree",
      GIT_CONFIG_VALUE_0: foreignRoot,
      GIT_CONFIG_PARAMETERS: "core.worktree=foreign",
      GIT_CONFIG_GLOBAL: globalConfig,
    });
    delete process.env.GIT_CONFIG_NOSYSTEM;
    const expectedReviewGitEnvironment = Object.fromEntries(
      [...GIT_REPOSITORY_LOCATION_ENVIRONMENT, ...dynamicConfig].map((name) => [name, process.env[name]]),
    );
    let result;
    try {
      result = await review.execute(ctx);
    } finally {
      for (const [name, value] of Object.entries(inheritedGitEnvironment)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
    assert.equal(invocation.command, "node");
    assert.deepEqual(invocation.args.slice(-2), ["--phase", "spec"]);
    assert.equal(invocation.options.cwd, repository);
    assert.equal(invocation.options.env.SENNEL_REVIEW_WORK_UNIT_CHECKOUT, undefined);
    assert.equal(
      invocation.options.timeout,
      AgentTimeout.fromConfig().toOuterProcessMilliseconds(),
      "the outer review worker survives the inner Agent's process-tree cleanup window",
    );
    assert.equal(invocation.options.env.SENNEL_REVIEW_OUTPUT_DIR.startsWith(
      path.join(repository, ".sennel", "review-work-units"),
    ), true);
    for (const [name, value] of Object.entries(expectedReviewGitEnvironment)) {
      assert.equal(invocation.options.env[name], value, `${name} must be inherited by the review worker`);
    }
    assert.equal(invocation.options.env.GIT_CONFIG_GLOBAL, globalConfig);
    assert.equal(invocation.options.env.GIT_CONFIG_NOSYSTEM, undefined);
    assert.equal(result.artifacts.phase, "spec");
    assert.equal(result.artifacts.evidenceDigest.length, 64);
    assert.equal(attachedCanonicalCommandResultArtifact(result).logicalKey, "spec.review");
    assert.equal(attachedCanonicalCommandResultPublications(result)[0].logicalKey, "review.evidence");

    await FLOW_COMMANDS.run.review.post(ctx, result);
    const transientWorkUnit = invocation.options.env.SENNEL_REVIEW_OUTPUT_DIR;
    assert.equal(fs.existsSync(transientWorkUnit), false);

    const location = manager.specLocation(created.specId);
    const history = JSON.parse(manager.readArtifact({
      specId: created.specId,
      logicalKey: "spec.review",
      consumerNodeId: "spec-triage",
    }).bytes.toString("utf8"));
    const evidencePath = `steps/spec-review/evidence/${result.artifacts.evidenceDigest}.json`;
    const evidence = manager.artifactCatalog(created.specId).resolve(evidencePath);
    const state = manager.load(created.specId);

    assert.deepEqual(history.attempts.map((entry) => entry.attempt), [1]);
    assert.equal(history.attempts[0].artifact.payload.canonicalEvidence.disposition, "PASS");
    assert.equal(evidence.relativePath, evidencePath);
    assert.equal(leaves(state.steps).find((entry) => entry.id === "spec-review").status, "done");
    assert.equal(fs.existsSync(path.join(location.directory, "spec-review.json")), false);
    assert.equal(fs.existsSync(path.join(location.directory, "review-history")), false);
  });

  it("rejects review evidence when the execution checkout changes during the review", async () => {
    const repository = root();
    initializeReviewSource(repository);
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-review-source-changed"));
    manager.addActiveFlow(created.specId, "direct");
    advanceTo(manager, created.specId, "spec-review");

    const review = new RunReviewCommand({
      runCommand(_command, _args, options) {
        const outputDirectory = options.env.SENNEL_REVIEW_OUTPUT_DIR;
        fs.writeFileSync(path.join(outputDirectory, "spec-review.json"), `${JSON.stringify({
          verdict: "PASS",
          blockingFindings: [],
          nonBlockingImprovements: [],
        }, null, 2)}\n`);
        ReviewWorkUnit.fromEnvironment(options.env).seal();
        fs.writeFileSync(path.join(repository, "README.md"), "changed while review was running\n");
        return { ok: true, status: 0, stdout: "", stderr: "", signal: null, killed: false };
      },
    });
    const ctx = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      phase: "spec",
      flowManager: manager,
      flowState: manager.load(created.specId),
      config: {},
    };
    const before = manager.activityLedger(created.specId).length;

    const result = await review.execute(ctx);

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "STALE_REVIEW_TARGET");
    assert.equal(manager.activityLedger(created.specId).length, before);
    assert.equal(manager.canonicalState(created.specId).current.at(-1), "spec-review");
    assert.notEqual(manager.canonicalState(created.specId).attempt, null);
    assert.equal(manager.readProducerArtifact({
      specId: created.specId,
      nodeId: "spec-review",
      logicalKey: "spec.review",
      optional: true,
    }), null);
  });

  it("materializes draft review input from the catalog without exposing the Version root", async () => {
    const repository = root();
    const executionRoot = path.join(repository, "execution");
    fs.mkdirSync(executionRoot, { recursive: true });
    initializeReviewSource(executionRoot);
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-canonical-draft-review"));
    manager.addActiveFlow(created.specId, "direct");
    const draft = Buffer.from(`${JSON.stringify({ goal: "Review the draft", qa: [] }, null, 2)}\n`, "utf8");
    advanceTo(manager, created.specId, "draft");
    manager.confirmCurrentAttempt({
      specId: created.specId,
      artifactWrites: [{ logicalKey: "draft", mediaType: "application/json", bytes: draft }],
    });
    manager.updateStepStatus(
      { stepId: "draft-questions-review", requestedStatus: "in_progress" },
      { specId: created.specId },
    );

    let invocation = null;
    const review = new RunReviewCommand({
      resolveTreeSha: () => "a".repeat(40),
      runCommand(command, args, options) {
        invocation = { command, args, options };
        const source = JSON.parse(options.env.SENNEL_REVIEW_DRAFT_SOURCE);
        assert.equal(source.logicalPath, "draft.json");
        assert.deepEqual(fs.readFileSync(source.sourcePath), draft);
        assert.equal(source.revision.digest, crypto.createHash("sha256").update(draft).digest("hex"));
        assert.equal(path.dirname(source.sourcePath), options.env.SENNEL_REVIEW_OUTPUT_DIR);
        fs.writeFileSync(path.join(options.env.SENNEL_REVIEW_OUTPUT_DIR, "draft-review-questions.json"), JSON.stringify({
          version: 2,
          phase: "draft-questions",
          sourceDraft: "draft.json",
          sourceDraftRevision: source.revision,
          generatedAt: "2026-08-14T00:00:00.000Z",
          verdict: "PASS",
          summary: "No finite structural defects.",
          blockingFindings: [],
          advisoryFindings: [],
          repairTargets: [],
        }, null, 2) + "\n");
        ReviewWorkUnit.fromEnvironment(options.env).seal();
        return {
          ok: true,
          status: 0,
          stdout: "Draft review PASS. QA entries are adequate.\n",
          stderr: "  [draft-questions-review] verdict=PASS proposalCount=0\n",
          signal: null,
          killed: false,
        };
      },
    });
    const ctx = {
      root: repository,
      mainRoot: repository,
      executionRoot,
      specId: created.specId,
      phase: "draft",
      flowManager: manager,
      flowState: manager.load(created.specId),
      config: {},
    };

    const result = await review.execute(ctx);
    assert.equal(invocation.command, "node");
    assert.deepEqual(invocation.args.slice(-2), ["--phase", "draft"]);
    assert.equal(result.artifacts.phase, "draft-questions");
    assert.equal(attachedCanonicalCommandResultArtifact(result).logicalKey, "draft.questions.review");
    assert.equal(
      invocation.options.env.SENNEL_REVIEW_OUTPUT_DIR.startsWith(path.join(executionRoot, ".sennel", "review-work-units")),
      true,
    );
    assert.equal(path.resolve(invocation.options.cwd), executionRoot);
    const location = manager.specLocation(created.specId);
    assert.equal(fs.existsSync(path.join(location.directory, "draft.json")), false);
    assert.equal(fs.existsSync(path.join(location.directory, "draft-questions-review.json")), false);
    assert.equal(fs.existsSync(path.join(location.directory, "draft-questions-triage.json")), false);
    assert.equal(fs.existsSync(path.join(location.directory, "draft-questions-repair.json")), false);
  });

  for (const reviewPhase of ["draft-questions", "draft-coverage"]) {
    it(`runs the actual ${reviewPhase} writer in a sibling execution checkout before canonical promotion`, async () => {
      const fixtureRoot = root();
      const repository = path.join(fixtureRoot, "main");
      const executionRoot = path.join(fixtureRoot, "execution");
      fs.mkdirSync(repository, { recursive: true });
      initGitRepo(repository);
      commitAll(repository, "review writer fixture");
      execFileSync("git", ["worktree", "add", "-q", "-b", `writer-${reviewPhase}`, executionRoot], { cwd: repository });
      const manager = new FlowManager({ root: executionRoot, mainRoot: repository, inWorktree: true });
      const created = manager.createFresh(request(`001-actual-${reviewPhase}-writer`));
      assert.equal(manager.specLocation(created.specId).directory.startsWith(path.join(repository, "specs")), true);
      manager.addActiveFlow(created.specId, "direct");
      const draft = Buffer.from('{"goal":"Run writer boundary","qa":[],"approval":{"approved":true}}\n', "utf8");
      advanceTo(manager, created.specId, "draft");
      manager.confirmCurrentAttempt({
        specId: created.specId,
        artifactWrites: [{ logicalKey: "draft", mediaType: "application/json", bytes: draft }],
      });
      let agentCalls = 0;
      let outputDirectory = null;
      let childCwd = null;
      const runActualDraftWriter = async (_command, _args, options) => {
          outputDirectory = options.env.SENNEL_REVIEW_OUTPUT_DIR;
          childCwd = options.cwd;
          const keys = Object.keys(options.env).filter((key) => key.startsWith("SENNEL_REVIEW_"));
          const previous = new Map(keys.map((key) => [key, process.env[key]]));
          try {
            for (const key of keys) process.env[key] = options.env[key];
            container.reset();
            container.register("root", executionRoot);
            container.register("mainRoot", repository);
            container.register("flowManager", manager);
            container.register("config", { flow: { review: {} } });
            container.register("agent", {
              resolve: () => ({ provider: "writer-fixture" }),
              call: async () => { agentCalls += 1; return "NO_PROPOSALS"; },
            });
            await new FlowReviewCommand().execute({ _rawArgs: ["--phase", "draft"] });
          } finally {
            for (const [key, value] of previous) {
              if (value === undefined) delete process.env[key];
              else process.env[key] = value;
            }
            container.reset();
          }
          return { ok: true, status: 0, stdout: "", stderr: "", signal: null, killed: false };
      };
      if (reviewPhase === "draft-coverage") {
        manager.updateStepStatus(
          { stepId: "draft-questions-review", requestedStatus: "in_progress" },
          { specId: created.specId },
        );
        const questions = new RunReviewCommand({
          resolveTreeSha: () => "a".repeat(40),
          resolveTargetStateDigest: () => "b".repeat(64),
          runCommand: runActualDraftWriter,
        });
        const questionsCtx = {
          root: repository, mainRoot: repository, executionRoot, specId: created.specId,
          phase: "draft", flowManager: manager, flowState: manager.load(created.specId), config: {},
        };
        const questionsResult = await questions.execute(questionsCtx);
        await FLOW_COMMANDS.run.review.post(questionsCtx, questionsResult);
        manager.updateStepStatus(
          { stepId: "draft-refine", requestedStatus: "in_progress" },
          { specId: created.specId },
        );
        manager.confirmCurrentAttempt({
          specId: created.specId,
          artifactWrites: [{ logicalKey: "draft", mediaType: "application/json", bytes: draft }],
        });
        manager.updateStepStatus(
          { stepId: "draft-coverage-review", requestedStatus: "in_progress" },
          { specId: created.specId },
        );
      } else {
        manager.updateStepStatus(
          { stepId: "draft-questions-review", requestedStatus: "in_progress" },
          { specId: created.specId },
        );
      }
      const review = new RunReviewCommand({
        resolveTreeSha: () => "a".repeat(40),
        resolveTargetStateDigest: () => "b".repeat(64),
        runCommand: runActualDraftWriter,
      });
      const ctx = {
        root: repository, mainRoot: repository, executionRoot, specId: created.specId,
        phase: "draft", flowManager: manager, flowState: manager.load(created.specId), config: {},
      };
      const result = await review.execute(ctx);
      assert.equal(agentCalls, reviewPhase === "draft-coverage" ? 2 : 1);
      assert.equal(result.artifacts.phase, reviewPhase);
      assert.equal(result.artifacts.verdict, "PASS");
      assert.equal(fs.existsSync(path.join(outputDirectory, reviewPhase === "draft-questions"
        ? "draft-review-questions.json"
        : "draft-review-coverage.json")), true);
      assert.equal(outputDirectory.startsWith(path.join(executionRoot, ".sennel", "review-work-units")), true);
      assert.equal(path.resolve(childCwd), executionRoot);
      assert.equal(fs.existsSync(path.join(repository, ".sennel", "review-work-units")), false);
      await FLOW_COMMANDS.run.review.post(ctx, result);
      assert.equal(fs.existsSync(outputDirectory), false);
      assert.equal(manager.activityLedger(created.specId).some((activity) => activity.type === "result_confirmed"), true);
    });
  }

  for (const [verdict, expectedNext] of [["PASS", "draft-refine"], ["ADVISORY", "draft-questions-triage"]]) {
    it(`replays a sealed draft-questions ${verdict} result without rerunning the worker`, async () => {
      const repository = root();
      const executionRoot = path.join(repository, "execution");
      fs.mkdirSync(executionRoot, { recursive: true });
      initializeReviewSource(executionRoot);
      const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
      const created = manager.createFresh(request(`001-canonical-draft-replay-${verdict.toLowerCase()}`));
      manager.addActiveFlow(created.specId, "direct");
      const draft = Buffer.from(`${JSON.stringify({ goal: "Replay sealed draft review", qa: [] }, null, 2)}\n`, "utf8");
      advanceTo(manager, created.specId, "draft");
      manager.confirmCurrentAttempt({
        specId: created.specId,
        artifactWrites: [{ logicalKey: "draft", mediaType: "application/json", bytes: draft }],
      });
      manager.updateStepStatus(
        { stepId: "draft-questions-review", requestedStatus: "in_progress" },
        { specId: created.specId },
      );

      let workerRuns = 0;
      let outputDirectory = null;
      const command = new RunReviewCommand({
        resolveTreeSha: () => "a".repeat(40),
        resolveTargetStateDigest: () => "b".repeat(64),
        runCommand(_command, _args, options) {
          workerRuns += 1;
          outputDirectory = options.env.SENNEL_REVIEW_OUTPUT_DIR;
          const source = JSON.parse(options.env.SENNEL_REVIEW_DRAFT_SOURCE);
          fs.writeFileSync(path.join(options.env.SENNEL_REVIEW_OUTPUT_DIR, "draft-review-questions.json"), `${JSON.stringify({
            version: 2,
            phase: "draft-questions",
            sourceDraft: "draft.json",
            sourceDraftRevision: source.revision,
            generatedAt: "2026-08-14T00:00:00.000Z",
            verdict,
            summary: "Replay-safe review output.",
            blockingFindings: [],
            advisoryFindings: verdict === "ADVISORY" ? [{ id: "draft-advice", summary: "Optional cleanup." }] : [],
            repairTargets: [],
          }, null, 2)}\n`);
          ReviewWorkUnit.fromEnvironment(options.env).seal();
          return { ok: true, status: 0, stdout: "", stderr: "", signal: null, killed: false };
        },
      });
      const ctx = {
        root: repository,
        mainRoot: repository,
        executionRoot,
        specId: created.specId,
        phase: "draft",
        flowManager: manager,
        flowState: manager.load(created.specId),
        config: {},
      };

      const beforeCrash = await command.execute(ctx);
      assert.equal(beforeCrash.next, expectedNext);
      assert.equal(workerRuns, 1);
      const recovered = await command.execute({ ...ctx, flowState: manager.load(created.specId) });
      assert.equal(workerRuns, 1, "a sealed work unit must not invoke the Agent again");
      assert.equal(recovered.artifacts.verdict, verdict);
      assert.equal(recovered.next, expectedNext);
      await FLOW_COMMANDS.run.review.post({ ...ctx, flowState: manager.load(created.specId) }, recovered);
      assert.equal(fs.existsSync(outputDirectory), false, "publication confirmation cleans the sealed worker surface");
    });
  }

  it("reconciles a sealed worker surface after Store confirmation succeeds but cleanup crashes", async () => {
    const repository = root();
    const executionRoot = path.join(repository, "execution");
    fs.mkdirSync(executionRoot, { recursive: true });
    initializeReviewSource(executionRoot);
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-canonical-review-cleanup-reconcile"));
    manager.addActiveFlow(created.specId, "direct");
    const draft = Buffer.from('{"goal":"Reconcile cleanup","qa":[]}\n', "utf8");
    advanceTo(manager, created.specId, "draft");
    manager.confirmCurrentAttempt({
      specId: created.specId,
      artifactWrites: [{ logicalKey: "draft", mediaType: "application/json", bytes: draft }],
    });
    manager.updateStepStatus(
      { stepId: "draft-questions-review", requestedStatus: "in_progress" },
      { specId: created.specId },
    );
    let outputDirectory = null;
    const review = new RunReviewCommand({
      resolveTreeSha: () => "a".repeat(40),
      resolveTargetStateDigest: () => "b".repeat(64),
      runCommand(_command, _args, options) {
        outputDirectory = options.env.SENNEL_REVIEW_OUTPUT_DIR;
        const source = JSON.parse(options.env.SENNEL_REVIEW_DRAFT_SOURCE);
        fs.writeFileSync(path.join(outputDirectory, "draft-review-questions.json"), `${JSON.stringify({
          verdict: "PASS", sourceDraft: "draft.json", sourceDraftRevision: source.revision,
          blockingFindings: [], advisoryFindings: [], repairTargets: [],
        })}\n`);
        ReviewWorkUnit.fromEnvironment(options.env).seal();
        return { ok: true, status: 0, stdout: "", stderr: "", signal: null, killed: false };
      },
    });
    const ctx = {
      root: repository, mainRoot: repository, executionRoot, specId: created.specId,
      phase: "draft", flowManager: manager, flowState: manager.load(created.specId), config: {},
    };
    const result = await review.execute(ctx);
    const sealed = attachedCanonicalReviewWorkUnit(result);
    sealed.cleanup = () => { throw new Error("simulated cleanup crash"); };
    await assert.rejects(() => FLOW_COMMANDS.run.review.post(ctx, result), /simulated cleanup crash/);
    assert.equal(
      manager.activityLedger(created.specId).some((activity) => (
        activity.type === "result_confirmed" && activity.attemptId === sealed.manifestDocument.attemptId
      )),
      true,
      "Store confirmation precedes local cleanup",
    );
    assert.equal(fs.existsSync(outputDirectory), true);
    assert.equal(reconcileCompletedReviewWorkUnits({
      flowManager: manager,
      specId: created.specId,
      executionRoot,
    }), 1);
    assert.equal(fs.existsSync(outputDirectory), false);
  });

  it("materializes the shared file.map for impl review from its catalog authority", async () => {
    const repository = root();
    initializeReviewSource(repository);
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const specId = "001-canonical-file-map-review";
    const created = manager.createFresh(request(specId, {
      specRecord: new CurrentFlowSpecRecord({
        ...emptySpecStub(),
        requirements: [{ id: "R-1", desc: "Bind review to the shared file map." }],
        tasks: [],
      }, { specId }),
    }));
    manager.addActiveFlow(specId, "direct");
    advanceTo(manager, specId, "impl-review", {
      onActive(nodeId) {
        if (nodeId !== "implement") return;
        manager.updateFileMap({ specId, requirementId: "R-1", paths: ["src/mapped.js"] });
      },
    });

    let invocation = null;
    const review = new RunReviewCommand({
      resolveTreeSha: () => "a".repeat(40),
      resolveTargetStateDigest: () => "b".repeat(64),
      runCommand(command, args, options) {
        invocation = { command, args, options };
        const outputDirectory = options.env.SENNEL_REVIEW_OUTPUT_DIR;
        const specSource = JSON.parse(options.env.SENNEL_REVIEW_SPEC_SOURCE);
        const fileMapSource = JSON.parse(options.env.SENNEL_REVIEW_FILE_MAP_SOURCE);
        assert.equal(specSource.sourcePath.startsWith(`${outputDirectory}${path.sep}`), true);
        assert.equal(fileMapSource.sourcePath.startsWith(`${outputDirectory}${path.sep}`), true);
        assert.deepEqual(JSON.parse(fs.readFileSync(fileMapSource.sourcePath, "utf8")), {
          "R-1": ["src/mapped.js"],
        });
        fs.writeFileSync(path.join(outputDirectory, "impl-review.json"), `${JSON.stringify({
          verdict: "PASS",
          blockingFindings: [],
          nonBlockingImprovements: [],
        }, null, 2)}\n`);
        ReviewWorkUnit.fromEnvironment(options.env).seal();
        return {
          ok: true,
          status: 0,
          stdout: "Impl review PASS. No blocking findings or non-blocking improvements recorded.\n",
          stderr: "  [review] verdict=PASS blocking=0 nonBlocking=0\n",
          signal: null,
          killed: false,
        };
      },
    });
    const result = await review.execute({
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId,
      flowManager: manager,
      flowState: manager.load(specId),
      config: {},
    });

    assert.equal(invocation.command, "node");
    assert.equal(attachedCanonicalCommandResultArtifact(result).logicalKey, "impl.review");
    assert.equal(fs.existsSync(path.join(manager.specLocation(specId).directory, "file-map.json")), false);
  });

  it("binds rejected test-review evidence to a replacement test Attempt and handoff", async () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-canonical-test-review-repair", {
      specRecord: new CurrentFlowSpecRecord({ ...validWorkerHandoffSpec(), tasks: [] }, {
        specId: "001-canonical-test-review-repair",
      }),
    }));
    manager.addActiveFlow(created.specId, "direct");
    advanceTo(manager, created.specId, "test-review", {
      onActive(nodeId) {
        if (nodeId !== "test") return;
        manager.publishArtifacts({
          specId: created.specId,
          nodeId: "test",
          artifactWrites: [{
            logicalKey: "tests.source",
            parameters: { testPath: "requirement.test.js" },
            mediaType: "text/javascript",
            bytes: Buffer.from("// spec: R1\n", "utf8"),
          }],
        });
      },
    });
    const testArtifactStore = new CanonicalTestArtifactStore({
      flowManager: manager,
      state: manager.load(created.specId),
    });
    const sourceRevision = testArtifactStore.testSourceRevision().toJSON();
    assert.deepEqual(
      testArtifactStore.testSourceRevision().toJSON(),
      sourceRevision,
      "a cataloged test source revision is stable across repeated reads",
    );
    const evidenceDigest = "e".repeat(64);
    const finding = {
      findingId: "test-review-finding",
      fingerprint: "f".repeat(64),
      summary: "The test omits a required behavior.",
      disposition: "must-fix",
      rationale: "The test must cover the required behavior before acceptance.",
    };
    publishAttemptArtifact(manager, created.specId, "test-review", "test.review", {
      phase: "test",
      verdict: "REJECTED",
      blockingFindings: [finding],
      advisoryFindings: [],
      sourceTestArtifactRevision: sourceRevision,
      canonicalEvidence: {
        disposition: "REJECTED",
        blockingFindings: [finding],
        advisoryFindings: [],
        identity: { evidenceDigest },
      },
    });
    for (let index = 0; index < 4; index += 1) {
      manager.appendMetric({ phase: "test", counter: "reviewRetry", delta: 1 }, { specId: created.specId, taskId: null });
    }
    const ctx = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      flowManager: manager,
      flowState: manager.load(created.specId),
      flowCommandBoundary: true,
    };
    const next = await new GetNextActionCommand().execute(ctx);
    assert.equal(next.directive.actionId, "REPAIR_TEST_REVIEW", "four persisted retries remain below the definition maximum");

    const repaired = new RunRepairTestReviewCommand().execute({
      ...ctx,
      flowState: manager.load(created.specId),
    });
    assert.equal(repaired.ok, true, JSON.stringify(repaired));
    assert.equal(repaired.data.nextStep, "test");
    const state = manager.load(created.specId);
    assert.equal(state.currentNodeId, "test");
    assert.equal(leaves(state.steps).find((entry) => entry.id === "scenario-validity").status, "invalidated");
    assert.equal(leaves(state.steps).find((entry) => entry.id === "test-review").status, "invalidated");
    const firstTestAction = await new GetNextActionCommand().execute({ ...ctx, flowState: state });
    const secondTestAction = await new GetNextActionCommand().execute({ ...ctx, flowState: state });
    assert.deepEqual(
      secondTestAction,
      firstTestAction,
      "repair-test-review produces a stable next action for dispatcher identity verification",
    );

    const handoff = new WorkerArtifactHandoffCoordinator().createRequest({
      ctx,
      state,
      invocation: {
        id: "canonical-test-review-repair",
        target: { digest: "b".repeat(64) },
        action: { digest: "a".repeat(64), nextAction: { step: "test" } },
      },
    });
    assert.deepEqual(handoff.inputs.map((entry) => entry.name), ["spec.json", "test-review.json"]);
    assert.equal(handoff.inputs[1].document.verdict, "REJECTED");
    assert.equal(fs.existsSync(path.join(manager.specLocation(created.specId).directory, "test-review.json")), false);
  });

  it("does not mix stale test-review repair into a later scenario gate test replacement", async () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-repair-lineage-plan-gate", {
      specRecord: new CurrentFlowSpecRecord({ ...validWorkerHandoffSpec(), tasks: [] }, {
        specId: "001-repair-lineage-plan-gate",
      }),
    }));
    manager.addActiveFlow(created.specId, "direct");
    advanceTo(manager, created.specId, "test-review", {
      onActive(nodeId) {
        if (nodeId !== "test") return;
        manager.publishArtifacts({
          specId: created.specId,
          nodeId: "test",
          artifactWrites: [{
            logicalKey: "tests.source",
            parameters: { testPath: "scenario.test.js" },
            mediaType: "text/javascript",
            bytes: Buffer.from([
              'import test from "node:test";',
              'test("R1: exposes an invalid scenario premise", () => {});',
              "",
            ].join("\n"), "utf8"),
          }],
        });
      },
    });
    const testStore = new CanonicalTestArtifactStore({ flowManager: manager, state: manager.load(created.specId) });
    const revision = testStore.testSourceRevision().toJSON();
    const finding = {
      findingId: "test-review-finding",
      fingerprint: "f".repeat(64),
      summary: "The test omits a required behavior.",
    };
    publishAttemptArtifact(manager, created.specId, "test-review", "test.review", {
      phase: "test",
      verdict: "REJECTED",
      blockingFindings: [finding],
      advisoryFindings: [],
      sourceTestArtifactRevision: revision,
      canonicalEvidence: {
        disposition: "REJECTED",
        blockingFindings: [finding],
        advisoryFindings: [],
        identity: { evidenceDigest: "e".repeat(64) },
      },
    });
    const context = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      flowManager: manager,
      flowState: manager.load(created.specId),
      config: {},
      flowCommandBoundary: true,
    };
    const reviewRepair = new RunRepairTestReviewCommand().execute(context);
    assert.equal(reviewRepair.ok, true, JSON.stringify(reviewRepair));
    confirmFixtureStep(manager, "test", { specId: created.specId });
    manager.updateStepStatus({ stepId: "scenario-validity", requestedStatus: "in_progress" }, { specId: created.specId });
    context.flowState = manager.load(created.specId);
    const scenario = new RunScenarioValidityCommand({
      scenarioTestExecutor: async ({ executions }) => executions.map((execution) => ({
        file: execution.file,
        requirementId: execution.requirementId,
        command: `node --test ${execution.file}`,
        process: {
          started: true,
          exitCode: 0,
          signal: null,
          timedOut: false,
          spawnError: null,
          stdout: "",
          stderr: "",
        },
      })),
    });
    const blocked = await scenario.execute(context);
    assert.equal(blocked.result, "block");
    await FLOW_COMMANDS.run["scenario-validity"].post(context, blocked);
    context.flowState = manager.load(created.specId);
    const gateRepair = new RunRepairPlanGateCommand().execute(context);
    assert.equal(gateRepair.ok, true, JSON.stringify(gateRepair));

    const state = manager.load(created.specId);
    const next = await new GetNextActionCommand().execute({ ...context, flowState: state });
    assert.equal(next.step, "test");
    assert.ok(next.context.planGateRepair);
    assert.equal(Object.hasOwn(next.context, "testReviewRepair"), false);
    const handoff = new WorkerArtifactHandoffCoordinator().createRequest({
      ctx: context,
      state,
      invocation: {
        id: "repair-lineage-plan-gate",
        target: { digest: "b".repeat(64) },
        action: { digest: "a".repeat(64), nextAction: { step: "test" } },
      },
    });
    assert.ok(handoff);
    assert.doesNotThrow(() => handoff.assertCurrent(state));

    manager.publishArtifacts({
      specId: created.specId,
      nodeId: "test",
      artifactWrites: [{
        logicalKey: "tests.source",
        parameters: { testPath: "scenario.test.js" },
        mediaType: "text/javascript",
        bytes: Buffer.from([
          'import test from "node:test";',
          'test("R1: covers the repaired scenario", () => {});',
          "",
        ].join("\n"), "utf8"),
      }],
    });
    confirmFixtureStep(manager, "test", { specId: created.specId });
    manager.updateStepStatus(
      { stepId: "scenario-validity", requestedStatus: "in_progress" },
      { specId: created.specId },
    );
    confirmFixtureStep(manager, "scenario-validity", { specId: created.specId });
    manager.updateStepStatus(
      { stepId: "test-review", requestedStatus: "in_progress" },
      { specId: created.specId },
    );

    const resumedReviewState = manager.load(created.specId);
    const resumedCanonicalReviewState = manager.canonicalState(created.specId);
    const resumedReview = await new GetNextActionCommand().execute({
      ...context,
      flowState: resumedReviewState,
    });
    assert.equal(resumedCanonicalReviewState.attempt.nodeId, "test-review");
    assert.ok(
      resumedCanonicalReviewState.attempt.sequence > 1,
      "the replacement test must enter a new test-review Attempt",
    );
    assert.equal(resumedReview.step, "test-review");
    assert.notEqual(resumedReview.directive.actionId, "REPAIR_TEST_REVIEW");

    const stateBeforeRejectedRepair = resumedCanonicalReviewState.toJSON();
    const rejectedHistoricalRepair = new RunRepairTestReviewCommand().execute({
      ...context,
      flowState: resumedReviewState,
    });
    assert.equal(rejectedHistoricalRepair.ok, false);
    assert.equal(rejectedHistoricalRepair.errors[0].code, "TEST_REVIEW_REPAIR_STAGE_UNSUPPORTED");
    assert.deepEqual(manager.canonicalState(created.specId).toJSON(), stateBeforeRejectedRepair);
  });

  it("preserves current test-review Attempt evidence and revision guards", async () => {
    const cases = [
      {
        label: "stale source revision",
        expectedCode: "TEST_REVIEW_REPAIR_REVISION_MISMATCH",
        alter({ payload }) {
          return {
            ...payload,
            sourceTestArtifactRevision: {
              ...payload.sourceTestArtifactRevision,
              digest: "0".repeat(64),
            },
          };
        },
      },
      {
        label: "invalid canonical evidence",
        expectedDirectiveCode: "TEST_REVIEW_REPAIR_EVIDENCE_INVALID",
        alter({ payload }) {
          return {
            ...payload,
            canonicalEvidence: {
              ...payload.canonicalEvidence,
              blockingFindings: [],
            },
          };
        },
      },
      {
        label: "exhausted stale source revision converges before repair validation",
        exhausted: true,
        alter({ payload }) {
          return {
            ...payload,
            sourceTestArtifactRevision: {
              ...payload.sourceTestArtifactRevision,
              digest: "0".repeat(64),
            },
          };
        },
      },
    ];

    for (const testCase of cases) {
      const repository = root();
      const caseId = testCase.expectedCode ?? testCase.expectedDirectiveCode ?? "exhausted-stale-revision";
      const specId = `001-current-review-guard-${caseId.toLowerCase()}`;
      const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
      const created = manager.createFresh(request(specId, {
        specRecord: new CurrentFlowSpecRecord({ ...validWorkerHandoffSpec(), tasks: [] }, { specId }),
      }));
      manager.addActiveFlow(created.specId, "direct");
      advanceTo(manager, created.specId, "test-review", {
        onActive(nodeId) {
          if (nodeId !== "test") return;
          manager.publishArtifacts({
            specId: created.specId,
            nodeId: "test",
            artifactWrites: [{
              logicalKey: "tests.source",
              parameters: { testPath: "requirement.test.js" },
              mediaType: "text/javascript",
              bytes: Buffer.from("// spec: R1\n", "utf8"),
            }],
          });
        },
      });
      const staleFlowState = manager.load(created.specId);
      const currentState = manager.canonicalState(created.specId);
      const revision = new CanonicalTestArtifactStore({
        flowManager: manager,
        state: currentState,
      }).testSourceRevision().toJSON();
      const finding = {
        findingId: "test-review-finding",
        fingerprint: "f".repeat(64),
        summary: "The test omits a required behavior.",
        disposition: "must-fix",
        rationale: "The test must cover the required behavior before acceptance.",
      };
      const payload = testCase.alter({
        payload: {
          phase: "test",
          verdict: "REJECTED",
          blockingFindings: [finding],
          advisoryFindings: [],
          sourceTestArtifactRevision: revision,
          canonicalEvidence: {
            disposition: "REJECTED",
            blockingFindings: [finding],
            advisoryFindings: [],
            identity: { evidenceDigest: "e".repeat(64) },
          },
        },
      });
      publishAttemptArtifact(manager, created.specId, "test-review", "test.review", payload);
      assert.equal(currentState.attempt.sequence, 1, `${testCase.label} fixture must own review Attempt 1`);
      if (testCase.exhausted === true) {
        for (let index = 0; index < 5; index += 1) {
          manager.appendMetric({ phase: "test", counter: "reviewRetry", delta: 1 }, { specId: created.specId, taskId: null });
        }
      }

      const context = {
        root: repository,
        mainRoot: repository,
        executionRoot: repository,
        specId: created.specId,
        flowManager: manager,
        flowState: staleFlowState,
        config: {},
        flowCommandBoundary: true,
      };
      let workerCalls = 0;
      const beforeDirectState = manager.canonicalState(created.specId).toJSON();
      const beforeDirectActivities = manager.activityLedger(created.specId).length;
      const deniedDirectReview = await new RunReviewCommand({
        runCommand: async () => {
          workerCalls += 1;
          return { ok: true, stdout: "", stderr: "" };
        },
      }).execute({ ...context, phase: "test" });
      assert.equal(deniedDirectReview.ok, false, testCase.label);
      assert.equal(deniedDirectReview.errors[0].code, "REVIEW_DEFINITION_ACTION_REQUIRED", testCase.label);
      assert.equal(workerCalls, 0, `${testCase.label} must not start a Review worker`);
      assert.deepEqual(manager.canonicalState(created.specId).toJSON(), beforeDirectState, testCase.label);
      assert.equal(manager.activityLedger(created.specId).length, beforeDirectActivities, testCase.label);
      if (testCase.exhausted === true) {
        const next = await new GetNextActionCommand().execute(context);
        assert.equal(next.directive.actionId, "SETTLE_REVIEW_DEFER");
        assert.match(next.directive.nextAction, /settle-review-transition/);
      } else if (testCase.expectedDirectiveCode) {
        const next = await new GetNextActionCommand().execute(context);
        assert.equal(next.directive.code, testCase.expectedDirectiveCode, testCase.label);
      } else {
        await assert.rejects(
          () => new GetNextActionCommand().execute(context),
          (error) => error.code === testCase.expectedCode,
          testCase.label,
        );
      }
    }
  });

  it("settles a definition-selected exhausted test-review deferral without rerunning review", async () => {
    const repository = root();
    const specId = "001-test-review-defer-settlement";
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request(specId, {
      specRecord: new CurrentFlowSpecRecord({ ...validWorkerHandoffSpec(), tasks: [] }, { specId }),
    }));
    manager.addActiveFlow(created.specId, "direct");
    advanceTo(manager, created.specId, "test-review", {
      onActive(nodeId) {
        if (nodeId !== "test") return;
        manager.publishArtifacts({
          specId: created.specId,
          nodeId: "test",
          artifactWrites: [{
            logicalKey: "tests.source",
            parameters: { testPath: "deferred.test.js" },
            mediaType: "text/javascript",
            bytes: Buffer.from("// spec: R1\n", "utf8"),
          }],
        });
      },
    });
    const revision = new CanonicalTestArtifactStore({
      flowManager: manager,
      state: manager.load(created.specId),
    }).testSourceRevision().toJSON();
    const finding = {
      findingId: "deferred-test-review-finding",
      fingerprint: "f".repeat(64),
      summary: "The test omits a required behavior.",
      disposition: "must-fix",
      rationale: "The test must cover the required behavior before acceptance.",
    };
    publishAttemptArtifact(manager, created.specId, "test-review", "test.review", {
      phase: "test",
      verdict: "REJECTED",
      blockingFindings: [finding],
      sourceTestArtifactRevision: revision,
      canonicalEvidence: {
        disposition: "REJECTED",
        blockingFindings: [finding],
        advisoryFindings: [],
        identity: { evidenceDigest: "e".repeat(64) },
      },
    });
    for (let index = 0; index < 5; index += 1) {
      manager.appendMetric({ phase: "test", counter: "reviewRetry", delta: 1 }, { specId: created.specId, taskId: null });
    }
    const context = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      flowManager: manager,
      flowState: manager.load(created.specId),
      flowCommandBoundary: true,
    };
    const before = await new GetNextActionCommand().execute(context);
    assert.equal(before.directive.actionId, "SETTLE_REVIEW_DEFER");
    assert.match(before.directive.nextAction, /settle-review-transition/);

    const settled = new RunSettleReviewTransitionCommand().execute(context);
    assert.equal(settled.ok, true, JSON.stringify(settled));
    const reloaded = manager.load(created.specId);
    assert.equal(leaves(reloaded.steps).find((entry) => entry.id === "test-review").status, "done");
    const deferred = manager.readArtifact({
      specId: created.specId,
      logicalKey: "flow.findings",
      consumerNodeId: "acceptance-review",
    });
    assert.equal(JSON.parse(deferred.bytes.toString("utf8")).entries.length, 1);
    const first = await new GetNextActionCommand().execute({ ...context, flowState: reloaded });
    const second = await new GetNextActionCommand().execute({ ...context, flowState: manager.load(created.specId) });
    assert.deepEqual(second, first, "reloaded Flow projects one stable next Action after review deferral");
  });

  it("routes an exhausted Task Review through the same definition-owned settlement", async () => {
    const repository = root();
    const specId = "001-task-review-defer-settlement";
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request(specId, {
      specRecord: new CurrentFlowSpecRecord({ ...validWorkerHandoffSpec(), tasks: [] }, { specId }),
    }));
    manager.addActiveFlow(created.specId, "direct");
    manager.addTask({
      id: "T-1",
      title: "Review transition task",
      goal: "Exercise Task Review settlement.",
      parent: null,
      origin: "plan",
      added_round: 0,
      status: "pending",
    }, { specId: created.specId });
    advanceTo(manager, created.specId, "T-1-review");
    const reject = () => manager.failCurrentAttempt({
      specId: created.specId,
      failure: {
        category: "semantic",
        code: "REVIEW_REJECTED",
        message: "Task Review rejected the current implementation Attempt.",
        retryable: true,
        retryKind: "semantic",
      },
    });
    for (let attempt = 1; attempt < 4; attempt += 1) {
      reject();
      manager.retryCurrentAttempt({ specId: created.specId });
    }
    const finding = {
      findingId: "task-review-deferred-finding",
      fingerprint: "d".repeat(64),
      disposition: "must-fix",
      rationale: "The implementation omits required behavior.",
    };
    manager.publishArtifacts({
      specId: created.specId,
      nodeId: "T-1-review",
      artifactWrites: [{
        logicalKey: "task.review",
        parameters: { taskId: "T-1" },
        mediaType: "application/json",
        bytes: attemptHistoryBytes("T-1-review", "task.review", {
          phase: "impl",
          verdict: "REJECTED",
          blockingFindings: [finding],
          canonicalEvidence: {
            disposition: "REJECTED",
            blockingFindings: [finding],
            advisoryFindings: [],
            identity: { evidenceDigest: "e".repeat(64) },
          },
        }, manager.canonicalState(created.specId).attempt.sequence),
      }],
    });
    reject();
    const context = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      flowManager: manager,
      flowState: manager.load(created.specId),
      flowCommandBoundary: true,
    };

    const next = await new GetNextActionCommand().execute(context);
    assert.equal(next.taskId, "T-1");
    assert.equal(next.step, "task-review");
    assert.equal(next.directive.actionId, "SETTLE_REVIEW_DEFER");
    const settled = new RunSettleReviewTransitionCommand().execute(context);
    assert.equal(settled.ok, true, JSON.stringify(settled));
    const reloaded = manager.load(created.specId);
    assert.equal(reloaded.tasks[0].steps.find((step) => step.id === "T-1-review").status, "done");
    const findings = manager.readArtifact({
      specId: created.specId,
      logicalKey: "flow.findings",
      consumerNodeId: "acceptance-review",
    });
    assert.equal(JSON.parse(findings.bytes.toString("utf8")).entries[0].sourceStep, "task-review");
    const repeated = new RunSettleReviewTransitionCommand().execute({ ...context, flowState: reloaded });
    assert.equal(repeated.ok, false);
    assert.equal(repeated.errors[0].code, "REVIEW_TRANSITION_SETTLEMENT_UNAVAILABLE");
  });

  it("settles exhausted flow impl-review from current persisted evidence and resumes after partial publication", async () => {
    const repository = root();
    const specId = "001-impl-review-partial-settlement";
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request(specId, {
      specRecord: new CurrentFlowSpecRecord({ ...validWorkerHandoffSpec(), tasks: [] }, { specId }),
    }));
    manager.addActiveFlow(created.specId, "direct");
    advanceTo(manager, created.specId, "impl-review");
    const finding = {
      findingId: "impl-review-must-fix",
      fingerprint: "a".repeat(64),
      summary: "The implementation leaves a required behavior unresolved.",
      rationale: "The unresolved behavior is required by the accepted specification.",
      evidenceRefs: ["src/example.js:1"],
      disposition: "must-fix",
    };
    publishAttemptArtifact(manager, created.specId, "impl-review", "impl.review", {
      phase: "impl",
      verdict: "REJECTED",
      blockingFindings: [finding],
      advisoryFindings: [],
      canonicalEvidence: {
        disposition: "REJECTED",
        blockingFindings: [finding],
        advisoryFindings: [],
        identity: { evidenceDigest: "e".repeat(64) },
      },
    });
    for (let index = 0; index < 4; index += 1) {
      manager.appendMetric({ phase: "impl", counter: "reviewRetry", delta: 1 }, { specId: created.specId, taskId: null });
    }
    const context = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      flowManager: manager,
      flowState: manager.load(created.specId),
      flowCommandBoundary: true,
    };
    const next = await new GetNextActionCommand().execute(context);
    assert.equal(next.step, "impl-review");
    assert.equal(next.directive.actionId, "SETTLE_REVIEW_DEFER");

    let interrupted = false;
    const interruptedManager = new Proxy(manager, {
      get(target, property) {
        if (property === "updateStepStatus") {
          return (...args) => {
            if (!interrupted) {
              interrupted = true;
              throw new Error("simulated crash after flow.findings publication");
            }
            return target.updateStepStatus(...args);
          };
        }
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
    const partial = new RunSettleReviewTransitionCommand().execute({
      ...context,
      flowManager: interruptedManager,
    });
    assert.equal(partial.ok, false);
    assert.match(partial.errors[0].messages.join("\n"), /simulated crash/);
    assert.equal(manager.canonicalState(created.specId).current.at(-1), "impl-review");
    const publishedBeforeRetry = manager.activityLedger(created.specId)
      .filter((activity) => activity.type === "artifacts_published" && activity.nodeId === "impl-review").length;

    const settled = new RunSettleReviewTransitionCommand().execute({
      ...context,
      flowManager: manager,
      flowState: manager.load(created.specId),
    });
    assert.equal(settled.ok, true, JSON.stringify(settled));
    assert.equal(manager.canonicalState(created.specId).findNode("impl-review").status, "done");
    assert.equal(manager.canonicalState(created.specId).findNode("impl-triage").status, "done");
    assert.equal(manager.canonicalState(created.specId).findNode("impl-repair").status, "done");
    const findings = manager.readArtifact({
      specId: created.specId,
      logicalKey: "flow.findings",
      consumerNodeId: "acceptance-review",
    });
    assert.deepEqual(
      JSON.parse(findings.bytes.toString("utf8")).entries.map((entry) => entry.fingerprint),
      [finding.fingerprint],
    );
    const publishedAfterRetry = manager.activityLedger(created.specId)
      .filter((activity) => activity.type === "artifacts_published" && activity.nodeId === "impl-review").length;
    assert.equal(publishedAfterRetry, publishedBeforeRetry, "idempotent retry must not republish unchanged flow.findings");
    const afterSettlement = await new GetNextActionCommand().execute({
      ...context,
      flowState: manager.load(created.specId),
    });
    assert.equal(afterSettlement.step, "impl-gate");
  });

  it("blocks non-deferrable exhausted test-review evidence with a stable identity", async () => {
    const repository = root();
    const specId = "001-test-review-blocked-settlement";
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request(specId, {
      specRecord: new CurrentFlowSpecRecord({ ...validWorkerHandoffSpec(), tasks: [] }, { specId }),
    }));
    manager.addActiveFlow(created.specId, "direct");
    advanceTo(manager, created.specId, "test-review", {
      onActive(nodeId) {
        if (nodeId !== "test") return;
        manager.publishArtifacts({
          specId: created.specId,
          nodeId: "test",
          artifactWrites: [{
            logicalKey: "tests.source",
            parameters: { testPath: "blocked.test.js" },
            mediaType: "text/javascript",
            bytes: Buffer.from("// spec: R1\n", "utf8"),
          }],
        });
      },
    });
    const revision = new CanonicalTestArtifactStore({ flowManager: manager, state: manager.load(created.specId) }).testSourceRevision().toJSON();
    const finding = {
      findingId: "mechanical-test-review-finding",
      fingerprint: "f".repeat(64),
      summary: "The review evidence is mechanically malformed.",
      failureKind: "schema_error",
    };
    publishAttemptArtifact(manager, created.specId, "test-review", "test.review", {
      phase: "test",
      verdict: "REJECTED",
      blockingFindings: [finding],
      sourceTestArtifactRevision: revision,
      canonicalEvidence: {
        disposition: "REJECTED",
        blockingFindings: [finding],
        advisoryFindings: [],
        identity: { evidenceDigest: "e".repeat(64) },
      },
    });
    for (let index = 0; index < 5; index += 1) {
      manager.appendMetric({ phase: "test", counter: "reviewRetry", delta: 1 }, { specId: created.specId, taskId: null });
    }
    const context = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      flowManager: manager,
      flowState: manager.load(created.specId),
      flowCommandBoundary: true,
    };
    let workerCalls = 0;
    const beforeDirectState = manager.canonicalState(created.specId).toJSON();
    const beforeDirectActivities = manager.activityLedger(created.specId).length;
    const deniedDirectReview = await new RunReviewCommand({
      runCommand: async () => {
        workerCalls += 1;
        return { ok: true, stdout: "", stderr: "" };
      },
    }).execute({ ...context, phase: "test" });
    assert.equal(deniedDirectReview.ok, false);
    assert.equal(deniedDirectReview.errors[0].code, "REVIEW_DEFINITION_ACTION_REQUIRED");
    assert.equal(workerCalls, 0);
    assert.deepEqual(manager.canonicalState(created.specId).toJSON(), beforeDirectState);
    assert.equal(manager.activityLedger(created.specId).length, beforeDirectActivities);
    const first = await new GetNextActionCommand().execute(context);
    const second = await new GetNextActionCommand().execute({ ...context, flowState: manager.load(created.specId) });
    assert.equal(first.directive.code, "REVIEW_MAX_ATTEMPTS_EXCEEDED");
    assert.deepEqual(second, first);
  });

  it("derives every cataloged test member finalization from durable test confirmations", () => {
    const state = { schemaRevision: 3, runId: "test-source-run", specId: "001-test-source-provenance" };
    const descriptor = (testPath, activityId) => ({
      logicalKey: "tests.source",
      slot: { publicationStep: "test" },
      relativePath: `artifacts/tests/${testPath}`,
      hash: "a".repeat(64),
      size: 12,
      activityId,
    });
    const confirmation = (id, attemptId, sequence, confirmedAt, confirmationOrder) => ({
      id,
      type: "result_confirmed",
      nodeId: "test",
      attemptId,
      sequence,
      confirmationOrder,
      transition: { operation: "confirm_attempt", nodeId: "test", status: "done" },
      result: { outcome: "passed", confirmedAt },
      timing: null,
    });
    const publication = (id, attemptId, sequence, confirmationOrder) => ({
      id,
      type: "artifacts_published",
      nodeId: "test",
      attemptId,
      sequence,
      confirmationOrder,
      transition: { operation: "publish_artifacts", nodeId: "test", status: null },
      result: null,
      timing: null,
    });
    const catalog = {
      artifacts: [
        descriptor("direct.test.js", "confirm-direct"),
        descriptor("published-first.test.js", "publish-first"),
        descriptor("published-last.test.js", "publish-last"),
      ],
    };
    const activities = [
      confirmation("confirm-direct", "test-attempt-direct", 1, "2026-08-23T00:00:00.000Z", 1),
      publication("publish-first", "test-attempt-first", 2, 2),
      confirmation("confirm-first", "test-attempt-first", 2, "2026-08-23T00:01:00.000Z", 3),
      publication("publish-last", "test-attempt-last", 3, 4),
      confirmation("confirm-last", "test-attempt-last", 3, "2026-08-23T00:02:00.000Z", 5),
    ];

    const first = CanonicalTestSourceRevision.fromCatalog({ state, catalog, activities }).toJSON();
    const second = CanonicalTestSourceRevision.fromCatalog({ state, catalog, activities }).toJSON();

    assert.equal(first.finalizedAt, "2026-08-23T00:02:00.000Z");
    assert.deepEqual(second, first, "rebuilding the same canonical revision must not use read time");
  });

  it("rejects test-source revisions without complete durable provenance", () => {
    const state = { schemaRevision: 3, runId: "test-source-run", specId: "001-test-source-provenance-errors" };
    const descriptor = (activityId) => ({
      logicalKey: "tests.source",
      slot: { publicationStep: "test" },
      relativePath: "artifacts/tests/requirement.test.js",
      hash: "a".repeat(64),
      size: 12,
      activityId,
    });
    const invalidConfirmation = {
      id: "failed-confirmation",
      type: "result_confirmed",
      nodeId: "test",
      attemptId: "test-attempt",
      sequence: 1,
      confirmationOrder: 2,
      transition: { operation: "confirm_attempt", nodeId: "test", status: "done" },
      result: { outcome: "failed", confirmedAt: "2026-08-23T00:00:00.000Z" },
    };
    const assertUnavailable = ({ artifacts, activities }) => {
      assert.throws(
        () => CanonicalTestSourceRevision.fromCatalog({ state, catalog: { artifacts }, activities }),
        (error) => error instanceof CanonicalTestSourceProvenanceError
          && error.code === "CANONICAL_TEST_SOURCE_REVISION_UNAVAILABLE",
      );
    };

    assertUnavailable({ artifacts: [], activities: [] });
    assertUnavailable({ artifacts: [descriptor(null)], activities: [] });
    assertUnavailable({ artifacts: [descriptor("missing-activity")], activities: [] });
    assertUnavailable({ artifacts: [descriptor("failed-confirmation")], activities: [invalidConfirmation] });
    assertUnavailable({
      artifacts: [descriptor("invalid-confirmation")],
      activities: [{ ...invalidConfirmation, id: "invalid-confirmation", result: { outcome: "passed", confirmedAt: "not-a-timestamp" } }],
    });
    assertUnavailable({
      artifacts: [descriptor("publish-after-confirmation")],
      activities: [
        {
          id: "publish-after-confirmation",
          type: "artifacts_published",
          nodeId: "test",
          attemptId: "test-attempt",
          sequence: 1,
          confirmationOrder: 2,
          transition: { operation: "publish_artifacts", nodeId: "test", status: null },
          result: null,
        },
        { ...invalidConfirmation, id: "earlier-confirmation", confirmationOrder: 1, result: { outcome: "passed", confirmedAt: "2026-08-23T00:00:00.000Z" } },
      ],
    });
    assertUnavailable({
      artifacts: [descriptor("publish-ambiguous")],
      activities: [
        {
          id: "publish-ambiguous",
          type: "artifacts_published",
          nodeId: "test",
          attemptId: "test-attempt",
          sequence: 1,
          confirmationOrder: 1,
          transition: { operation: "publish_artifacts", nodeId: "test", status: null },
          result: null,
        },
        { ...invalidConfirmation, id: "confirmation-one", result: { outcome: "passed", confirmedAt: "2026-08-23T00:00:00.000Z" } },
        { ...invalidConfirmation, id: "confirmation-two", confirmationOrder: 3, result: { outcome: "passed", confirmedAt: "2026-08-23T00:01:00.000Z" } },
      ],
    });
  });

  it("publishes a rejected test review before repair while retaining its active Attempt", async () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-canonical-test-review-publication", {
      specRecord: new CurrentFlowSpecRecord({ ...validWorkerHandoffSpec(), tasks: [] }, {
        specId: "001-canonical-test-review-publication",
      }),
    }));
    manager.addActiveFlow(created.specId, "direct");
    advanceTo(manager, created.specId, "test-review", {
      onActive(nodeId) {
        if (nodeId !== "test") return;
        manager.publishArtifacts({
          specId: created.specId,
          nodeId: "test",
          artifactWrites: [{
            logicalKey: "tests.source",
            parameters: { testPath: "requirement.test.js" },
            mediaType: "text/javascript",
            bytes: Buffer.from("// spec: R1\n", "utf8"),
          }],
        });
      },
    });
    let outputDirectory = null;
    const review = rejectedTestReviewCommand((directory) => { outputDirectory = directory; });
    const ctx = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      phase: "test",
      flowManager: manager,
      flowState: manager.load(created.specId),
      flowCommandBoundary: true,
      config: {},
    };
    const result = await review.execute(ctx);
    assert.equal(attachedCanonicalCommandResultArtifact(result).logicalKey, "test.review");

    await FLOW_COMMANDS.run.review.post(ctx, result);

    const catalog = manager.artifactCatalog(created.specId);
    assert.ok(catalog.artifacts.some((artifact) => artifact.logicalKey === "test.review"));
    assert.ok(catalog.artifacts.some((artifact) => artifact.logicalKey === "review.evidence"));
    const active = manager.canonicalState(created.specId);
    assert.equal(active.current.at(-1), "test-review");
    assert.equal(active.attempt.failure, null);
    assert.equal(fs.existsSync(outputDirectory), false, "publication confirmation cleans the sealed worker surface");

    const next = await new GetNextActionCommand().execute({ ...ctx, flowState: manager.load(created.specId) });
    assert.equal(next.directive.actionId, "REPAIR_TEST_REVIEW");
    const repaired = new RunRepairTestReviewCommand().execute({ ...ctx, flowState: manager.load(created.specId) });
    assert.equal(repaired.ok, true, JSON.stringify(repaired));
    assert.equal(manager.canonicalState(created.specId).current.at(-1), "test");
  });

  it("retains a rejected test-review work unit when its canonical publication fails", async () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-canonical-test-review-publication-failure", {
      specRecord: new CurrentFlowSpecRecord({ ...validWorkerHandoffSpec(), tasks: [] }, {
        specId: "001-canonical-test-review-publication-failure",
      }),
    }));
    manager.addActiveFlow(created.specId, "direct");
    advanceTo(manager, created.specId, "test-review", {
      onActive(nodeId) {
        if (nodeId !== "test") return;
        manager.publishArtifacts({
          specId: created.specId,
          nodeId: "test",
          artifactWrites: [{
            logicalKey: "tests.source",
            parameters: { testPath: "requirement.test.js" },
            mediaType: "text/javascript",
            bytes: Buffer.from("// spec: R1\n", "utf8"),
          }],
        });
      },
    });
    let outputDirectory = null;
    const review = rejectedTestReviewCommand((directory) => { outputDirectory = directory; });
    const ctx = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      phase: "test",
      flowManager: manager,
      flowState: manager.load(created.specId),
      config: {},
    };
    const result = await review.execute(ctx);
    manager.publishCurrentAttemptResult = () => { throw new Error("simulated publication failure"); };

    await assert.rejects(
      () => FLOW_COMMANDS.run.review.post(ctx, result),
      /simulated publication failure/,
    );
    assert.equal(fs.existsSync(outputDirectory), true, "failed publication retains the sealed worker surface");
    assert.equal(manager.canonicalState(created.specId).current.at(-1), "test-review");
  });

  it("records a material impl repair and invalidates to one replacement test-execute Attempt", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-canonical-impl-repair", {
      specRecord: new CurrentFlowSpecRecord({ ...validWorkerHandoffSpec(), tasks: [] }, { specId: "001-canonical-impl-repair" }),
    }));
    manager.addActiveFlow(created.specId, "direct");
    advanceTo(manager, created.specId, "impl-repair");
    const confirmedAt = "2026-08-13T00:00:00.000Z";
    manager.confirmSourceWorkerHandoff({
      specId: created.specId,
      effect: new SourceWorkerEffect({
        version: 1,
        stepId: "impl-repair",
        completionStatus: "done",
        requirements: [], files: [], issues: [], overview: null, triage: null,
        repair: { appliedFindingKeys: ["finding-1"], summary: "Applied the reviewed implementation correction." },
      }),
      handoffDigest: "a".repeat(64),
      result: {
        outcome: "passed", summary: "Worker handoff confirmed for impl-repair.", confirmedAt,
        artifactRefs: [{ kind: "worker-handoff", id: "a".repeat(64) }, { kind: "worker-handoff-request", id: "b".repeat(64) }],
      },
    });
    const state = manager.load(created.specId);
    assert.equal(state.currentNodeId, "test-execute");
    assert.equal(leaves(state.steps).find((entry) => entry.id === "impl-repair").status, "invalidated");
    assert.equal(leaves(state.steps).find((entry) => entry.id === "test-execute").status, "in_progress");
    const ledger = manager.activityLedger(created.specId);
    const activity = ledger.at(-1);
    assert.equal(activity.transition.operation, "repair_implementation");
    assert.equal(activity.nodeId, "impl-repair");
    assert.notEqual(activity.attemptId, activity.transition.attempt.id, "producer and replacement Attempt identities differ");
    assert.equal(activity.transition.attempt.nodeId, "test-execute");
    assert.equal(manager.load(created.specId).currentNodeId, "test-execute", "journal reload preserves the replacement Attempt");
  });

  it("routes the normal review post-hook through the Version Store result history", async () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");
    const ordered = leaves(manager.load(created.specId).steps);
    const reviewIndex = ordered.findIndex((entry) => entry.id === "spec-review");
    for (const entry of ordered.slice(0, reviewIndex)) {
      confirmFixtureStep(manager, entry.id);
    }
    manager.updateStepStatus({ stepId: "spec-review", requestedStatus: "in_progress" });

    const ctx = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      phase: "spec",
      flowManager: manager,
      flowState: manager.load(created.specId),
    };
    await FLOW_COMMANDS.run.review.post(ctx, {
      result: "ok",
      artifacts: { phase: "spec", verdict: "PASS", command: "run-review" },
    });

    const state = manager.load(created.specId);
    const history = JSON.parse(manager.readArtifact({
      specId: created.specId,
      logicalKey: "spec.review",
      consumerNodeId: "spec-triage",
    }).bytes.toString("utf8"));
    const leafState = new Map(leaves(state.steps).map((entry) => [entry.id, entry.status]));
    assert.deepEqual(history.attempts.map((entry) => entry.attempt), [1]);
    assert.equal(leafState.get("spec-review"), "done");
    assert.equal(leafState.get("spec-triage"), "done");
    assert.equal(leafState.get("spec-repair"), "done");
    assert.equal(state.metrics.some((entry) => entry.counter === "reviewRetry" && entry.reset === true), true);
  });

  it("reloads and resumes the same Version Store after process restart in every execution mode", () => {
    for (const mode of ["direct", "branch", "worktree"]) {
      const repository = root();
      const specId = `001-canonical-restart-${mode}`;
      const execution = {
        mode,
        baseBranch: "main",
        featureBranch: mode === "direct" ? "main" : `feature/restart-${mode}`,
      };
      const executionRoot = mode === "worktree"
        ? path.join(repository, ".sennel", "worktree", specId)
        : repository;
      fs.mkdirSync(executionRoot, { recursive: true });
      const managerOptions = {
        root: executionRoot,
        mainRoot: repository,
        inWorktree: mode === "worktree",
        specId,
      };
      const manager = new FlowManager(managerOptions);
      const created = manager.createFresh(request(specId, {
        runId: `canonical-restart-${mode}-run`,
        flowId: `canonical-restart-${mode}-flow`,
        flowVersionId: `canonical-restart-${mode}-flow-v1`,
        execution,
      }));
      manager.addActiveFlow(specId, mode);
      const identity = canonicalIdentity(manager.canonicalState(specId));
      const catalog = catalogArtifactReferences(manager.artifactCatalog(specId));

      manager.parkFlow(specId);
      const restarted = new FlowManager(managerOptions);
      const parked = restarted.restartFlow(specId);
      assert.equal(parked.lifecycle, "parked", mode);
      assert.equal(parked.resumable, true, mode);
      assert.equal(parked.state.request, "Keep the request exactly as supplied.", mode);
      assert.deepEqual(canonicalIdentity(restarted.canonicalState(specId)), identity, mode);
      assert.deepEqual(catalogArtifactReferences(restarted.artifactCatalog(specId)), catalog, mode);
      assert.equal(restarted.specLocation(specId).version.toString(), "1", mode);
      assert.equal(path.basename(restarted.specLocation(specId).directory), "001", mode);

      restarted.resumeFlow(specId);
      const reloaded = new FlowManager(managerOptions);
      const resumed = reloaded.restartFlow(specId);
      assert.equal(resumed.lifecycle, "active", mode);
      assert.equal(resumed.resumable, false, mode);
      assert.equal(resumed.state.request, "Keep the request exactly as supplied.", mode);
      assert.equal(resumed.state.flowVersionId, created.flowVersionId, mode);
      assert.deepEqual(catalogArtifactReferences(reloaded.artifactCatalog(specId)), catalog, mode);
    }
  });

  it("preserves V1 identity, finalized state, Activities, and catalog references after a fresh read", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-canonical-finalized-request"));
    const originalIdentity = canonicalIdentity(manager.canonicalState(created.specId));
    const ordered = leaves(manager.load(created.specId).steps);
    const scenarioIndex = ordered.findIndex((step) => step.id === "scenario-validity");
    assert.ok(scenarioIndex >= 0);
    for (const step of ordered.slice(0, scenarioIndex)) {
      confirmFixtureStep(manager, step.id, { specId: created.specId });
    }
    manager.updateStepStatus(
      { stepId: "scenario-validity", requestedStatus: "in_progress" },
      { specId: created.specId },
    );
    const location = manager.specLocation(created.specId);
    publishAttemptArtifact(manager, created.specId, "scenario-validity", "scenario.validity", {
      version: "1",
      command: "node --test artifacts/tests/scenario.test.js",
      process: { started: true, exitCode: 0, signal: null, timedOut: false, spawnError: null },
      result: "pass",
      raw_output_path: location.relativeArtifact("scenario.validity.raw-log"),
      summary: [],
    });
    assert.equal(
      catalogArtifactReferences(manager.artifactCatalog(created.specId))
        .some((artifact) => artifact.logicalKey === "scenario.validity"),
      true,
    );
    manager.updateStepStatus(
      { stepId: "scenario-validity", requestedStatus: "done" },
      { specId: created.specId },
    );

    for (const step of leaves(manager.load(created.specId).steps)) {
      if (step.status === "pending") {
        confirmFixtureStep(manager, step.id, { specId: created.specId });
      }
    }
    const referencesBeforeFinalization = catalogArtifactReferences(manager.artifactCatalog(created.specId));
    assert.equal(referencesBeforeFinalization.some((artifact) => artifact.logicalKey === "scenario.validity"), true);

    const finalized = manager.finalizeFlow(created.specId);
    assert.equal(finalized.lifecycle.state, "finalized");
    assert.equal(finalized.request, "Keep the request exactly as supplied.");
    const finalizedState = manager.canonicalState(created.specId).toJSON();
    const finalizedActivities = manager.activityLedger(created.specId);
    const finalizedCatalog = manager.artifactCatalog(created.specId).toJSON();
    assert.deepEqual(canonicalIdentity(manager.canonicalState(created.specId)), originalIdentity);
    assert.equal(finalizedActivities.at(-1).transition.operation, "finalize_flow");
    assert.deepEqual(
      catalogArtifactReferences(manager.artifactCatalog(created.specId)),
      referencesBeforeFinalization,
    );

    const reopenedManager = new FlowManager({
      root: repository,
      mainRoot: repository,
      inWorktree: false,
      specId: created.specId,
    });
    const reopened = reopenedManager.loadReadOnly(created.specId);
    assert.equal(reopened.lifecycle, "finalized");
    assert.equal(reopened.request, "Keep the request exactly as supplied.");
    assert.deepEqual(canonicalIdentity(reopenedManager.canonicalState(created.specId)), originalIdentity);
    assert.deepEqual(reopenedManager.canonicalState(created.specId).toJSON(), finalizedState);
    assert.deepEqual(reopenedManager.activityLedger(created.specId), finalizedActivities);
    assert.deepEqual(reopenedManager.artifactCatalog(created.specId).toJSON(), finalizedCatalog);
    assert.deepEqual(
      catalogDescriptorReferences(reopenedManager.artifactCatalog(created.specId)),
      catalogDescriptorReferences(manager.artifactCatalog(created.specId)),
    );
  });

  it("keeps only unfinished outbox work in flow.json and journals terminal side effects", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");
    const outbox = new FlowOutboxStore(manager, { specId: created.specId });
    const identity = new FlowOutboxIdentity({
      runId: created.runId,
      stepId: "finalize-cleanup",
      operation: "finalize-cleanup",
    });

    const pending = outbox.beginCommand(identity);
    assert.equal(pending.status, "pending");
    assert.deepEqual(manager.canonicalState(created.specId).outbox.toJSON(), [{
      id: identity.idempotencyKey,
      operation: "finalize-cleanup",
    }]);

    const failed = outbox.fail(identity, new Error("cleanup interruption"));
    assert.equal(failed.status, "failed");
    assert.deepEqual(manager.canonicalState(created.specId).outbox.toJSON(), []);
    assert.throws(
      () => outbox.beginCommand(identity),
      FlowOutboxRecoveryRequiredError,
    );

    const reopened = outbox.reopenFailedExact(new FlowOutboxRecoveryClaim({
      identity,
      attempt: 1,
      failure: "cleanup interruption",
    }));
    assert.equal(reopened.status, "pending");
    const completed = outbox.complete(identity, { status: "done" });
    assert.equal(completed.status, "done");
    assert.deepEqual(manager.canonicalState(created.specId).outbox.toJSON(), []);

    const activities = fs.readFileSync(manager.specLocation(created.specId).activitiesFile, "utf8")
      .trim().split("\n").map((line) => JSON.parse(line));
    assert.deepEqual(
      activities.slice(-4).map((entry) => entry.transition.operation),
      ["begin_outbox", "fail_outbox", "reopen_outbox", "complete_outbox"],
    );
    assert.equal(activities.at(-3).transition.outbox.failure, "cleanup interruption");
    assert.deepEqual(activities.at(-2).transition.outbox.exactRecoveryReceipt, {
      idempotencyKey: identity.idempotencyKey,
      attempt: 1,
      failure: "cleanup interruption",
      recoveryKey: null,
    });
    assert.equal(activities.at(-1).transition.outbox.failure, null);
  });

  it("stores explicit dispatch approval only as a typed Activity receipt", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");
    const receipt = {
      version: 1,
      runId: created.runId,
      actionDigest: "a".repeat(64),
      approvalToken: "b".repeat(64),
      approvedAt: "2026-08-13T00:00:00.000Z",
    };

    manager.recordDispatchApproval({ specId: created.specId, receipt });
    assert.deepEqual(manager.load(created.specId).flowDispatchApprovals, [receipt]);
    assert.throws(
      () => manager.recordDispatchApproval({
        specId: created.specId,
        receipt: { ...receipt, approvalToken: "c".repeat(64) },
      }),
      /cannot replace its exact receipt/,
    );

    const location = manager.specLocation(created.specId);
    const persisted = JSON.parse(fs.readFileSync(location.flowStateFile, "utf8"));
    const activities = fs.readFileSync(location.activitiesFile, "utf8").trim().split("\n")
      .map((line) => JSON.parse(line));
    assert.equal(Object.hasOwn(persisted, "flowDispatchApprovals"), false);
    assert.equal(activities.at(-1).type, "dispatch_approval_recorded");
    assert.deepEqual(activities.at(-1).transition.approval, receipt);
  });

  it("derives exact recovery and pre-sync failure facts from V1 outbox Activities", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");
    const outbox = new FlowOutboxStore(manager, { specId: created.specId });
    const identity = new FlowOutboxIdentity({
      runId: created.runId,
      stepId: "finalize-merge",
      operation: "finalize-merge",
    });
    const conflict = new Error("Pre-merge rebase detected conflicts in origin/main");
    conflict.code = "MERGE_PRE_SYNC_CONFLICT";
    conflict.data = { recovery: { baseRef: "origin/main", baseHead: "a".repeat(40) } };

    outbox.begin(identity);
    outbox.fail(identity, conflict);
    const failed = outbox.status(identity);
    assert.deepEqual(failed.latestFailure.toJSON(), {
      attempt: 1,
      failure: conflict.message,
      recordedAt: failed.updatedAt,
      code: "MERGE_PRE_SYNC_CONFLICT",
      recovery: { baseRef: "origin/main", baseHead: "a".repeat(40) },
    });

    const claim = new FlowOutboxRecoveryClaim({
      identity,
      attempt: 1,
      failure: conflict.message,
      recoveryKey: "a".repeat(40),
    });
    outbox.reopenFailedExact(claim);
    outbox.fail(identity, conflict);
    assert.throws(() => outbox.reopenFailedExact(claim), /exact recovery was already consumed/);
  });

  it("routes the normal explicit dispatch approval through the Version Store without changing worker input", async () => {
    const legacyAction = {
      taskId: null,
      step: "draft",
      action: "write-draft",
      instructions: { key: "draft", content: "Write the supplied draft." },
      context: null,
      output_schema: {},
      requires_approval: true,
      maxAttempts: 1,
      directive: {
        kind: "execute_step",
        terminal: false,
        requiresUserAction: false,
        action: "write-draft",
      },
    };

    const boundaryPromptAction = {
      ...legacyAction,
      directive: {
        ...legacyAction.directive,
        requiresUserAction: true,
        actionPrompt: {
          requiresUserAction: true,
          question: "Review or approve the specification?",
          choices: [
            {
              actionId: "APPROVE_SPECIFICATION",
              label: "Approve",
              nextAction: null,
              stateTransition: "resume-current-approval-boundary",
              impact: { retains: [], changes: ["approval authorization"], deletes: [] },
              reason: null,
            },
            {
              actionId: "REVIEW_SPECIFICATION_SUMMARY",
              label: "Review summary",
              nextAction: "sennel flow get artifact spec.record --mode summary --expect-binding 'opaque'",
              stateTransition: null,
              impact: { retains: ["current approval boundary"], changes: [], deletes: [] },
              reason: null,
            },
          ],
          recommendedActionId: "REVIEW_SPECIFICATION_SUMMARY",
          recommendationReason: "Review before approving.",
        },
      },
    };

    const captureWorkerInput = async (action) => {
      const repository = root();
      const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
      const created = manager.createFresh(request());
      manager.addActiveFlow(created.specId, "direct");
      for (const stepId of ["branch", "prepare-spec"]) {
        manager.updateStepStatus({ stepId, requestedStatus: "in_progress" });
        confirmFixtureStep(manager, stepId);
      }
      await new GetNextActionCommand().execute({
        root: repository,
        mainRoot: repository,
        executionRoot: repository,
        flowManager: manager,
        flowState: manager.load(created.specId),
        specId: created.specId,
        flowCommandBoundary: false,
      });

      const completed = {
        taskId: null,
        step: null,
        action: "completed",
        instructions: null,
        context: null,
        output_schema: null,
        requires_approval: false,
        directive: { kind: "completed", terminal: true, requiresUserAction: false },
      };
      const current = { value: structuredClone(action) };
      let workerPrompt = null;
      let workerOptions = null;
      const dispatcher = new RunDispatchCommand({
        nextAction: { async run() { return structuredClone(current.value); } },
        agent: {
          async call(prompt, options) {
            workerPrompt = prompt;
            workerOptions = options;
            manager.confirmCurrentAttempt({ specId: created.specId });
            current.value = completed;
          },
        },
        repositoryFingerprint: () => "canonical-dispatch-r0",
        leaseFactory: () => ({ acquire() {}, release() {} }),
        handoffCoordinator: {
          recoverPending() {},
          createRequest() { return null; },
        },
      });
      dispatcher.container = {};
      const context = {
        root: repository,
        mainRoot: repository,
        executionRoot: repository,
        flowManager: manager,
        flowState: manager.load(created.specId),
        specId: created.specId,
        expectRunId: created.runId,
        _envelopeType: "run",
        _envelopeKey: "dispatch",
        flowCommandBoundary: false,
      };

      const boundary = await dispatcher.execute(context);
      assert.equal(boundary.dispatch.boundary, "approval_required");
      const result = await dispatcher.execute({ ...context, approve: boundary.dispatch.approvalToken });
      assert.equal(result.dispatch.boundary, "completed");
      assert.ok(workerPrompt);
      assert.ok(workerOptions);
      const activities = fs.readFileSync(manager.specLocation(created.specId).activitiesFile, "utf8")
        .trim().split("\n").map((line) => JSON.parse(line));
      assert.equal(activities.some((entry) => entry.type === "dispatch_approval_recorded"), true);
      assert.equal(manager.canonicalState(created.specId).findNode("draft").status, "done");
      return { prompt: workerPrompt, environment: workerOptions.executionEnvironment };
    };

    const parseWorkerPrompt = (prompt) => {
      const invocationMarker = "\n\nMachine-readable dispatch invocation contract:\n";
      const actionMarker = "\n\nGuarded next action:\n";
      const reportMarker = "\n\nYour response is only a worker report.";
      const [instructions, invocationAndAction] = prompt.split(invocationMarker);
      const [invocationJson, actionAndReport] = invocationAndAction.split(actionMarker);
      const [actionJson] = actionAndReport.split(reportMarker);
      return {
        instructions,
        invocation: JSON.parse(invocationJson),
        actionJson,
      };
    };
    const normalizeInvocation = (invocation) => {
      const { id: _id, action, authorization, ...stable } = invocation;
      return {
        ...stable,
        action: { ...action, digest: "<authorization-bound>" },
        authorization: {
          ...authorization,
          actionDigest: "<authorization-bound>",
          approvalToken: "<authorization-bound>",
          approvedAt: "<authorization-bound>",
        },
      };
    };
    const normalizeEnvironment = (environment) => ({
      ...environment,
      [FLOW_DISPATCH_INVOCATION_ID_ENV]: "<invocation-id>",
      [FLOW_DISPATCH_INVOCATION_ENV]: normalizeInvocation(
        JSON.parse(environment[FLOW_DISPATCH_INVOCATION_ENV]),
      ),
    });
    const redactAuthorizationInstruction = (instructions) => instructions.replace(
      /The CLI durably recorded explicit user approval at .+ for this exact action digest\./,
      "<explicit-authorization>",
    );

    const beforeInput = await captureWorkerInput(legacyAction);
    const before = parseWorkerPrompt(beforeInput.prompt);
    const afterInput = await captureWorkerInput(boundaryPromptAction);
    const after = parseWorkerPrompt(afterInput.prompt);

    assert.equal(before.actionJson, JSON.stringify(legacyAction, null, 2));
    assert.equal(after.actionJson, JSON.stringify(legacyAction, null, 2));
    assert.equal(redactAuthorizationInstruction(after.instructions), redactAuthorizationInstruction(before.instructions));
    assert.deepEqual(normalizeInvocation(after.invocation), normalizeInvocation(before.invocation));
    assert.deepEqual(
      normalizeEnvironment(afterInput.environment),
      normalizeEnvironment(beforeInput.environment),
    );
    assert.doesNotMatch(afterInput.prompt, /Review or approve the specification/);
    assert.doesNotMatch(afterInput.environment[FLOW_DISPATCH_INVOCATION_ENV], /actionPrompt/);
  });

  it("journals policy changes and rewinds through the same canonical state machine", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");

    manager.setAutoApprove(true);
    manager.updateStepStatus({ stepId: "branch", requestedStatus: "in_progress" });
    confirmFixtureStep(manager, "branch");
    manager.rewindTo("branch");

    const location = manager.specLocation(created.specId);
    const activities = fs.readFileSync(location.activitiesFile, "utf8").trim().split("\n")
      .map((line) => JSON.parse(line));
    const state = manager.load(created.specId);
    const persisted = JSON.parse(fs.readFileSync(location.flowStateFile, "utf8"));

    assert.equal(state.autoApprove, true);
    assert.deepEqual(persisted.policy, { autoApprove: true, nonblocking: null });
    assert.equal(state.currentNodeId, "branch");
    assert.equal(activities.find((entry) => entry.type === "policy_updated").transition.operation, "set_policy");
    assert.equal(activities.at(-1).transition.operation, "rewind");
    assert.equal(Object.hasOwn(persisted, "autoApprove"), false);
  });

  it("keeps nonblocking policy and evidence in typed V1 policy and Activities", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");
    manager.beginNextAction(created.specId);
    const activeNodeId = manager.load(created.specId).currentNodeId;

    manager.activateNonblockingPolicy({
      policy: {
        enabled: true,
        activatedAt: "2026-08-14T00:00:00.000Z",
        activatedStep: "scenario-validity",
        reason: "A durable acceptance decision is required.",
      },
    });
    manager.recordNonblocking({
      nodeId: activeNodeId,
      record: {
        kind: "observation",
        sourceStep: "scenario-validity",
        sourceAttempt: 1,
        evidenceRef: "steps/scenario-validity/result.json",
        evidenceDigest: "a".repeat(64),
        resultKind: "unavailable",
        action: null,
        rationale: null,
        remainingRisk: null,
      },
    });

    const location = manager.specLocation(created.specId);
    const persisted = JSON.parse(fs.readFileSync(location.flowStateFile, "utf8"));
    const activities = manager.activityLedger(created.specId);
    assert.equal(persisted.policy.nonblocking.enabled, true);
    assert.equal(Object.hasOwn(persisted, "nonblocking"), false);
    assert.equal(Object.hasOwn(persisted, "stepAttempts"), false);
    assert.equal(activities.at(-1).type, "nonblocking_recorded");
    assert.equal(activities.at(-1).transition.nonblocking.sourceStep, "scenario-validity");
  });

  it("records metrics and notes in Activities while keeping dispatcher metadata transient", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");

    manager.incrementMetric("draft", "question");
    manager.accumulateAgentMetrics("draft", {
      provider: "provider",
      profileKey: "default",
      model: "model",
      responseChars: 12,
      durationMs: 34,
      usage: {
        input_tokens: 8,
        output_tokens: 5,
        cache_read_tokens: 3,
        cache_creation_tokens: 1,
        cost_usd: 0.01,
      },
    });
    manager.addNote("Retain this canonical observation.");
    manager.setStepRuntimeLog("branch", {
      runId: created.runId,
      sequence: 1,
      attempt: 1,
      command: "flow run branch",
      startedAt: "2026-08-13T00:00:00.000Z",
      endedAt: "2026-08-13T00:00:01.000Z",
      exitCode: 0,
    });
    manager.writeRuntimeArtifact({
      specId: created.specId,
      nodeId: "finalize-cleanup",
      artifact: {
        logicalKey: "finalize.cleanup.runtime-log",
        mediaType: "application/json",
        bytes: '{"version":1,"runtimeLog":{"runId":"canonical-manager-run"}}\n',
      },
    });

    const location = manager.specLocation(created.specId);
    const state = manager.load(created.specId);
    const persisted = JSON.parse(fs.readFileSync(location.flowStateFile, "utf8"));
    const activities = fs.readFileSync(location.activitiesFile, "utf8").trim().split("\n")
      .map((line) => JSON.parse(line));

    assert.equal(state.metrics.length, 2);
    assert.deepEqual(state.metrics[0], { phase: "draft", counter: "question", delta: 1, taskId: null, ts: state.metrics[0].ts });
    assert.equal(state.metrics[1].tokens.cacheCreation, 1);
    assert.deepEqual(state.notes, [{ text: "Retain this canonical observation.", taskId: null, ts: state.notes[0].ts }]);
    assert.equal(Object.hasOwn(persisted, "metrics"), false);
    assert.equal(Object.hasOwn(persisted, "notes"), false);
    assert.deepEqual(activities.slice(-3).map((activity) => activity.type), ["metric_recorded", "metric_recorded", "note_recorded"]);
    assert.equal(
      fs.existsSync(path.join(location.directory, ".runtime", "step-metadata", "branch.json")),
      true,
    );
    assert.equal(
      fs.existsSync(path.join(location.directory, ".runtime", "finalize-cleanup", "runtime-log.json")),
      true,
    );
    const catalog = manager.artifactCatalog(created.specId);
    assert.equal(catalog.artifacts.some((entry) => entry.relativePath.includes("step-metadata")), false);
    assert.equal(catalog.artifacts.some((entry) => entry.relativePath.includes("runtime-log")), false);
    assert.doesNotThrow(() => catalog.verify(location));
  });

  it("resolves issue-log publication through the same bound Version catalog", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");
    manager.updateStepStatus({ stepId: "branch", requestedStatus: "in_progress" });
    const state = manager.load(created.specId);
    const location = manager.specLocation(created.specId);

    manager.appendIssueLog({
      specId: state.specId,
      entry: {
        step: "draft",
        reason: "Canonical issue-log publication is catalog-owned.",
      },
      idempotencyKey: "canonical-issue-log",
    });

    const catalog = manager.artifactCatalog(created.specId);
    const activities = fs.readFileSync(location.activitiesFile, "utf8").trim().split("\n")
      .map((line) => JSON.parse(line));
    assert.equal(fs.existsSync(location.issueLogFile), true);
    assert.equal(catalog.resolve("issue-log.json").logicalKey, "issue.log");
    assert.equal(activities.at(-1).transition.operation, "publish_artifacts");
    assert.equal(activities.at(-1).nodeId, "branch");
    assert.doesNotThrow(() => catalog.verify(location));
  });

  it("updates a Task overview through the V1 Store without a root spec writer or duplicate Activity", async () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-canonical-overview"));
    manager.addTask({
      id: "T-1",
      title: "Canonical overview update",
      goal: "Persist this Task contribution through the Version Store.",
      parent: null,
      origin: "plan",
      added_round: 0,
      status: "pending",
    }, { specId: created.specId });
    manager.addActiveFlow(created.specId, "direct");
    advanceTo(manager, created.specId, "T-1-impl");

    const command = new RunUpdateOverviewCommand();
    const context = {
      root: repository,
      flowManager: manager,
      flowState: manager.load(created.specId),
      specId: created.specId,
      json: JSON.stringify({
        modules: ["src/flow/lib/canonical-overview-update.js"],
        data_flow: ["task implementation -> canonical spec record"],
        decisions: ["Overview contributions use the Version Store."],
      }),
    };
    const first = await command.execute(context);
    assert.equal(first.ok, true, JSON.stringify(first.errors));
    assert.equal(first.data.applied, true);

    const location = manager.specLocation(created.specId);
    const spec = JSON.parse(manager.readArtifact({
      specId: created.specId,
      logicalKey: "spec.record",
      consumerNodeId: "T-1-impl",
    }).bytes.toString("utf8"));
    const activities = () => fs.readFileSync(location.activitiesFile, "utf8").trim().split("\n")
      .map((line) => JSON.parse(line));
    assert.deepEqual(spec.overview.modules.at(-1), {
      text: "src/flow/lib/canonical-overview-update.js",
      added_by_task: "T-1",
    });
    assert.equal(activities().at(-1).transition.operation, "update_spec_record");
    assert.equal(activities().at(-1).type, "spec_record_updated");
    assert.equal(activities().at(-1).nodeId, "T-1-impl");
    assert.equal(fs.existsSync(path.join(repository, "specs", created.specId, "spec.json")), false);
    assert.equal(fs.existsSync(path.join(location.directory, "spec.md")), false);

    const beforeRepeat = activities().length;
    const repeated = await command.execute({ ...context, flowState: manager.load(created.specId) });
    assert.equal(repeated.ok, true);
    assert.equal(repeated.data.applied, false);
    assert.equal(activities().length, beforeRepeat, "recovery must not duplicate a matching overview contribution");
    assert.doesNotThrow(() => manager.artifactCatalog(created.specId).verify(location));
  });

  it("does not recreate the retired task-gate overview outbox after a V1 Task gate", async () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-canonical-task-gate"));
    manager.addTask({
      id: "T-1",
      title: "Canonical Task gate",
      goal: "Retire the post-gate Markdown refresh side effect.",
      parent: null,
      origin: "plan",
      added_round: 0,
      status: "pending",
    }, { specId: created.specId });
    manager.addActiveFlow(created.specId, "direct");
    advanceTo(manager, created.specId, "T-1-gate");
    confirmFixtureStep(manager, "T-1-gate", { specId: created.specId });

    const location = manager.specLocation(created.specId);
    const before = fs.readFileSync(location.activitiesFile, "utf8");
    await executeGateSideEffects({
      root: repository,
      flowManager: manager,
      flowState: manager.load(created.specId),
      specId: created.specId,
    }, "task-impl", { stepId: "T-1-gate", taskId: "T-1" });

    assert.equal(fs.readFileSync(location.activitiesFile, "utf8"), before);
    assert.equal(fs.existsSync(path.join(location.directory, "spec.md")), false);
    assert.equal(fs.existsSync(path.join(repository, "specs", created.specId, "spec.json")), false);
  });

  it("activates a fresh worker through one journaled Attempt while preserving next-action output", async () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");
    for (const stepId of ["branch", "prepare-spec"]) {
      manager.updateStepStatus({ stepId, requestedStatus: "in_progress" });
      confirmFixtureStep(manager, stepId);
    }
    const context = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      flowManager: manager,
      flowState: manager.load(created.specId),
      specId: created.specId,
      flowCommandBoundary: false,
    };

    const first = await new GetNextActionCommand().execute(context);
    const location = manager.specLocation(created.specId);
    const firstActivities = fs.readFileSync(location.activitiesFile, "utf8").trim().split("\n")
      .map((line) => JSON.parse(line));

    assert.equal(first.step, "draft");
    assert.equal(first.action, "write-draft");
    assert.equal(context.flowState.currentNodeId, "draft");
    assert.equal(firstActivities.at(-1).transition.operation, "start_attempt");
    assert.equal(firstActivities.at(-1).nodeId, "draft");

    const second = await new GetNextActionCommand().execute({ ...context, flowState: manager.load(created.specId) });
    const secondActivities = fs.readFileSync(location.activitiesFile, "utf8").trim().split("\n");
    assert.equal(second.step, first.step);
    assert.deepEqual(second.context, first.context);
    assert.equal(secondActivities.length, firstActivities.length, "resuming an active Attempt must not double-start it");
  });

  it("commits a worker result, Activity, and cataloged producer output through one V1 Store boundary", async () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");
    for (const stepId of ["branch", "prepare-spec"]) {
      manager.updateStepStatus({ stepId, requestedStatus: "in_progress" });
      confirmFixtureStep(manager, stepId);
    }
    await new GetNextActionCommand().execute({
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      flowManager: manager,
      flowState: manager.load(created.specId),
      specId: created.specId,
      flowCommandBoundary: false,
    });

    manager.confirmCurrentAttempt({
      specId: created.specId,
      artifactWrites: [{
        logicalKey: "draft",
        mediaType: "application/json",
        bytes: '{"goal":"canonical"}\n',
      }],
    });

    const location = manager.specLocation(created.specId);
    const catalog = manager.artifactCatalog(created.specId);
    const draft = catalog.resolve("steps/draft/result.json");
    const activities = fs.readFileSync(location.activitiesFile, "utf8").trim().split("\n")
      .map((line) => JSON.parse(line));
    assert.equal(manager.canonicalState(created.specId).findNode("draft").status, "done");
    assert.equal(draft.logicalKey, "draft");
    assert.equal(draft.activityId, activities.at(-1).id);
    assert.equal(fs.existsSync(path.join(location.directory, "draft.json")), false);
    assert.equal(fs.readFileSync(path.join(location.directory, draft.relativePath), "utf8"), '{"goal":"canonical"}\n');
  });

  it("journals a durable producer artifact without a second mutable state write", async () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");
    for (const stepId of ["branch", "prepare-spec"]) {
      manager.updateStepStatus({ stepId, requestedStatus: "in_progress" });
      confirmFixtureStep(manager, stepId);
    }
    await new GetNextActionCommand().execute({
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      flowManager: manager,
      flowState: manager.load(created.specId),
      specId: created.specId,
      flowCommandBoundary: false,
    });

    manager.publishArtifacts({
      specId: created.specId,
      nodeId: "draft",
      artifactWrites: [{
        logicalKey: "draft",
        mediaType: "application/json",
        bytes: '{"goal":"durable without completion"}\n',
      }],
    });
    const location = manager.specLocation(created.specId);
    const activities = fs.readFileSync(location.activitiesFile, "utf8").trim().split("\n")
      .map((line) => JSON.parse(line));
    const artifact = manager.artifactCatalog(created.specId).resolve("steps/draft/result.json");

    assert.equal(manager.canonicalState(created.specId).findNode("draft").status, "in_progress");
    assert.equal(activities.at(-1).transition.operation, "publish_artifacts");
    assert.equal(activities.at(-1).attemptId, manager.canonicalState(created.specId).attempt.id);
    assert.equal(artifact.activityId, activities.at(-1).id);
    assert.equal(fs.readFileSync(path.join(location.directory, artifact.relativePath), "utf8"), '{"goal":"durable without completion"}\n');
  });

  it("confirms a sealed normal worker handoff from the execution handoff directory", async () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");
    for (const stepId of ["branch", "prepare-spec"]) {
      manager.updateStepStatus({ stepId, requestedStatus: "in_progress" });
      confirmFixtureStep(manager, stepId);
    }
    await new GetNextActionCommand().execute({
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      flowManager: manager,
      flowState: manager.load(created.specId),
      specId: created.specId,
      flowCommandBoundary: false,
    });
    const coordinator = new WorkerArtifactHandoffCoordinator({
      now: () => new Date("2026-08-13T00:00:00.000Z"),
    });
    const context = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      flowManager: manager,
    };
    const handoff = coordinator.createRequest({
      ctx: context,
      state: manager.load(created.specId),
      invocation: {
        id: "canonical-handoff",
        target: { digest: "b".repeat(64) },
        action: { digest: "a".repeat(64), nextAction: { step: "draft" } },
      },
    });
    // Dispatch flushes the deferred agent metric while its Attempt is still
    // active, immediately before it reconciles the sealed handoff.
    manager.accumulateAgentMetrics("draft", {
      provider: "provider",
      profileKey: "default",
      responseChars: 9,
      durationMs: 12,
      usage: { input_tokens: 3, output_tokens: 4, cache_read_tokens: 0, cache_creation_tokens: 0 },
    });
    const location = manager.specLocation(created.specId);
    assert.equal(handoff.requestPath.startsWith(path.join(repository, ".sennel", "handoffs")), true);
    assert.equal(fs.existsSync(path.join(location.directory, ".runtime", "worker-handoffs")), false);
    fs.writeFileSync(handoff.payloadPath("draft.json"), '{"goal":"sealed canonical handoff"}\n');
    sealWorkerArtifactHandoff({ requestPath: handoff.requestPath, invocationId: "canonical-handoff" });

    const result = coordinator.reconcile({ ctx: context, request: handoff });
    const catalog = manager.artifactCatalog(created.specId);
    const draft = catalog.resolve("steps/draft/result.json");

    assert.equal(result.completed, true);
    assert.equal(manager.canonicalState(created.specId).findNode("draft").status, "done");
    assert.equal(manager.load(created.specId).metrics[0].kind, "agent");
    assert.equal(fs.readFileSync(path.join(location.directory, draft.relativePath), "utf8"), '{"goal":"sealed canonical handoff"}\n');
    assert.equal(fs.existsSync(path.join(location.directory, "draft.json")), false);
  });

  it("replaces worker test sources through the V1 catalog without retaining obsolete artifacts", () => {
    const specId = "001-canonical-test-tree";
    const { manager, created, coordinator, context, handoff } = canonicalTestTreeHandoffScenario(
      specId,
      "canonical-test-tree",
    );
    writeCanonicalTestTreePayload(handoff);
    sealWorkerArtifactHandoff({ requestPath: handoff.requestPath, invocationId: "canonical-test-tree" });

    const result = coordinator.reconcile({ ctx: context, request: handoff });
    const location = manager.specLocation(created.specId);
    const catalog = manager.artifactCatalog(created.specId);
    const sourcePaths = catalog.artifacts
      .filter((entry) => entry.logicalKey === "tests.source")
      .map((entry) => entry.relativePath);

    assert.equal(result.completed, true);
    assert.deepEqual(sourcePaths, ["artifacts/tests/current.test.js"]);
    assert.equal(fs.existsSync(path.join(location.directory, "artifacts", "tests", "obsolete.test.js")), false);
    assert.equal(fs.existsSync(path.join(location.directory, "artifacts", "tests", "current.test.js")), true);
    assert.equal(manager.canonicalState(created.specId).findNode("test").status, "done");
  });

  it("fails a stale V1 test-tree handoff without deleting newer cataloged sources", () => {
    const { manager, created, coordinator, context, handoff } = canonicalTestTreeHandoffScenario(
      "001-canonical-test-tree-cas",
      "canonical-test-tree-cas",
    );
    manager.publishArtifacts({
      specId: created.specId,
      nodeId: "test",
      artifactWrites: [{
        logicalKey: "tests.source",
        parameters: { testPath: "newer.test.js" },
        mediaType: "text/javascript",
        bytes: Buffer.from("// spec: R1\n", "utf8"),
      }],
    });
    writeCanonicalTestTreePayload(handoff);
    sealWorkerArtifactHandoff({ requestPath: handoff.requestPath, invocationId: "canonical-test-tree-cas" });

    assert.throws(
      () => coordinator.reconcile({ ctx: context, request: handoff }),
      (error) => error?.code === "FLOW_ARTIFACT_HANDOFF_CONFLICT",
    );
    const sources = manager.artifactCatalog(created.specId).artifacts
      .filter((entry) => entry.logicalKey === "tests.source")
      .map((entry) => entry.relativePath)
      .sort();
    assert.deepEqual(sources, ["artifacts/tests/newer.test.js", "artifacts/tests/obsolete.test.js"]);
    assert.equal(manager.canonicalState(created.specId).findNode("test").status, "in_progress");
  });

  it("hands cataloged draft review payloads to V1 triage and repair without exposing attempts wrappers", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-canonical-draft-triage"));
    manager.addActiveFlow(created.specId, "direct");
    const draftBytes = Buffer.from('{"goal":"Review the canonical draft."}\n', "utf8");
    const revision = {
      version: 1,
      runId: created.runId,
      specId: created.specId,
      sourceStepId: "draft",
      digest: crypto.createHash("sha256").update(draftBytes).digest("hex"),
      byteLength: draftBytes.length,
      finalizedAt: "2026-08-13T00:00:00.000Z",
    };
    const review = {
      version: 2,
      phase: "draft-questions",
      sourceDraft: "draft.json",
      sourceDraftRevision: revision,
      generatedAt: "2026-08-13T00:00:01.000Z",
      verdict: "ADVISORY",
      summary: "One repair target is retained.",
      blockingFindings: [],
      advisoryFindings: [],
      repairTargets: [{
        title: "Publish through the parent",
        target: "goal",
        rationale: "The parent owns durable publication.",
        evidence: "The worker handoff is catalog-backed.",
        classification: "repair_target",
      }],
    };
    advanceTo(manager, created.specId, "draft");
    manager.confirmCurrentAttempt({
      specId: created.specId,
      artifactWrites: [{
        logicalKey: "draft",
        mediaType: "application/json",
        bytes: draftBytes,
      }],
    });
    manager.updateStepStatus(
      { stepId: "draft-questions-review", requestedStatus: "in_progress" },
      { specId: created.specId },
    );
    publishAttemptArtifact(manager, created.specId, "draft-questions-review", "draft.questions.review", review);
    manager.updateStepStatus({ stepId: "draft-questions-review", requestedStatus: "done" }, { specId: created.specId });
    manager.updateStepStatus({ stepId: "draft-questions-triage", requestedStatus: "in_progress" }, { specId: created.specId });

    const coordinator = new WorkerArtifactHandoffCoordinator();
    const context = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      flowManager: manager,
    };
    const handoff = coordinator.createRequest({
      ctx: context,
      state: manager.load(created.specId),
      invocation: {
        id: "canonical-draft-triage",
        target: { digest: "b".repeat(64) },
        action: { digest: "a".repeat(64), nextAction: { step: "draft-questions-triage" } },
      },
    });
    const reviewInput = handoff.inputs.find((input) => input.name === "draft-review-questions.json");
    assert.deepEqual(reviewInput.document, review);
    fs.writeFileSync(handoff.payloadPath("draft-questions-triage.json"), `${JSON.stringify({
      version: 1,
      phase: "draft-questions-triage",
      sourceReview: "draft-review-questions.json",
      summary: "Apply the repair target.",
      items: [{
        title: "Publish through the parent",
        target: "goal",
        decision: "apply",
        rationale: "The target is valid.",
        evidence: "The parent owns durable publication.",
      }],
    }, null, 2)}\n`);
    sealWorkerArtifactHandoff({ requestPath: handoff.requestPath, invocationId: "canonical-draft-triage" });

    const result = coordinator.reconcile({ ctx: context, request: handoff });
    const location = manager.specLocation(created.specId);
    const triage = manager.readArtifact({
      specId: created.specId,
      logicalKey: "draft.questions.triage",
      consumerNodeId: "draft-questions-repair",
    });
    assert.equal(result.completed, true);
    assert.equal(manager.canonicalState(created.specId).findNode("draft-questions-triage").status, "done");
    assert.equal(JSON.parse(triage.bytes.toString("utf8")).items[0].decision, "apply");
    assert.equal(fs.existsSync(path.join(location.directory, "draft-review-questions.json")), false);

    manager.updateStepStatus({ stepId: "draft-questions-repair", requestedStatus: "in_progress" }, { specId: created.specId });
    const repairHandoff = coordinator.createRequest({
      ctx: context,
      state: manager.load(created.specId),
      invocation: {
        id: "canonical-draft-repair",
        target: { digest: "d".repeat(64) },
        action: { digest: "c".repeat(64), nextAction: { step: "draft-questions-repair" } },
      },
    });
    assert.deepEqual(
      repairHandoff.inputs.find((input) => input.name === "draft-review-questions.json").document,
      review,
    );
    fs.writeFileSync(repairHandoff.payloadPath("draft-questions-repair.json"), `${JSON.stringify({
      version: 1,
      phase: "draft-questions-repair",
      sourceTriage: "draft-questions-triage.json",
      summary: "Applied the repair target.",
      items: [{
        title: "Publish through the parent",
        target: "goal",
        rationale: "The parent owns durable publication.",
        evidence: "The sealed payload is cataloged by the parent.",
        changedFieldPaths: ["goal"],
      }],
    }, null, 2)}\n`);
    fs.writeFileSync(repairHandoff.payloadPath("draft.json"), '{"goal":"Repaired through the parent."}\n');
    sealWorkerArtifactHandoff({ requestPath: repairHandoff.requestPath, invocationId: "canonical-draft-repair" });

    const repaired = coordinator.reconcile({ ctx: context, request: repairHandoff });
    const draft = manager.readArtifact({
      specId: created.specId,
      logicalKey: "draft",
      consumerNodeId: "draft-refine",
    });
    assert.equal(repaired.completed, true);
    assert.equal(manager.canonicalState(created.specId).findNode("draft-questions-repair").status, "done");
    assert.equal(JSON.parse(draft.bytes.toString("utf8")).goal, "Repaired through the parent.");
    assert.equal(fs.existsSync(path.join(location.directory, "draft-questions-repair.json")), false);
  });

  it("rewinds a V1 plan gate with cataloged evidence and no mutable repair marker", async () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");
    advanceTo(manager, created.specId, "draft-gate");
    const source = {
      issueLogId: "draft-gate-blocking-evidence",
      step: "draft-gate",
      phase: "draft",
      reason: "The draft gate found a blocking retained behavior omission.",
      trigger: "gate post hook (auto)",
      observations: [{
        kind: "violation",
        failureMode: "guardrail-violation",
        requirementRef: "R-1",
        where: { file: "spec.json", locator: "requirements[0]" },
        observed: "The required behavior is absent from the draft.",
        severity: "blocking",
        refs: ["R-1"],
      }, {
        kind: "violation",
        failureMode: "process-evidence-missing",
        requirementRef: "process:gate-structure",
        where: null,
        observed: "The draft approval marker has not been finalized.",
        severity: "blocking",
        refs: ["process:diff-verifiable"],
      }],
      timestamp: "2026-08-13T00:00:00.000Z",
    };
    const gateResult = attachCanonicalCommandResultArtifact({
      result: "fail",
      artifacts: {
        phase: "draft",
        nextAction: { diagnosis: { observations: source.observations } },
      },
    }, {
      logicalKey: "draft.gate",
      payload: {
        result: "fail",
        artifacts: {
          phase: "draft",
          nextAction: { diagnosis: { observations: source.observations } },
        },
      },
    });
    manager.failCurrentAttempt({
      specId: created.specId,
      failure: {
        category: "semantic",
        code: "GATE_REJECTED",
        message: "The draft gate has blocking evidence.",
        retryable: true,
        retryKind: "semantic",
      },
      commandResult: gateResult,
    });
    manager.appendIssueLog({
      specId: created.specId,
      entry: source,
      idempotencyKey: source.issueLogId,
    });
    manager.appendIssueLog({
      specId: created.specId,
      entry: {
        step: "prepare-spec",
        reason: "An unrelated lifecycle observation was recorded after the gate.",
        trigger: "test fixture",
      },
      idempotencyKey: "unrelated-lifecycle-observation",
    });
    const context = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      flowManager: manager,
      flowState: manager.load(created.specId),
    };

    const repairAction = await new GetNextActionCommand().execute(context);
    assert.equal(repairAction.directive.actionId, "REPAIR_PLAN_GATE_EVIDENCE");
    assert.equal(repairAction.directive.phase, "draft");
    assert.match(repairAction.directive.nextAction, /sennel flow run repair-plan-gate/);

    const repaired = new RunRepairPlanGateCommand().execute(context);
    const typed = manager.canonicalState(created.specId);
    const projected = manager.load(created.specId);
    const activities = manager.activityLedger(created.specId);

    assert.equal(repaired.ok, true, JSON.stringify(repaired));
    assert.equal(repaired.data.previousStep, "draft-gate");
    assert.equal(typed.current.at(-1), "draft-refine");
    assert.equal(Object.hasOwn(typed.toJSON(), "planGateRepair"), false);
    assert.equal(Object.hasOwn(projected, "planGateRepair"), false);
    assert.equal(activities.at(-1).transition.operation, "plan_gate_repair");
    assert.equal(activities.at(-1).references.repairs[0].label, source.issueLogId);
    const workerAction = await new GetNextActionCommand().execute({
      ...context,
      flowState: manager.load(created.specId),
    });
    assert.equal(workerAction.step, "draft-refine");
    assert.deepEqual(workerAction.context.planGateRepair, {
      phase: "draft",
      targetStepId: "draft-refine",
      sourceIssueLogId: source.issueLogId,
      sourceEntryDigest: workerAction.context.planGateRepair.sourceEntryDigest,
      observations: source.observations,
    });

    confirmFixtureStep(manager, "draft-refine", { specId: created.specId });
    for (const stepId of ["draft-coverage-review", "draft-coverage-triage", "draft-coverage-repair"]) {
      const next = await new GetNextActionCommand().execute({
        ...context,
        flowState: manager.load(created.specId),
      });
      assert.equal(next.step, stepId);
      confirmFixtureStep(manager, stepId, { specId: created.specId });
    }
    const freshGate = await new GetNextActionCommand().execute({
      ...context,
      flowState: manager.load(created.specId),
    });
    assert.equal(freshGate.step, "draft-gate");
    assert.equal(freshGate.directive.kind, "execute_step");
  });

  it("fails closed when a current gate result and issue-log observations do not match", async () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");
    advanceTo(manager, created.specId, "draft-gate");
    const currentObservations = [{
      kind: "violation",
      failureMode: "guardrail-violation",
      requirementRef: "R-1",
      where: { file: "draft.json", locator: "requirements[0]" },
      observed: "The current gate result has this observation.",
      severity: "blocking",
      refs: ["R-1"],
    }];
    const staleObservations = [{
      ...currentObservations[0],
      observed: "A stale issue-log entry is not evidence for this result.",
    }];
    publishAttemptArtifact(manager, created.specId, "draft-gate", "draft.gate", {
      result: "fail",
      artifacts: {
        phase: "draft",
        nextAction: { diagnosis: { observations: currentObservations } },
      },
    });
    manager.failCurrentAttempt({
      specId: created.specId,
      failure: {
        category: "semantic",
        code: "GATE_REJECTED",
        message: "The current draft gate failed with different durable observations.",
        retryable: true,
        retryKind: "semantic",
      },
    });
    manager.appendIssueLog({
      specId: created.specId,
      entry: {
        step: "draft-gate",
        phase: "draft",
        reason: "A mismatched issue-log entry must not authorize repair.",
        trigger: "gate post hook (auto)",
        observations: staleObservations,
      },
      idempotencyKey: "mismatched-draft-gate-evidence",
    });
    const context = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      flowManager: manager,
      flowState: manager.load(created.specId),
    };

    const next = await new GetNextActionCommand().execute(context);
    const repair = new RunRepairPlanGateCommand().execute(context);

    assert.equal(next.directive.code, "CANONICAL_ATTEMPT_BLOCKED");
    assert.equal(repair.ok, false);
    assert.equal(repair.errors[0].code, "PLAN_GATE_REPAIR_EVIDENCE_MISSING");
    assert.equal(manager.canonicalState(created.specId).current.at(-1), "draft-gate");
  });

  it("keeps implementation and Task gate blockers outside the plan-gate repair route", async () => {
    const implementations = root();
    const implManager = new FlowManager({ root: implementations, mainRoot: implementations, inWorktree: false });
    new FlowAtStepFixture({
      flowManager: implManager,
      specId: "001-impl-gate-block",
      runId: "run-impl-gate-block",
      request: "Keep implementation gate recovery explicit.",
      targetStep: "impl-gate",
    }).create();
    const tasks = root();
    const taskManager = new FlowManager({ root: tasks, mainRoot: tasks, inWorktree: false });
    new TaskLifecycleFixture({
      flowManager: taskManager,
      specId: "001-task-gate-block",
      runId: "run-task-gate-block",
      request: "Keep Task gate recovery explicit.",
      taskDocuments: [{
        id: "T-1",
        title: "Task gate blocker",
        goal: "Exercise Task gate failure routing.",
        parent: null,
        origin: "plan",
        added_round: 0,
        status: "pending",
      }],
      taskId: "T-1",
      targetStep: "task-gate",
    }).create();

    for (const [manager, specId, expectedStep] of [
      [implManager, "001-impl-gate-block", "impl-gate"],
      [taskManager, "001-task-gate-block", "task-gate"],
    ]) {
      manager.failCurrentAttempt({
        specId,
        failure: {
          category: "semantic",
          code: "GATE_REJECTED",
          message: "The gate requires its dedicated recovery evidence.",
          retryable: true,
          retryKind: "semantic",
        },
      });
      const context = {
        root: manager === implManager ? implementations : tasks,
        mainRoot: manager === implManager ? implementations : tasks,
        executionRoot: manager === implManager ? implementations : tasks,
        specId,
        flowManager: manager,
        flowState: manager.load(specId),
      };
      const next = await new GetNextActionCommand().execute(context);
      const repair = new RunRepairPlanGateCommand().execute(context);

      assert.equal(next.step, expectedStep);
      assert.equal(next.directive.code, "CANONICAL_ATTEMPT_BLOCKED");
      assert.equal(repair.ok, false);
      assert.equal(repair.errors[0].code, "PLAN_GATE_REPAIR_STAGE_UNSUPPORTED");
    }
  });

  it("settles only definition-owned record and rewind failure dispositions", async () => {
    const recordRoot = root();
    const recordManager = new FlowManager({ root: recordRoot, mainRoot: recordRoot, inWorktree: false });
    new FlowAtStepFixture({
      flowManager: recordManager,
      specId: "001-record-failure",
      runId: "run-record-failure",
      request: "Record an exhausted definition failure.",
      targetStep: "spec-review",
    }).create();
    // A semantic producer failure remains distinct from a tooling failure:
    // the review result has already been canonically published, so its
    // definition-owned record continuation has valid consumer input.
    recordManager.publishCurrentAttemptResult({
      specId: "001-record-failure",
      commandResult: attachCanonicalCommandResultArtifact({ result: "rejected" }, {
        logicalKey: "spec.review",
        payload: { verdict: "REJECTED", proposalCount: 1 },
      }),
    });
    recordManager.failCurrentAttempt({
      specId: "001-record-failure",
      failure: {
        category: "semantic",
        code: "REVIEW_REJECTED",
        message: "The review cannot be retried.",
        retryable: false,
        retryKind: null,
      },
    });
    const recordContext = {
      root: recordRoot,
      mainRoot: recordRoot,
      executionRoot: recordRoot,
      specId: "001-record-failure",
      flowManager: recordManager,
      flowState: recordManager.load("001-record-failure"),
    };
    const recordDirective = await new GetNextActionCommand().execute(recordContext);
    assert.equal(recordDirective.directive.actionId, "SETTLE_CANONICAL_FAILURE");
    assert.match(recordDirective.directive.nextAction, /sennel flow run settle-failure/);
    recordManager.settleCurrentFailure({ specId: "001-record-failure" });
    assert.equal(recordManager.canonicalState("001-record-failure").current, null);
    assert.equal(recordManager.activityLedger("001-record-failure").at(-1).transition.operation, "record_failure");

    const rewindRoot = root();
    const rewindManager = new FlowManager({ root: rewindRoot, mainRoot: rewindRoot, inWorktree: false });
    new FlowAtStepFixture({
      flowManager: rewindManager,
      specId: "001-rewind-failure",
      runId: "run-rewind-failure",
      request: "Rewind an acceptance execution failure.",
      targetStep: "acceptance-review",
    }).create();
    rewindManager.failCurrentAttempt({
      specId: "001-rewind-failure",
      failure: {
        category: "agent",
        code: "ACCEPTANCE_AGENT_FAILED",
        message: "The acceptance agent failed before producing a verdict.",
        retryable: false,
        retryKind: null,
      },
    });
    const rewindContext = {
      root: rewindRoot,
      mainRoot: rewindRoot,
      executionRoot: rewindRoot,
      specId: "001-rewind-failure",
      flowManager: rewindManager,
      flowState: rewindManager.load("001-rewind-failure"),
    };
    const rewindDirective = await new GetNextActionCommand().execute(rewindContext);
    assert.equal(rewindDirective.directive.actionId, "SETTLE_CANONICAL_FAILURE");
    const settled = new RunSettleFailureCommand().execute({
      ...rewindContext,
      targetStep: "impl-gate",
      result: { outcome: "passed" },
    });
    assert.equal(settled.ok, true, JSON.stringify(settled));
    assert.equal(settled.data.operation, "rewind");
    assert.equal(rewindManager.canonicalState("001-rewind-failure").current.at(-1), "spec");
    const transition = rewindManager.activityLedger("001-rewind-failure").at(-1);
    assert.equal(transition.transition.operation, "rewind");
    assert.equal(transition.transition.attempt.nodeId, "spec");
    assert.equal(FLOW_COMMANDS.run["settle-failure"].args.options.includes("--target"), false);
    assert.equal(FLOW_COMMANDS.run["settle-failure"].args.options.includes("--result"), false);
  });

  it("records a blocked V1 scenario gate in the catalog before its guarded test rewind", async () => {
    const repository = root();
    const specId = "001-canonical-scenario-plan-gate";
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request(specId, {
      specRecord: new CurrentFlowSpecRecord({ ...validWorkerHandoffSpec(), tasks: [] }, { specId }),
    }));
    manager.addActiveFlow(created.specId, "direct");
    advanceTo(manager, created.specId, "scenario-validity", {
      onActive(nodeId) {
        if (nodeId !== "test") return;
        manager.publishArtifacts({
          specId: created.specId,
          nodeId,
          artifactWrites: [{
            logicalKey: "tests.source",
            parameters: { testPath: "scenario.test.js" },
            mediaType: "text/javascript",
            bytes: Buffer.from([
              'import test from "node:test";',
              'test("R1: exposes an invalid scenario premise", () => {});',
              "",
            ].join("\n"), "utf8"),
          }],
        });
      },
    });
    const context = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      flowManager: manager,
      flowState: manager.load(created.specId),
      config: {},
    };
    const scenario = new RunScenarioValidityCommand({
      scenarioTestExecutor: async ({ executions }) => executions.map((execution) => ({
        file: execution.file,
        requirementId: execution.requirementId,
        command: `node --test ${execution.file}`,
        process: {
          started: true,
          exitCode: 0,
          signal: null,
          timedOut: false,
          spawnError: null,
          stdout: "",
          stderr: "",
        },
      })),
    });

    const blocked = await scenario.execute(context);
    const issueLog = manager.readArtifact({
      specId: created.specId,
      logicalKey: "issue.log",
      consumerNodeId: "scenario-validity",
    });
    const source = JSON.parse(issueLog.bytes.toString("utf8")).entries.at(-1);

    assert.equal(blocked.result, "block");
    assert.equal(source.sourceArtifact, "scenario.validity");
    assert.match(source.testRevisionDigest, /^[a-f0-9]{64}$/);
    assert.deepEqual(source.observations.map((entry) => entry.refs), [["scenario.validity#summary.0"]]);
    await FLOW_COMMANDS.run["scenario-validity"].post(context, blocked);
    context.flowState = manager.load(created.specId);
    const failedAttempt = manager.canonicalState(created.specId).attempt;
    const resultPublication = manager.activityLedger(created.specId).find((activity) => (
      activity.transition.operation === "publish_artifacts"
      && activity.nodeId === "scenario-validity"
    ));
    assert.equal(resultPublication.attemptId, failedAttempt.id);
    assert.equal(resultPublication.sequence, failedAttempt.sequence);
    const repairAction = await new GetNextActionCommand().execute(context);
    assert.equal(repairAction.directive.actionId, "REPAIR_PLAN_GATE_EVIDENCE");
    assert.equal(repairAction.directive.phase, "test");
    const repaired = new RunRepairPlanGateCommand().execute({
      ...context,
      flowState: context.flowState,
    });
    const typed = manager.canonicalState(created.specId);
    const activities = manager.activityLedger(created.specId);

    assert.equal(repaired.ok, true, JSON.stringify(repaired));
    assert.equal(repaired.data.previousStep, "scenario-validity");
    assert.equal(typed.current.at(-1), "test");
    assert.equal(Object.hasOwn(typed.toJSON(), "planGateRepair"), false);
    assert.equal(activities.at(-1).transition.operation, "plan_gate_repair");
    assert.equal(activities.at(-1).references.repairs[0].label, source.issueLogId);
  });

  it("recovers a committed V1 handoff cleanup from the Flow runtime directory", async () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");
    for (const stepId of ["branch", "prepare-spec"]) {
      manager.updateStepStatus({ stepId, requestedStatus: "in_progress" });
      confirmFixtureStep(manager, stepId);
    }
    await new GetNextActionCommand().execute({
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      flowManager: manager,
      flowState: manager.load(created.specId),
      specId: created.specId,
      flowCommandBoundary: false,
    });
    const context = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      flowManager: manager,
    };
    const coordinator = new WorkerArtifactHandoffCoordinator({
      faultInjector: ({ phase }) => {
        if (phase === "before-worker-handoff-cleanup-rename") throw new Error("crash before cleanup");
      },
    });
    const handoff = coordinator.createRequest({
      ctx: context,
      state: manager.load(created.specId),
      invocation: {
        id: "canonical-recovery",
        target: { digest: "d".repeat(64) },
        action: { digest: "c".repeat(64), nextAction: { step: "draft" } },
      },
    });
    fs.writeFileSync(handoff.payloadPath("draft.json"), '{"goal":"recover cleanup"}\n');
    sealWorkerArtifactHandoff({ requestPath: handoff.requestPath, invocationId: "canonical-recovery" });
    assert.throws(
      () => coordinator.reconcile({ ctx: context, request: handoff }),
      /RECOVERY_REQUIRED|cleanup requires recovery/i,
    );
    assert.equal(manager.canonicalState(created.specId).findNode("draft").status, "done");
    assert.equal(fs.existsSync(handoff.directory), true);

    const recovered = new WorkerArtifactHandoffCoordinator().recoverPending({ ctx: context });
    assert.equal(recovered.completed, true);
    assert.equal(recovered.replayed, true);
    assert.equal(fs.existsSync(handoff.directory), false);
  });
});
