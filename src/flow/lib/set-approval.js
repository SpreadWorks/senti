/**
 * src/flow/lib/set-approval.js
 *
 * Persist plan-level user approval into the active flow's spec.json
 * `user_approval` field. Replaces the legacy hand-edit of spec.md's
 * `## User Confirmation` section so that `spec render` no longer drops
 * the approval state on regeneration (spec 221).
 *
 * ctx.approved      — flag set when --approved is passed
 * ctx.notes         — optional --notes value
 * ctx.confirmedAt   — optional --confirmed-at value (ISO 8601)
 */

import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { renderSpecView } from "./render-spec-view.js";
import { CanonicalSpecApproval, MAX_APPROVAL_NOTES_LENGTH } from "./canonical-spec-approval.js";

function isValidIso8601(value) {
  if (typeof value !== "string" || value.length === 0) return false;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return false;
  return new Date(parsed).toISOString() === value || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/.test(value);
}

export default class SetApprovalCommand extends FlowCommand {
  execute(ctx) {
    if (!ctx.approved) {
      return Envelope.fail(
        "set",
        "approval",
        "INVALID_USAGE",
        "usage: flow set approval --approved [--notes <text>] [--confirmed-at <iso>]",
      );
    }

    let confirmedAt;
    if (typeof ctx.confirmedAt === "string" && ctx.confirmedAt.length > 0) {
      if (!isValidIso8601(ctx.confirmedAt)) {
        return Envelope.fail(
          "set",
          "approval",
          "INVALID_ARG_VALUE",
          `--confirmed-at must be an ISO 8601 timestamp (got: ${ctx.confirmedAt})`,
        );
      }
      confirmedAt = ctx.confirmedAt;
    } else {
      confirmedAt = new Date().toISOString();
    }

    const notes = typeof ctx.notes === "string" && ctx.notes.length > 0 ? ctx.notes : null;
    if (notes !== null) {
      if (notes.length > MAX_APPROVAL_NOTES_LENGTH) {
        return Envelope.fail(
          "set",
          "approval",
          "INVALID_ARG_VALUE",
          `--notes exceeds ${MAX_APPROVAL_NOTES_LENGTH} characters`,
        );
      }
    }

    const approval = new CanonicalSpecApproval({ confirmedAt, notes });
    const userApproval = ctx.flowManager.updateSpecApproval({
      specId: ctx.flowState.specId,
      approval,
    });
    const rendered = renderSpecView({
      root: ctx.root,
      flowManager: ctx.flowManager,
      flowState: ctx.flowState,
    });

    return { user_approval: userApproval, rendered: rendered.changed };
  }
}
