/**
 * src/flow/lib/resolve-auto-check-input.js
 *
 * Phase-aware input resolution for `flow run auto-check` and `flow set auto on`
 * (spec 220). Pure functions only — no CLI, no I/O beyond reading draft.json.
 *
 * Phase mapping (completion markers read from flow state `steps[]`):
 *   - approval done            → skip AI evaluation (spec-approved)
 *   - draft-gate done + draft  → issue + request + draft body
 *   - otherwise                → issue + request
 *
 * The two callers (run-auto-check, set-auto) must go through this module so
 * that the same flow state always yields the same verdict input (split-brain
 * prevention).
 */

import fs from "fs";
import path from "path";
import { getFlowNode } from "../definition.js";
import { findStepById, flattenSteps } from "./step-tree.js";
import { relativeFlowSpecFile } from "../../lib/flow-workspace.js";

function isStepDone(state, stepId) {
  const steps = state?.steps;
  if (!Array.isArray(steps)) return false;
  const isNested = steps.some((s) => s.children);
  if (isNested) {
    const step = findStepById(steps, stepId);
    return step?.status === "done";
  }
  return steps.some((s) => s && s.id === stepId && s.status === "done");
}

export function isSpecApproved(state) {
  const node = getFlowNode("approval");
  return node ? isStepDone(state, node.id) : false;
}

function isDraftGateDone(state) {
  const node = getFlowNode("draft-gate");
  return node ? isStepDone(state, node.id) : false;
}

function loadSpecSiblingText(root, specPath, fileName, { warnOnError = false } = {}) {
  if (!root || !specPath) return null;
  const filePath = path.join(path.dirname(path.resolve(root, specPath)), fileName);
  if (!fs.existsSync(filePath)) return null;
  try {
    const text = fs.readFileSync(filePath, "utf8").trim();
    return text || null;
  } catch (e) {
    if (warnOnError) {
      process.stderr.write(`warn: failed to read ${fileName} at ${filePath}: ${e.message}\n`);
    }
    return null;
  }
}

function parseDraftGoal(text) {
  try {
    const draft = JSON.parse(text);
    return typeof draft?.goal === "string" ? draft.goal.trim() : "";
  } catch {
    return "";
  }
}

export function buildGoalMissingVerdict() {
  return {
    eligible: false,
    score: 0,
    maxScore: 24,
    threshold: 16,
    breakdown: {},
    staticGates: { G: false, H: false, I: false },
    goalGate: { checked: true, passed: false },
    reason: "draft goal is missing",
  };
}

export function resolvePersistedAutoCheckTrust(state, paths = {}) {
  if (!state?.autoCheck) return null;
  if (state.autoCheck.goalGate?.passed !== true) {
    return {
      ...buildGoalMissingVerdict(),
      reason: "persisted auto-check is missing a passing goalGate marker",
    };
  }
  if (!isDraftGateDone(state) || !state?.specId) return null;
  const draft = loadSpecSiblingText(paths.root, relativeFlowSpecFile(state), "draft.json");
  if (!draft) return null;
  if (!parseDraftGoal(draft)) return buildGoalMissingVerdict();
  return null;
}

function buildBaseInput(state, paths = {}) {
  const parts = [];
  if (state?.request) parts.push(String(state.request));

  const preparingBody = typeof state?.issueBody === "string" && state.issueBody.length > 0
    ? state.issueBody
    : null;
  if (preparingBody) {
    parts.push(preparingBody);
    return parts.join("\n").trim();
  }

  if (state?.specId) {
    const fileBody = loadSpecSiblingText(paths.root, relativeFlowSpecFile(state), "issue.md", { warnOnError: true });
    if (fileBody) {
      parts.push(fileBody);
      return parts.join("\n").trim();
    }
  }

  if (state?.issue) parts.push(`Issue #${state.issue}`);
  return parts.join("\n").trim();
}

/**
 * Resolve the input payload for auto-check based on flow state phase.
 *
 * @param {object} state - flow state (active flow.json or preparing record)
 * @param {object} [paths] - { root: string }
 * @returns {{skip: true, reason: string} | {skip: false, text: string}}
 */
export function resolveAutoCheckInput(state, paths = {}) {
  if (isSpecApproved(state)) {
    return { skip: true, reason: "spec approved" };
  }
  const base = buildBaseInput(state, paths);
  if (isDraftGateDone(state) && state?.specId) {
    const draft = loadSpecSiblingText(paths.root, relativeFlowSpecFile(state), "draft.json");
    if (draft) {
      if (!parseDraftGoal(draft)) {
        return { fail: true, verdict: buildGoalMissingVerdict() };
      }
      const text = base ? `${base}\n\n${draft}` : draft;
      return { skip: false, text, goalGate: { checked: true, passed: true } };
    }
  }
  return { skip: false, text: base };
}

/**
 * Envelope shape returned by the skip path. Shared with set-auto.js.
 */
export function buildSkipVerdict() {
  return {
    eligible: true,
    skipped: true,
    reason: "spec approved",
    goalGate: { checked: false, passed: true, skipped: "spec-approved" },
  };
}
