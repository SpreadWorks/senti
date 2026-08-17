import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  formatReviewMd,
  formatSpecReviewMd,
  NO_PROPOSALS_MARKER,
} from "../../../src/flow/commands/review.js";

import { FLOW_DEFINITION } from "../../../src/flow/definition.js";
import { PHASE_REVIEW_PARSERS } from "../../../src/flow/lib/run-review.js";

function findNode(nodes, id) {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

describe("R5/R7: formatReviewMd without verdicts", () => {
  it("outputs proposals without verdict fields", () => {
    const proposals = [
      { title: "1. Fix naming", body: "**File:** `src/foo.js`\n**Issue:** bad name\n**Suggestion:** rename" },
      { title: "2. Remove dead code", body: "**File:** `src/bar.js`\n**Issue:** unused\n**Suggestion:** delete" },
    ];
    const md = formatReviewMd(proposals);
    assert.ok(!md.includes("**Verdict:**"), "should not contain Verdict field");
    assert.ok(!md.includes("APPROVED"), "should not contain APPROVED");
    assert.ok(!md.includes("REJECTED"), "should not contain REJECTED");
    assert.ok(md.includes("Fix naming"), "should contain proposal title");
    assert.ok(md.includes("Remove dead code"), "should contain second proposal title");
  });

  it("outputs no-proposals marker for empty list", () => {
    const md = formatReviewMd([]);
    assert.ok(md.includes(NO_PROPOSALS_MARKER), "should contain no-proposals marker");
  });
});

describe("R6: formatSpecReviewMd without verdicts", () => {
  it("outputs proposals without APPROVED/REJECTED sections", () => {
    const proposals = [
      { title: "1. Missing scope entry", body: "**File:** `src/foo.js`\n**Issue:** not mentioned" },
    ];
    const md = formatSpecReviewMd(proposals);
    assert.ok(!md.includes("## APPROVED"), "should not have APPROVED section");
    assert.ok(!md.includes("## REJECTED"), "should not have REJECTED section");
    assert.ok(md.includes("Missing scope entry"), "should contain proposal title");
  });
});

describe("R7: dead code removed from exports", () => {
  it("does not export buildFinalSystemPrompt", async () => {
    const mod = await import("../../../src/flow/commands/review.js");
    assert.equal(mod.buildFinalSystemPrompt, undefined, "buildFinalSystemPrompt should not be exported");
  });

  it("does not export buildFinalValidationPrompt", async () => {
    const mod = await import("../../../src/flow/commands/review.js");
    assert.equal(mod.buildFinalValidationPrompt, undefined, "buildFinalValidationPrompt should not be exported");
  });

  it("does not export mergeVerdicts", async () => {
    const mod = await import("../../../src/flow/commands/review.js");
    assert.equal(mod.mergeVerdicts, undefined, "mergeVerdicts should not be exported");
  });
});

describe("R9: run-review.js proposalCount-only parsing", () => {
  it("spec parser uses proposalCount pattern, not issues", () => {
    const spec = PHASE_REVIEW_PARSERS.spec;
    assert.ok(spec.countPattern.test("proposalCount=3"), "should match proposalCount=N");
    assert.ok(!spec.countPattern.test("issues=3"), "should not match issues=N");
    assert.equal(spec.countKey, "proposalCount");
  });

  it("impl review parser source does not reference approved/rejected", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const { dirname, resolve } = await import("node:path");
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(resolve(dir, "../../../src/flow/lib/run-review.js"), "utf8");
    const executeBlock = src.slice(src.indexOf("class RunReviewCommand"));
    assert.ok(!executeBlock.includes("approvedMatch"), "should not parse approved count");
    assert.ok(!executeBlock.includes("rejectedMatch"), "should not parse rejected count");
  });
});

describe("R8: review nodes not skippable", () => {
  it("review-draft node is not skippable", () => {
    const node = findNode(FLOW_DEFINITION, "review-draft");
    assert.ok(node, "review-draft node exists");
    assert.equal(node.skippable, false, "review-draft should not be skippable");
  });

  it("review-spec node is not skippable", () => {
    const node = findNode(FLOW_DEFINITION, "review-spec");
    assert.ok(node, "review-spec node exists");
    assert.equal(node.skippable, false, "review-spec should not be skippable");
  });

  it("review-test node is not skippable", () => {
    const node = findNode(FLOW_DEFINITION, "review-test");
    assert.ok(node, "review-test node exists");
    assert.equal(node.skippable, false, "review-test should not be skippable");
  });
});
