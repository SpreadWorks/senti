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
import { syncSpecTasksToFlow } from "./sync-spec-tasks.js";
import { runAutoCheckCore } from "./run-auto-check.js";
import { resolveAutoCheckInput, buildSkipVerdict } from "./resolve-auto-check-input.js";
import {
  findActiveNode,
  flowLeafIdsBetween,
  resolveSideEffects,
  taskIdForResolvedStep,
} from "../definition.js";
import { validateTestHeaders, formatValidationMessages } from "./test-headers.js";
import { loadSpecJson, resolveSpecDir } from "../../lib/spec-json.js";
import { validateStepCompletionTransition } from "./flow-judgment-contract.js";
import { findStepById } from "./step-tree.js";
import {
  assertIntegrationRegressionEvidence,
  completeScenarioValidityArtifactChange,
  completeTestExecuteArtifactChange,
  completeTestResultReviewArtifactChange,
  readJsonStrict,
  validateTestExecuteResultV2,
} from "./test-artifacts.js";
import {
  completeImplTriage,
  completeImplRepair,
} from "./impl-repair-artifacts.js";

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
  if (!state?.spec) return null;
  let specJson;
  try {
    specJson = loadSpecJson(path.resolve(ctx.root, state.spec), { validate: false });
  } catch (err) {
    return Envelope.fail(
      "set",
      "step",
      "TEST_HEADER_VALIDATION_FAILED",
      [`failed to load spec.json: ${err.message}`],
      { violations: [] },
    );
  }
  const specDir = resolveSpecDir(path.resolve(ctx.root, state.spec));
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

function validatePostHookManagedStep(ctx, id) {
  const state = ctx.flowManager.load();
  if (!state?.spec) {
    return Envelope.fail(
      "set",
      "step",
      "STEP_ARTIFACT_VALIDATION_FAILED",
      `${id} cannot be marked done without an active flow spec`,
    );
  }
  const specDir = resolveSpecDir(path.resolve(ctx.root, state.spec));
  try {
    if (id === "test-execute") {
      validateTestExecuteResultV2(readJsonStrict(path.join(specDir, "test-execute-result.json")));
    } else if (id === "retro") {
      assertIntegrationRegressionEvidence({
        root: ctx.root,
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

export async function preValidateImplementStepCompletion({ root, state, requestedStatus } = {}) {
  if (requestedStatus !== "done") return null;
  if (!state?.spec) return implementFailure(["durable-artifact-missing"], ["active flow spec is required"]);
  const specPath = path.resolve(root, state.spec);
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
  if (!fs.existsSync(testExecutePath) && !fs.existsSync(scenarioValidityPath)) {
    addImplementIssue(issueCodes, "durable-artifact-missing");
  }
  if (issueCodes.includes("requirement-status-incomplete")) {
    return implementFailure(issueCodes);
  }
  if (fs.existsSync(scenarioValidityPath)) {
    try {
      const completed = await completeScenarioValidityArtifactChange({
        root,
        specDir,
        artifact: JSON.parse(fs.readFileSync(scenarioValidityPath, "utf8")),
      });
      if (completed.constructor.name === "ArtifactCompletionMechanicalFailure") {
        for (const code of completed.issueCodes) addImplementIssue(issueCodes, code);
      }
    } catch (err) {
      addImplementIssue(issueCodes, "durable-artifact-missing");
    }
  }
  if (fs.existsSync(testExecutePath)) {
    try {
      const artifact = JSON.parse(fs.readFileSync(testExecutePath, "utf8"));
      const completed = await completeTestExecuteArtifactChange({ root, specDir, artifact });
      if (completed.constructor.name === "ArtifactCompletionMechanicalFailure") {
        for (const code of completed.issueCodes) addImplementIssue(issueCodes, code);
      }
      const rawOutputPath = artifact.rawOutputPath || artifact.raw_output_path;
      const rawPath = rawOutputPath?.startsWith("specs/")
        ? path.resolve(root, rawOutputPath)
        : path.resolve(specDir, rawOutputPath || "");
      if (rawOutputPath && !fs.existsSync(rawPath)) {
        addImplementIssue(issueCodes, "durable-artifact-missing");
      }
    } catch (err) {
      addImplementIssue(issueCodes, "durable-artifact-missing");
    }
  }
  if (fs.existsSync(testResultReviewPath)) {
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

    // spec 249: pre-validate test step done before persisting state.
    if (id === "test" && status === "done") {
      const fail = preValidateTestStep(ctx);
      if (fail) return fail;
    }
    if (status === "done") {
      const state = ctx.flowManager.load();
      if (id === "impl-triage") {
        const specDir = resolveSpecDir(path.resolve(ctx.root, state.spec));
        const completed = completeImplTriage({ specDir, flowManager: ctx.flowManager });
        if (!completed.requiresRepair) {
          return { id, status, next: "impl-gate", dispositions: completed.artifact.items };
        }
      }
      if (id === "impl-repair") {
        const completed = completeImplRepair({
          root: ctx.root,
          state,
          flowManager: ctx.flowManager,
          resetStepIds: flowLeafIdsBetween("test-execute", "finalize-cleanup"),
        });
        return { id, status, repair: completed.entry, invalidations: completed.invalidations };
      }
      if (id === "implement") {
        const fail = await preValidateImplementStepCompletion({ root: ctx.root, state, requestedStatus: status });
        if (fail) return fail;
      }
      const fail = validateStepCompletionTransition({ root: ctx.root, state, stepId: id, requestedStatus: status });
      if (fail) return fail;
    }
    if (status === "done" && ["test-execute", "retro"].includes(id)) {
      const fail = validatePostHookManagedStep(ctx, id);
      if (fail) return fail;
    }

    // Pass specId so the mutator can locate flow.json by path even when the
    // current flowManager root has no .active-flow entry for this spec
    // (spec 251: main-repo authority during finalize-merge / sync / cleanup).
    // The resolved active step owns its parent scope; a non-matching id is a
    // flow-level mutation rather than an implicit current-task lookup.
    const activeNode = findActiveNode(ctx.flowManager.load());
    ctx.flowManager.updateStepStatus(id, status, {
      ...(ctx.specId ? { specId: ctx.specId } : {}),
      taskId: taskIdForResolvedStep(activeNode, id),
    });
    if (container.has("logger")) {
      container.get("logger").event("flow-step-change", { step: id, status });
    }

    let extras = null;
    if (status === "done") {
      const effects = collectSideEffects(id);

      if (effects.includes("syncSpecTasks")) {
        try {
          const syncResult = syncSpecTasksToFlow({ root: ctx.root });
          if (syncResult.added?.length > 0) {
            extras = { tasksSynced: syncResult.added };
          }
        } catch (err) {
          process.stderr.write(
            `[senti] set-step ${id}: task sync failed (${err.message})\n`,
          );
          if (container.has("logger")) {
            container.get("logger").event("approval-sync-error", { error: err.message });
          }
        }
      }

      if (effects.includes("autoUpgradeReeval")) {
        try {
          const state = ctx.flowManager.load();
          if (state?.autoDesired === true && state?.autoApprove !== true) {
            const paths = { root: ctx.root, specPath: state.spec };
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
