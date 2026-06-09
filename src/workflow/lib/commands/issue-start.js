/**
 * src/workflow/lib/commands/issue-start.js
 *
 * senti workflow issue-start <issueNumber>
 *
 * Move the board item linked to a GitHub issue number into "In Progress".
 * Called by the flow draft step when workflow.flowIntegration is enabled and
 * the flow has a linked issue. Idempotent: a no-op when the item is already
 * In Progress, and a non-fatal skip when the board / gh CLI is unavailable.
 */

import { WorkflowCommand } from "../base-command.js";
import { isFlowIntegrationEnabled } from "../../../lib/config.js";
import { searchItems, setItemStatus } from "../graphql.js";
import { ensureStatusOption } from "../board-helpers.js";

const IN_PROGRESS = "In Progress";

/**
 * Validate and normalize an issue-number argument.
 * @param {string|number} raw
 * @returns {number} the positive integer issue number
 * @throws {Error} with code INVALID_ARGS when not a positive integer
 */
export function validateIssueNumber(raw) {
  const s = typeof raw === "number" ? String(raw) : String(raw ?? "").trim();
  if (!/^[1-9][0-9]*$/.test(s)) {
    const err = new Error(`invalid issue number: ${JSON.stringify(raw)} (expected a positive integer)`);
    err.code = "INVALID_ARGS";
    throw err;
  }
  return Number(s);
}

export default class IssueStartCommand extends WorkflowCommand {
  execute(ctx) {
    const issueNumber = validateIssueNumber(ctx.issueNumber);

    // Defense-in-depth: the draft template only calls this when flowIntegration
    // is enabled, but a direct invocation with the flag off must not mutate the
    // board. Skip non-fatally so any caller can proceed.
    if (!isFlowIntegrationEnabled(ctx.config)) {
      return { issueNumber, matched: false, skipped: true, reason: "workflow.flowIntegration is not enabled" };
    }

    // Board / gh unavailable: degrade to a non-fatal skip so the flow proceeds.
    if (!ctx.boardConfig) {
      const reason = ctx.boardConfigError?.message || "board configuration unavailable";
      console.error(`[workflow issue-start] skipped: ${reason}`);
      return { issueNumber, matched: false, skipped: true, reason };
    }

    const { owner, project } = ctx.boardConfig;
    const { nodes } = searchItems(owner, project, String(issueNumber));
    const item = nodes.find((n) => n.content?.number === issueNumber);
    if (!item) {
      return { issueNumber, matched: false };
    }

    const current = item.fieldValueByName?.name || null;
    if (current === IN_PROGRESS) {
      return { issueNumber, matched: true, status: IN_PROGRESS, changed: false };
    }

    const { meta, optionId } = ensureStatusOption(ctx.boardConfig, IN_PROGRESS);
    setItemStatus(meta.projectId, item.id, meta.statusField.id, optionId);
    return { issueNumber, matched: true, status: IN_PROGRESS, changed: true, previousStatus: current };
  }
}
