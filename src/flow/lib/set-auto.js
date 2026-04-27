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
 * Preparing-flow target resolution (spec 220):
 *   - --run-id is REQUIRED in preparing mode. Auto-select heuristics are gone.
 *
 * Gate on `on`:
 *   - Spec 208 R8 / R9: `on` is gated by auto-check — if the check returns
 *     eligible:false, autoApprove is NOT updated and the CLI exits non-zero
 *     with the reason on stderr.
 *   - Spec 218: When state already contains a persisted `autoCheck` (written
 *     earlier by `flow run auto-check`), the verdict is trusted verbatim and
 *     the AI is NOT invoked again.
 *   - Spec 220: phase-aware input and spec-approved skip share a single
 *     module with run-auto-check via `resolveAutoCheckInput`.
 *   - Spec 232: autoDesired flag persisted on reject; failed verdict not saved.
 *
 * ctx.value — "on" | "off"
 * ctx.runId — preparing-flow target (required in preparing mode)
 */

import { FlowCommand } from "./base-command.js";
import { VALID_AUTO_VALUES } from "../../lib/constants.js";
import { runAutoCheckCore } from "./run-auto-check.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { resolvePreparingRunId } from "./resolve-preparing-run-id.js";
import {
  resolveAutoCheckInput,
  isSpecApproved,
  buildSkipVerdict,
} from "./resolve-auto-check-input.js";

export default class SetAutoCommand extends FlowCommand {
  constructor() {
    super({ requiresFlow: false });
  }

  async execute(ctx) {
    const value = ctx.value;

    if (!value || !VALID_AUTO_VALUES.includes(value)) {
      return Envelope.fail(
        "set",
        "auto",
        "INVALID_USAGE",
        `usage: flow set auto ${VALID_AUTO_VALUES.join("|")}`,
      );
    }

    const { flowManager, flowState } = ctx;
    const preparingMode = !flowState;
    let runId = null;
    if (preparingMode) {
      const resolved = resolvePreparingRunId(flowManager, ctx.runId, {
        type: "set",
        key: "auto",
        zeroPreparingAsFail: true,
      });
      if (resolved.fail) return resolved.fail;
      runId = resolved.runId;
    }

    const mutateState = (updater) => {
      if (preparingMode) {
        flowManager.mutatePreparingFlow(runId, updater);
      } else {
        flowManager.mutate(updater);
      }
    };

    if (value === "off") {
      mutateState((s) => {
        s.autoApprove = false;
        s.autoDesired = false;
      });
      return { autoApprove: false, ...(preparingMode ? { runId } : {}) };
    }

    const state = preparingMode
      ? flowManager.loadPreparingFlow(runId)
      : flowManager.load();

    // Spec-approved skip path: skip auto-check entirely (active flow only).
    if (!preparingMode && isSpecApproved(state)) {
      const autoCheck = buildSkipVerdict();
      flowManager.mutate((s) => {
        s.autoCheck = autoCheck;
        s.autoApprove = true;
      });
      return { autoApprove: true, autoCheck };
    }

    // Trust path: a prior `flow run auto-check` already persisted a verdict to
    // this state. Use it directly instead of re-invoking the AI with a
    // different (typically thinner) input. Eliminates the split-brain where
    // run auto-check evaluates a rich issue body but set auto on re-evaluates
    // the bare "Issue #<n>" literal and hard-gate-rejects.
    let autoCheck = state?.autoCheck || null;
    const trusted = !!autoCheck;
    if (!autoCheck) {
      const paths = { root: ctx.root, specPath: preparingMode ? null : state?.spec };
      const resolved = resolveAutoCheckInput(state, paths);
      if (resolved.skip) {
        autoCheck = buildSkipVerdict();
      } else {
        autoCheck = await runAutoCheckCore(this.container, resolved.text);
      }
      if (autoCheck.eligible) {
        mutateState((s) => { s.autoCheck = autoCheck; });
      }
    }

    if (!autoCheck.eligible) {
      mutateState((s) => { s.autoDesired = true; });
      return Envelope.fail(
        "set",
        "auto",
        "AUTO_CHECK_INELIGIBLE",
        `auto-check rejected: ${autoCheck.reason || "not eligible"}`,
        autoCheck,
      );
    }

    mutateState((s) => { s.autoApprove = true; });
    return { autoApprove: true, autoCheck, trusted, ...(preparingMode ? { runId } : {}) };
  }
}
