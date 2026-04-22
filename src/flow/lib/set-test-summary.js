/**
 * src/flow/lib/set-test-summary.js
 *
 * Save test summary to flow.json under `test.summary` (or `test.baseline`
 * with --baseline). Supports two input modes:
 *
 *   Legacy flag mode (tool-measured counts):
 *     ctx.unit / ctx.integration / ctx.acceptance — number strings
 *
 *   JSON mode (spec 209):
 *     ctx.json — stringified JSON of { counts?, failed?, exitCode? }
 *     ctx.mode — "replace" (default) or "fallback"
 *                fallback: preserves existing counts/exitCode, writes only failed[]
 *     ctx.baseline — when truthy, target is test.baseline instead of test.summary
 *
 * Tool monopoly (REQ-P1-5 / spec 198, retained per spec 209):
 *   once exitCode is present at the target slot (tool-recorded by `flow run tests`),
 *   AI-side replace writes are rejected. `fallback` mode is allowed since it
 *   only writes failed[] and does not overwrite exitCode / counts.
 */

import { FlowCommand } from "./base-command.js";

const TYPE_KEYS = ["unit", "integration", "acceptance"];
const MAX_ID_CHARS = 200;
const MAX_REASON_CHARS = 500;
const MAX_FAILED = 100;

function parseLegacy(ctx) {
  const summary = {};
  for (const key of TYPE_KEYS) {
    const val = ctx[key];
    if (val != null && val !== "") {
      const num = parseInt(val, 10);
      if (isNaN(num) || num < 0) {
        throw new Error(`invalid value for --${key}: ${val}`);
      }
      summary[key] = num;
    }
  }
  return Object.keys(summary).length > 0 ? summary : null;
}

function parseJsonPayload(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    const e = new Error(`invalid --json: ${err.message}`);
    e.code = "TEST_SUMMARY_INVALID";
    throw e;
  }
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    const e = new Error("invalid --json: expected object");
    e.code = "TEST_SUMMARY_INVALID";
    throw e;
  }
  return parsed;
}

function validateFailedArray(failed) {
  if (failed == null) return null;
  if (!Array.isArray(failed)) {
    const e = new Error("invalid failed[]: must be array");
    e.code = "TEST_SUMMARY_INVALID";
    throw e;
  }
  const out = [];
  for (const entry of failed) {
    if (!entry || typeof entry !== "object") {
      const e = new Error("invalid failed[]: entry must be object");
      e.code = "TEST_SUMMARY_INVALID";
      throw e;
    }
    if (typeof entry.id !== "string" || typeof entry.reason !== "string") {
      const e = new Error("invalid failed[]: id and reason must be strings");
      e.code = "TEST_SUMMARY_INVALID";
      throw e;
    }
    const id = entry.id.trim();
    const reason = entry.reason;
    if (!id) {
      const e = new Error("invalid failed[]: id must be non-empty string");
      e.code = "TEST_SUMMARY_INVALID";
      throw e;
    }
    if (id.length > MAX_ID_CHARS) {
      const e = new Error(`invalid failed[]: id exceeds ${MAX_ID_CHARS} chars`);
      e.code = "TEST_SUMMARY_INVALID";
      throw e;
    }
    if (reason.length > MAX_REASON_CHARS) {
      const e = new Error(`invalid failed[]: reason exceeds ${MAX_REASON_CHARS} chars`);
      e.code = "TEST_SUMMARY_INVALID";
      throw e;
    }
    out.push({ id, reason });
    if (out.length >= MAX_FAILED) break;
  }
  return out;
}

export default class SetTestSummaryCommand extends FlowCommand {
  execute(ctx) {
    const baseline = Boolean(ctx.baseline);
    const mode = ctx.mode === "fallback" ? "fallback" : "replace";
    const targetKey = baseline ? "baseline" : "summary";

    let summary;

    if (ctx.json != null && ctx.json !== "") {
      const payload = parseJsonPayload(ctx.json);
      const failed = validateFailedArray(payload.failed);
      summary = {};
      if (failed) summary.failed = failed;
      if (mode === "replace") {
        if (payload.counts && typeof payload.counts === "object") {
          for (const key of TYPE_KEYS) {
            if (typeof payload.counts[key] === "number") {
              summary[key] = payload.counts[key];
            }
          }
        }
        if (typeof payload.exitCode === "number") summary.exitCode = payload.exitCode;
      }
    } else {
      const legacy = parseLegacy(ctx);
      if (!legacy) {
        throw new Error("usage: flow set test-summary --unit N [--integration N] [--acceptance N] | --json <payload> [--mode fallback] [--baseline]");
      }
      summary = legacy;
    }

    const state = ctx.flowState;
    const existing = state?.test?.[targetKey];
    if (mode === "replace" && existing?.exitCode != null) {
      const err = new Error(
        `test.${targetKey}.exitCode is tool-recorded; AI-side write rejected (use --mode fallback to write failed[] only, or \`flow run tests\` to re-measure)`,
      );
      err.code = "TEST_SUMMARY_LOCKED";
      throw err;
    }

    ctx.flowManager.setTestSummary(summary, { baseline, mode });

    return { summary, target: `test.${targetKey}`, mode };
  }
}
