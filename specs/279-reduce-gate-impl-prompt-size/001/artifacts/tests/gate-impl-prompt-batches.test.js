// spec: R1 R2 R3 R4 R5 R6
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as gate from "../../../src/flow/lib/run-gate.js";

const FULL_SPEC_TEXT = [
  "# Spec",
  "## Requirements",
  "- R1: Target requirement implemented through src/target.js.",
  "- R2: Unrelated requirement that must not be sent to the target prompt.",
  "## Background",
  "This background block represents full spec context that is not needed for a single requirement check.",
  "## Additional Context",
  "This fixture deliberately includes enough non-target context to make excerpt-size assertions meaningful.",
  "The gate-impl prompt should not need architecture notes, task history, or unrelated acceptance details.",
  "Long-form spec context is represented here as repeated prose about unrelated behavior and setup.",
  "Long-form spec context is represented here as repeated prose about unrelated behavior and setup.",
  "Long-form spec context is represented here as repeated prose about unrelated behavior and setup.",
  "Long-form spec context is represented here as repeated prose about unrelated behavior and setup.",
].join("\n");

const TARGET_REQUIREMENT = {
  id: "R1",
  desc: "Target requirement implemented through src/target.js.",
  priority: "must",
};

const UNRELATED_REQUIREMENT = {
  id: "R2",
  desc: "Unrelated requirement that must not be sent to the target prompt.",
  priority: "must",
};

function makeDiff(label, size = 64) {
  return [
    "diff --git a/src/target.js b/src/target.js",
    "--- a/src/target.js",
    "+++ b/src/target.js",
    "@@ -1 +1 @@",
    `-${label}-old`,
    `+${label}-${"x".repeat(size)}`,
  ].join("\n");
}

function requireExport(name) {
  assert.equal(typeof gate[name], "function", `${name} export is required`);
  return gate[name];
}

function buildExcerpt(requirement) {
  const RequirementPromptExcerpt = requireExport("RequirementPromptExcerpt");
  return new RequirementPromptExcerpt(requirement);
}

function buildLargeRequirement(id, size) {
  return buildExcerpt({
    id,
    desc: `Requirement ${id} ${"x".repeat(size)}`,
    priority: "must",
  });
}

