/**
 * src/flow/lib/resolve-auto-check-input.js
 *
 * Phase-aware input resolution for `flow run auto-check` and `flow set auto on`
 * (spec 220). Pure functions only — no CLI, no I/O beyond reading draft.md.
 *
 * Phase mapping (completion markers read from flow state `steps[]`):
 *   - approval done            → skip AI evaluation (spec-approved)
 *   - gate-draft done + draft  → issue + request + draft body
 *   - otherwise                → issue + request
 *
 * The two callers (run-auto-check, set-auto) must go through this module so
 * that the same flow state always yields the same verdict input (split-brain
 * prevention).
 */

import fs from "fs";
import path from "path";

function isStepDone(state, stepId) {
  const steps = state?.steps;
  if (!Array.isArray(steps)) return false;
  return steps.some((s) => s && s.id === stepId && s.status === "done");
}

export function isSpecApproved(state) {
  return isStepDone(state, "approval");
}

function isDraftGateDone(state) {
  return isStepDone(state, "gate-draft");
}

function loadDraftText(root, specPath) {
  if (!root || !specPath) return null;
  const draftPath = path.join(path.dirname(path.resolve(root, specPath)), "draft.md");
  if (!fs.existsSync(draftPath)) return null;
  const text = fs.readFileSync(draftPath, "utf8").trim();
  return text || null;
}

function buildBaseInput(state) {
  const parts = [];
  if (state?.request) parts.push(String(state.request));
  if (state?.issue) parts.push(`Issue #${state.issue}`);
  return parts.join("\n").trim();
}

/**
 * Resolve the input payload for auto-check based on flow state phase.
 *
 * @param {object} state - flow state (active flow.json or preparing record)
 * @param {object} [paths] - { root: string, specPath: string|null }
 * @returns {{skip: true, reason: string} | {skip: false, text: string}}
 */
export function resolveAutoCheckInput(state, paths = {}) {
  if (isSpecApproved(state)) {
    return { skip: true, reason: "spec approved" };
  }
  const base = buildBaseInput(state);
  if (isDraftGateDone(state)) {
    const draft = loadDraftText(paths.root, paths.specPath);
    if (draft) {
      const text = base ? `${base}\n\n${draft}` : draft;
      return { skip: false, text };
    }
  }
  return { skip: false, text: base };
}

/**
 * Envelope shape returned by the skip path. Shared with set-auto.js.
 */
export function buildSkipVerdict() {
  return { eligible: true, skipped: true, reason: "spec approved" };
}
