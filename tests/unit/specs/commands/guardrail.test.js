import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../helpers/tmp-dir.js";
import { execFileSync } from "child_process";
import { setupFlow } from "../../../helpers/flow-setup.js";

const SDD_FORGE = join(process.cwd(), "src/sdd-forge.js");

// Dynamically import gate functions for unit tests
const { buildGuardrailPrompt, parseGuardrailResponse, IMPL_DIFF_SCOPE_LINES } = await import(
  "../../../../src/flow/lib/run-gate.js"
);

// ---------------------------------------------------------------------------
// gate integration: guardrail warning
// ---------------------------------------------------------------------------

describe("gate guardrail integration", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  const validSpec = [
    "# Spec",
    "## Clarifications (Q&A)",
    "## Open Questions",
    "## User Confirmation",
    "- [x] User approved this spec",
    "## Acceptance Criteria",
    "- done",
  ].join("\n");

  function createGateFixture({ config, guardrails } = {}) {
    tmp = createTmpDir();
    execFileSync("git", ["init", tmp], { stdio: "ignore" });
    execFileSync("git", ["-C", tmp, "commit", "--allow-empty", "-m", "init"], { stdio: "ignore" });
    setupFlow(tmp);
    writeJson(tmp, ".sdd-forge/config.json", config || {
      lang: "en", type: "node-cli",
      docs: { languages: ["en"], defaultLanguage: "en" },
    });
    writeFile(tmp, "spec.md", validSpec);
    if (guardrails) {
      writeJson(tmp, ".sdd-forge/guardrail.json", { guardrails });
    }
    return tmp;
  }

  function runGate(dir, extraArgs = []) {
    return execFileSync("node", [
      SDD_FORGE, "flow", "run", "gate",
      "--spec", join(dir, "spec.md"),
      ...extraArgs,
    ], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: dir },
    });
  }

  it("warns when guardrail.json is absent", () => {
    createGateFixture();
    const envelope = JSON.parse(runGate(tmp));
    assert.equal(envelope.ok, true);
  });

  it("passes with guardrail.json present (no agent = skip AI check with warn)", () => {
    createGateFixture({
      guardrails: [
        { id: "no-external-deps", title: "No External Dependencies", body: "Use only Node.js built-in modules.", meta: { phase: ["spec"] } },
      ],
    });
    const envelope = JSON.parse(runGate(tmp));
    assert.equal(envelope.ok, true);
  });

  it("skips AI check with --skip-guardrail", () => {
    createGateFixture({
      config: {
        lang: "en", type: "node-cli",
        docs: { languages: ["en"], defaultLanguage: "en" },
        agent: { default: "claude", providers: { claude: { command: "echo", args: ["FAIL"] } } },
      },
      guardrails: [
        { id: "rule", title: "Rule", body: "Some rule.", meta: { phase: ["spec"] } },
      ],
    });
    const envelope = JSON.parse(runGate(tmp, ["--skip-guardrail"]));
    assert.equal(envelope.ok, true);
  });
});

// ---------------------------------------------------------------------------
// buildGuardrailPrompt / parseGuardrailResponse unit tests
// ---------------------------------------------------------------------------

describe("buildGuardrailPrompt", () => {
  it("includes all guardrails and spec text", () => {
    const guardrails = [
      { title: "Rule A", body: "Description A", meta: { phase: ["spec"] } },
      { title: "Rule B", body: "Description B", meta: { phase: ["spec"] } },
    ];
    const prompt = buildGuardrailPrompt("spec content here", guardrails, "spec");
    assert.ok(prompt.includes("Rule A"));
    assert.ok(prompt.includes("Rule B"));
    assert.ok(prompt.includes("spec content here"));
    assert.ok(prompt.includes("PASS"));
    assert.ok(prompt.includes("FAIL"));
  });
});

describe("parseGuardrailResponse", () => {
  it("parses PASS and FAIL lines", () => {
    const response = [
      "PASS: Single Responsibility — spec addresses one concern",
      "FAIL: Unambiguous Requirements — uses vague term 'appropriate'",
      "PASS: Complete Context — all requirements have triggers",
    ].join("\n");

    const results = parseGuardrailResponse(response);
    assert.equal(results.length, 3);
    assert.equal(results[0].title, "Single Responsibility");
    assert.equal(results[0].passed, true);
    assert.equal(results[1].title, "Unambiguous Requirements");
    assert.equal(results[1].passed, false);
    assert.ok(results[1].reason.includes("vague"));
    assert.equal(results[2].title, "Complete Context");
    assert.equal(results[2].passed, true);
  });

  it("ignores non-matching lines", () => {
    const response = "Some preamble\nPASS: Rule — ok\nSome trailing text";
    const results = parseGuardrailResponse(response);
    assert.equal(results.length, 1);
    assert.equal(results[0].title, "Rule");
  });

  it("returns empty array for empty response", () => {
    assert.deepEqual(parseGuardrailResponse(""), []);
  });

  it("handles en-dash and hyphen separators", () => {
    const r1 = parseGuardrailResponse("PASS: Rule \u2013 reason with en-dash");
    assert.equal(r1.length, 1);
    const r2 = parseGuardrailResponse("FAIL: Rule - reason with hyphen");
    assert.equal(r2.length, 1);
    assert.equal(r2[0].passed, false);
  });
});

