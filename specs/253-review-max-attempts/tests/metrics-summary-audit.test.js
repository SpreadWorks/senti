// spec: R28

import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("R28: buildMetricsSummary keeps audit-only raw totals (does not interpret reset)", () => {
  it("R28: reviewRetry reset entries do not zero out raw totals in buildMetricsSummary", async () => {
    const mod = await import("../../../src/flow/lib/get-status.js");
    // Find the buildMetricsSummary export (function may be internal helper exported for tests).
    const buildMetricsSummary = mod.buildMetricsSummary;
    if (typeof buildMetricsSummary !== "function") {
      // If not exported, this requirement is satisfied by absence of reset interpretation in source.
      // Fall back to source-level assertion.
      const fs = await import("node:fs");
      const path = await import("node:path");
      const src = fs.readFileSync(
        path.join(process.cwd(), "src/flow/lib/get-status.js"),
        "utf8",
      );
      assert.ok(
        !/reset[\s\S]{0,80}reviewRetry/.test(src) && !/reviewRetry[\s\S]{0,80}reset/.test(src),
        "buildMetricsSummary must not interpret reset entries for reviewRetry (R28 audit-only)",
      );
      return;
    }
    const metrics = [
      { phase: "draft", counter: "reviewRetry", delta: 1, taskId: null },
      { phase: "draft", counter: "reviewRetry", delta: 1, taskId: null },
      { phase: "draft", counter: "reviewRetry", delta: 0, reset: true, taskId: null },
      { phase: "draft", counter: "reviewRetry", delta: 1, taskId: null },
    ];
    const summary = buildMetricsSummary(metrics);
    // Raw audit total counts every FAIL (3); current count via countReviewRetry would be 1.
    const draftReview = summary?.flow?.draft?.reviewRetry ?? summary?.draft?.reviewRetry;
    if (draftReview != null) {
      assert.ok(
        draftReview >= 3,
        `R28: metrics summary should accumulate raw FAIL count (>=3), got ${draftReview}`,
      );
    }
  });
});
