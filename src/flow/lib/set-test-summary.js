/**
 * src/flow/lib/set-test-summary.js
 *
 * Save test type counts to flow.json under test.summary.
 *
 * ctx.unit        — number of unit tests (optional, string or number)
 * ctx.integration — number of integration tests (optional, string or number)
 * ctx.acceptance  — number of acceptance tests (optional, string or number)
 */

import { FlowCommand } from "./base-command.js";

const TYPE_KEYS = ["unit", "integration", "acceptance"];

export default class SetTestSummaryCommand extends FlowCommand {
  execute(ctx) {
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

    if (Object.keys(summary).length === 0) {
      throw new Error("usage: flow set test-summary --unit N [--integration N] [--acceptance N]");
    }

    // Tool monopoly (REQ-P1-5, spec 198): once `flow run tests` has
    // recorded an execution summary (signaled by the presence of
    // `exitCode`), AI-side writes via this command are rejected so they
    // cannot overwrite tool-measured results.
    const state = ctx.flowState;
    if (state?.test?.summary?.exitCode != null) {
      const err = new Error(
        "test.summary.exitCode is tool-recorded; AI-side write rejected (use `flow run tests` to re-measure)",
      );
      err.code = "TEST_SUMMARY_LOCKED";
      throw err;
    }

    ctx.flowManager.setTestSummary(summary);

    return { summary };
  }
}