describe("279: gate-impl requirement excerpts and batching", () => {
  it("R1: file-map requirement prompts include only target requirement excerpts", () => {
    const planRequirementGateCalls = requireExport("planRequirementGateCalls");
    const plan = planRequirementGateCalls({
      requirements: [buildExcerpt(TARGET_REQUIREMENT), buildExcerpt(UNRELATED_REQUIREMENT)],
      relatedDiffs: new Map([
        ["R1", makeDiff("target")],
        ["R2", ""],
      ]),
      fullSpecText: FULL_SPEC_TEXT,
      phase: "task-impl",
      maxChars: 120000,
    });
    const prompt = plan.calls[0].buildPrompt().build().userPrompt;

    assert.match(prompt, /R1/);
    assert.match(prompt, /Target requirement implemented/);
    assert.match(prompt, /priority:\s*must/i);
    assert.doesNotMatch(prompt, /testing not required/i);
    assert.doesNotMatch(prompt, /Unrelated requirement/);
    assert.equal(prompt.includes(FULL_SPEC_TEXT), false);

    const nonTestableExcerpt = buildExcerpt({
      id: "R9",
      desc: "Document-only requirement.",
      priority: "should",
      testable: false,
    }).toPromptText();
    assert.match(nonTestableExcerpt, /priority:\s*should/i);
    assert.match(nonTestableExcerpt, /testing not required/i);
  });

  it("R2: identical diff contexts are batched within the multi-requirement limit", () => {
    const buildRequirementGateBatches = requireExport("buildRequirementGateBatches");
    const diff = makeDiff("shared");
    const batches = buildRequirementGateBatches({
      requirements: [
        buildExcerpt(TARGET_REQUIREMENT),
        buildExcerpt(UNRELATED_REQUIREMENT),
      ],
      relatedDiffs: new Map([
        ["R1", diff],
        ["R2", diff],
      ]),
      maxChars: 120000,
    });

    assert.equal(batches.length, 1);
    assert.deepEqual(batches[0].requirementIds, ["R1", "R2"]);
    assert.ok(batches[0].promptCharCount <= 120000);
  });

  it("R2: an indivisible oversized requirement becomes a single-requirement overflow batch", () => {
    const buildRequirementGateBatches = requireExport("buildRequirementGateBatches");
    const oversizedDiff = makeDiff("oversized", 120500);
    const batches = buildRequirementGateBatches({
      requirements: [buildExcerpt(TARGET_REQUIREMENT)],
      relatedDiffs: new Map([["R1", oversizedDiff]]),
      maxChars: 120000,
    });

    assert.equal(batches.length, 1);
    assert.deepEqual(batches[0].requirementIds, ["R1"]);
    assert.equal(batches[0].overflow, true);
    assert.ok(batches[0].promptCharCount > 120000);
    assert.ok(Buffer.byteLength(oversizedDiff, "utf8") <= 1048576);
  });

  it("R2: oversized same-context multi-requirement groups split into limited batches", () => {
    const buildRequirementGateBatches = requireExport("buildRequirementGateBatches");
    const sharedDiff = makeDiff("shared", 40000);
    const batches = buildRequirementGateBatches({
      requirements: [
        buildLargeRequirement("R1", 50000),
        buildLargeRequirement("R2", 50000),
        buildLargeRequirement("R3", 50000),
      ],
      relatedDiffs: new Map([
        ["R1", sharedDiff],
        ["R2", sharedDiff],
        ["R3", sharedDiff],
      ]),
      maxChars: 120000,
    });

    assert.ok(batches.length > 1);
    assert.deepEqual(batches.flatMap((batch) => batch.requirementIds), ["R1", "R2", "R3"]);
    for (const batch of batches) {
      assert.equal(batch.overflow, false);
      assert.ok(batch.requirementIds.length > 1 || batch.promptCharCount <= 120000);
      assert.ok(batch.promptCharCount <= 120000);
    }
  });

  it("R3: previous-pass and empty-diff requirements are skipped before agent planning", () => {
    const planRequirementGateCalls = requireExport("planRequirementGateCalls");
    const plan = planRequirementGateCalls({
      requirements: [
        buildExcerpt(TARGET_REQUIREMENT),
        buildExcerpt(UNRELATED_REQUIREMENT),
        buildExcerpt({ id: "R3", desc: "No related diff requirement.", priority: "must" }),
      ],
      relatedDiffs: new Map([
        ["R1", makeDiff("target")],
        ["R2", makeDiff("related")],
        ["R3", ""],
      ]),
      previouslyPassed: new Set(["R2"]),
      maxChars: 120000,
    });

    assert.deepEqual(plan.calls.flatMap((batch) => batch.requirementIds), ["R1"]);
    assert.deepEqual(plan.evaluations, [
      {
        guardrail_id: "R2",
        result: "pass",
        reason: "previously passed (skipped on retry)",
        title: "R2",
        category: "requirements",
      },
      {
        guardrail_id: "R3",
        result: "skip",
        reason: "no related diff found",
        title: "R3",
        category: "requirements",
      },
    ]);
  });

  it("R4: no-file-map fallback is limited to non-integration requirement checks", () => {
    const planRequirementGateCalls = requireExport("planRequirementGateCalls");
    const parseImplRequirementEvaluation = requireExport("parseImplRequirementEvaluation");
    const fullDiff = makeDiff("full");
    const taskImplPlan = planRequirementGateCalls({
      requirements: [buildExcerpt(TARGET_REQUIREMENT), buildExcerpt(UNRELATED_REQUIREMENT)],
      relatedDiffs: null,
      fullSpecText: FULL_SPEC_TEXT,
      fullDiff,
      phase: "task-impl",
      maxChars: 120000,
    });
    assert.equal(taskImplPlan.calls.length, 1);
    assert.equal(taskImplPlan.calls[0].usesFullSpec, true);
    const fallbackPrompt = taskImplPlan.calls[0].buildPrompt().build().userPrompt;
    assert.equal(fallbackPrompt.includes(FULL_SPEC_TEXT), true);
    assert.equal(fallbackPrompt.includes(fullDiff), true);

    const parsed = parseImplRequirementEvaluation(JSON.stringify({
      evaluations: [
        { guardrail_id: "R1", result: "pass", reason: "covered" },
        { guardrail_id: "R2", result: "skip", reason: "runtime evidence required" },
      ],
    }), ["R1", "R2"]);
    assert.deepEqual(parsed.map((entry) => entry.guardrail_id), ["R1", "R2"]);

    assert.throws(() => planRequirementGateCalls({
      requirements: [buildExcerpt(TARGET_REQUIREMENT)],
      relatedDiffs: null,
      fullSpecText: FULL_SPEC_TEXT,
      fullDiff: makeDiff("full"),
      phase: "integration",
      maxChars: 120000,
    }), /file-map trust/i);
  });

  it("R5: planned skip and batch results preserve gate evaluation shape", () => {
    const planRequirementGateCalls = requireExport("planRequirementGateCalls");
    const plan = planRequirementGateCalls({
      requirements: [buildExcerpt(TARGET_REQUIREMENT), buildExcerpt(UNRELATED_REQUIREMENT)],
      relatedDiffs: new Map([
        ["R1", makeDiff("target")],
        ["R2", ""],
      ]),
      previouslyPassed: new Set(),
      maxChars: 120000,
    });

    for (const evaluation of plan.evaluations) {
      assert.deepEqual(Object.keys(evaluation).sort(), [
        "category",
        "guardrail_id",
        "reason",
        "result",
        "title",
      ]);
    }
    for (const batch of plan.calls) {
      assert.ok(Array.isArray(batch.requirementIds));
      assert.equal(batch.category, "requirements");
    }
  });

  it("R6: excerpt prompt content is less than half the full spec fixture size", () => {
    const excerptText = buildExcerpt(TARGET_REQUIREMENT).toPromptText();

    assert.ok(excerptText.length < FULL_SPEC_TEXT.length / 2);
  });
});
