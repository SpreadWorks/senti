/**
 * src/flow/lib/set-step.js
 *
 * Update a workflow step's status.
 * Side effects (syncSpecTasks, autoUpgradeReeval) are driven by
 * the definition's sideEffects attribute — not hardcoded step IDs.
 */

import path from "node:path";
import fs from "node:fs";
import { FlowCommand } from "./base-command.js";
import { VALID_STEP_STATUSES } from "../../lib/constants.js";
import { container } from "../../lib/container.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { prepareSpecTaskSync } from "./sync-spec-tasks.js";
import { runAutoCheckCore } from "./run-auto-check.js";
import { resolveAutoCheckInput, buildSkipVerdict } from "./resolve-auto-check-input.js";
import {
  findActiveNode,
  flowLeafIdsBetween,
  isDefinitionLifecycleOwnedStep,
  resolveLifecyclePlan,
  resolveSideEffects,
  taskIdForResolvedStep,
} from "../definition.js";
import { validateTestHeaders, formatValidationMessages } from "./test-headers.js";
import { loadSpecJson, resolveSpecDir } from "../../lib/spec-json.js";
import { relativeFlowSpecFile } from "../../lib/flow-workspace.js";
import { validateStepCompletionTransition } from "./flow-judgment-contract.js";
import { findStepById } from "./step-tree.js";
import {
  assertIntegrationRegressionEvidence,
  completeScenarioValidityArtifactChange,
  completeTestExecuteArtifactChange,
  completeTestResultReviewArtifactChange,
  readJsonStrict,
  resolveRawFile,
  validateTestExecuteResultV2,
} from "./test-artifacts.js";
import {
  PlanEvidenceReference,
  isPlanArtifactFresh,
  isPlanEvidenceFresh,
  latestPlanRewind,
} from "./plan-rewind.js";
import {
  completeImplTriage,
  completeImplRepair,
  completeLateAppliedFindingRepair,
  commitImplRepairEffects,
  ImplRepairTransitionIntent,
  readImplRepairLedger,
} from "./impl-repair-artifacts.js";
import { loadIssueLog } from "./set-issue-log.js";
import {
  ExternalBlockedOutcome,
  StepAttemptLog,
} from "./step-outcome.js";
import { readRepairFingerprintManifest } from "./repair-state-identity.js";
import {
  DefinitionLifecycleTransition,
  ExplicitRecoveryTransition,
  NormalStepTransition,
  StepTransitionError,
} from "./step-transition-policy.js";
import {
  DraftArtifactRecoveryError,
  completeDraftArtifactStep,
  isDraftArtifactWriterStep,
} from "./draft-artifact-promotion.js";

function definitionTransitions(state, plan) {
  return plan.actions.flatMap((action) => {
    const target = findStepById(state.steps || [], action.step);
    if (target?.status === action.status) return [];
    return [new DefinitionLifecycleTransition({
      action,
      plan,
      currentStatus: target?.status,
    })];
  });
}

function isBlockedImplRepairRecovery({ id, status, activeNode, storedStep }) {
  return id === "impl-repair"
    && status === "done"
    && activeNode?.scope === "flow"
    && activeNode.stepId === "impl-gate";
}

function hasAuditedPreimplementationBootstrap(state, scenarioArtifact) {
  const scenario = findStepById(state.steps || [], "scenario-validity");
  const testReview = findStepById(state.steps || [], "test-review");
  const implement = findStepById(state.steps || [], "implement");
  return scenario?.status === "skipped"
    && testReview?.status === "skipped"
    && implement?.status === "in_progress"
    && typeof state.repairBaseline?.ref === "string"
    && scenarioArtifact?.result === "block"
    && Array.isArray(scenarioArtifact?.preflight?.invalid_paths)
    && scenarioArtifact.preflight.invalid_paths.length > 0;
}

const MISSING_REPAIR_EVIDENCE_REASON = /^must-fix finding ([a-f0-9]{64}) is missing matching repair evidence$/;
const LATE_APPLIED_REPAIR_REASON_PREFIX = "Late repair evidence recorded for findings ";

function hasLateAppliedFindingRecovery(ledger) {
  return ledger?.entries.some((entry) => (
    entry.reason.startsWith(LATE_APPLIED_REPAIR_REASON_PREFIX)
  )) === true;
}

