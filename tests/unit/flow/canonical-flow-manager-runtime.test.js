import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { FlowManager } from "../../../src/lib/flow-manager.js";
import {
  FlowArtifactAttemptHistory,
  FlowArtifactAttemptRecord,
} from "../../../src/lib/flow-artifact-contract.js";
import { CanonicalFlowCreateRequest } from "../../../src/flow/lib/canonical-flow-manager-store.js";
import { CurrentFlowSpecRecord } from "../../../src/flow/lib/current-flow-state.js";
import GetNextActionCommand from "../../../src/flow/lib/get-next-action.js";
import RunDispatchCommand from "../../../src/flow/lib/run-dispatch.js";
import RunFinalRegressionCommand from "../../../src/flow/lib/run-final-regression.js";
import RunReportCommand from "../../../src/flow/lib/run-report.js";
import RunReviewCommand from "../../../src/flow/lib/run-review.js";
import SetReviewEvidenceCommand from "../../../src/flow/lib/set-review-evidence.js";
import RunRecoverReviewPassCommand from "../../../src/flow/lib/run-recover-review-pass.js";
import RunUpdateOverviewCommand from "../../../src/flow/lib/run-update-overview.js";
import RunGateCommand, { executeGateSideEffects } from "../../../src/flow/lib/run-gate.js";
import RunRepairPlanGateCommand from "../../../src/flow/lib/run-repair-plan-gate.js";
import RunRepairTestReviewCommand from "../../../src/flow/lib/run-repair-test-review.js";
import RunScenarioValidityCommand from "../../../src/flow/lib/run-scenario-validity.js";
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
  sealWorkerArtifactHandoff,
} from "../../../src/flow/lib/worker-artifact-handoff.js";
import {
  FlowOutboxIdentity,
  FlowOutboxRecoveryClaim,
  FlowOutboxRecoveryRequiredError,
  FlowOutboxStore,
} from "../../../src/flow/lib/flow-outbox.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { commitAll, initGitRepo } from "../../helpers/git-repo.js";
import { validWorkerHandoffSpec } from "../../helpers/worker-artifact.js";
import { validateCanonicalUpgradeEvidence } from "../../../src/flow/lib/test-artifacts.js";
import { ReviewTargetAuthority } from "../../../src/flow/lib/review-target-authority.js";
import { CanonicalTestArtifactStore } from "../../../src/flow/lib/canonical-test-artifacts.js";
import { buildRepairFingerprint } from "../../../src/flow/lib/repair-fingerprint.js";

const roots = [];

function root() {
  const value = createTmpDir("canonical-flow-manager-");
  roots.push(value);
  return value;
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
    manager.updateStepStatus({ stepId: entry.id, requestedStatus: "done" }, { specId });
  }
  manager.updateStepStatus({ stepId: nodeId, requestedStatus: "in_progress" }, { specId });
}

function attemptHistoryBytes(nodeId, logicalKey, payload) {
  const history = new FlowArtifactAttemptHistory([
    new FlowArtifactAttemptRecord({
      attempt: 1,
      payload: {
        nodeId,
        outcome: "completed",
        result: { result: "ok" },
        artifact: { logicalKey, payload },
      },
    }),
  ]);
  return Buffer.from(`${JSON.stringify(history.toJSON(), null, 2)}\n`, "utf8");
}

