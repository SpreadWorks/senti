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
 * Gate on `on`:
 *   - Spec 208 R8 / R9: `on` is gated by auto-check — if the check returns
 *     eligible:false, autoApprove is NOT updated and the CLI exits non-zero
 *     with the reason on stderr.
 *   - Spec 218: When state already contains a persisted `autoCheck` (written
 *     earlier by `flow run auto-check`), the verdict is trusted verbatim and
 *     the AI is NOT invoked again. This eliminates the split-brain where
 *     `run auto-check` evaluates a rich issue body while `set auto on`
 *     re-evaluates the bare `Issue #<n>` literal and hard-gate-rejects.
 *
 * ctx.value — "on" | "off"
 * ctx.runId — optional preparing-flow target
 */

import fs from "fs";
import path from "path";
import { FlowCommand } from "./base-command.js";
import { VALID_AUTO_VALUES } from "../../lib/constants.js";
import { runAutoCheckCore } from "./run-auto-check.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { resolvePreparingRunId } from "./resolve-preparing-run-id.js";

function buildInputText(state) {
  const parts = [];
  if (state?.request) parts.push(String(state.request));
  if (state?.issue) parts.push(`Issue #${state.issue}`);
  return parts.join("\n").trim();
}

function isSpecApproved(state) {
  const steps = state?.steps;
  if (!Array.isArray(steps)) return false;
  return steps.some((s) => s && s.id === "approval" && s.status === "done");
}

function loadDraftText(root, state) {
  const specPath = state?.spec;
  if (!root || !specPath) return null;
  const draftPath = path.join(path.dirname(path.resolve(root, specPath)), "draft.md");
  if (!fs.existsSync(draftPath)) return null;
  const text = fs.readFileSync(draftPath, "utf8").trim();
  return text || null;
}

function resolveAutoCheckInput(ctx, state, preparingMode) {
  if (!preparingMode) {
    const draft = loadDraftText(ctx.root, state);
    if (draft) return draft;
  }
  return buildInputText(state);
}

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

    // Spec-approved skip path: skip auto-check entirely (active flow only).
    if (!preparingMode && isSpecApproved(state)) {
      const autoCheck = { eligible: true, skipped: true, reason: "spec approved" };
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
      const input = resolveAutoCheckInput(ctx, state, preparingMode);
      autoCheck = await runAutoCheckCore(this.container, input);
      const applyCheck = (s) => { s.autoCheck = autoCheck; };
      if (preparingMode) {
        flowManager.mutatePreparingFlow(runId, applyCheck);
      } else {
        flowManager.mutate(applyCheck);
      }
    }

    if (!autoCheck.eligible) {
      return Envelope.fail(
        "set",
        "auto",
        "AUTO_CHECK_INELIGIBLE",
        `auto-check rejected: ${autoCheck.reason || "not eligible"}`,
        autoCheck,
      );
    }

    const applyApprove = (s) => { s.autoApprove = true; };
    if (preparingMode) {
      flowManager.mutatePreparingFlow(runId, applyApprove);
    } else {
      flowManager.mutate(applyApprove);
    }
    return { autoApprove: true, autoCheck, trusted, ...(preparingMode ? { runId } : {}) };
  }
}