function assertLateAppliedFindingRecoveryAvailable(ledger) {
  if (hasLateAppliedFindingRecovery(ledger)) {
    throw new Error("impl-repair recovery may run only once for the current flow");
  }
}

function assertFreshRecoveryTestEvidence(specDir) {
  const manifest = readRepairFingerprintManifest(specDir);
  for (const artifactName of ["test-execute-result.json", "test-result-review.json"]) {
    const artifact = JSON.parse(fs.readFileSync(path.join(specDir, artifactName), "utf8"));
    if (artifact.repairFingerprint !== manifest.hash) {
      throw new Error("impl-repair recovery requires fresh test evidence before invalidation");
    }
  }
}

function missingCurrentAppliedFindingIds(specDir, ledger = readImplRepairLedger(specDir)) {
  const triage = JSON.parse(fs.readFileSync(path.join(specDir, "impl-triage.json"), "utf8"));
  if (triage.sourceStep !== "impl-review" || triage.sourceArtifact !== "impl-review.json") {
    throw new Error("impl-repair recovery requires an impl-review triage artifact");
  }
  const review = JSON.parse(fs.readFileSync(path.join(specDir, "impl-review.json"), "utf8"));
  const previous = triage.previousFingerprint?.hash;
  if (typeof previous !== "string" || review.repairFingerprint !== previous) {
    throw new Error("impl-repair recovery requires triage and review fingerprint agreement");
  }
  const sourceFindingIds = new Set([
    ...(review.blockingFindings || []),
    ...(review.nonBlockingImprovements || []),
  ].map((finding) => finding.findingId));
  if (!Array.isArray(triage.items) || triage.items.length === 0) {
    throw new Error("impl-repair recovery requires triage findings");
  }
  if (triage.items.some((item) => !sourceFindingIds.has(item.findingId))) {
    throw new Error("impl-repair recovery triage findings must come from impl-review");
  }
  const applied = triage.items
    .filter((item) => item.decision === "apply")
    .map((item) => item.findingId);
  if (applied.length === 0 || triage.items.some((item) => item.decision !== "apply")) {
    throw new Error("impl-repair recovery requires only applied triage findings");
  }
  assertFreshRecoveryTestEvidence(specDir);
  const repaired = new Set(
    ledger?.entries.flatMap((entry) => entry.sourceFindingIds) || [],
  );
  const missing = applied.filter((findingId) => !repaired.has(findingId));
  if (missing.length === 0) {
    throw new Error("impl-repair recovery requires an applied finding without repair evidence");
  }
  if (missing.length !== applied.length) {
    throw new Error("impl-repair recovery cannot mix repaired and unrepaired applied findings");
  }
  return missing;
}

function missingGateObservedFindingIds({ root, state, specDir, ledger = readImplRepairLedger(specDir) }) {
  const repaired = new Set(ledger?.entries.flatMap((entry) => entry.sourceFindingIds) || []);
  const observed = loadIssueLog(root, relativeFlowSpecFile(state)).entries
    .map((entry) => MISSING_REPAIR_EVIDENCE_REASON.exec(String(entry?.reason || ""))?.[1] || null)
    .filter((findingId) => findingId !== null && repaired.has(findingId));
  const missing = [...new Set(observed)];
  if (missing.length === 0) {
    throw new Error("impl-repair recovery requires a gate-observed repair evidence failure");
  }
  assertFreshRecoveryTestEvidence(specDir);
  return missing;
}

function validateBlockedImplRepairRecovery({ root, state }) {
  const latest = new StepAttemptLog(state.stepAttempts || []).latestForRun(state.runId);
  if (
    latest?.stepId !== "impl-gate"
    || latest.taskId != null
    || !(latest.outcome instanceof ExternalBlockedOutcome)
    || latest.outcome.reason !== "mechanical"
  ) {
    return Envelope.fail(
      "set",
      "step",
      "IMPL_REPAIR_RECOVERY_UNAVAILABLE",
      "impl-repair recovery requires a mechanically blocked flow-level impl-gate attempt",
    );
  }
  try {
    const specDir = resolveSpecDir(path.resolve(root, relativeFlowSpecFile(state)));
    const ledger = readImplRepairLedger(specDir);
    assertLateAppliedFindingRecoveryAvailable(ledger);
    try {
      return { specDir, missingFindingIds: missingCurrentAppliedFindingIds(specDir, ledger) };
    } catch (triageError) {
      try {
        return { specDir, missingFindingIds: missingGateObservedFindingIds({ root, state, specDir, ledger }) };
      } catch (gateError) {
        throw new Error(`${triageError.message}; ${gateError.message}`);
      }
    }
  } catch (error) {
    return Envelope.fail(
      "set",
      "step",
      "IMPL_REPAIR_RECOVERY_UNAVAILABLE",
      error.message,
    );
  }
}

