/**
 * src/flow/lib/set-step.js
 *
 * Update a workflow step's status.
 *
 * ctx.id     — step ID
 * ctx.status — new status string
 */

import { FlowCommand } from "./base-command.js";
import { VALID_STEP_STATUSES } from "../../lib/constants.js";
import { container } from "../../lib/container.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { syncSpecTasksToFlow } from "./sync-spec-tasks.js";
import { runAutoCheckCore } from "./run-auto-check.js";
import { resolveAutoCheckInput, buildSkipVerdict } from "./resolve-auto-check-input.js";

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

    // REQ-2 (spec 215): approval post-hook — when the user marks the
    // parent-level approval step as done, reflect spec.json tasks[] into
    // flow.json tasks[] (differential append, preserving existing tasks).
    let extras = null;
    if (id === "approval" && status === "done") {
      try {
        const syncResult = syncSpecTasksToFlow({ root: ctx.root });
        if (syncResult.added?.length > 0) {
          extras = { tasksSynced: syncResult.added };
        }
      } catch (err) {
        process.stderr.write(
          `[sdd-forge] set-step approval: task sync failed (${err.message})\n`,
        );
        if (container.has("logger")) {
          container.get("logger").event("approval-sync-error", { error: err.message });
        }
      }
    }

    // Spec 232 R2: re-evaluate auto-check on draft→done / approval→done
    // when the user desired auto mode but was rejected earlier.
    if (status === "done" && (id === "draft" || id === "approval")) {
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

    return extras ? { id, status, ...extras } : { id, status };
  }
}
