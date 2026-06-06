/**
 * src/flow/lib/set-request.js
 *
 * Set the user request field.
 *
 * Dual-mode operation:
 *   - Active flow (flow.json present): mutate flow.json.
 *   - Preparing flow (.active-flow.<runId>): mutate the preparing state so
 *     prelude refinements can feed `flow run auto-check --run-id <id>` before
 *     `flow prepare` creates flow.json.
 *
 * ctx.text  — request text
 * ctx.runId — preparing-flow target (required in preparing mode)
 */

import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { resolveCommandRouteOptions } from "../../lib/flow-options.js";
import { resolvePreparingRunId } from "./resolve-preparing-run-id.js";

export default class SetRequestCommand extends FlowCommand {
  constructor() {
    super({ requiresFlow: false });
  }

  execute(ctx) {
    const { text } = ctx;

    if (!text) {
      return Envelope.fail("set", "request", "INVALID_USAGE", 'usage: flow set request "<text>" [--run-id <id>]');
    }

    const { flowManager, flowState } = ctx;
    const preparingMode = !flowState;

    if (preparingMode) {
      const resolved = resolvePreparingRunId(flowManager, ctx.runId, {
        type: "set",
        key: "request",
        zeroPreparingAsFail: true,
      });
      if (resolved.fail) return resolved.fail;

      flowManager.mutatePreparingFlow(resolved.runId, (s) => {
        s.request = text;
      });
      return { request: text, runId: resolved.runId };
    }

    flowManager.setRequest(text, resolveCommandRouteOptions(ctx));

    return { request: text };
  }
}
