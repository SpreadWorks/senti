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
import { syncSpecTasksToFlow } from "./sync-spec-tasks.js";
import { runAutoCheckCore } from "./run-auto-check.js";
import { resolveAutoCheckInput, buildSkipVerdict } from "./resolve-auto-check-input.js";
import { resolveNodeFor, FLOW_DEFINITION } from "../definition.js";

function collectSideEffects(stepId) {
  const node = resolveNodeFor(FLOW_DEFINITION, stepId);
  return node?.sideEffects || [];
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

    ctx.flowManager.updateStepStatus(id, status);
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
            `[sdd-forge] set-step ${id}: task sync failed (${err.message})\n`,
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
            } else {
              verdict = await runAutoCheckCore(this.container, resolved.text);
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
            `[sdd-forge] set-step auto-upgrade re-eval: ${err.message}\n`,
          );
        }
      }
    }

    return extras ? { id, status, ...extras } : { id, status };
  }
}
