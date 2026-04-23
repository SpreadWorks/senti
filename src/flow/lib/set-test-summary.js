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
import { Envelope } from "../../lib/flow-envelope.js";

const TYPE_KEYS = ["unit", "integration", "acceptance"];
const MAX_ID_CHARS = 200;
const MAX_REASON_CHARS = 500;
const MAX_FAILED = 100;

// Returns { summary } on success, { fail: Envelope } on validation error, or
// { summary: null } when no legacy flags were provided at all.
function parseLegacy(ctx) {
  const summary = {};
  for (const key of TYPE_KEYS) {
    const val = ctx[key];
    if (val != null && val !== "") {
      const num = parseInt(val, 10);
      if (isNaN(num) || num < 0) {
        return {
          fail: Envelope.fail(
            "set",
            "test-summary",
            "INVALID_ARG_VALUE",
            `invalid value for --${key}: ${val}`,
          ),
        };
      }
      summary[key] = num;
    }
  }
  return { summary: Object.keys(summary).length > 0 ? summary : null };
}

function failJson(code, message) {
  return { fail: Envelope.fail("set", "test-summary", code, message) };
}

function parseJsonPayload(raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return failJson("INVALID_JSON", `invalid --json: ${err.message}`);
  }
  if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return failJson("INVALID_ARG_VALUE", "invalid --json: expected object");
  }
  return { payload: parsed };
}

function inheritCountsFromBaseline(summary, baseline) {
  if (!baseline || typeof baseline !== "object") return;
  for (const key of TYPE_KEYS) {
    if (summary[key] == null && typeof baseline[key] === "number") {
      summary[key] = baseline[key];
    }
  }
}

function validateFailedArray(failed) {
  if (failed == null) return { failed: null };
  if (!Array.isArray(failed)) {
    return failJson("INVALID_ARG_VALUE", "invalid failed[]: must be array");
  }
  const out = [];
  for (const entry of failed) {
    if (!entry || typeof entry !== "object") {
      return failJson("INVALID_ARG_VALUE", "invalid failed[]: entry must be object");
    }
    if (typeof entry.id !== "string" || typeof entry.reason !== "string") {
      return failJson("INVALID_ARG_VALUE", "invalid failed[]: id and reason must be strings");
    }
    const id = entry.id.trim();
    const reason = entry.reason;
    if (!id) {
      return failJson("INVALID_ARG_VALUE", "invalid failed[]: id must be non-empty string");
    }
    if (id.length > MAX_ID_CHARS) {
      return failJson("INVALID_ARG_VALUE", `invalid failed[]: id exceeds ${MAX_ID_CHARS} chars`);
    }
    if (reason.length > MAX_REASON_CHARS) {
      return failJson("INVALID_ARG_VALUE", `invalid failed[]: reason exceeds ${MAX_REASON_CHARS} chars`);
    }
    out.push({ id, reason });
    if (out.length >= MAX_FAILED) break;
  }
  return { failed: out };
}

export default class SetTestSummaryCommand extends FlowCommand {
  execute(ctx) {
    const baseline = Boolean(ctx.baseline);
    const mode = ctx.mode === "fallback" ? "fallback" : "replace";
    const targetKey = baseline ? "baseline" : "summary";

    let summary;

    if (ctx.json != null && ctx.json !== "") {
      const parsed = parseJsonPayload(ctx.json);
      if (parsed.fail) return parsed.fail;
      const payload = parsed.payload;
      const validated = validateFailedArray(payload.failed);
      if (validated.fail) return validated.fail;
      const failed = validated.failed;
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
      const legacyResult = parseLegacy(ctx);
      if (legacyResult.fail) return legacyResult.fail;
      if (!legacyResult.summary) {
        return Envelope.fail(
          "set",
          "test-summary",
          "INVALID_USAGE",
          "usage: flow set test-summary --unit N [--integration N] [--acceptance N] | --json <payload> [--mode fallback] [--baseline]",
        );
      }
      summary = legacyResult.summary;
    }

    const state = ctx.flowState;
    const existing = state?.test?.[targetKey];
    if (mode === "replace" && existing?.exitCode != null) {
      return Envelope.fail(
        "set",
        "test-summary",
        "TEST_SUMMARY_LOCKED",
        `test.${targetKey}.exitCode is tool-recorded; AI-side write rejected (use --mode fallback to write failed[] only, or \`flow run tests\` to re-measure)`,
      );
    }

    if (!baseline && mode === "replace") {
      inheritCountsFromBaseline(summary, state?.test?.baseline);
    }

    ctx.flowManager.setTestSummary(summary, { baseline, mode });

    return { summary, target: `test.${targetKey}`, mode };
  }
}
