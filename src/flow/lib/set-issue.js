/**
 * src/flow/lib/set-issue.js
 *
 * Set the GitHub issue number in flow.json.
 *
 * ctx.number — issue number (string or number)
 */

import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";

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

    ctx.flowManager.setIssue(num);

    return { issue: num };
  }
}
