/**
 * src/flow/lib/set-req.js
 *
 * Update a single requirement's status in spec.json (the single source of truth).
 *
 * ctx.index  — requirement index (string or number)
 * ctx.status — new status string
 */

import { FlowCommand } from "./base-command.js";
import { VALID_REQ_STATUSES } from "../../lib/constants.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { updateSpecRequirementStatus } from "../../lib/spec-json.js";

export default class SetReqCommand extends FlowCommand {
  execute(ctx) {
    const { index: rawIndex, status } = ctx;

    if (rawIndex == null || !status) {
      return Envelope.fail("set", "req", "INVALID_USAGE", "usage: flow set req <index> <status>");
    }

    const str = String(rawIndex);
    if (!/^\d+$/.test(str)) {
      return Envelope.fail(
        "set",
        "req",
        "INVALID_ARG_VALUE",
        `not a valid non-negative integer: ${rawIndex}`,
      );
    }

    const index = parseInt(str, 10);

    if (!VALID_REQ_STATUSES.includes(status)) {
      return Envelope.fail(
        "set",
        "req",
        "INVALID_STATUS",
        `invalid status: ${status} (valid: ${VALID_REQ_STATUSES.join(", ")})`,
      );
    }

    updateSpecRequirementStatus(ctx.root, ctx.flowState.spec, index, status);

    return { index, status };
  }
}
