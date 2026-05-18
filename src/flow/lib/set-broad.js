/**
 * Enable audited broad implementation mode for task-decomposed flows.
 */

import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { createBroadModeRecord } from "./task-scope.js";

export default class SetBroadCommand extends FlowCommand {
  async execute(ctx) {
    const action = String(ctx.action || "").trim();
    if (action !== "on") {
      return Envelope.fail(
        "set",
        "broad",
        "INVALID_USAGE",
        "usage: flow set broad on --step <implement|review|gate-impl> --reason <text>",
      );
    }

    let record;
    try {
      record = createBroadModeRecord(ctx.flowState, ctx.step, ctx.reason);
    } catch (err) {
      return Envelope.fail("set", "broad", "INVALID_BROAD_MODE", err.message);
    }

    ctx.flowManager.mutate((state) => {
      if (!Array.isArray(state.broadModeHistory)) state.broadModeHistory = [];
      state.broadModeHistory.push(record);
    });

    return { broadMode: record };
  }
}
