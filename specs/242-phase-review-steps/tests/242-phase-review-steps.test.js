import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  FLOW_DEFINITION,
  collectLeafIds,
  resolveNodeFor,
  buildInitialNestedSteps,
  flattenSteps,
} from "../../../src/flow/definition.js";
import { VALID_REVIEW_PHASES } from "../../../src/lib/constants.js";
import {
  parseTestReviewOutput,
  parseSpecReviewOutput,
} from "../../../src/flow/lib/run-review.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PKG_DIR = path.resolve(fileURLToPath(import.meta.url), "../../../../src");
const PROMPTS_DIR = path.join(PKG_DIR, "flow", "prompts");

describe("R1: review step nodes in FLOW_DEFINITION", () => {
  const planNode = FLOW_DEFINITION.find((n) => n.id === "plan");
  const childIds = planNode.children.map((c) => c.id);

  it("review-draft exists between draft and gate-draft", () => {
    const draftIdx = childIds.indexOf("draft");
    const reviewDraftIdx = childIds.indexOf("review-draft");
    const gateDraftIdx = childIds.indexOf("gate-draft");
    assert.ok(reviewDraftIdx > draftIdx, "review-draft should be after draft");
    assert.ok(reviewDraftIdx < gateDraftIdx, "review-draft should be before gate-draft");
  });

  it("review-spec exists between spec and gate", () => {
    const specIdx = childIds.indexOf("spec");
    const reviewSpecIdx = childIds.indexOf("review-spec");
    const gateIdx = childIds.indexOf("gate");
    assert.ok(reviewSpecIdx > specIdx, "review-spec should be after spec");
    assert.ok(reviewSpecIdx < gateIdx, "review-spec should be before gate");
  });

  it("review-test exists after test", () => {
    const testIdx = childIds.indexOf("test");
    const reviewTestIdx = childIds.indexOf("review-test");
    assert.ok(reviewTestIdx > testIdx, "review-test should be after test");
  });
});

describe("R2: review node properties", () => {
  for (const id of ["review-draft", "review-spec", "review-test"]) {
    it(`${id} has skippable: true, maxAttempts: 3, action: "run-review"`, () => {
      const node = resolveNodeFor(FLOW_DEFINITION, id);
      assert.ok(node, `${id} not found in FLOW_DEFINITION`);
      assert.equal(node.skippable, true);
      assert.equal(node.maxAttempts, 3);
      assert.equal(node.action, "run-review");
    });
  }

  it('review-draft instructionsKey is "plan.review-draft"', () => {
    assert.equal(resolveNodeFor(FLOW_DEFINITION, "review-draft").instructionsKey, "plan.review-draft");
  });

  it('review-spec instructionsKey is "plan.review-spec"', () => {
    assert.equal(resolveNodeFor(FLOW_DEFINITION, "review-spec").instructionsKey, "plan.review-spec");
  });

  it('review-test instructionsKey is "plan.review-test"', () => {
    assert.equal(resolveNodeFor(FLOW_DEFINITION, "review-test").instructionsKey, "plan.review-test");
  });
});

describe("R3: VALID_REVIEW_PHASES includes draft", () => {
  it('contains "draft"', () => {
    assert.ok(VALID_REVIEW_PHASES.includes("draft"));
  });

  it('still contains "test" and "spec"', () => {
    assert.ok(VALID_REVIEW_PHASES.includes("test"));
    assert.ok(VALID_REVIEW_PHASES.includes("spec"));
  });
});

describe("R4: runDraftReview structural checks", () => {
  it("REVIEW_PHASES includes draft entry", async () => {
    const mod = await import("../../../src/flow/commands/review.js");
    assert.ok(mod.REVIEW_PHASES.draft, "REVIEW_PHASES should have a draft entry");
  });

  it("buildDraftReviewPrompt is exported and produces output", async () => {
    const mod = await import("../../../src/flow/commands/review.js");
    assert.equal(typeof mod.buildDraftReviewPrompt, "function");
    const result = mod.buildDraftReviewPrompt(
      { qa: [{ question: "test?", answer: "yes", evidence: "code", why: "because" }] },
      "test request",
      [],
    );
    assert.ok(result.includes("test?"), "prompt includes QA question");
    assert.ok(result.includes("test request"), "prompt includes request text");
  });
});

describe("R5: parseDraftReviewOutput", () => {
  it("is exported from run-review.js", async () => {
    const mod = await import("../../../src/flow/lib/run-review.js");
    assert.equal(typeof mod.parseDraftReviewOutput, "function");
  });
});

describe("R6: registry review post hook phase mapping", () => {
  it("registry exports review entry with post hook", async () => {
    const registryPath = path.join(PKG_DIR, "flow", "registry.js");
    const content = fs.readFileSync(registryPath, "utf8");
    assert.ok(content.includes("review"), "registry has review entry");
  });
});

describe("R7: prompt files exist", () => {
  for (const name of ["review-draft", "review-spec", "review-test"]) {
    it(`prompts/plan/${name}.md exists`, () => {
      const filePath = path.join(PROMPTS_DIR, "plan", `${name}.md`);
      assert.ok(fs.existsSync(filePath), `${filePath} does not exist`);
    });
  }
});

describe("R8: existing review phases unchanged", () => {
  it("impl review node still exists", () => {
    const node = resolveNodeFor(FLOW_DEFINITION, "review");
    assert.ok(node, "review node not found");
    assert.equal(node.instructionsKey, "impl.review");
  });

  it("parseTestReviewOutput is still exported", () => {
    assert.equal(typeof parseTestReviewOutput, "function");
  });

  it("parseSpecReviewOutput is still exported", () => {
    assert.equal(typeof parseSpecReviewOutput, "function");
  });
});

describe("R9: instructions-coverage (structural)", () => {
  it("new review step nodes have prompt files", () => {
    const ids = ["review-draft", "review-spec", "review-test"];
    for (const id of ids) {
      const node = resolveNodeFor(FLOW_DEFINITION, id);
      assert.ok(node, `${id} not found`);
      const parts = node.instructionsKey.split(".");
      const stepName = parts.pop();
      const filePath = path.join(PROMPTS_DIR, ...parts, `${stepName}.md`);
      assert.ok(fs.existsSync(filePath), `prompt file missing for ${node.instructionsKey}: ${filePath}`);
    }
  });
});

describe("flow steps include review nodes", () => {
  it("buildInitialNestedSteps produces review-draft, review-spec, review-test", () => {
    const steps = buildInitialNestedSteps(FLOW_DEFINITION);
    const leafIds = flattenSteps(steps).map((s) => s.id);
    assert.ok(leafIds.includes("review-draft"));
    assert.ok(leafIds.includes("review-spec"));
    assert.ok(leafIds.includes("review-test"));
  });
});
