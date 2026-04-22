/**
 * src/flow/lib/set-request.js
 *
 * Set the user request field in flow.json.
 *
 * ctx.text — request text
 */

import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";

export default class SetRequestCommand extends FlowCommand {
  execute(ctx) {
    const { text } = ctx;

    if (!text) {
      return Envelope.fail("set", "request", "INVALID_USAGE", 'usage: flow set request "<text>"');
    }

    ctx.flowManager.setRequest(text);

    return { request: text };
  }
}
