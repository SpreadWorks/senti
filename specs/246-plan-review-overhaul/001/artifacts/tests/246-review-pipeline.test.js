import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../..");

describe("spec 246: run-review.js parser rename (R-06)", () => {
  it("R-06: PHASE_REVIEW_PARSERS draft key uses renamed commandId", async () => {
    const { PHASE_REVIEW_PARSERS } = await import(
      resolve(ROOT, "src/flow/lib/run-review.js")
    );
    const draftParser = PHASE_REVIEW_PARSERS.draft;
    assert.ok(draftParser, "draft parser exists in PHASE_REVIEW_PARSERS");
    assert.ok(
      draftParser.commandId.includes("propose"),
      `draft parser commandId should include "propose", got "${draftParser.commandId}"`
    );
  });

  it("R-06: parseDraftReviewOutput is renamed to parseProposalReviewOutput or equivalent", async () => {
    const mod = await import(resolve(ROOT, "src/flow/lib/run-review.js"));
    const hasOldName = "parseDraftReviewOutput" in mod;
    assert.ok(
      !hasOldName,
      "parseDraftReviewOutput should be renamed (no longer exported under old name)"
    );
  });
});

describe("spec 246: draft review auto-fix abolished (R-01)", () => {
  it("R-01: buildDraftFixPrompt does not exist in review.js", () => {
    const reviewJs = readFileSync(
      resolve(ROOT, "src/flow/commands/review.js"),
      "utf-8"
    );
    assert.ok(
      !reviewJs.includes("buildDraftFixPrompt"),
      "buildDraftFixPrompt should be deleted from review.js"
    );
  });

  it("R-01: runDraftReview does not write to draft.json", () => {
    const reviewJs = readFileSync(
      resolve(ROOT, "src/flow/commands/review.js"),
      "utf-8"
    );
    const draftReviewSection = extractFunction(reviewJs, "runDraftReview");
    if (draftReviewSection) {
      const writeLines = draftReviewSection.split("\n").filter(
        (line) => line.includes("writeFileSync") && line.includes("draftPath")
      );
      assert.equal(
        writeLines.length,
        0,
        "runDraftReview should not write to draftPath (draft.json)"
      );
    }
  });
});

describe("spec 246: spec review propose-validate pattern (R-02, R-03)", () => {
  it("R-02: buildSpecFixPrompt does not exist in review.js", () => {
    const reviewJs = readFileSync(
      resolve(ROOT, "src/flow/commands/review.js"),
      "utf-8"
    );
    assert.ok(
      !reviewJs.includes("buildSpecFixPrompt"),
      "buildSpecFixPrompt should be deleted from review.js"
    );
  });

  it("R-02: runSpecReview does not call runReviewLoop", () => {
    const reviewJs = readFileSync(
      resolve(ROOT, "src/flow/commands/review.js"),
      "utf-8"
    );
    const specReviewSection = extractFunction(reviewJs, "runSpecReview");
    if (specReviewSection) {
      assert.ok(
        !specReviewSection.includes("runReviewLoop"),
        "runSpecReview should not use runReviewLoop (replaced by 2-step propose→validate)"
      );
    }
  });

  it("R-03: runSpecReview does not write to spec.md", () => {
    const reviewJs = readFileSync(
      resolve(ROOT, "src/flow/commands/review.js"),
      "utf-8"
    );
    const specReviewSection = extractFunction(reviewJs, "runSpecReview");
    if (specReviewSection) {
      const writesSpecMd =
        specReviewSection.includes("writeFileSync") &&
        specReviewSection.includes("spec.md");
      assert.ok(
        !writesSpecMd,
        "runSpecReview should not write to spec.md (auto-fix abolished)"
      );
    }
  });
});

describe("spec 246: skill instruction prompts (R-08)", () => {
  it("R-08: review-draft.md describes detection report + additional questions flow", () => {
    const promptPath = resolve(
      ROOT,
      "src/flow/prompts/plan/review-draft.md"
    );
    const content = readFileSync(promptPath, "utf-8");
    assert.ok(
      content.includes("追加質問") || content.includes("additional question"),
      "review-draft.md should describe additional questions flow"
    );
    assert.ok(
      !content.includes("auto-fix") && !content.includes("autofix"),
      "review-draft.md should not reference auto-fix"
    );
  });

  it("R-08: review-spec.md describes propose-validate + APPROVED proposals flow", () => {
    const promptPath = resolve(
      ROOT,
      "src/flow/prompts/plan/review-spec.md"
    );
    const content = readFileSync(promptPath, "utf-8");
    assert.ok(
      content.includes("propose") || content.includes("APPROVED"),
      "review-spec.md should describe propose→validate flow"
    );
    assert.ok(
      !content.includes("auto-fix") && !content.includes("autofix"),
      "review-spec.md should not reference auto-fix"
    );
  });
});

function extractFunction(source, funcName) {
  const idx = source.indexOf(`function ${funcName}`);
  if (idx === -1) {
    const asyncIdx = source.indexOf(`async function ${funcName}`);
    if (asyncIdx === -1) return null;
    return extractBalanced(source, asyncIdx);
  }
  return extractBalanced(source, idx);
}

function extractBalanced(source, startIdx) {
  const braceStart = source.indexOf("{", startIdx);
  if (braceStart === -1) return null;
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  return source.slice(startIdx);
}
