/**
 * src/flow/lib/set-summary.js
 *
 * Set requirements list from a JSON string array.
 *
 * ctx.json — JSON string representing an array of requirement strings
 */

import { FlowCommand } from "./base-command.js";
import { Envelope } from "../../lib/flow-envelope.js";

export default class SetSummaryCommand extends FlowCommand {
  execute(ctx) {
    const raw = ctx.json;

    if (!raw) {
      return Envelope.fail(
        "set",
        "summary",
        "INVALID_USAGE",
        "usage: flow set summary '<json-array>'",
      );
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      return Envelope.fail("set", "summary", "INVALID_JSON", `failed to parse JSON: ${e.message}`);
    }

    if (!Array.isArray(parsed)) {
      return Envelope.fail(
        "set",
        "summary",
        "INVALID_ARG_VALUE",
        "expected a JSON array of strings or {text, status} objects",
      );
    }

    for (let i = 0; i < parsed.length; i++) {
      const el = parsed[i];
      const isString = typeof el === "string";
      const isValidObject = typeof el === "object" && el !== null && !Array.isArray(el) && typeof el.text === "string";
      if (!isString && !isValidObject) {
        return Envelope.fail(
          "set",
          "summary",
          "INVALID_ARG_VALUE",
          `invalid element at index ${i}: expected string or {text, status} object`,
        );
      }
    }

    ctx.flowManager.setRequirements(parsed);

    return { count: parsed.length };
  }
}
