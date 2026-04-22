/**
 * src/flow/lib/set-auto.js
 *
 * Enable or disable autoApprove mode.
 *
 * Dual-mode operation:
 *   - Active flow (flow.json present): mutate flow.json.
 *   - Preparing flow (.sdd-forge/.active-flow.<runId>, pre-prepare): mutate the
 *     preparing state so skill prelude B.0.5 can enable auto mode BEFORE
 *     `flow prepare` creates flow.json. `run-prepare-spec` then inherits the
 *     values into the new flow.json.
 *
 * Preparing-flow target resolution:
 *   - If --run-id is provided → use that runId.
 *   - Otherwise → auto-detect only when exactly one preparing flow exists.
 *   - If no flow.json and multiple/zero preparing flows and no --run-id → error.
 *
 * Spec 208 R8 / R9: `on` is gated by auto-check — if the check returns
 * eligible:false, autoApprove is NOT updated and the CLI exits non-zero
 * with the reason on stderr.
 *
 * ctx.value — "on" | "off"
 * ctx.runId — optional preparing-flow target
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

function resolvePreparingRunId(flowManager, explicitRunId) {
  if (explicitRunId) return explicitRunId;
  const ids = flowManager.listPreparingFlows();
  if (ids.length === 1) return ids[0];
  if (ids.length === 0) {
    throw new Error("no active flow and no preparing flow found");
  }
  throw new Error(
    `multiple preparing flows found; pass --run-id <id> (candidates: ${ids.join(", ")})`,
  );
}

export default class SetAutoCommand extends FlowCommand {
  constructor() {
    super({ requiresFlow: false });
  }

  async execute(ctx) {
    const value = ctx.value;

    if (!value || !VALID_AUTO_VALUES.includes(value)) {
      throw new Error(`usage: flow set auto ${VALID_AUTO_VALUES.join("|")}`);
    }

    const { flowManager, flowState } = ctx;
    const preparingMode = !flowState;
    const runId = preparingMode
      ? resolvePreparingRunId(flowManager, ctx.runId)
      : null;

    if (value === "off") {
      if (preparingMode) {
        flowManager.mutatePreparingFlow(runId, (state) => {
          state.autoApprove = false;
        });
      } else {
        flowManager.mutate((state) => {
          state.autoApprove = false;
        });
      }
      return { autoApprove: false, ...(preparingMode ? { runId } : {}) };
    }

    const state = preparingMode
      ? flowManager.loadPreparingFlow(runId)
      : flowManager.load();
    const input = buildInputText(state);
    const autoCheck = await runAutoCheckCore(this.container, input);

    const applyCheck = (s) => { s.autoCheck = autoCheck; };
    if (preparingMode) {
      flowManager.mutatePreparingFlow(runId, applyCheck);
    } else {
      flowManager.mutate(applyCheck);
    }

    if (!autoCheck.eligible) {
      const err = new Error(`auto-check rejected: ${autoCheck.reason || "not eligible"}`);
      err.autoCheck = autoCheck;
      throw err;
    }

    const applyApprove = (s) => { s.autoApprove = true; };
    if (preparingMode) {
      flowManager.mutatePreparingFlow(runId, applyApprove);
    } else {
      flowManager.mutate(applyApprove);
    }
    return { autoApprove: true, autoCheck, ...(preparingMode ? { runId } : {}) };
  }
}
