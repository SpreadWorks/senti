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

import path from "node:path";
import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { loadSpecJson, saveSpecJson, resolveSpecJsonPath } from "../../lib/spec-json.js";

const NOTES_MAX_LENGTH = 2000;

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

    const userApproval = { approved: true };

    if (typeof ctx.confirmedAt === "string" && ctx.confirmedAt.length > 0) {
      if (!isValidIso8601(ctx.confirmedAt)) {
        return Envelope.fail(
          "set",
          "approval",
          "INVALID_ARG_VALUE",
          `--confirmed-at must be an ISO 8601 timestamp (got: ${ctx.confirmedAt})`,
        );
      }
      userApproval.confirmed_at = ctx.confirmedAt;
    } else {
      userApproval.confirmed_at = new Date().toISOString();
    }

    if (typeof ctx.notes === "string" && ctx.notes.length > 0) {
      if (ctx.notes.length > NOTES_MAX_LENGTH) {
        return Envelope.fail(
          "set",
          "approval",
          "INVALID_ARG_VALUE",
          `--notes exceeds ${NOTES_MAX_LENGTH} characters`,
        );
      }
      userApproval.notes = ctx.notes;
    }

    const specPath = path.resolve(ctx.root, ctx.flowState.spec);
    const jsonPath = resolveSpecJsonPath(specPath);
    const spec = loadSpecJson(jsonPath, { validate: false });
    spec.user_approval = userApproval;
    saveSpecJson(jsonPath, spec);

    return { user_approval: userApproval };
  }
}
