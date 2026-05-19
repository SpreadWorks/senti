import { describe, it, afterEach } from "node:test";
import os from "os";
import fs from "fs";
import assert from "node:assert/strict";
import path, { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir } from "../../../helpers/tmp-dir.js";
import { FLOW_STEPS } from "../../../../src/lib/flow-helpers.js";
import { FlowManager } from "../../../../src/lib/flow-manager.js";
import { Agent } from "../../../../src/lib/agent.js";
import { ProviderRegistry } from "../../../../src/lib/provider.js";
import { Logger } from "../../../../src/lib/log.js";
import {
  parseProposals,
  buildDraftReviewPrompt,
  buildSpecSummaryMarkdown,
  buildSpecReviewPrompt,
  buildDraftSystemPrompt,
  formatSpecReviewJson,
  formatSpecReviewMd,
  parseSpecReviewFindings,
  collectTestFiles,
  filterProposalsByScope,
  collectTouchedFiles,
  applyTestFixes,
  formatTestReviewMd,
  buildTestReviewPrompt,
  parseTestReviewFindings,
  resolveMergeBase,
} from "../../../../src/flow/commands/review.js";

function resolveAgent(cfg, commandId) {
  const registry = new ProviderRegistry(cfg.agent?.providers || {});
  const agent = new Agent({
    config: cfg,
    paths: { root: process.cwd(), agentWorkDir: "/tmp" },
    registry,
    logger: new Logger({ logDir: os.tmpdir(), enabled: false }),
  });
  const resolved = agent.resolve(commandId);
  return resolved ? resolved.profile : null;
}

const FLOW_CMD = join(process.cwd(), "src/sdd-forge.js");
const FLOW_CMD_ARGS_PREFIX = ["flow"];

describe("FLOW_STEPS includes review", () => {
  it("has review between implement and finalize-commit", () => {
    const implIdx = FLOW_STEPS.indexOf("implement");
    const reviewIdx = FLOW_STEPS.indexOf("review");
    const finalIdx = FLOW_STEPS.indexOf("finalize-commit");
    assert.ok(reviewIdx > 0, "review step exists");
    assert.ok(reviewIdx > implIdx, "review comes after implement");
    assert.ok(finalIdx > 0, "finalize-commit step exists");
    assert.ok(reviewIdx < finalIdx, "review comes before finalize-commit");
  });
});

describe("flow run routes review action", () => {
  it("shows review in flow run help output", () => {
    const result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "run", "--help"], { encoding: "utf8" });
    assert.match(result, /review/);
  });
});

describe("flow run review CLI", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("errors when no active flow", () => {
    tmp = createTmpDir();
    try {
      execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "run", "review"], {
        encoding: "utf8",
        env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
      });
      assert.fail("should exit non-zero");
    } catch (err) {
      const out = `${err.stdout || ""}${err.stderr || ""}`;
      assert.match(out, /no active flow/i);
    }
  });
});

describe("flow run review --phase test CLI", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("passes --phase test through to review command", () => {
    const result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "run", "review", "--help"], { encoding: "utf8" });
    assert.match(result, /--phase/);
    assert.match(result, /--agent-work-dir/);
    assert.match(result, /--log-file/);
  });

  it("errors when no active flow with --phase test", () => {
    tmp = createTmpDir();
    try {
      execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "run", "review", "--phase", "test"], {
        encoding: "utf8",
        env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
      });
      assert.fail("should exit non-zero");
    } catch (err) {
      const out = `${err.stdout || ""}${err.stderr || ""}`;
      assert.match(out, /no active flow/i);
    }
  });
});