function collectSideEffects(stepId) {
  return resolveSideEffects({ scope: "flow", stepId }) || [];
}

/**
 * spec 249: pre-validate spec verification test files when transitioning the
 * `test` step to `done`. Returns a failed Envelope when validation fails so
 * the step status is not persisted.
 */
function preValidateTestStep(ctx) {
  const state = ctx.flowManager.load();
  if (!state?.specId) return null;
  let specJson;
  try {
    specJson = loadSpecJson(path.resolve(ctx.root, relativeFlowSpecFile(state)), { validate: false });
  } catch (err) {
    return Envelope.fail(
      "set",
      "step",
      "TEST_HEADER_VALIDATION_FAILED",
      [`failed to load spec.json: ${err.message}`],
      { violations: [] },
    );
  }
  const specDir = resolveSpecDir(path.resolve(ctx.root, relativeFlowSpecFile(state)));
  const result = validateTestHeaders({ specDir, spec: specJson });
  if (result.ok) return null;
  return Envelope.fail(
    "set",
    "step",
    "TEST_HEADER_VALIDATION_FAILED",
    formatValidationMessages(result),
    result,
  );
}

function preValidateApprovalStep({ root, state }) {
  if (!latestPlanRewind(state)) return null;
  let spec;
  try {
    spec = loadSpecJson(path.resolve(root, relativeFlowSpecFile(state)), { validate: false });
  } catch (error) {
    return Envelope.fail("set", "step", "STALE_PLAN_APPROVAL", error.message);
  }
  const confirmedAt = spec.user_approval?.confirmed_at;
  if (typeof confirmedAt !== "string") {
    return Envelope.fail(
      "set",
      "step",
      "STALE_PLAN_APPROVAL",
      "approval must be confirmed after the latest plan rewind",
    );
  }
  let fresh = false;
  try {
    fresh = isPlanEvidenceFresh(state, new PlanEvidenceReference({
      kind: "approval",
      createdAt: confirmedAt,
    }));
  } catch {
    fresh = false;
  }
  return fresh
    ? null
    : Envelope.fail(
      "set",
      "step",
      "STALE_PLAN_APPROVAL",
      "approval confirmation is stale after the latest plan rewind",
    );
}

function validatePostHookManagedStep(ctx, id) {
  const state = ctx.flowManager.load();
  if (!state?.specId) {
    return Envelope.fail(
      "set",
      "step",
      "STEP_ARTIFACT_VALIDATION_FAILED",
      `${id} cannot be marked done without an active flow spec`,
    );
  }
  const specDir = resolveSpecDir(path.resolve(ctx.root, relativeFlowSpecFile(state)));
  try {
    if (id === "test-execute") {
      validateTestExecuteResultV2(readJsonStrict(path.join(specDir, "test-execute-result.json")));
    } else if (id === "retro") {
      assertIntegrationRegressionEvidence({
        root: ctx.executionRoot || ctx.root,
        state,
        specDir,
        config: container.has("config") ? (container.get("config") || {}) : {},
      });
      readJsonStrict(path.join(specDir, "retro.json"));
    }
  } catch (err) {
    return Envelope.fail(
      "set",
      "step",
      "STEP_ARTIFACT_VALIDATION_FAILED",
      `${id} cannot be marked done without valid current v2 test artifacts: ${err.message}`,
    );
  }
  return null;
}

function implementFailure(issueCodes, messages = null) {
  const unique = [...new Set(issueCodes)];
  return Envelope.fail(
    "set",
    "step",
    "IMPLEMENT_COMPLETION_VALIDATION_FAILED",
    messages || unique.map((code) => `implement completion failed: ${code}`),
    { issueCodes: unique },
  );
}

function addImplementIssue(issueCodes, code) {
  if (!issueCodes.includes(code)) issueCodes.push(code);
}

class ImplementEvidenceEligibility {
  constructor({ state, file, kind }) {
    this.file = file;
    this.present = fs.existsSync(file);
    this.current = this.present && isPlanArtifactFresh(state, file, kind);
    Object.freeze(this);
  }