// ---------------------------------------------------------------------------
// buildGuardrailPrompt includes all guardrails (no exemption filtering)
// ---------------------------------------------------------------------------

describe("buildGuardrailPrompt ignores exemption sections", () => {
  const guardrails = [
    { title: "Rule A", body: "Description A", meta: { phase: ["spec"] } },
    { title: "Rule B", body: "Description B", meta: { phase: ["spec"] } },
    { title: "Rule C", body: "Description C", meta: { phase: ["spec"] } },
  ];

  it("includes all spec-phase guardrails even with exemptions section in spec", () => {
    const spec = "## Guardrail Exemptions\n- Rule B \u2014 reason\n\n## Requirements\n- R1\n";
    const prompt = buildGuardrailPrompt(spec, guardrails, "spec");
    assert.ok(prompt.includes("Rule A"));
    assert.ok(prompt.includes("Rule B"), "Rule B should NOT be filtered out");
    assert.ok(prompt.includes("Rule C"));
    assert.ok(!prompt.includes("Exempted Articles"), "should not have Exempted Articles section");
  });

  it("includes inapplicable-PASS instruction", () => {
    const prompt = buildGuardrailPrompt("## Requirements\n- R1\n", guardrails, "spec");
    assert.ok(prompt.includes("inapplicable"), "should include inapplicable instruction");
  });
});

// ---------------------------------------------------------------------------
// buildGuardrailPrompt impl phase: diff-scope constraint (Issue #180)
// ---------------------------------------------------------------------------

describe("buildGuardrailPrompt impl-phase diff-scope constraint", () => {
  const implGuardrails = [
    { title: "No Sync I/O in Hot Paths", body: "Avoid sync I/O", meta: { phase: ["impl"] } },
  ];
  // Canonical contract phrases exposed by the implementation. Breaking any of these
  // would semantically regress the Issue #180 fix, so we assert on them directly.
  const DIFF_SCOPE_HEADING = "## Diff Scope Constraint";
  const CANONICAL_PHRASES = IMPL_DIFF_SCOPE_LINES.join("\n");

  it("embeds the canonical diff-scope heading in impl-phase prompts", () => {
    const targetText = "## Spec\nR1\n\n## Git Diff\ndiff --git a/x.js b/x.js\n+new line\n";
    const prompt = buildGuardrailPrompt(targetText, implGuardrails, "impl");
    assert.ok(prompt, "impl-phase prompt should be generated");
    assert.ok(
      prompt.includes(DIFF_SCOPE_HEADING),
      `impl prompt should contain "${DIFF_SCOPE_HEADING}" section`,
    );
  });

  it("embeds the full canonical diff-scope instruction block", () => {
    const targetText = "## Spec\nR1\n\n## Git Diff\ndiff --git a/x.js b/x.js\n+new line\n";
    const prompt = buildGuardrailPrompt(targetText, implGuardrails, "impl");
    assert.ok(
      prompt.includes(CANONICAL_PHRASES.trim()),
      "impl prompt should embed IMPL_DIFF_SCOPE_LINES verbatim",
    );
  });

  it("does not add diff-scope constraint to draft/spec phase prompts", () => {
    const multiPhaseGuardrails = [
      { title: "Rule A", body: "Desc A", meta: { phase: ["draft", "spec", "impl"] } },
    ];
    const draftPrompt = buildGuardrailPrompt("content", multiPhaseGuardrails, "draft");
    const specPrompt = buildGuardrailPrompt("content", multiPhaseGuardrails, "spec");
    assert.ok(draftPrompt, "draft prompt should be generated for draft-phase guardrails");
    assert.ok(specPrompt, "spec prompt should be generated for spec-phase guardrails");
    assert.ok(
      !draftPrompt.includes(DIFF_SCOPE_HEADING),
      "draft prompt should not carry impl-specific diff-scope heading",
    );
    assert.ok(
      !specPrompt.includes(DIFF_SCOPE_HEADING),
      "spec prompt should not carry impl-specific diff-scope heading",
    );
  });
});
