import { describe, it } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// filterByPhase: "draft" phase support
// ---------------------------------------------------------------------------

describe("filterByPhase supports draft phase", () => {
  let filterByPhase;

  it("filters articles with phase: [draft]", async () => {
    ({ filterByPhase } = await import("../../../../src/lib/guardrail.js"));

    const articles = [
      { title: "Draft Rule", body: "", meta: { phase: ["draft"] } },
      { title: "Spec Rule", body: "", meta: { phase: ["spec"] } },
      { title: "Both Rule", body: "", meta: { phase: ["draft", "spec"] } },
      { title: "Impl Rule", body: "", meta: { phase: ["impl"] } },
    ];

    const draftArticles = filterByPhase(articles, "draft");
    assert.equal(draftArticles.length, 2);
    assert.deepEqual(draftArticles.map((a) => a.title), ["Draft Rule", "Both Rule"]);
  });
});