describe("review-test spec-local file scope", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function write(file, content) {
    const full = join(tmp, file);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }

  it("collects only spec-local test files and excludes project-level tests", () => {
    tmp = createTmpDir();
    const specDir = "specs/demo";
    write("tests/project.test.js", "project root test");
    write(`${specDir}/tests/project.test.js`, "spec local shadow");
    write(`${specDir}/tests/local.spec.mjs`, "spec local mjs");

    const files = collectTestFiles(tmp, specDir);

    assert.deepEqual(
      files.map((f) => f.source).sort(),
      [
        `${specDir}/tests/local.spec.mjs`,
        `${specDir}/tests/project.test.js`,
      ],
    );
    assert.ok(files.every((f) => f.source.startsWith(`${specDir}/tests/`)));
    assert.ok(files.some((f) => f.content === "spec local shadow"));
    assert.ok(!files.some((f) => f.content === "project root test"));
  });

  it("applies test fixes only under the current spec-local tests directory", () => {
    tmp = createTmpDir();
    const specDir = "specs/demo";
    const allowed = [
      `### FILE: ${specDir}/tests/generated.test.js`,
      "```",
      "import assert from \"node:assert/strict\";",
      "```",
    ].join("\n");

    assert.deepEqual(applyTestFixes(allowed, tmp, specDir), [
      `${specDir}/tests/generated.test.js`,
    ]);
    assert.equal(
      fs.readFileSync(join(tmp, specDir, "tests/generated.test.js"), "utf8"),
      "import assert from \"node:assert/strict\";\n",
    );

    const outside = [
      "### FILE: tests/project.test.js",
      "```",
      "should not be written",
      "```",
    ].join("\n");
    assert.throws(
      () => applyTestFixes(outside, tmp, specDir),
      /outside specs\/demo\/tests/,
    );
    assert.equal(fs.existsSync(join(tmp, "tests/project.test.js")), false);
  });

  it("formats blocking and advisory findings without undefined placeholders", () => {
    const md = formatTestReviewMd({
      verdict: "ADVISORY",
      coverageArtifact: "specs/demo/test-coverage.json",
      toolingFailure: null,
      blockingFindings: [],
      advisoryFindings: [{
        title: "Boundary case",
        target: "R1",
        improvement: "Add a boundary assertion when implementation details are known.",
        whyNonBlocking: "Existing tests cover the acceptance behavior.",
      }],
    });

    assert.match(md, /## Verdict: ADVISORY/);
    assert.match(md, /Boundary case/);
    assert.doesNotMatch(md, /undefined/);
  });

  it("asks for one-shot JSON blocking findings separately from advisory findings", () => {
    const coverageArtifact = {
      toPromptSummary() {
        return {
          requirements: [{ id: "R1", status: "covered", files: ["tests/example.test.js"] }],
          files: [{ file: "tests/example.test.js", headerIds: ["R1"], testNameIds: ["R1"] }],
        };
      },
    };
    const prompt = buildTestReviewPrompt(
      "- R1 [must]: Do x",
      coverageArtifact,
      [{ source: "specs/demo/tests/example.test.js", content: "// spec: R1\ntest('R1: does x', () => {});" }],
    );
    const combined = `${prompt.systemPrompt || ""}\n${prompt.userPrompt || ""}`;

    assert.ok(prompt.jsonSchema, "test review should provide a JSON schema to Agent");
    assert.match(prompt.fmtFallback, /Return only a JSON object/);
    assert.match(combined, /one-shot static test reviewer/);
    assert.match(combined, /blockingFindings\[\]/);
    assert.match(combined, /advisoryFindings\[\]/);
    assert.match(combined, /Do not fail for advisory findings/);
    assert.match(combined, /does not auto-fix tests/i);
    assert.match(combined, /Requirement-to-Test Coverage Artifact/);
  });

  it("parses JSON test review findings and rejects markdown gap output", () => {
    const parsed = parseTestReviewFindings(JSON.stringify({
      blockingFindings: [{
        title: "Missing coverage",
        target: "R2",
        issue: "R2 has no test.",
        requiredChange: "Add a spec-local test for R2.",
        whyBlocking: "Implementation would proceed without acceptance coverage.",
      }],
      advisoryFindings: [{
        title: "Extra boundary",
        target: "R1",
        improvement: "Add one more boundary case.",
        whyNonBlocking: "Current coverage is adequate for implementation.",
      }],
    }));

    assert.equal(parsed.blocking.length, 1);
    assert.equal(parsed.advisory.length, 1);
    assert.throws(() => parseTestReviewFindings("### GAP-1\nMissing"), /test review output failed schema validation|Unexpected token|JSON/i);
  });
});

