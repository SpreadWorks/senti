/**
 * src/flow/lib/set-issue.js
 *
 * Set the GitHub issue number in flow.json and cache the issue body
 * to specs/<spec>/issue.md (spec 225 R9).
 *
 * ctx.number — issue number (string or number)
 */

import path from "path";
import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { resolveCommandRouteOptions } from "../../lib/flow-options.js";
import { fetchNormalizedIssueBody, writeIssueMd } from "./issue-body-cache.js";

export default class SetIssueCommand extends FlowCommand {
  execute(ctx) {
    const raw = ctx.number;

    if (raw == null || raw === "") {
      return Envelope.fail("set", "issue", "INVALID_USAGE", "usage: flow set issue <number>");
    }

    const str = String(raw);
    if (!/^\d+$/.test(str)) {
      return Envelope.fail(
        "set",
        "issue",
        "INVALID_ARG_VALUE",
        `not a valid positive integer: ${raw}`,
      );
    }

    const num = parseInt(str, 10);
    if (num < 1) {
      return Envelope.fail(
        "set",
        "issue",
        "INVALID_ARG_VALUE",
        `issue number must be a positive integer: ${raw}`,
      );
    }

    ctx.flowManager.setIssue(num, resolveCommandRouteOptions(ctx));

    const specRel = ctx.flowState?.spec;
    if (specRel) {
      const body = fetchNormalizedIssueBody(num, ctx.root);
      if (body) {
        const specDir = path.dirname(path.resolve(ctx.root, specRel));
        writeIssueMd(specDir, body);
      }
    }

    return { issue: num };
  }
}