  get stale() {
    return this.present && !this.current;
  }
}

export async function preValidateImplementStepCompletion({ root, state, requestedStatus } = {}) {
  if (requestedStatus !== "done") return null;
  if (!state?.specId) return implementFailure(["durable-artifact-missing"], ["active flow spec is required"]);
  const specPath = path.resolve(root, relativeFlowSpecFile(state));
  const specDir = resolveSpecDir(specPath);
  let spec;
  try {
    spec = loadSpecJson(specPath, { validate: false });
  } catch (err) {
    return implementFailure(["durable-artifact-missing"], [`failed to load spec.json: ${err.message}`]);
  }

  const issueCodes = [];
  const requirements = Array.isArray(spec.requirements) ? spec.requirements.filter((r) => r.testable !== false) : [];
  if (requirements.some((requirement) => requirement.status !== "done")) {
    addImplementIssue(issueCodes, "requirement-status-incomplete");
  }

  const fileMapPath = path.join(specDir, "file-map.json");
  let fileMap = null;
  if (!fs.existsSync(fileMapPath)) {
    addImplementIssue(issueCodes, "file-map-missing");
  } else {
    try {
      fileMap = JSON.parse(fs.readFileSync(fileMapPath, "utf8"));
      const missing = requirements.filter((requirement) => !Array.isArray(fileMap?.[requirement.id]) || fileMap[requirement.id].length === 0);
      if (missing.length > 0) addImplementIssue(issueCodes, "file-map-missing");
    } catch (err) {
      addImplementIssue(issueCodes, "file-map-missing");
    }
  }

  const scenarioValidityPath = path.join(specDir, "scenario-validity-result.json");
  const testExecutePath = path.join(specDir, "test-execute-result.json");
  const testResultReviewPath = path.join(specDir, "test-result-review.json");
  const scenarioValidityEvidence = new ImplementEvidenceEligibility({
    state,
    file: scenarioValidityPath,
    kind: "scenario-validity",
  });
  const testExecuteEvidence = new ImplementEvidenceEligibility({
    state,
    file: testExecutePath,
    kind: "test-execute",
  });
  const testResultReviewEvidence = new ImplementEvidenceEligibility({
    state,
    file: testResultReviewPath,
    kind: "test-result-review",
  });
  const readinessEvidence = [scenarioValidityEvidence, testExecuteEvidence];
  if (!readinessEvidence.some((evidence) => evidence.current)) {
    addImplementIssue(
      issueCodes,
      readinessEvidence.some((evidence) => evidence.stale)
        ? "durable-artifact-stale"
        : "durable-artifact-missing",
    );
  }
  if (issueCodes.includes("requirement-status-incomplete")) {
    return implementFailure(issueCodes);
  }
  if (scenarioValidityEvidence.current) {
    try {
      const scenarioArtifact = JSON.parse(fs.readFileSync(scenarioValidityPath, "utf8"));
      if (!hasAuditedPreimplementationBootstrap(state, scenarioArtifact)) {
        const completed = await completeScenarioValidityArtifactChange({
          root,
          specDir,
          artifact: scenarioArtifact,
        });
        if (completed.constructor.name === "ArtifactCompletionMechanicalFailure") {
          for (const code of completed.issueCodes) addImplementIssue(issueCodes, code);
        }
      }
    } catch (err) {
      addImplementIssue(issueCodes, "durable-artifact-missing");
    }
  }
  if (testExecuteEvidence.current) {
    try {
      const artifact = JSON.parse(fs.readFileSync(testExecutePath, "utf8"));
      const completed = await completeTestExecuteArtifactChange({ root, specDir, artifact });
      if (completed.constructor.name === "ArtifactCompletionMechanicalFailure") {
        for (const code of completed.issueCodes) addImplementIssue(issueCodes, code);
      }
      const rawOutputPath = artifact.rawOutputPath || artifact.raw_output_path;
      const rawPath = resolveRawFile(root, specDir, rawOutputPath || "");
      if (rawOutputPath && !fs.existsSync(rawPath)) {
        addImplementIssue(issueCodes, "durable-artifact-missing");
      }
    } catch (err) {
      addImplementIssue(issueCodes, "durable-artifact-missing");
    }
  }
  if (testResultReviewEvidence.current) {
    try {
      const completed = await completeTestResultReviewArtifactChange({
        specDir,
        artifact: JSON.parse(fs.readFileSync(testResultReviewPath, "utf8")),
      });
      if (completed.constructor.name === "ArtifactCompletionMechanicalFailure") {
        for (const code of completed.issueCodes) addImplementIssue(issueCodes, code);
      }
    } catch (err) {
      addImplementIssue(issueCodes, "durable-artifact-missing");
    }
  }

  if (issueCodes.length > 0) return implementFailure(issueCodes);
  return null;
}

