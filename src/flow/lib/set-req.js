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
import { loadSpecRequirements, updateSpecRequirementStatus } from "../../lib/spec-json.js";
import { relativeFlowSpecFile } from "../../lib/flow-workspace.js";

function resolveRequirementIndex(root, specPath, rawRef) {
  const ref = String(rawRef);
  if (/^\d+$/.test(ref)) return parseInt(ref, 10);

  const requirements = loadSpecRequirements(root, specPath);
  const index = requirements.findIndex((req) => req.id === ref);
  return index >= 0 ? index : null;
}

export default class SetReqCommand extends FlowCommand {
  execute(ctx) {
    const rawRef = ctx.reqRef ?? ctx.index;
    const { status } = ctx;

    if (rawRef == null || !status) {
      return Envelope.fail("set", "req", "INVALID_USAGE", "usage: flow set req <reqId|zeroBasedIndex> <status>");
    }

    const specPath = relativeFlowSpecFile(ctx.flowState);
    const index = resolveRequirementIndex(ctx.root, specPath, rawRef);
    if (index == null) {
      return Envelope.fail(
        "set",
        "req",
        "INVALID_ARG_VALUE",
        `not a valid requirement id or zero-based index: ${rawRef}`,
      );
    }

    if (!VALID_REQ_STATUSES.includes(status)) {
      return Envelope.fail(
        "set",
        "req",
        "INVALID_STATUS",
        `invalid status: ${status} (valid: ${VALID_REQ_STATUSES.join(", ")})`,
      );
    }

    const requirement = updateSpecRequirementStatus(ctx.root, specPath, index, status);

    return { index, reqId: requirement.id ?? null, status };
  }
}
