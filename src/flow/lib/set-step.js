/**
 * src/flow/lib/set-step.js
 *
 * Update a workflow step's status.
 * Side effects (syncSpecTasks, autoUpgradeReeval) are driven by
 * the definition's sideEffects attribute — not hardcoded step IDs.
 */

import { FlowCommand } from "./base-command.js";
import { VALID_STEP_STATUSES } from "../../lib/constants.js";
import { container } from "../../lib/container.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { runAutoCheckCore } from "./run-auto-check.js";
import { resolveCanonicalAutoCheckInput, buildSkipVerdict } from "./resolve-auto-check-input.js";
import {
  findActiveNode,
  isDefinitionLifecycleOwnedStep,
  resolveSideEffects,
  taskIdForResolvedStep,
} from "../definition.js";
import { findStepById } from "./step-tree.js";
import {
  NormalStepTransition,
  StepTransitionError,
} from "./step-transition-policy.js";
import { requiresWorkerArtifactHandoff } from "./flow-artifact-authority.js";

function collectSideEffects(stepId) {
  return resolveSideEffects({ scope: "flow", stepId }) || [];
}

function canonicalTargetId(activeNode, requestedId) {
  if (activeNode?.scope !== "task") return requestedId;
  if (["task-impl", "task-review", "task-gate"].includes(requestedId)) {
    return activeNode.stepId;
  }
  return requestedId;
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

    if (
      status === "done"
      && requiresWorkerArtifactHandoff(id)
    ) {
      return Envelope.fail(
        "set",
        "step",
        "FLOW_ARTIFACT_HANDOFF_REQUIRED",
        `${id} completion is owned by the parent dispatcher artifact handoff`,
        {
          classification: "invalid",
          retryBudgetConsumed: false,
          completionOwner: "parent-dispatcher",
        },
      );
    }

    const state = ctx.flowManager.load();
    if (state?.schemaRevision !== 3) {
      return Envelope.fail("set", "step", "CANONICAL_FLOW_REQUIRED", "active Flow must be backed by the canonical Version Store");
    }
    const activeNode = state ? findActiveNode(state) : null;
    const activeScope = activeNode?.scope === "task"
      ? state.tasks?.find((task) => task.id === activeNode.taskId)
      : state;
    const targetId = canonicalTargetId(activeNode, id);
    const storedStep = activeScope
      ? findStepById(activeScope.steps || [], targetId)
      : null;
    let transition;
    try {
      transition = new NormalStepTransition({
        stepId: targetId,
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

    const effects = status === "done" ? collectSideEffects(id) : [];

    // Pass specId so the mutator can locate flow.json by path even when the
    // current flowManager root has no .active-flow entry for this spec
    // (spec 251: main-repo authority during finalize-merge / sync / cleanup).
    // The resolved active step owns its parent scope; a non-matching id is a
    // flow-level mutation rather than an implicit current-task lookup.
    ctx.flowManager.updateStepStatus(transition, {
      ...(ctx.specId ? { specId: ctx.specId } : {}),
      taskId: taskIdForResolvedStep(activeNode, targetId),
    });
    if (container.has("logger")) {
      container.get("logger").event("flow-step-change", { step: id, status });
    }

    let extras = null;
    if (status === "done") {
      if (effects.includes("autoUpgradeReeval")) {
        try {
          const state = ctx.flowManager.load();
          if (state?.autoDesired === true && state?.autoApprove !== true) {
            const resolved = resolveCanonicalAutoCheckInput({
              flowManager: ctx.flowManager,
              state,
            });
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
              if (!extras) extras = {};
              extras.autoUpgrade = { available: true };
            }
          }
        } catch (err) {
          process.stderr.write(
            `[sennel] set-step auto-upgrade re-eval: ${err.message}\n`,
          );
        }
      }
    }

    return extras ? { id, status, ...extras } : { id, status };
  }
}
