/**
 * src/flow/lib/set-auto.js
 *
 * Enable or disable autoApprove mode in flow.json.
 *
 * Spec 208 R8 / R9: `on` is gated by auto-check — if the check returns
 * eligible:false, autoApprove is NOT updated and the CLI exits non-zero
 * with the reason on stderr.
 *
 * ctx.value — "on" | "off"
 */

import { FlowCommand } from "./base-command.js";
import { VALID_AUTO_VALUES } from "../../lib/constants.js";
import { runAutoCheckCore } from "./run-auto-check.js";

function buildInputText(state) {
  const parts = [];
  if (state?.request) parts.push(String(state.request));
  if (state?.issue) parts.push(`Issue #${state.issue}`);
  return parts.join("\n").trim();
}

export default class SetAutoCommand extends FlowCommand {
  async execute(ctx) {
    const value = ctx.value;

    if (!value || !VALID_AUTO_VALUES.includes(value)) {
      throw new Error(`usage: flow set auto ${VALID_AUTO_VALUES.join("|")}`);
    }

    if (value === "off") {
      ctx.flowManager.mutate((state) => {
        state.autoApprove = false;
      });
      return { autoApprove: false };
    }

    const state = ctx.flowManager.load();
    const input = buildInputText(state);
    const autoCheck = await runAutoCheckCore(this.container, input);

    ctx.flowManager.mutate((s) => {
      s.autoCheck = autoCheck;
    });

    if (!autoCheck.eligible) {
      const err = new Error(`auto-check rejected: ${autoCheck.reason || "not eligible"}`);
      err.autoCheck = autoCheck;
      throw err;
    }

    ctx.flowManager.mutate((s) => {
      s.autoApprove = true;
    });
    return { autoApprove: true, autoCheck };
  }
}
