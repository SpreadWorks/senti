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

export default class SetStepCommand extends FlowCommand {
  execute(ctx) {
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

    return { id, status };
  }
}
