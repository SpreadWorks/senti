/**
 * src/flow/lib/set-init.js
 *
 * Initialize a preparing flow state before flow prepare.
 * Creates .senti/.active-flow.<runId> with a flow.json-compatible schema.
 * Accepts --issue and --request to seed the preparing state so that a later
 * `flow prepare --run-id <id>` can inherit them.
 */

import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { fetchNormalizedIssueBody } from "./issue-body-cache.js";

export default class SetInitCommand extends FlowCommand {
  constructor() {
    super({ requiresFlow: false });
  }

  execute(ctx) {
    const { flowManager } = ctx;

    const extra = {};
    if (ctx.issue != null && ctx.issue !== "") {
      const n = Number(ctx.issue);
      if (!Number.isInteger(n) || n <= 0) {
        return Envelope.fail(
          "set",
          "init",
          "INVALID_ARG_VALUE",
          `--issue must be a positive integer: ${ctx.issue}`,
        );
      }
      extra.issue = n;
      const body = fetchNormalizedIssueBody(n, ctx.root);
      if (body) extra.issueBody = body;
    }
    if (ctx.request) extra.request = ctx.request;

    // Single-pass prune + list: delete stale preparing flows and enumerate
    // the remaining entries in one directory scan (spec 222).
    const { remaining } = flowManager.pruneStalePreparingFlowsAndList();
    if (remaining.length > 0) {
      console.error(
        `[flow] WARN: ${remaining.length} preparing flow(s) already exist: ${remaining.join(", ")}`
      );
    }

    const runId = flowManager.generateRunId();
    flowManager.createPreparingFlow(runId, extra);

    return { runId, ...extra };
  }
}
