/**
 * src/flow/lib/set-req.js
 *
 * Update a single requirement's status in spec.json (the single source of truth).
 *
 * ctx.reqRef — requirement id (for example R1) or zero-based index
 * ctx.status — new status string
 */

import { FlowCommand } from "./base-command.js";
import { VALID_REQ_STATUSES } from "../../lib/constants.js";
import { Envelope } from "../../lib/flow-envelope.js";

export default class SetReqCommand extends FlowCommand {
  execute(ctx) {
    const rawRef = ctx.reqRef ?? ctx.index;
    const { status } = ctx;

    if (rawRef == null || !status) {
      return Envelope.fail("set", "req", "INVALID_USAGE", "usage: flow set req <reqId|zeroBasedIndex> <status>");
    }

    if (!VALID_REQ_STATUSES.includes(status)) {
      return Envelope.fail(
        "set",
        "req",
        "INVALID_STATUS",
        `invalid status: ${status} (valid: ${VALID_REQ_STATUSES.join(", ")})`,
      );
    }

    const reference = typeof rawRef === "number" ? String(rawRef) : rawRef.trim();
    if (!/^(?:\d+|R-?\d+|REQ-?\d+)$/i.test(reference)) {
      return Envelope.fail("set", "req", "INVALID_ARG_VALUE", `not a valid requirement id or zero-based index: ${rawRef}`);
    }

    if (ctx.flowState?.schemaRevision !== 3 || typeof ctx.flowManager?.updateRequirementStatus !== "function") {
      throw new Error("canonical FlowManager.updateRequirementStatus is required");
    }
    let outcome;
    try {
      outcome = ctx.flowManager.updateRequirementStatus({
        specId: ctx.flowState.specId,
        reference,
        status,
      });
    } catch (error) {
      if (error.message.startsWith("requirement id not found:")) {
        return Envelope.fail("set", "req", "INVALID_ARG_VALUE", `not a valid requirement id or zero-based index: ${rawRef}`);
      }
      throw error;
    }

    return { index: outcome.index, reqId: outcome.requirement.id ?? null, status };
  }
}
