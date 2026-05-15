import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { createTmpDir, removeTmpDir, writeJson } from "../../../helpers/tmp-dir.js";
import { execFileSync } from "child_process";
import { setupFlow } from "../../../helpers/flow-setup.js";

const SDD_FORGE = join(process.cwd(), "src/sdd-forge.js");

// Dynamically import gate functions for unit tests
const { buildGuardrailPrompt, parseGuardrailArticleEvaluation, IMPL_DIFF_SCOPE_LINES } = await import(
  "../../../../src/flow/lib/run-gate.js"
);

// ---------------------------------------------------------------------------
// gate integration: guardrail warning
// ---------------------------------------------------------------------------

describe("gate guardrail integration", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  const validSpec = {
    goal: "test goal",
    background: "test background",
    scope: { in: ["a"], out: ["b"] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements: [],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
  };

  function createGateFixture({ config, guardrails } = {}) {
    tmp = createTmpDir();
    execFileSync("git", ["init", tmp], { stdio: "ignore" });
    execFileSync("git", ["-C", tmp, "commit", "--allow-empty", "-m", "init"], { stdio: "ignore" });
    setupFlow(tmp);
    writeJson(tmp, ".sdd-forge/config.json", config || {
      lang: "en", type: "node-cli",
      docs: { languages: ["en"], defaultLanguage: "en" },
    });
    writeJson(tmp, "spec.json", validSpec);
    if (guardrails) {
      writeJson(tmp, ".sdd-forge/guardrail.json", { guardrails });
    }
    return tmp;
  }

  function runGate(dir, { phase = "spec", extraArgs = [] } = {}) {
    // Explicit `phase` is required under the post-spec-221 contract: when no
    // gate-type step is in_progress in the flow state (the test fixture only
    // uses `setupFlow` which leaves every step pending), the gate command
    // errors out unless --phase is passed. The helper centralizes the flag so
    // callers cannot accidentally pass a conflicting --phase via extraArgs.
    return execFileSync("node", [
      SDD_FORGE, "flow", "run", "gate",
      "--phase", phase,
      "--spec", join(dir, "spec.json"),
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
        {
          id: "no-external-deps",
          title: "No External Dependencies",
          body: "Use only Node.js built-in modules.",
          meta: { phase: ["spec"], category: "code-quality" },
        },
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
        {
          id: "rule",
          title: "Rule",
          body: "Some rule.",
          meta: { phase: ["spec"], category: "process" },
        },
      ],
    });
    const envelope = JSON.parse(runGate(tmp, { extraArgs: ["--skip-guardrail"] }));
    assert.equal(envelope.ok, true);
  });
});

// ---------------------------------------------------------------------------
// buildGuardrailPrompt: structured JSON output format
// ---------------------------------------------------------------------------

describe("buildGuardrailPrompt (structured JSON)", () => {
  it("includes all guardrails and spec text", () => {
    const guardrails = [
      { id: "a", title: "Rule A", body: "Description A", meta: { phase: ["spec"], category: "requirements" } },
      { id: "b", title: "Rule B", body: "Description B", meta: { phase: ["spec"], category: "requirements" } },
    ];
    const prompt = buildGuardrailPrompt("spec content here", guardrails, "spec");
    assert.ok(prompt.includes("Rule A"));
    assert.ok(prompt.includes("Rule B"));
    assert.ok(prompt.includes("spec content here"));
    assert.ok(prompt.includes("evaluations"));
    assert.ok(prompt.includes("pass"));
    assert.ok(prompt.includes("fail"));
    assert.ok(prompt.includes("JSON"));
    assert.ok(prompt.includes("Evaluate only explicit requirements stated in the listed guardrail article body"));
    assert.ok(prompt.includes("This is a readiness gate, not a design review"));
    assert.ok(prompt.includes("not directly grounded in a listed guardrail article"));
  });
});

// ---------------------------------------------------------------------------
// parseEvaluationResponse: sanity delegating tests — full contract covered in
// tests/unit/flow/gate-evaluation-schema.test.js.
// ---------------------------------------------------------------------------

describe("parseGuardrailArticleEvaluation (smoke)", () => {
  it("parses a well-formed response", () => {
    const resp = JSON.stringify({
      evaluations: [{ guardrail_id: "a", result: "pass", reason: "ok" }],
    });
    const r = parseGuardrailArticleEvaluation(resp, ["a"]);
    assert.equal(r.length, 1);
    assert.equal(r[0].result, "pass");
  });
});