describe("resolveAgent for flow.review", () => {
  it("resolves flow.review.draft independently from flow.review.final via profiles", () => {
    const cfg = {
      agent: {
        default: "claude",
        providers: {
          claude: { command: "claude", args: ["-p", "{{PROMPT}}"] },
          "claude/opus": { command: "claude", args: ["-p", "{{PROMPT}}", "--model", "opus"] },
          codex: { command: "codex", args: ["exec", "{{PROMPT}}"] },
        },
        useProfile: "review",
        profiles: {
          review: {
            "flow.review.draft": "codex",
            "flow.review.final": "claude/opus",
          },
        },
      },
    };
    const draft = resolveAgent(cfg, "flow.review.draft");
    assert.equal(draft.command, "codex");

    const final = resolveAgent(cfg, "flow.review.final");
    assert.equal(final.command, "claude");
    assert.ok(final.args.includes("opus"));
  });

  it("falls back to flow.review prefix when specific phase not configured via profiles", () => {
    const cfg = {
      agent: {
        default: "claude",
        providers: {
          claude: { command: "claude", args: ["-p", "{{PROMPT}}"] },
          codex: { command: "codex", args: ["exec", "{{PROMPT}}"] },
        },
        useProfile: "review",
        profiles: {
          review: { "flow.review": "codex" },
        },
      },
    };
    // flow.review.draft matches "flow.review" prefix
    const draft = resolveAgent(cfg, "flow.review.draft");
    assert.equal(draft.command, "codex");
  });

  it("falls back to default agent when no flow.review configured", () => {
    const cfg = {
      agent: {
        default: "claude",
        providers: {
          claude: { command: "claude", args: ["-p", "{{PROMPT}}"] },
        },
      },
    };
    const draft = resolveAgent(cfg, "flow.review.draft");
    assert.equal(draft.command, "claude");
  });
});

describe("parseProposals extracts file from **File:** marker (spec 201 R-P1/R-P3)", () => {
  it("returns file=<path> when body contains '**File:** `path`'", () => {
    const text = [
      "### 1. Title A",
      "**File:** `src/foo.js`",
      "**Issue:** something",
      "",
      "### 2. Title B",
      "**File:** src/bar.js",
      "**Issue:** another",
    ].join("\n");
    const proposals = parseProposals(text);
    assert.equal(proposals.length, 2);
    assert.equal(proposals[0].file, "src/foo.js");
    assert.equal(proposals[1].file, "src/bar.js");
  });

  it("returns file=null when body has no **File:** marker", () => {
    const text = "### 1. No file\n**Issue:** nothing to point at\n";
    const proposals = parseProposals(text);
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0].file, null);
  });
});

describe("buildDraftSystemPrompt enforces scope (spec 201 R-P2)", () => {
  it("includes an instruction restricting proposals to the diff target files", () => {
    const prompt = buildDraftSystemPrompt();
    assert.match(
      prompt,
      /diff|touched|changed/i,
      "prompt must mention diff/touched/changed scope constraint",
    );
    assert.match(
      prompt,
      /only|do not propose|out of scope|outside/i,
      "prompt must explicitly restrict suggestions",
    );
  });
});