function publishAttemptArtifact(manager, specId, nodeId, logicalKey, payload) {
  manager.publishArtifacts({
    specId,
    nodeId,
    artifactWrites: [{
      logicalKey,
      mediaType: "application/json",
      bytes: attemptHistoryBytes(nodeId, logicalKey, payload),
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
  return new Map([
    ["scenario-validity", () => publishAttemptArtifact(manager, specId, "scenario-validity", "scenario.validity", {
      version: "1",
      command: "node --test artifacts/tests/scenario.test.js",
      process: { started: true, exitCode: 0, signal: null, timedOut: false, spawnError: null },
      result: "pass",
      raw_output_path: location.relativeArtifact("scenario.validity.raw-log"),
      summary: [],
    })],
    ["test-execute", () => publishAttemptArtifact(manager, specId, "test-execute", "test.execute", {
      version: "2",
      raw_output_path: location.relativeArtifact("test.execute.raw-log"),
      summary: [{ id: "R-1", result: "pass", evidence: { test_name: "canonical acceptance evidence" } }],
      regression: { required: false, category: "docs-only", reason: "fixture", classified_paths: [], trigger_relevant_changed_files: [], changed_files: [] },
    })],
    ["test-result-review", () => publishAttemptArtifact(manager, specId, "test-result-review", "test.result.review", {
      verdict: "pass",
      checked_items: [],
      result_file_path: location.relativeArtifact("test.execute"),
      raw_output_path: location.relativeArtifact("test.execute.raw-log"),
    })],
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

  it("routes normal manager step transitions and Task addition through the Activity Store", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    manager.createFresh(request());
    manager.addActiveFlow("001-canonical-manager", "direct");

    manager.updateStepStatus({ stepId: "branch", requestedStatus: "in_progress" });
    manager.updateStepStatus({ stepId: "branch", requestedStatus: "done" });
    manager.updateStepStatus({ stepId: "prepare-spec", requestedStatus: "in_progress" });
    manager.updateStepStatus({ stepId: "prepare-spec", requestedStatus: "done" });
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
    manager.updateStepStatus({ stepId: "branch", requestedStatus: "done" });
    manager.updateStepStatus({ stepId: "prepare-spec", requestedStatus: "done" });
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
      if (step.status === "pending") manager.updateStepStatus({ stepId: step.id, requestedStatus: "done" });
    }
    manager.updateStepStatus({ stepId: "T-1-impl", requestedStatus: "in_progress" });
    manager.setStepRuntimeLog("task-impl", runtimeLog(created.runId, 1));
    manager.updateStepStatus({ stepId: "T-1-impl", requestedStatus: "done" });
    manager.updateStepStatus({ stepId: "T-1-review", requestedStatus: "in_progress" });
    manager.setStepRuntimeLog("task-review", runtimeLog(created.runId, 2));
    manager.updateStepStatus({ stepId: "T-1-review", requestedStatus: "done" });
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
      manager.updateStepStatus({ stepId: entry.id, requestedStatus: "done" });
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
      manager.updateStepStatus({ stepId: entry.id, requestedStatus: "done" });
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
    assert.equal(leaves(state.steps).find((entry) => entry.id === "acceptance-review").status, "invalidated");
    const history = JSON.parse(manager.readArtifact({
      specId: created.specId,
      logicalKey: "acceptance.review",
      consumerNodeId: "acceptance-decision",
    }).bytes.toString("utf8"));
    assert.equal(history.attempts[0].artifact.payload.verdict, "repair_required");
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

  it("routes test execution and result-review artifacts through V1 history and the transient raw contract", async () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");
    const ordered = leaves(manager.load(created.specId).steps);
    const executeIndex = ordered.findIndex((entry) => entry.id === "test-execute");
    assert.ok(executeIndex > 0);
    for (const entry of ordered.slice(0, executeIndex)) {
      manager.updateStepStatus({ stepId: entry.id, requestedStatus: "done" });
    }
    manager.updateStepStatus({ stepId: "test-execute", requestedStatus: "in_progress" });
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
    const executionArtifact = {
      version: "2",
      repairFingerprint: repairFingerprint.hash,
      raw_output_path: manager.specLocation(created.specId).relativeArtifact("test.execute.raw-log"),
      summary: [],
      regression: {
        required: false,
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
      next: "test-result-review",
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

  it("confirms definition-owned no-op leaves and persists review history through the catalog", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");

    const ordered = leaves(manager.load(created.specId).steps);
    const reviewIndex = ordered.findIndex((entry) => entry.id === "spec-review");
    assert.ok(reviewIndex > 0);
    for (const entry of ordered.slice(0, reviewIndex)) {
      manager.updateStepStatus({ stepId: entry.id, requestedStatus: "done" });
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
      manager.updateStepStatus({ stepId: entry.id, requestedStatus: "done" });
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
      manager.updateStepStatus({ stepId: entry.id, requestedStatus: "done" });
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
        if (entry.id === "implement") {
          manager.updateStepStatus({ stepId: entry.id, requestedStatus: "in_progress" });
          manager.updateFileMap({ requirementId: "R1", paths: ["src/report.js"] });
        }
        manager.updateStepStatus({ stepId: entry.id, requestedStatus: "done" });
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
      manager.updateStepStatus({ stepId: entry.id, requestedStatus: "done" });
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
      manager.updateStepStatus({ stepId: entry.id, requestedStatus: "done" });
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
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");
    const ordered = leaves(manager.load(created.specId).steps);
    const reviewIndex = ordered.findIndex((entry) => entry.id === "spec-review");
    for (const entry of ordered.slice(0, reviewIndex)) {
      manager.updateStepStatus({ stepId: entry.id, requestedStatus: "done" });
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

    const result = await review.execute(ctx);
    assert.equal(invocation.command, "node");
    assert.deepEqual(invocation.args.slice(-2), ["--phase", "spec"]);
    assert.equal(invocation.options.env.SENNEL_REVIEW_OUTPUT_DIR.startsWith(
      path.join(manager.specLocation(created.specId).directory, ".runtime", "review-work-units"),
    ), true);
    assert.equal(result.artifacts.phase, "spec");
    assert.equal(result.artifacts.evidenceDigest.length, 64);
    assert.equal(attachedCanonicalCommandResultArtifact(result).logicalKey, "spec.review");
    assert.equal(attachedCanonicalCommandResultPublications(result)[0].logicalKey, "review.evidence");

    await FLOW_COMMANDS.run.review.post(ctx, result);
    const transientWorkUnit = invocation.options.env.SENNEL_REVIEW_OUTPUT_DIR;
    assert.equal(fs.existsSync(transientWorkUnit), true);
    fs.rmSync(transientWorkUnit, { recursive: true, force: true });
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

  it("materializes draft review input from the catalog without exposing the Version root", async () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request("001-canonical-draft-review"));
    manager.addActiveFlow(created.specId, "direct");
    const draft = Buffer.from(`${JSON.stringify({ goal: "Review the draft", qa: [] }, null, 2)}\n`, "utf8");
    advanceTo(manager, created.specId, "draft-questions-review", {
      onActive(nodeId) {
        if (nodeId !== "draft") return;
        manager.publishArtifacts({
          specId: created.specId,
          nodeId,
          artifactWrites: [{ logicalKey: "draft", mediaType: "application/json", bytes: draft }],
        });
      },
    });

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
        fs.writeFileSync(path.join(options.env.SENNEL_REVIEW_OUTPUT_DIR, "draft-questions-review.json"), JSON.stringify({
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
      executionRoot: repository,
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
    const location = manager.specLocation(created.specId);
    assert.equal(fs.existsSync(path.join(location.directory, "draft.json")), false);
    assert.equal(fs.existsSync(path.join(location.directory, "draft-questions-review.json")), false);
    assert.equal(fs.existsSync(path.join(location.directory, "draft-questions-triage.json")), false);
    assert.equal(fs.existsSync(path.join(location.directory, "draft-questions-repair.json")), false);
  });

  it("materializes the shared file.map for impl review from its catalog authority", async () => {
    const repository = root();
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
    const sourceRevision = new CanonicalTestArtifactStore({
      flowManager: manager,
      state: manager.load(created.specId),
    }).testSourceRevision().toJSON();
    const evidenceDigest = "e".repeat(64);
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
      sourceTestArtifactRevision: sourceRevision,
      canonicalEvidence: {
        disposition: "REJECTED",
        blockingFindings: [finding],
        advisoryFindings: [],
        identity: { evidenceDigest },
      },
    });
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
    assert.equal(next.directive.actionId, "REPAIR_TEST_REVIEW");

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

  it("routes the normal review post-hook through the Version Store result history", async () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");
    const ordered = leaves(manager.load(created.specId).steps);
    const reviewIndex = ordered.findIndex((entry) => entry.id === "spec-review");
    for (const entry of ordered.slice(0, reviewIndex)) {
      manager.updateStepStatus({ stepId: entry.id, requestedStatus: "done" });
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
      manager.updateStepStatus(
        { stepId: step.id, requestedStatus: "done" },
        { specId: created.specId },
      );
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
    const referencesBeforeFinalization = catalogArtifactReferences(manager.artifactCatalog(created.specId));
    assert.equal(referencesBeforeFinalization.some((artifact) => artifact.logicalKey === "scenario.validity"), true);
    manager.updateStepStatus(
      { stepId: "scenario-validity", requestedStatus: "done" },
      { specId: created.specId },
    );

    for (const step of leaves(manager.load(created.specId).steps)) {
      if (step.status === "pending") {
        manager.updateStepStatus(
          { stepId: step.id, requestedStatus: "done" },
          { specId: created.specId },
        );
      }
    }

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
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");
    for (const stepId of ["branch", "prepare-spec"]) {
      manager.updateStepStatus({ stepId, requestedStatus: "in_progress" });
      manager.updateStepStatus({ stepId, requestedStatus: "done" });
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

    const action = {
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
    const current = { value: action };
    let workerPrompt = null;
    const dispatcher = new RunDispatchCommand({
      nextAction: { async run() { return structuredClone(current.value); } },
      agent: {
        async call(prompt) {
          workerPrompt = prompt;
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
    assert.match(workerPrompt, /Machine-readable dispatch invocation contract:/);
    assert.match(workerPrompt, /"source": "explicit"/);
    assert.match(workerPrompt, /"step": "draft"/);
    const activities = fs.readFileSync(manager.specLocation(created.specId).activitiesFile, "utf8")
      .trim().split("\n").map((line) => JSON.parse(line));
    assert.equal(activities.some((entry) => entry.type === "dispatch_approval_recorded"), true);
    assert.equal(manager.canonicalState(created.specId).findNode("draft").status, "done");
  });

  it("journals policy changes and rewinds through the same canonical state machine", () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");

    manager.setAutoApprove(true);
    manager.updateStepStatus({ stepId: "branch", requestedStatus: "in_progress" });
    manager.updateStepStatus({ stepId: "branch", requestedStatus: "done" });
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
    manager.updateStepStatus({ stepId: "T-1-gate", requestedStatus: "done" }, { specId: created.specId });

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
      manager.updateStepStatus({ stepId, requestedStatus: "done" });
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
      manager.updateStepStatus({ stepId, requestedStatus: "done" });
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
      manager.updateStepStatus({ stepId, requestedStatus: "done" });
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
    assert.equal(activities.at(-1).attemptId, null);
    assert.equal(artifact.activityId, activities.at(-1).id);
    assert.equal(fs.readFileSync(path.join(location.directory, artifact.relativePath), "utf8"), '{"goal":"durable without completion"}\n');
  });

  it("confirms a sealed normal worker handoff through the same V1 Store and catalog", async () => {
    const repository = root();
    const manager = new FlowManager({ root: repository, mainRoot: repository, inWorktree: false });
    const created = manager.createFresh(request());
    manager.addActiveFlow(created.specId, "direct");
    for (const stepId of ["branch", "prepare-spec"]) {
      manager.updateStepStatus({ stepId, requestedStatus: "in_progress" });
      manager.updateStepStatus({ stepId, requestedStatus: "done" });
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
    assert.equal(handoff.requestPath.startsWith(path.join(location.directory, ".runtime", "worker-handoffs")), true);
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
    advanceTo(manager, created.specId, "draft-questions-review", {
      onActive(nodeId) {
        if (nodeId !== "draft") return;
        manager.publishArtifacts({
          specId: created.specId,
          nodeId,
          artifactWrites: [{
            logicalKey: "draft",
            mediaType: "application/json",
            bytes: draftBytes,
          }],
        });
      },
    });
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
      observations: [{
        kind: "violation",
        failureMode: "guardrail-violation",
        requirementRef: "R-1",
        where: { file: "spec.json", locator: "requirements[0]" },
        observed: "The required behavior is absent from the draft.",
        severity: "blocking",
        refs: ["R-1"],
      }],
      timestamp: "2026-08-13T00:00:00.000Z",
    };
    manager.publishArtifacts({
      specId: created.specId,
      nodeId: "draft-gate",
      artifactWrites: [{
        logicalKey: "issue.log",
        mediaType: "application/json",
        bytes: Buffer.from(`${JSON.stringify({ entries: [source] }, null, 2)}\n`, "utf8"),
      }],
    });
    manager.failCurrentAttempt({
      specId: created.specId,
      failure: {
        category: "semantic",
        code: "DRAFT_GATE_BLOCKED",
        message: "The draft gate has blocking evidence.",
        retryable: false,
        retryKind: null,
      },
    });
    const context = {
      root: repository,
      mainRoot: repository,
      executionRoot: repository,
      specId: created.specId,
      flowManager: manager,
      flowState: manager.load(created.specId),
    };

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
      flowState: projected,
    });
    assert.equal(workerAction.step, "draft-refine");
    assert.deepEqual(workerAction.context.planGateRepair, {
      phase: "draft",
      targetStepId: "draft-refine",
      sourceIssueLogId: source.issueLogId,
      sourceEntryDigest: workerAction.context.planGateRepair.sourceEntryDigest,
      observations: source.observations,
    });
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
    const repaired = new RunRepairPlanGateCommand().execute({
      ...context,
      flowState: manager.load(created.specId),
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
      manager.updateStepStatus({ stepId, requestedStatus: "done" });
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