// ---------------------------------------------------------------------------
// buildGuardrailPrompt includes all guardrails (no exemption filtering)
// ---------------------------------------------------------------------------

describe("buildGuardrailPrompt ignores exemption sections", () => {
  const guardrails = [
    { id: "a", title: "Rule A", body: "Description A", meta: { phase: ["spec"], category: "requirements" } },
    { id: "b", title: "Rule B", body: "Description B", meta: { phase: ["spec"], category: "requirements" } },
    { id: "c", title: "Rule C", body: "Description C", meta: { phase: ["spec"], category: "requirements" } },
  ];

  it("includes all spec-phase guardrails even with exemptions section in spec", () => {
    const spec = "## Guardrail Exemptions\n- Rule B \u2014 reason\n\n## Requirements\n- R1\n";
    const prompt = buildGuardrailPrompt(spec, guardrails, "spec");
    assert.ok(prompt.includes("Rule A"));
    assert.ok(prompt.includes("Rule B"), "Rule B should NOT be filtered out");
    assert.ok(prompt.includes("Rule C"));
    assert.ok(!prompt.includes("Exempted Articles"), "should not have Exempted Articles section");
  });

  it("includes inapplicable instruction", () => {
    const prompt = buildGuardrailPrompt("## Requirements\n- R1\n", guardrails, "spec");
    assert.ok(prompt.includes("inapplicable"), "should include inapplicable instruction");
  });
});

// ---------------------------------------------------------------------------
// buildGuardrailPrompt: diff-scope constraint for task-impl and integration
// ---------------------------------------------------------------------------

describe("buildGuardrailPrompt diff-scope constraint (task-impl / integration)", () => {
  const implGuardrails = [
    {
      id: "no-sync-io",
      title: "No Sync I/O in Hot Paths",
      body: "Avoid sync I/O",
      meta: { phase: ["task-impl", "integration"], category: "code-quality" },
    },
  ];
  const DIFF_SCOPE_HEADING = "## Diff Scope Constraint";
  const CANONICAL_PHRASES = IMPL_DIFF_SCOPE_LINES.join("\n");

  it("embeds diff-scope heading in task-impl prompts", () => {
    const targetText = "## Spec\nR1\n\n## Git Diff\ndiff --git a/x.js b/x.js\n+new line\n";
    const prompt = buildGuardrailPrompt(targetText, implGuardrails, "task-impl");
    assert.ok(prompt, "task-impl prompt should be generated");
    assert.ok(prompt.includes(DIFF_SCOPE_HEADING));
  });

  it("embeds diff-scope heading in integration prompts", () => {
    const targetText = "## Spec\nR1\n\n## Git Diff\ndiff --git a/x.js b/x.js\n+new line\n";
    const prompt = buildGuardrailPrompt(targetText, implGuardrails, "integration");
    assert.ok(prompt, "integration prompt should be generated");
    assert.ok(prompt.includes(DIFF_SCOPE_HEADING));
  });

  it("embeds the full canonical diff-scope instruction block", () => {
    const targetText = "## Spec\nR1\n\n## Git Diff\ndiff --git a/x.js b/x.js\n+new line\n";
    const prompt = buildGuardrailPrompt(targetText, implGuardrails, "task-impl");
    assert.ok(
      prompt.includes(CANONICAL_PHRASES.trim()),
      "task-impl prompt should embed IMPL_DIFF_SCOPE_LINES verbatim",
    );
  });

  it("does not add diff-scope constraint to draft/spec/task-spec phase prompts", () => {
    const multiPhaseGuardrails = [
      {
        id: "rule-a",
        title: "Rule A",
        body: "Desc A",
        meta: { phase: ["draft", "spec", "task-spec", "task-impl", "integration"], category: "requirements" },
      },
    ];
    for (const phase of ["draft", "spec", "task-spec"]) {
      const prompt = buildGuardrailPrompt("content", multiPhaseGuardrails, phase);
      assert.ok(prompt, `${phase} prompt should be generated`);
      assert.ok(
        !prompt.includes(DIFF_SCOPE_HEADING),
        `${phase} prompt should not carry diff-scope heading`,
      );
    }
  });
});