describe("spec review classification helpers", () => {
  it("builds a review summary with acceptance, decisions, tasks, and unresolved items", () => {
    const longTail = "x".repeat(900);
    const summary = buildSpecSummaryMarkdown({
      goal: "Improve review-spec input.",
      background: "Existing review lacks some spec fields.",
      scope: { in: ["`src/flow/commands/review.js`"], out: ["No CLI flag changes"] },
      constraints: ["Keep prompt size bounded."],
      design_principles: ["Pass only blocking-review-relevant fields."],
      overview: {
        modules: [{ text: "Review command" }],
        data_flow: [{ text: "spec.json -> review summary -> reviewer" }],
        decisions: [{
          text: "Use structured review memory.",
          evidence: `This evidence should be present but truncated. ${longTail}`,
          consideredAlternatives: "Pass full spec.md to review.",
        }],
      },
      requirements: [{
        id: "R1",
        priority: "must",
        status: "pending",
        testable: false,
        desc: "Review should see acceptance criteria.",
      }],
      acceptance_criteria: ["review-spec sees acceptance criteria"],
      clarifications: [{ q: "Should review see prior answers?", a: "Yes, through bounded fields." }],
      alternatives_considered: [{ option: "Full spec.md input", reason: "Too much token growth." }],
      open_questions: ["Confirm whether live-provider behavior is in scope."],
      tasks: [{
        id: "T-1",
        title: "Enrich spec review summary",
        status: "pending",
        goal: "Expose task-level acceptance and test strategy.",
        acceptance: ["summary includes task acceptance"],
        test_strategy: `Unit test summary field projection. ${longTail}`,
      }],
    });

    assert.match(summary, /# Acceptance Criteria/);
    assert.match(summary, /review-spec sees acceptance criteria/);
    assert.match(summary, /# Clarifications/);
    assert.match(summary, /Q: Should review see prior answers\?/);
    assert.match(summary, /# Alternatives Considered/);
    assert.match(summary, /Option: Full spec\.md input/);
    assert.match(summary, /# Open Questions/);
    assert.match(summary, /Confirm whether live-provider behavior is in scope/);
    assert.match(summary, /## Decisions/);
    assert.match(summary, /evidence: This evidence should be present but truncated/);
    assert.match(summary, /testable=false/);
    assert.match(summary, /# Tasks/);
    assert.match(summary, /T-1: Enrich spec review summary/);
    assert.match(summary, /acceptance: summary includes task acceptance/);
    assert.match(summary, /test_strategy: Unit test summary field projection/);
    assert.doesNotMatch(summary, new RegExp(`x{800}`));
  });

  it("asks for JSON blocking findings separately from non-blocking improvements", () => {
    const prompt = buildSpecReviewPrompt("# Requirements\n- R1 [must]: Do x", []);
    const combined = `${prompt.systemPrompt || ""}\n${prompt.userPrompt || ""}`;

    assert.ok(prompt.jsonSchema, "spec review should provide a JSON schema to Agent");
    assert.match(prompt.fmtFallback, /Return only a JSON object/);
    assert.match(combined, /blockingFindings\[\]/);
    assert.match(combined, /nonBlockingImprovements\[\]/);
    assert.match(combined, /Do not fail the review for non-blocking improvements/);
    assert.match(combined, /Treat a concern as blocking only when/);
    assert.match(combined, /contradicts verified existing codebase behavior/);
    assert.match(combined, /no implementation target or integration point/);
    assert.match(combined, /no observable acceptance\/test basis/);
    assert.match(combined, /required error path, data path, or compatibility path/);
    assert.match(combined, /Two spec fields conflict/);
    assert.match(combined, /wording could be clearer/);
    assert.match(combined, /whyBlocking must name the concrete implementation, testing, safety, or compatibility failure/);
    assert.match(combined, /Gate-owned checks are not blocking findings/);
    assert.match(combined, /JSON schema, required\/empty fields, unresolved markers, tasks missing\/empty\/depth structure, and guardrail compliance/);
    assert.match(combined, /without codebase context, leave it to gate/);
    assert.match(combined, /This review is diagnostic/);
    assert.match(combined, /smallest spec-level correction/);
    assert.match(combined, /If a concern is gate-owned, omit it entirely/);
    assert.match(combined, /omits an impact on existing behavior/);
    assert.match(combined, /target/);
    assert.doesNotMatch(combined, /\*\*File:\*\* `<path>`/);
  });

  it("injects previous spec-review.json memory into the next prompt", () => {
    const previousReview = JSON.parse(formatSpecReviewJson({
      verdict: "ADVISORY",
      blocking: [],
      improvements: [{
        title: "Mention nearby helper",
        body: [
          "**Target:** src/lib/example.js",
          "**Improvement:** Mention this helper as related context.",
          "**Why non-blocking:** Implementation can proceed without it.",
        ].join("\n"),
      }],
    }));
    const prompt = buildSpecReviewPrompt("# Requirements\n- R1 [must]: Do x", [], {
      toPromptMemory() {
        return {
          verdict: previousReview.verdict,
          counts: previousReview.counts,
          acknowledgedNonBlockingImprovements: previousReview.nonBlockingImprovements,
        };
      },
    });

    assert.match(prompt.userPrompt, /## Previous Spec Review Memory/);
    assert.match(prompt.userPrompt, /Mention nearby helper/);
    assert.match(prompt.systemPrompt, /do not repeat acknowledged non-blocking improvements/i);
  });

  it("parses JSON findings and ignores response text outside the object", () => {
    const parsed = parseSpecReviewFindings([
      "preamble that should be ignored",
      JSON.stringify({
        blockingFindings: [{
          title: "Missing acceptance condition",
          target: "R1",
          issue: "R1 has no observable pass/fail behavior.",
          requiredChange: "Add an acceptance condition.",
          whyBlocking: "Tests cannot be designed.",
        }],
        nonBlockingImprovements: [{
          title: "Mention nearby helper",
          target: "src/lib/example.js",
          improvement: "Mention this helper as related context.",
          whyNonBlocking: "Implementation can proceed without it.",
        }],
      }),
      "trailing text that should be ignored",
    ].join("\n"));

    assert.equal(parsed.blocking.length, 1);
    assert.equal(parsed.blocking[0].title, "Missing acceptance condition");
    assert.equal(parsed.blocking[0].target, "R1");
    assert.equal(parsed.improvements.length, 1);
    assert.equal(parsed.improvements[0].title, "Mention nearby helper");
    assert.equal(parsed.improvements[0].target, "src/lib/example.js");
  });

  it("rejects markdown proposal output instead of treating it as blocking", () => {
    assert.throws(() => parseSpecReviewFindings([
      "### 1. Legacy proposal",
      "**File:** `src/example.js`",
      "**Issue:** Something is missing.",
      "**Suggestion:** Add it.",
    ].join("\n")), /spec review output failed schema validation|Unexpected token|JSON/i);
  });

  it("renders verdict, blocking findings, and non-blocking improvements separately", () => {
    const md = formatSpecReviewMd({
      verdict: "ADVISORY",
      blocking: [],
      improvements: [{ title: "Helpful detail", body: "**Target:** GLOBAL" }],
    });

    assert.match(md, /## Verdict: ADVISORY/);
    assert.match(md, /## Blocking Findings/);
    assert.match(md, /No blocking findings/);
    assert.match(md, /## Non-blocking Improvements/);
    assert.match(md, /Helpful detail/);
  });

  it("renders structured spec-review.json with counts and targets", () => {
    const json = JSON.parse(formatSpecReviewJson({
      verdict: "FAIL",
      blocking: [{
        title: "Missing acceptance condition",
        body: [
          "**Target:** R1",
          "**Issue:** R1 has no observable pass/fail behavior.",
          "**Required change:** Add an acceptance condition.",
          "**Why blocking:** Tests cannot be designed.",
        ].join("\n"),
      }],
      improvements: [{
        title: "Mention nearby helper",
        body: [
          "**Target:** src/lib/example.js",
          "**Improvement:** Mention this helper as related context.",
          "**Why non-blocking:** Implementation can proceed without it.",
        ].join("\n"),
      }],
    }));

    assert.equal(json.version, 1);
    assert.equal(json.phase, "spec");
    assert.equal(json.verdict, "FAIL");
    assert.deepEqual(json.counts, { blocking: 1, nonBlocking: 1, total: 2 });
    assert.equal(json.blockingFindings[0].target, "R1");
    assert.equal(json.nonBlockingImprovements[0].target, "src/lib/example.js");
  });
});

describe("buildDraftReviewPrompt stage-specific QA projection", () => {
  const draftJson = {
    decisionMap: {
      knownFacts: ["The CLI currently has a draft review stage"],
      decisionPoints: ["Decide whether draft coverage is blocking"],
      resolvedByProjectRules: ["Use existing flow step lifecycle"],
      requiresUserJudgment: ["Confirm the user-visible behavior"],
      deferredToSpec: ["Choose helper placement from existing code patterns"],
    },
    qa: [
      {
        id: "q1",
        status: "pending",
        category: "impact-scope",
        question: "Which CLI behavior is in scope?",
        answer: "Do not leak this answer",
        evidence: "Do not leak this evidence",
        why: "Do not leak this rationale",
        droppedReason: "Do not leak this dropped reason",
      },
      {
        id: "q2",
        status: "answered",
        category: "acceptance-criteria",
        question: "Which acceptance criteria apply?",
        answer: "Keep this for coverage review",
        evidence: "coverage evidence",
        why: "coverage rationale",
        droppedReason: "",
      },
      {
        id: "q3",
        status: "approved",
        category: "risk-migration-policy",
        question: "Should this approved question be hidden from coverage?",
        answer: "",
        evidence: "",
        why: "",
        droppedReason: "",
      },
    ],
  };

  it("omits answer fields from review-draft-questions input", () => {
    const prompt = buildDraftReviewPrompt(draftJson, "request", [], { key: "questions" });

    assert.match(prompt, /Which CLI behavior is in scope\?/);
    assert.doesNotMatch(prompt, /\*\*Answer:\*\*/);
    assert.doesNotMatch(prompt, /Do not leak this answer/);
    assert.doesNotMatch(prompt, /Do not leak this evidence/);
    assert.doesNotMatch(prompt, /Do not leak this rationale/);
    assert.doesNotMatch(prompt, /Which acceptance criteria apply\?/);
    assert.doesNotMatch(prompt, /Category coverage across/);
    assert.doesNotMatch(prompt, /Missing first-pass questions/);
    assert.doesNotMatch(prompt, /NEW for missing/);
    assert.match(prompt, /one-shot finite structural check/);
    assert.match(prompt, /This is not a question generation task/);
    assert.match(prompt, /Do not identify missing first-pass questions/);
    assert.match(prompt, /Do not propose NEW QA entries/);
    assert.match(prompt, /total: 3/);
    assert.match(prompt, /answered: 1/);
  });

  it("limits review-draft-coverage input to answered and dropped QA", () => {
    const prompt = buildDraftReviewPrompt(draftJson, "request", [], { key: "coverage" });

    assert.match(prompt, /\*\*Answer:\*\* Keep this for coverage review/);
    assert.match(prompt, /\*\*Evidence:\*\* coverage evidence/);
    assert.match(prompt, /\*\*Why:\*\* coverage rationale/);
    assert.doesNotMatch(prompt, /Which CLI behavior is in scope\?/);
    assert.doesNotMatch(prompt, /Should this approved question be hidden from coverage\?/);
    assert.doesNotMatch(prompt, /Ambiguous user answers must be converted/);
    assert.doesNotMatch(prompt, /unsupported answers/);
    assert.doesNotMatch(prompt, /Propose only NEW follow-up questions/);
    assert.match(prompt, /one-shot final check/);
    assert.match(prompt, /at most 3 highest-impact blocking gaps/);
    assert.match(prompt, /append QA entries/);
    assert.match(prompt, /If no blocking user decision is required/);
    assert.match(prompt, /pending: 1/);
    assert.match(prompt, /approved: 1/);
    assert.match(prompt, /answered: 1/);
    assert.match(prompt, /## Decision Map/);
    assert.match(prompt, /Decide whether draft coverage is blocking/);
    assert.match(prompt, /Confirm the user-visible behavior/);
  });
});

describe("filterProposalsByScope (spec 201 R-P1/R-P3)", () => {
  it("keeps proposals whose file is in the touched set", () => {
    const proposals = [
      { title: "A", body: "", file: "src/foo.js" },
      { title: "B", body: "", file: "src/bar.js" },
    ];
    const touched = new Set(["src/foo.js", "src/bar.js"]);
    const { kept, excluded } = filterProposalsByScope(proposals, touched);
    assert.equal(kept.length, 2);
    assert.equal(excluded.outOfScope, 0);
    assert.equal(excluded.missingFile, 0);
  });

  it("removes proposals whose file is not in the touched set (R-P1)", () => {
    const proposals = [
      { title: "InScope", body: "", file: "src/foo.js" },
      { title: "OutOfScope", body: "", file: "src/flow/lib/run-draft-task.js" },
    ];
    const touched = new Set(["src/foo.js"]);
    const { kept, excluded } = filterProposalsByScope(proposals, touched);
    assert.equal(kept.length, 1);
    assert.equal(kept[0].title, "InScope");
    assert.equal(excluded.outOfScope, 1);
  });

  it("removes proposals with no file (R-P3) and reports missingFile count", () => {
    const proposals = [
      { title: "WithFile", body: "", file: "src/foo.js" },
      { title: "NoFile", body: "", file: null },
    ];
    const touched = new Set(["src/foo.js"]);
    const { kept, excluded } = filterProposalsByScope(proposals, touched);
    assert.equal(kept.length, 1);
    assert.equal(kept[0].title, "WithFile");
    assert.equal(excluded.missingFile, 1);
  });
});

function initTestRepo(tmp, baseFiles) {
  execFileSync("git", ["-C", tmp, "init", "-q", "-b", "main"]);
  execFileSync("git", ["-C", tmp, "config", "user.email", "t@t"]);
  execFileSync("git", ["-C", tmp, "config", "user.name", "t"]);
  for (const [name, content] of Object.entries(baseFiles)) {
    fs.writeFileSync(join(tmp, name), content);
  }
  execFileSync("git", ["-C", tmp, "add", "."]);
  execFileSync("git", ["-C", tmp, "commit", "-q", "-m", "base"]);
}

describe("collectTouchedFiles (spec 201 R-P4)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns the set of files changed in committed diff vs baseRef", () => {
    tmp = createTmpDir();
    initTestRepo(tmp, { "a.js": "a\n", "b.js": "b\n" });
    const baseSha = execFileSync("git", ["-C", tmp, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    execFileSync("git", ["-C", tmp, "checkout", "-q", "-b", "feature"]);
    fs.writeFileSync(join(tmp, "a.js"), "a modified\n");
    execFileSync("git", ["-C", tmp, "add", "a.js"]);
    execFileSync("git", ["-C", tmp, "commit", "-q", "-m", "change a"]);

    const touched = collectTouchedFiles(tmp, baseSha);
    assert.ok(touched instanceof Set, "returns a Set");
    assert.ok(touched.has("a.js"), "includes changed file");
    assert.ok(!touched.has("b.js"), "excludes unchanged file");
  });

  it("includes staged-but-uncommitted changes", () => {
    tmp = createTmpDir();
    initTestRepo(tmp, { "a.js": "a\n" });
    const baseSha = execFileSync("git", ["-C", tmp, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    fs.writeFileSync(join(tmp, "c.js"), "c\n");
    execFileSync("git", ["-C", tmp, "add", "c.js"]);

    const touched = collectTouchedFiles(tmp, baseSha);
    assert.ok(touched.has("c.js"), "includes staged file");
  });
});

function createDivergedHistoryFixture(tmp) {
  initTestRepo(tmp, { "a.js": "a\n", "upstream.js": "u\n" });

  execFileSync("git", ["-C", tmp, "checkout", "-q", "-b", "feature"]);
  fs.writeFileSync(join(tmp, "a.js"), "a modified on feature\n");
  execFileSync("git", ["-C", tmp, "add", "a.js"]);
  execFileSync("git", ["-C", tmp, "commit", "-q", "-m", "feature change"]);

  execFileSync("git", ["-C", tmp, "checkout", "-q", "main"]);
  fs.writeFileSync(join(tmp, "upstream.js"), "u modified on main\n");
  execFileSync("git", ["-C", tmp, "add", "upstream.js"]);
  execFileSync("git", ["-C", tmp, "commit", "-q", "-m", "upstream-only commit"]);

  execFileSync("git", ["-C", tmp, "checkout", "-q", "feature"]);

  return {
    featureFile: "a.js",
    upstreamFile: "upstream.js",
    mergeBase: resolveMergeBase(tmp, "main"),
  };
}

describe("collectTouchedFiles with merge-base starting point (spec 223)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("excludes upstream-only commits when baseBranch has advanced beyond the merge-base", () => {
    tmp = createTmpDir();
    const { featureFile, upstreamFile, mergeBase } = createDivergedHistoryFixture(tmp);

    const touched = collectTouchedFiles(tmp, mergeBase);
    assert.ok(touched.has(featureFile), "includes branch-local change");
    assert.ok(
      !touched.has(upstreamFile),
      "excludes upstream-only change (baseBranch advanced beyond merge-base)",
    );
  });

  it("old behavior (baseBranch tip) would include upstream-only commits — confirms bug would re-appear without merge-base", () => {
    tmp = createTmpDir();
    const { upstreamFile, mergeBase } = createDivergedHistoryFixture(tmp);

    // Passing baseBranch tip ref (= main) reproduces the bug: touched includes upstream.js
    const touchedFromTip = collectTouchedFiles(tmp, "main");
    assert.ok(
      touchedFromTip.has(upstreamFile),
      "sanity: baseBranch tip includes upstream-only file (this is the bug spec 223 fixes at the caller layer)",
    );

    // Passing merge-base excludes it
    const touchedFromMergeBase = collectTouchedFiles(tmp, mergeBase);
    assert.ok(!touchedFromMergeBase.has(upstreamFile));
  });
});

describe("resolveMergeBase (spec 223)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns the SHA of the common ancestor between HEAD and baseBranch", () => {
    tmp = createTmpDir();
    initTestRepo(tmp, { "a.js": "a\n" });
    const baseCommit = execFileSync("git", ["-C", tmp, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();

    execFileSync("git", ["-C", tmp, "checkout", "-q", "-b", "feature"]);
    fs.writeFileSync(join(tmp, "a.js"), "a modified\n");
    execFileSync("git", ["-C", tmp, "add", "a.js"]);
    execFileSync("git", ["-C", tmp, "commit", "-q", "-m", "feature change"]);

    const mergeBase = resolveMergeBase(tmp, "main");
    assert.equal(mergeBase, baseCommit);
  });

  it("throws a non-silent error when no common ancestor exists (orphan branch)", () => {
    tmp = createTmpDir();
    initTestRepo(tmp, { "a.js": "a\n" });

    // Create an orphan branch with no shared history
    execFileSync("git", ["-C", tmp, "checkout", "--orphan", "orphan"]);
    execFileSync("git", ["-C", tmp, "rm", "-rf", "-q", "."]);
    fs.writeFileSync(join(tmp, "o.js"), "o\n");
    execFileSync("git", ["-C", tmp, "add", "o.js"]);
    execFileSync("git", ["-C", tmp, "commit", "-q", "-m", "orphan root"]);

    assert.throws(
      () => resolveMergeBase(tmp, "main"),
      (err) => /merge-base/.test(err.message),
      "must throw an error that mentions merge-base",
    );
  });

  it("throws when the base branch does not exist", () => {
    tmp = createTmpDir();
    initTestRepo(tmp, { "a.js": "a\n" });

    assert.throws(
      () => resolveMergeBase(tmp, "nonexistent-branch"),
      (err) => /merge-base/.test(err.message),
    );
  });
});

describe("resolveAgent for flow.review.test", () => {
  it("resolves flow.review.test when explicitly configured via profiles", () => {
    const cfg = {
      agent: {
        default: "claude",
        providers: {
          claude: { command: "claude", args: ["-p", "{{PROMPT}}"] },
          codex: { command: "codex", args: ["exec", "{{PROMPT}}"] },
        },
        useProfile: "review",
        profiles: {
          review: {
            "flow.review.test": "codex",
            "flow.review.draft": "claude",
          },
        },
      },
    };
    const testAgent = resolveAgent(cfg, "flow.review.test");
    assert.equal(testAgent.command, "codex");
  });

  it("falls back to flow.review prefix when flow.review.test not in profile", () => {
    const cfg = {
      agent: {
        default: "claude",
        providers: {
          claude: { command: "claude", args: ["-p", "{{PROMPT}}"] },
          codex: { command: "codex", args: ["exec", "{{PROMPT}}"] },
        },
        useProfile: "review",
        profiles: {
          review: { "flow.review": "codex" },
        },
      },
    };
    // flow.review.test matches "flow.review" prefix
    const testAgent = resolveAgent(cfg, "flow.review.test");
    assert.equal(testAgent.command, "codex");
  });

  it("falls back to agent.default when no flow.review configured", () => {
    const cfg = {
      agent: {
        default: "claude",
        providers: {
          claude: { command: "claude", args: ["-p", "{{PROMPT}}"] },
        },
      },
    };
    const testAgent = resolveAgent(cfg, "flow.review.test");
    assert.equal(testAgent.command, "claude");
  });
});
