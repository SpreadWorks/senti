/**
 * src/flow/lib/run-update-overview.js
 *
 * Persist-side of the update-overview behavior (spec 207). Given a spec
 * directory, AI-emitted additions, a task identifier, and rendering meta,
 * this module:
 *
 *   1. reads `spec.json` from the spec dir,
 *   2. applies `additions` with `added_by_task = taskId` stamped (via the
 *      merge helper — no mutation),
 *   3. writes the updated `spec.json`,
 *   4. re-renders `spec.md` deterministically,
 *   5. writes the refreshed `spec.md`.
 *
 * The function is a pure orchestrator over existing primitives; AI
 * invocation lives in the caller (e.g. the flow runner) and is out of
 * scope for this module.
 */

import fs from "node:fs";
import path from "node:path";
import { applyOverviewAdditions, validateAdditions } from "./overview-merge.js";
import { applySpecViewPlan, buildSpecViewPlan } from "./render-spec-view.js";
import { FlowCommand } from "./base-command.js";
import { FlowManager } from "../../lib/flow-manager.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { getSpecDir } from "../../lib/flow-helpers.js";
import { saveSpecJson } from "../../lib/spec-json.js";

const MAX_SPEC_JSON_BYTES = 256 * 1024;

export function persistOverviewUpdate({ specDir, additions, taskId }) {
  const specJsonPath = path.join(specDir, "spec.json");

  const stat = fs.statSync(specJsonPath);
  if (stat.size > MAX_SPEC_JSON_BYTES) {
    throw new Error(
      `spec.json exceeds bounded size limit: ${stat.size} > ${MAX_SPEC_JSON_BYTES} bytes`,
    );
  }
  const raw = fs.readFileSync(specJsonPath, "utf8");
  const spec = JSON.parse(raw);

  const next = applyOverviewAdditions(spec, additions, taskId);
  const renderPlan = buildSpecViewPlan({
    root: path.dirname(path.dirname(specDir)),
    specPath: specJsonPath,
    spec: next,
  });
  saveSpecJson(specJsonPath, next, { validate: false });
  const renderResult = applySpecViewPlan(renderPlan);

  return { specJsonPath, specMdPath: path.join(specDir, "spec.md"), rendered: renderResult.changed };
}

/**
 * Parse and validate the raw `--json` argument for `flow run update-overview`.
 *
 * Returns a tagged result so the command can map errors directly to envelope
 * failure codes without mixing parsing concerns with orchestration.
 *
 * @param {string | undefined | null} raw
 * @returns {{ok: true, value: object} | {ok: false, code: string, message: string}}
 */
export function validateOverviewAdditions(raw) {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) {
    return { ok: false, code: "MISSING_JSON", message: "--json <additions-json> is required" };
  }

  let additions;
  try {
    additions = JSON.parse(trimmed);
  } catch (err) {
    return { ok: false, code: "INVALID_JSON", message: `failed to parse --json: ${err.message}` };
  }

  const shapeErrors = validateAdditions(additions);
  if (shapeErrors.length > 0) {
    return {
      ok: false,
      code: "INVALID_SHAPE",
      message: `invalid additions: ${shapeErrors.join("; ")}`,
    };
  }

  return { ok: true, value: additions };
}

/**
 * FlowCommand: `sennel flow run update-overview --json <additions>`.
 *
 * Spec 226: The task-scope `update-overview` step has been removed; its
 * functionality is now invoked from the impl step via this CLI (production
 * caller of `applyOverviewAdditions` / `persistOverviewUpdate`).
 *
 * The AI-emitted additions JSON is passed via `--json` option. The active
 * flow's current task id is auto-detected for the `added_by_task` stamp.
 */
export class RunUpdateOverviewCommand extends FlowCommand {
  async execute(ctx) {
    const parsed = validateOverviewAdditions(ctx.json);
    if (!parsed.ok) {
      return Envelope.fail("run", "update-overview", parsed.code, parsed.message);
    }
    const additions = parsed.value;

    const { root } = ctx;
    const fm = ctx.flowManager || new FlowManager({ root, mainRoot: root, inWorktree: false });
    const state = ctx.flowState || fm.load();
    if (!state) {
      return Envelope.fail("run", "update-overview", "NO_ACTIVE_FLOW", "no active flow found");
    }

    const specDir = getSpecDir(state, root);
    if (!specDir) {
      return Envelope.fail("run", "update-overview", "NO_SPEC_DIR", "spec directory not found in flow state");
    }

    const taskId = state.currentTaskId || null;

    try {
      const { specJsonPath, specMdPath } = persistOverviewUpdate({
        specDir, additions, taskId,
      });
      return Envelope.ok("run", "update-overview", {
        specJsonPath,
        specMdPath,
        taskId,
        applied: true,
      });
    } catch (err) {
      return Envelope.fail("run", "update-overview", "PERSIST_FAILED", err.message);
    }
  }
}

export default RunUpdateOverviewCommand;
