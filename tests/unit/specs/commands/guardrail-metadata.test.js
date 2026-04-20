import { describe, it } from "node:test";
import assert from "node:assert/strict";

const { filterByPhase, matchScope } = await import(
  "../../../../src/lib/guardrail.js"
);
const { buildGuardrailPrompt } = await import(
  "../../../../src/flow/lib/run-gate.js"
);

// ---------------------------------------------------------------------------
// filterByPhase
// ---------------------------------------------------------------------------

describe("filterByPhase", () => {
  it("filters guardrails by phase", () => {
    const guardrails = [
      { title: "A", body: "", meta: { phase: ["spec"] } },
      { title: "B", body: "", meta: { phase: ["task-impl", "lint"] } },
      { title: "C", body: "", meta: { phase: ["spec", "task-impl"] } },
      { title: "D", body: "", meta: { phase: ["lint"] } },
    ];

    const specGuardrails = filterByPhase(guardrails, "spec");
    assert.equal(specGuardrails.length, 2);
    assert.deepEqual(specGuardrails.map((g) => g.title), ["A", "C"]);

    const implGuardrails = filterByPhase(guardrails, "task-impl");
    assert.equal(implGuardrails.length, 2);
    assert.deepEqual(implGuardrails.map((g) => g.title), ["B", "C"]);

    const lintGuardrails = filterByPhase(guardrails, "lint");
    assert.equal(lintGuardrails.length, 2);
    assert.deepEqual(lintGuardrails.map((g) => g.title), ["B", "D"]);
  });
});

// ---------------------------------------------------------------------------
// scope matching
// ---------------------------------------------------------------------------

describe("matchScope", () => {
  it("matches glob patterns against file paths", () => {
    // *.css matches .css files
    assert.ok(matchScope("src/styles/main.css", ["*.css"]));
    assert.ok(!matchScope("src/app.js", ["*.css"]));

    // *Controller.php matches controller files
    assert.ok(matchScope("app/Controller/UsersController.php", ["*Controller.php"]));
    assert.ok(!matchScope("app/Model/User.php", ["*Controller.php"]));

    // Multiple patterns (OR logic)
    assert.ok(matchScope("src/app.tsx", ["*.css", "*.tsx"]));
    assert.ok(matchScope("src/style.css", ["*.css", "*.tsx"]));
    assert.ok(!matchScope("src/app.js", ["*.css", "*.tsx"]));
  });

  it("returns true when scope is undefined (all files match)", () => {
    assert.ok(matchScope("any/file.js", undefined));
    assert.ok(matchScope("any/file.js", []));
  });
});

// ---------------------------------------------------------------------------
// buildGuardrailPrompt: phase filtering
// ---------------------------------------------------------------------------

describe("buildGuardrailPrompt with phase filtering", () => {
  it("excludes non-spec guardrails from prompt", () => {
    const guardrails = [
      { id: "a", title: "Spec Rule", body: "Check in spec.", meta: { phase: ["spec"], category: "requirements" } },
      { id: "b", title: "Lint Rule", body: "Check in lint.", meta: { phase: ["lint"], category: "code-quality" } },
      { id: "c", title: "Both Rule", body: "Check in both.", meta: { phase: ["spec", "lint"], category: "requirements" } },
    ];
    const prompt = buildGuardrailPrompt("spec content", guardrails, "spec");
    assert.ok(prompt.includes("Spec Rule"));
    assert.ok(!prompt.includes("Lint Rule"));
    assert.ok(prompt.includes("Both Rule"));
  });

  it("returns null when no spec-phase guardrails remain after filtering", () => {
    const guardrails = [
      { id: "a", title: "Lint Only", body: "Lint check.", meta: { phase: ["lint"], category: "code-quality" } },
      { id: "b", title: "Impl Only", body: "Impl check.", meta: { phase: ["task-impl"], category: "code-quality" } },
    ];
    const prompt = buildGuardrailPrompt("spec content", guardrails, "spec");
    assert.equal(prompt, null);
  });
});

// ---------------------------------------------------------------------------
// lint article validation
// ---------------------------------------------------------------------------

describe("lint article validation", () => {
  let validateLintGuardrails;

  it("warns when lint pattern exists but phase does not include lint", async () => {
    ({ validateLintGuardrails } = await import("../../../../src/lib/lint.js"));

    const guardrails = [
      { title: "Good", body: "", meta: { phase: ["lint"], lint: /TODO/ } },
      { title: "Bad", body: "", meta: { phase: ["spec"], lint: /FIXME/ } },
      { title: "No Lint", body: "", meta: { phase: ["spec"] } },
    ];

    const warnings = validateLintGuardrails(guardrails);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes("Bad"));
  });
});