export default class SetStepCommand extends FlowCommand {
  constructor() {
    super({ explicitTargetResolution: true });
  }

  async execute(ctx) {
    const { id, status } = ctx;

    if (!id || !status) {
      return Envelope.fail("set", "step", "INVALID_USAGE", "usage: flow set step <id> <status>");
    }

    if (!VALID_STEP_STATUSES.includes(status)) {
      return Envelope.fail(
        "set",
        "step",
        "INVALID_STATUS",
        `invalid status: ${status} (valid: ${VALID_STEP_STATUSES.join(", ")})`,
      );
    }

    const state = ctx.flowManager.load();
    const activeNode = state ? findActiveNode(state) : null;
    const activeScope = activeNode?.scope === "task"
      ? state.tasks?.find((task) => task.id === activeNode.taskId)
      : state;
    const storedStep = activeScope
      ? findStepById(activeScope.steps || [], id)
      : null;
    if (isBlockedImplRepairRecovery({ id, status, activeNode, storedStep })) {
      const recovery = validateBlockedImplRepairRecovery({ root: ctx.root, state });
      if (recovery instanceof Envelope) return recovery;
      try {
        const completed = completeLateAppliedFindingRepair({
          root: ctx.root,
          state,
          flowManager: ctx.flowManager,
          specDir: recovery.specDir,
          sourceStep: "impl-review",
          sourceFindingIds: recovery.missingFindingIds,
          specId: ctx.specId,
        });
        return {
          id,
          status,
          recovered: true,
          repair: completed.entry,
          missingFindingIds: recovery.missingFindingIds,
          invalidations: completed.invalidations,
        };
      } catch (error) {
        return Envelope.fail(
          "set",
          "step",
          "IMPL_REPAIR_RECOVERY_FAILED",
          error.message,
        );
      }
    }
    let transition;
    try {
      transition = new NormalStepTransition({
        stepId: id,
        currentStepId: activeNode?.stepId,
        currentStatus: storedStep?.status,
        requestedStatus: status,
        lifecycleOwned: isDefinitionLifecycleOwnedStep({
          scope: activeNode?.scope || "flow",
          stepId: id,
        }),
      });
    } catch (error) {
      const transitionError = error instanceof StepTransitionError
        ? error
        : new StepTransitionError(error.message);
      return Envelope.fail("set", "step", transitionError.code, transitionError.message);
    }

    // spec 249: pre-validate test step done before persisting state.
    if (id === "test" && status === "done") {
      const fail = preValidateTestStep(ctx);
      if (fail) return fail;
    }
    if (status === "done") {
      if (id === "approval") {
        const fail = preValidateApprovalStep({ root: ctx.root, state });
        if (fail) return fail;
      }
      if (id === "impl-triage") {
        const specDir = resolveSpecDir(path.resolve(ctx.root, relativeFlowSpecFile(state)));
        const completed = completeImplTriage({ specDir });
        if (!completed.requiresRepair) {
          const plan = resolveLifecyclePlan({
            event: "set-step:impl-triage",
            currentStepId: activeNode.stepId,
          });
          ctx.flowManager.updateStepStatuses([
            transition,
            ...definitionTransitions(state, plan),
          ], {
            ...(ctx.specId ? { specId: ctx.specId } : {}),
            taskId: null,
          });
          return { id, status, next: "impl-gate", dispositions: completed.artifact.items };
        }
      }
      if (id === "impl-repair") {
        const executionRoot = ctx.executionRoot || ctx.root;
        const completed = completeImplRepair({
          root: executionRoot,
          state,
          resetStepIds: flowLeafIdsBetween("test-execute", "finalize-cleanup"),
        });
        ctx.flowManager.updateStepStatuses([
          transition,
          ...(completed.stepChanges.length > 0 ? [new ExplicitRecoveryTransition({
            stepId: completed.stepChanges[0].stepId,
            currentStatus: completed.stepChanges[0].currentStatus,
            requestedStatus: completed.stepChanges[0].requestedStatus,
            entrypoint: "impl-repair-invalidation",
            changes: completed.stepChanges,
          })] : []),
        ], {
          ...(ctx.specId ? { specId: ctx.specId } : {}),
          taskId: null,
        }, new ImplRepairTransitionIntent(completed.transaction));
        commitImplRepairEffects({
          root: executionRoot,
          state,
          flowManager: ctx.flowManager,
          transaction: completed.transaction,
          specId: ctx.specId,
        });
        return {
          id,
          status,
          repair: completed.entry,
          invalidations: completed.invalidations,
        };
      }
      if (id === "implement") {
        const fail = await preValidateImplementStepCompletion({ root: ctx.root, state, requestedStatus: status });
        if (fail) return fail;
      }
      const fail = validateStepCompletionTransition({
        root: ctx.root,
        executionRoot: ctx.executionRoot || ctx.root,
        state,
        stepId: id,
        requestedStatus: status,
      });
      if (fail) return fail;
      if (isDraftArtifactWriterStep(id)) {
        try {
          const completed = completeDraftArtifactStep({
            mainRoot: ctx.root,
            executionRoot: ctx.executionRoot || ctx.root,
            flowManager: ctx.flowManager,
            state,
            transition,
          });
          return {
            id,
            status,
            promoted: completed.promoted,
            draftArtifactRevision: completed.revision,
          };
        } catch (error) {
          if (!(error instanceof DraftArtifactRecoveryError)) throw error;
          return Envelope.fail(
            "set",
            "step",
            error.code,
            error.message,
            {
              ...error.data,
              recoveryCommand: error.recoveryCommand,
              retryBudgetConsumed: false,
            },
          );
        }
      }
    }
    if (status === "done" && ["test-execute", "retro"].includes(id)) {
      const fail = validatePostHookManagedStep(ctx, id);
      if (fail) return fail;
    }

    const effects = status === "done" ? collectSideEffects(id) : [];
    const taskSyncIntent = effects.includes("syncSpecTasks")
      ? prepareSpecTaskSync({ root: ctx.root, state })
      : null;

    // Pass specId so the mutator can locate flow.json by path even when the
    // current flowManager root has no .active-flow entry for this spec
    // (spec 251: main-repo authority during finalize-merge / sync / cleanup).
    // The resolved active step owns its parent scope; a non-matching id is a
    // flow-level mutation rather than an implicit current-task lookup.
    ctx.flowManager.updateStepStatus(transition, {
      ...(ctx.specId ? { specId: ctx.specId } : {}),
      taskId: taskIdForResolvedStep(activeNode, id),
      ...(taskSyncIntent ? { expectedOriginal: state } : {}),
    }, taskSyncIntent);
    if (container.has("logger")) {
      container.get("logger").event("flow-step-change", { step: id, status });
    }

    let extras = taskSyncIntent?.added.length > 0
      ? { tasksSynced: [...taskSyncIntent.added] }
      : null;
    if (status === "done") {
      if (effects.includes("autoUpgradeReeval")) {
        try {
          const state = ctx.flowManager.load();
          if (state?.autoDesired === true && state?.autoApprove !== true) {
            const paths = { root: ctx.root, specPath: relativeFlowSpecFile(state) };
            const resolved = resolveAutoCheckInput(state, paths);
            let verdict;
            if (resolved.skip) {
              verdict = buildSkipVerdict();
            } else if (resolved.fail) {
              verdict = resolved.verdict;
            } else {
              verdict = {
                ...(await runAutoCheckCore(this.container, resolved.text)),
                ...(resolved.goalGate ? { goalGate: resolved.goalGate } : {}),
              };
            }
            if (verdict.eligible) {
              ctx.flowManager.mutate((s) => {
                s.autoCheck = verdict;
                s.autoUpgrade = { available: true, reason: verdict.reason || "re-evaluation eligible" };
              });
              if (!extras) extras = {};
              extras.autoUpgrade = { available: true };
            }
          }
        } catch (err) {
          process.stderr.write(
            `[senti] set-step auto-upgrade re-eval: ${err.message}\n`,
          );
        }
      }

      if (effects.includes("promoteFinalRegression")) {
        ctx.flowManager.mutate((s) => {
          const finalRegression = findStepById(s.steps || [], "final-regression");
          if (finalRegression?.status === "pending") finalRegression.status = "in_progress";
        });
      }
    }

    return extras ? { id, status, ...extras } : { id, status };
  }
}
