import { describe, it, afterEach, mock } from "node:test";
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
import { FLOW_COMMANDS } from "../../../../src/flow/registry.js";
import {
  canonicalReviewArtifactFindings,
  reviewArtifactFindingLists,
} from "../../../../src/flow/lib/run-review.js";
import {
  applyReviewEvidenceTransition,
  ReviewDisposition,
  ReviewEvidence,
} from "../../../../src/flow/lib/review-convergence.js";
import { ReviewFindingGateArtifact } from "../../../../src/flow/lib/finding-disposition-policy.js";
import {
  parseProposals,
  buildDraftReviewPrompt,
  buildSpecSummaryMarkdown,
  buildSpecReviewPrompt,
  buildSpecReviewRepairPrompt,
  buildDraftSystemPrompt,
  formatSpecReviewJson,
  formatSpecReviewMd,
  parseSpecReviewFindings,
  parseSpecReviewFindingsWithRepair,
  parseImplReviewFindings,
  filterImplReviewFindingsByScope,
  formatImplReviewMd,
  formatImplReviewJson,
  buildImplReviewPrompt,
  runImplReview,
  resolveReviewTarget,
  createReviewExcludeMatcher,
  collectTestFiles,
  filterProposalsByScope,
  collectTouchedFiles,
  applyTestFixes,
  formatTestReviewMd,
  buildTestReviewPrompt,
  buildGapAnalysisPrompt,
  buildTestFixPrompt,
  parseTestReviewFindings,
  TEST_REVIEW_PROMPT_CHAR_LIMIT,
  assertTestReviewPromptWithinLimit,
  runTestReviewWithDependencies,
  runActiveImplReviewWithDependencies,
  runLoopReviewWithDependencies,
  resolveMergeBase,
  loopProposalsToImplReviewJson,
  parseImplLoopProposals,
  buildDraftReviewArtifact,
  writeReviewAttemptHistory,
} from "../../../../src/flow/commands/review.js";

function assertAllMatch(text, patterns) {
  for (const pattern of patterns) assert.match(text, pattern);
}

function assertAllDoesNotMatch(text, patterns) {
  for (const pattern of patterns) assert.doesNotMatch(text, pattern);
}

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

const FLOW_CMD = join(process.cwd(), "src/senti.js");
const FLOW_CMD_ARGS_PREFIX = ["flow"];

class DraftRepairTargetCheckpoint {
  constructor() {
    this.disposition = "ADVISORY";
    this.blockingFindings = Object.freeze([]);
    this.advisoryFindings = Object.freeze([]);
    this.repairTargets = Object.freeze([Object.freeze({
      title: "Empty initial QA list",
      target: "qa[]",
      rationale: "Initial QA list is empty before answer collection",
      evidence: "qa[] is empty before any answer exists",
    })]);
    Object.freeze(this);
  }

  toProposal() {
    const [target] = this.repairTargets;
    return {
      title: target.title,
      file: null,
      body: [
        `**QA:** ${target.target}`,
        `**Issue:** ${target.evidence}`,
        `**Suggestion:** ${target.rationale}`,
        "**Classification:** repair_target",
      ].join("\n"),
    };
  }

  toRecordingArtifact(producedArtifact) {
    return {
      ...producedArtifact.toJSON(),
      disposition: this.disposition,
    };
  }
}

function recordCanonicalDraftEvidence({
  artifact,
  phase,
  artifactName,
  invocationId,
}) {
  const canonical = canonicalReviewArtifactFindings(artifact, phase, artifactName);
  const disposition = new ReviewDisposition({
    value: artifact.verdict,
    ...canonical,
  });
  const evidence = new ReviewEvidence({
    phase,
    taskId: null,
    treeSha: "1".repeat(40),
    provenance: {
      provider: "issue-454-fixture",
      invocationId,
      capturedAt: "2026-07-24T00:00:00.000Z",
    },
    disposition,
  });
  const flowState = {};
  const convergence = applyReviewEvidenceTransition(flowState, evidence, {
    configuredSemanticMaxAttempts: 4,
  });
  return { canonical, convergence, disposition, flowState };
}

describe("draft repair target canonical classification", () => {
  const repairTarget = Object.freeze({
    title: "Empty initial QA list",
    target: "qa[]",
    rationale: "Initial QA list is empty before answer collection",
    evidence: "qa[] is empty before any answer exists",
    classification: "repair_target",
  });

  for (const phase of ["draft-questions", "draft-coverage"]) {
    it(`records ${phase} repairTargets-only as completed advisory evidence`, () => {
      const artifact = {
        verdict: "ADVISORY",
        blockingFindings: [],
        advisoryFindings: [],
        repairTargets: [repairTarget],
      };
      const result = reviewArtifactFindingLists(artifact, phase);
      const recorded = recordCanonicalDraftEvidence({
        artifact,
        phase,
        artifactName: phase === "draft-coverage"
          ? "draft-review-coverage.json"
          : "draft-review-questions.json",
        invocationId: `${phase}-result-recording`,
      });

      assert.deepEqual(result.blocking, []);
      assert.deepEqual(result.advisory, [repairTarget]);
      assert.equal(recorded.disposition.value, "ADVISORY");
      assert.equal(recorded.disposition.advisoryFindings.length, 1);
      assert.equal(recorded.convergence.finalizedEvidenceAvailable, true);
      assert.equal(recorded.flowState.reviewConvergence.records.length, 1);
    });
  }

  it("preserves advisory findings and repair targets without creating blocking findings", () => {
    const advisoryFinding = {
      title: "Optional wording improvement",
      classification: "advisory",
    };
    const result = reviewArtifactFindingLists({
      blockingFindings: [],
      advisoryFindings: [advisoryFinding],
      repairTargets: [repairTarget],
    }, "draft-questions");

    assert.deepEqual(result.blocking, []);
    assert.deepEqual(result.advisory, [advisoryFinding, repairTarget]);
  });

  it("keeps an empty draft review empty for PASS", () => {
    const result = reviewArtifactFindingLists({
      blockingFindings: [],
      advisoryFindings: [],
      repairTargets: [],
    }, "draft-questions");

    assert.deepEqual(result, { blocking: [], advisory: [] });
  });

  it("does not reclassify blocking findings", () => {
    const blockingFinding = {
      title: "Missing required decision",
      classification: "blocking",
    };
    const result = reviewArtifactFindingLists({
      blockingFindings: [blockingFinding],
      advisoryFindings: [],
      repairTargets: [repairTarget],
    }, "draft-coverage");

    assert.deepEqual(result.blocking, [blockingFinding]);
    assert.deepEqual(result.advisory, [repairTarget]);
  });

  it("records multiple repair targets with unique fallback IDs and rejects true duplicates", () => {
    const secondRepairTarget = {
      ...repairTarget,
      title: "Question contains an embedded rationale",
      target: "q2",
      evidence: "q2 contains answer text",
    };
    const canonical = canonicalReviewArtifactFindings({
      blockingFindings: [],
      advisoryFindings: [],
      repairTargets: [repairTarget, secondRepairTarget],
    }, "draft-questions", "draft-review-questions.json");

    assert.deepEqual(
      canonical.advisoryFindings.map((finding) => finding.findingId),
      ["draft-questions-advisory-001", "draft-questions-advisory-002"],
    );
    assert.equal(new ReviewDisposition({
      value: "ADVISORY",
      ...canonical,
    }).advisoryFindings.length, 2);

    const duplicateCanonical = canonicalReviewArtifactFindings({
      blockingFindings: [],
      advisoryFindings: [],
      repairTargets: [repairTarget, repairTarget],
    }, "draft-questions", "draft-review-questions.json");
    assert.throws(
      () => new ReviewDisposition({
        value: "ADVISORY",
        ...duplicateCanonical,
      }),
      /duplicate fingerprint/,
    );
  });

  it("normalizes colliding provider identities for distinct findings", () => {
    const duplicateIdentity = "a".repeat(64);
    const canonical = canonicalReviewArtifactFindings({
      verdict: "REJECTED",
      blockingFindings: [
        {
          title: "Missing stale scenario evidence coverage",
          issue: "Scenario evidence at the rewind boundary is not covered.",
          findingId: duplicateIdentity,
          fingerprint: duplicateIdentity,
        },
        {
          title: "Missing stale test execution evidence coverage",
          issue: "Test execution evidence at the rewind boundary is not covered.",
          findingId: duplicateIdentity,
          fingerprint: duplicateIdentity,
        },
      ],
    }, "test", "test-review.json");

    assert.deepEqual(
      canonical.blockingFindings.map((finding) => finding.findingId),
      [duplicateIdentity, "test-blocking-002"],
    );
    assert.notEqual(
      canonical.blockingFindings[0].fingerprint,
      canonical.blockingFindings[1].fingerprint,
    );
    assert.equal(new ReviewDisposition({
      value: "REJECTED",
      ...canonical,
    }).blockingFindings.length, 2);
    assert.notEqual(canonical.blockingFindings[0].findingId, canonical.blockingFindings[1].findingId);
    assert.notEqual(canonical.blockingFindings[0].fingerprint, canonical.blockingFindings[1].fingerprint);
  });
});

describe("FLOW_STEPS includes impl-review", () => {
  it("has impl-review between implement and finalize-commit", () => {
    const implIdx = FLOW_STEPS.indexOf("implement");
    const reviewIdx = FLOW_STEPS.indexOf("impl-review");
    const finalIdx = FLOW_STEPS.indexOf("finalize-commit");
    assert.ok(reviewIdx > 0, "impl-review step exists");
    assert.ok(reviewIdx > implIdx, "impl-review comes after implement");
    assert.ok(finalIdx > 0, "finalize-commit step exists");
    assert.ok(reviewIdx < finalIdx, "impl-review comes before finalize-commit");
  });
});

describe("draft repair target checkpoint replay", () => {
  it("records the exact R8 ADVISORY fixture once and advances through the production triage hook without review AI", async () => {
    const tmp = createTmpDir("draft-repair-target-checkpoint-");
    const specDir = path.join(tmp, "specs/demo");
    fs.mkdirSync(specDir, { recursive: true });
    const checkpoint = new DraftRepairTargetCheckpoint();
    const agentCall = mock.method(Agent.prototype, "call", () => {
      throw new Error("review AI must not run while replaying finalized checkpoint evidence");
    });
    const transitions = [];
    const flowState = {
      currentTaskId: null,
      steps: [
        { id: "draft-questions-review", status: "in_progress" },
        { id: "draft-questions-triage", status: "pending" },
        { id: "draft-questions-repair", status: "pending" },
      ],
      tasks: [],
    };
    const flowManager = {
      appendMetric() {},
      updateStepStatus(transition) {
        transitions.push({
          stepId: transition.stepId,
          status: transition.requestedStatus,
        });
        flowState.steps.find((step) => step.id === transition.stepId).status =
          transition.requestedStatus;
      },
    };

    try {
      assert.equal(checkpoint.disposition, "ADVISORY");
      assert.deepEqual(checkpoint.blockingFindings, []);
      assert.deepEqual(checkpoint.advisoryFindings, []);
      assert.deepEqual(checkpoint.repairTargets, [{
        title: "Empty initial QA list",
        target: "qa[]",
        rationale: "Initial QA list is empty before answer collection",
        evidence: "qa[] is empty before any answer exists",
      }]);

      const producedArtifact = buildDraftReviewArtifact({
        raw: "FINALIZED_CHECKPOINT_EVIDENCE",
        draftPath: "draft.json",
        proposals: [checkpoint.toProposal()],
        stage: {
          retryPhase: "draft-questions",
          reviewPhase: "draft-questions-review",
          findingClassification: "repair_target",
        },
      });
      assert.equal(producedArtifact.verdict, checkpoint.disposition);
      assert.equal(producedArtifact.phase, "draft-questions");
      assert.deepEqual(producedArtifact.blockingFindings, []);
      assert.deepEqual(producedArtifact.advisoryFindings, []);
      assert.equal(producedArtifact.repairTargets.length, 1);

      const written = writeReviewAttemptHistory({
        specDir,
        phase: "draft-questions",
        latestBasename: "draft-review-questions.json",
        artifact: checkpoint.toRecordingArtifact(producedArtifact),
        attemptNumber: 1,
      });
      const recordedArtifact = JSON.parse(fs.readFileSync(written.latestPath, "utf8"));
      const historyArtifact = JSON.parse(fs.readFileSync(written.historyJsonPath, "utf8"));
      const recorded = recordCanonicalDraftEvidence({
        artifact: recordedArtifact,
        phase: "draft-questions",
        artifactName: "draft-review-questions.json",
        invocationId: "checkpoint-result-recording",
      });

      assert.equal(recordedArtifact.verdict, checkpoint.disposition);
      assert.equal(recordedArtifact.disposition, "ADVISORY");
      assert.equal(historyArtifact.findings.length, 1);
      assert.equal(recorded.disposition.value, "ADVISORY");
      assert.equal(recorded.disposition.advisoryFindings.length, 1);
      assert.equal(recorded.convergence.finalizedEvidenceAvailable, true);
      assert.deepEqual(historyArtifact.findings[0], {
        id: "draft-questions-001-non-blocking-001",
        findingId: "draft-questions-001-non-blocking-001",
        phase: "draft-questions",
        sourceArtifact: "draft-review-questions.json",
        attempt: 1,
        severity: "non-blocking",
        title: "Empty initial QA list",
        body: "Initial QA list is empty before answer collection",
        category: "repair_target",
        target: "qa[]",
        evidence: "qa[] is empty before any answer exists",
        rationale: "Initial QA list is empty before answer collection",
      });
      assert.deepEqual(
        historyArtifact.findings[0].target,
        recordedArtifact.repairTargets[0].target,
      );
      assert.deepEqual(
        historyArtifact.findings[0].evidence,
        recordedArtifact.repairTargets[0].evidence,
      );

      await FLOW_COMMANDS.run.review.post({
        phase: "draft",
        flowState,
        flowManager,
      }, {
        artifacts: {
          phase: "draft",
          verdict: recordedArtifact.verdict,
          issueCount: historyArtifact.findings.length,
          retryPhase: historyArtifact.phase,
        },
      });

      assert.equal(agentCall.mock.callCount(), 0);
      assert.deepEqual(transitions, [{
        stepId: "draft-questions-review",
        status: "done",
      }]);
      assert.equal(flowState.steps[0].status, "done");
      assert.equal(flowState.steps[1].status, "pending");
      assert.equal(flowState.steps[2].status, "pending");
      assert.deepEqual(
        fs.readdirSync(path.join(specDir, "review-history")),
        ["draft-questions-attempt-001.json"],
      );
    } finally {
      agentCall.mock.restore();
      removeTmpDir(tmp);
    }
  });
});

describe("draft review artifact phases", () => {
  const proposal = {
    title: "Clarify the acceptance condition",
    file: null,
    body: "The draft needs one explicit acceptance condition.",
  };

  for (const { retryPhase, reviewPhase } of [
    { retryPhase: "draft-questions", reviewPhase: "draft-questions-review" },
    { retryPhase: "draft-coverage", reviewPhase: "draft-coverage-review" },
  ]) {
    it(`persists ${retryPhase} rather than ${reviewPhase}`, () => {
      const stage = { retryPhase, reviewPhase, findingClassification: "advisory" };
      const pass = buildDraftReviewArtifact({
        raw: "NO_PROPOSALS",
        draftPath: "draft.json",
        proposals: [],
        stage,
      });
      const advisory = buildDraftReviewArtifact({
        raw: "A review finding was recorded.",
        draftPath: "draft.json",
        proposals: [proposal],
        stage,
      });

      assert.equal(pass.phase, retryPhase);
      assert.equal(advisory.phase, retryPhase);
      assert.equal(advisory.verdict, "ADVISORY");
    });
  }
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
        env: { ...process.env, SENTI_WORK_ROOT: tmp },
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
    const removedLogOption = `--log-${"file"}`;
    assert.match(result, /--phase/);
    assert.match(result, /--agent-work-dir/);
    assert.ok(!result.includes(removedLogOption));
  });

  it("errors when no active flow with --phase test", () => {
    tmp = createTmpDir();
    try {
      execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "run", "review", "--phase", "test"], {
        encoding: "utf8",
        env: { ...process.env, SENTI_WORK_ROOT: tmp },
      });
      assert.fail("should exit non-zero");
    } catch (err) {
      const out = `${err.stdout || ""}${err.stderr || ""}`;
      assert.match(out, /no active flow/i);
    }
  });
});

describe("test-review spec-local file scope", () => {
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
    write(`${specDir}/spec.md`, "spec markdown");
    write(`${specDir}/tests/.raw/test-execution.log`, "raw execution log");
    write(`${specDir}/tests/helper.js`, "helper module");
    write(`${specDir}/tests/local.test.txt`, "text file");
    write(`${specDir}/tests/local.md`, "markdown file");
    write(`${specDir}/tests/project.test.js`, "spec local shadow");
    write(`${specDir}/tests/local.test.ts`, "spec local ts test");
    write(`${specDir}/tests/local.spec.mjs`, "spec local mjs");
    write(`${specDir}/tests/nested/local.spec.ts`, "nested spec local ts");

    const files = collectTestFiles(tmp, specDir);

    assert.deepEqual(
      files.map((f) => f.source).sort(),
      [
        `${specDir}/tests/local.spec.mjs`,
        `${specDir}/tests/local.test.ts`,
        `${specDir}/tests/nested/local.spec.ts`,
        `${specDir}/tests/project.test.js`,
      ].sort(),
    );
    assert.ok(files.every((f) => f.source.startsWith(`${specDir}/tests/`)));
    assert.ok(files.some((f) => f.content === "spec local shadow"));
    assert.ok(!files.some((f) => f.content === "project root test"));
    assert.ok(!files.some((f) => f.content === "spec markdown"));
    assert.ok(!files.some((f) => f.content === "raw execution log"));
    assert.ok(!files.some((f) => f.content === "helper module"));
    assert.ok(!files.some((f) => f.content === "text file"));
    assert.ok(!files.some((f) => f.content === "markdown file"));
  });

  it("keeps test design in systemPrompt for gap-analysis and fix prompts", () => {
    const testDesign = "TC-1: review-test input contract";
    const testFiles = [{
      source: "specs/demo/tests/review.test.js",
      content: "test('R1: collects local files', () => {});",
    }];
    const gapPrompt = buildGapAnalysisPrompt(testDesign, testFiles);
    const fixPrompt = buildTestFixPrompt(testDesign, "GAP-1", testFiles);

    for (const prompt of [gapPrompt, fixPrompt]) {
      assert.match(prompt.systemPrompt, /## Test Design/);
      assert.match(prompt.systemPrompt, /TC-1: review-test input contract/);
      assert.doesNotMatch(prompt.userPrompt, /## Test Design/);
      assert.doesNotMatch(prompt.userPrompt, /TC-1: review-test input contract/);
    }
  });

  it("enforces the test-review prompt limit before calling the agent", async () => {
    assert.equal(TEST_REVIEW_PROMPT_CHAR_LIMIT, 1_000_000);
    const overLimitPrompt = {
      systemPrompt: "x".repeat(TEST_REVIEW_PROMPT_CHAR_LIMIT),
      userPrompt: "y",
      fmtFallback: "",
    };
    let agentCalled = false;

    assert.throws(
      () => assertTestReviewPromptWithinLimit(overLimitPrompt, "test review"),
      /TEST_REVIEW_PROMPT_TOO_LARGE/,
    );
    await assert.rejects(
      () => runTestReviewWithDependencies({
        buildReviewPrompt: () => overLimitPrompt,
        callAgent: async () => {
          agentCalled = true;
          return "{}";
        },
      }),
      /TEST_REVIEW_PROMPT_TOO_LARGE/,
    );
    assert.equal(agentCalled, false);
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
      toolingOutcome: null,
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
    assert.match(combined, /origin/);
    assert.match(combined, /failureKind/);
    assert.match(combined, /Use null for origin or failureKind/);
    assert.match(combined, /Do not fail for advisory findings/);
    assert.match(combined, /does not auto-fix tests/i);
    assert.match(combined, /Requirement-to-Test Coverage Artifact/);

    const itemSchema = prompt.jsonSchema.properties.blockingFindings.items;
    assert.deepEqual([...itemSchema.required].sort(), Object.keys(itemSchema.properties).sort());
    assert.deepEqual(itemSchema.properties.origin.type, ["string", "null"]);
    assert.deepEqual(itemSchema.properties.failureKind.type, ["string", "null"]);
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

  it("accepts missing top-level test review findings arrays and rejects malformed items", () => {
    const empty = parseTestReviewFindings(JSON.stringify({}));
    assert.equal(empty.blocking.length, 0);
    assert.equal(empty.advisory.length, 0);

    const blockingOnly = parseTestReviewFindings(JSON.stringify({
      blockingFindings: [{
        title: "Missing coverage",
        target: "R2",
        issue: "R2 has no test.",
        requiredChange: "Add a spec-local test for R2.",
        whyBlocking: "Implementation would proceed without acceptance coverage.",
      }],
    }));
    assert.equal(blockingOnly.blocking.length, 1);
    assert.equal(blockingOnly.advisory.length, 0);

    const advisoryOnly = parseTestReviewFindings(JSON.stringify({
      advisoryFindings: [{
        title: "Extra boundary",
        target: "R1",
        improvement: "Add one more boundary case.",
        whyNonBlocking: "Current coverage is adequate for implementation.",
      }],
    }));
    assert.equal(advisoryOnly.blocking.length, 0);
    assert.equal(advisoryOnly.advisory.length, 1);

    assert.throws(
      () => parseTestReviewFindings(JSON.stringify({ blockingFindings: "none", advisoryFindings: [] })),
      /test review output failed schema validation/,
    );
    assert.throws(
      () => parseTestReviewFindings(JSON.stringify({
        blockingFindings: [{ title: "Missing required fields" }],
        advisoryFindings: [],
      })),
      /test review output failed schema validation/,
    );
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

  it("ignores provider preamble attached before the first proposal heading", async () => {
    const rawResponse = [
      "I’ll inspect the touched test file first.The path is unavailable under the agent work directory.### 1. Extract the Active Spec Path",
      "**File:** `tests/unit/flow/retry-recovery-convergence.test.js`",
      "**Requirement:** R1",
      "**Issue:** The test repeats the same spec path.",
      "**Suggestion:** Extract and reuse a local specPath constant.",
    ].join("\n");
    const requirementIds = new Set(["R1"]);
    const result = await runLoopReviewWithDependencies({
      groups: [{
        files: ["tests/unit/flow/retry-recovery-convergence.test.js"],
        representative: "tests/unit/flow/retry-recovery-convergence.test.js",
        diff: "+ test",
      }],
      buildChunkInput: () => "review input",
      reviewChunk: async () => rawResponse,
      crossCheck: async () => "NO_PROPOSALS",
      parseReviewProposals: (text) => parseImplLoopProposals(text, { requirementIds }),
      validateProviderOutput: true,
      requirementIds,
    });

    assert.equal(result.toolingOutcome, undefined);
    assert.equal(result.proposals.length, 1);
    assert.equal(result.proposals[0].title, "1. Extract the Active Spec Path");
    assert.equal(result.proposals[0].requirementId, "R1");
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
      goal: "Improve spec-review input.",
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
      acceptance_criteria: ["spec-review sees acceptance criteria"],
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
    assert.match(summary, /spec-review sees acceptance criteria/);
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
    assert.match(prompt.fmtFallback, /Always include both top-level arrays/);
    assert.match(combined, /Always include both top-level arrays/);
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

  it("treats omitted spec review finding arrays as empty arrays", () => {
    const empty = parseSpecReviewFindings("{}");
    assert.equal(empty.blocking.length, 0);
    assert.equal(empty.improvements.length, 0);

    const blockingOnly = parseSpecReviewFindings(JSON.stringify({ blockingFindings: [] }));
    assert.equal(blockingOnly.blocking.length, 0);
    assert.equal(blockingOnly.improvements.length, 0);

    const improvementsOnly = parseSpecReviewFindings(JSON.stringify({ nonBlockingImprovements: [] }));
    assert.equal(improvementsOnly.blocking.length, 0);
    assert.equal(improvementsOnly.improvements.length, 0);
  });

  it("repairs schema-invalid parsed spec review output with one bounded retry", async () => {
    let repairCalls = 0;
    const findings = await parseSpecReviewFindingsWithRepair(
      JSON.stringify({ blockingFindings: "not-array", nonBlockingImprovements: [] }),
      async ({ rawResponse, validationError, repairPrompt }) => {
        repairCalls += 1;
        assert.match(rawResponse, /not-array/);
        assert.match(validationError.message, /blockingFindings/);
        assert.match(repairPrompt.userPrompt, /Rewrite the existing spec-review response/);
        return JSON.stringify({ blockingFindings: [], nonBlockingImprovements: [] });
      },
    );

    assert.equal(repairCalls, 1);
    assert.equal(findings.blocking.length, 0);
    assert.equal(findings.improvements.length, 0);
  });

  it("rejects invalid spec review repair output", async () => {
    await assert.rejects(
      parseSpecReviewFindingsWithRepair(
        JSON.stringify({ blockingFindings: "not-array", nonBlockingImprovements: [] }),
        async () => JSON.stringify({ blockingFindings: "still-not-array", nonBlockingImprovements: [] }),
      ),
      /spec review output failed schema validation|blockingFindings/,
    );

    await assert.rejects(
      parseSpecReviewFindingsWithRepair(
        JSON.stringify({ blockingFindings: "not-array", nonBlockingImprovements: [] }),
        async () => "not json",
      ),
      /spec review output failed schema validation: repair response is invalid JSON/,
    );
  });

  it("builds a schema-repair-only spec review prompt", () => {
    const prompt = buildSpecReviewRepairPrompt(
      JSON.stringify({ blockingFindings: "not-array" }),
      new Error("blockingFindings must be array"),
    );
    const combined = `${prompt.systemPrompt || ""}\n${prompt.userPrompt || ""}\n${prompt.fmtFallback || ""}`;

    assert.ok(prompt.jsonSchema);
    assert.match(combined, /Rewrite the existing spec-review response/);
    assert.match(combined, /Do not re-review the spec/i);
    assert.match(combined, /blockingFindings must be array/);
    assert.match(combined, /Always include both top-level arrays/);
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
      verdict: "REJECTED",
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
    assert.equal(json.verdict, "REJECTED");
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
        considered: "Do not leak this considered field",
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
        considered: "coverage alternative",
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
        considered: "",
        droppedReason: "",
      },
    ],
  };

  it("omits answer fields from draft-questions-review input", () => {
    const prompt = buildDraftReviewPrompt(draftJson, "request", [], { key: "questions" });
    const leakedAnswerFieldPatterns = [
      /Do not leak this answer/,
      /Do not leak this evidence/,
      /Do not leak this rationale/,
      /Do not leak this considered field/,
    ];
    const coverageOnlyPatterns = [
      /Which acceptance criteria apply\?/,
      /Category coverage across/,
      /Missing first-pass questions/,
      /NEW for missing/,
    ];

    assert.match(prompt, /Which CLI behavior is in scope\?/);
    assert.doesNotMatch(prompt, /\*\*Answer:\*\*/);
    assertAllDoesNotMatch(prompt, leakedAnswerFieldPatterns);
    assertAllDoesNotMatch(prompt, coverageOnlyPatterns);
    assert.match(prompt, /one-shot finite structural check/);
    assert.match(prompt, /This is not a question generation task/);
    assert.match(prompt, /Do not identify missing first-pass questions/);
    assert.match(prompt, /Do not propose NEW QA entries/);
    assert.match(prompt, /total: 3/);
    assert.match(prompt, /answered: 1/);
  });

  it("limits draft-coverage-review input to answered and dropped QA", () => {
    const prompt = buildDraftReviewPrompt(draftJson, "request", [], { key: "coverage" });
    const renderedQaFieldPatterns = [
      /\*\*Answer:\*\* Keep this for coverage review/,
      /\*\*Evidence:\*\* coverage evidence/,
      /\*\*Why:\*\* coverage rationale/,
      /\*\*Considered:\*\* coverage alternative/,
    ];
    const omittedQuestionStagePatterns = [
      /Which CLI behavior is in scope\?/,
      /Should this approved question be hidden from coverage\?/,
      /Ambiguous user answers must be converted/,
      /unsupported answers/,
      /Propose only NEW follow-up questions/,
    ];

    assertAllMatch(prompt, renderedQaFieldPatterns);
    assertAllDoesNotMatch(prompt, omittedQuestionStagePatterns);
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

  it("renders empty considered as (none) in coverage review", () => {
    const prompt = buildDraftReviewPrompt({
      ...draftJson,
      qa: [{ ...draftJson.qa[1], considered: "" }],
    }, "request", [], { key: "coverage" });

    assert.match(prompt, /\*\*Considered:\*\* \(none\)/);
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

function createMandatoryLoopReviewFixture(prefix, file) {
  const root = createTmpDir(prefix);
  fs.mkdirSync(path.join(root, "specs/demo"), { recursive: true });
  fs.writeFileSync(path.join(root, "specs/demo/spec.json"), `${JSON.stringify({
    requirements: [{ id: "R1", priority: "must", desc: "Keep the implementation maintainable." }],
  }, null, 2)}\n`);
  return {
    root,
    flow: { spec: "specs/demo/spec.json" },
    reviewOutput: loopProposalsToImplReviewJson([{
      title: "Extract shared branch",
      body: "Extract the duplicated branch.",
      file,
      requirementId: "R1",
    }], new Set(["R1"])),
  };
}

function persistSelectedImplReview({ root, flow, touchedFiles, taskSpec = null }) {
  return (reviewOutput, persistence) => persistence
    ? persistence.persist({ root, flow, reviewOutput, touchedFiles, taskSpec })
    : runImplReview({ root, flow, reviewOutput, touchedFiles, taskSpec });
}

describe("impl review structured artifact helpers", () => {
  it("requires a typed disposition and rationale for every impl review finding", () => {
    const typedFinding = {
      findingKey: "missing-artifact",
      title: "Missing artifact",
      failureMode: "missing_acceptance_requirement",
      file: null,
      requirementId: "R4",
      issue: "impl-review.json is not written.",
      suggestion: "Write impl-review.json.",
      disposition: "must-fix",
      rationale: "R4 requires a machine-readable artifact.",
    };
    const parse = (entry) => parseImplReviewFindings(JSON.stringify({
      blockingFindings: [entry],
      nonBlockingImprovements: [],
    }), { requirementIds: new Set(["R4"]) });

    const parsed = parse(typedFinding);
    assert.equal(parsed.blockingFindings[0].disposition, "must-fix");

    for (const missingField of ["findingKey", "disposition", "rationale"]) {
      const invalid = { ...typedFinding };
      delete invalid[missingField];
      assert.throws(
        () => parse(invalid),
        new RegExp(`${missingField}.*(required|non-empty)`, "i"),
      );
    }
  });

  it("parses JSON findings and rejects legacy proposal markdown", () => {
    const parsed = parseImplReviewFindings(JSON.stringify({
      blockingFindings: [{
        findingKey: "missing-artifact",
        title: "Missing artifact",
        failureMode: "missing_acceptance_requirement",
        file: null,
        requirementId: "R4",
        issue: "impl-review.json is not written.",
        suggestion: "Write impl-review.json.",
        disposition: "must-fix",
        rationale: "The spec requires a machine-readable artifact.",
      }],
      nonBlockingImprovements: [{
        findingKey: "optional-naming",
        title: "Optional naming",
        failureMode: "naming",
        file: "src/flow/commands/review.js",
        requirementId: "R4",
        issue: "A local variable name could be clearer.",
        suggestion: "Rename it.",
        disposition: "informational",
        rationale: "Readability-only.",
      }],
    }), { requirementIds: new Set(["R4"]) });

    assert.equal(parsed.blockingFindings.length, 1);
    assert.equal(parsed.nonBlockingImprovements.length, 1);
    assert.throws(
      () => parseImplReviewFindings("### 1. Legacy proposal\n**File:** src/example.js", { requirementIds: new Set(["R4"]) }),
      /impl review output failed schema validation|Unexpected token|JSON/i,
    );
  });

  it("filters both blocking and non-blocking findings by touched scope", () => {
    const parsed = parseImplReviewFindings(JSON.stringify({
      blockingFindings: [
        {
          findingKey: "keep-missing-requirement",
          title: "Keep missing requirement",
          failureMode: "missing_acceptance_requirement",
          file: null,
          requirementId: "R4",
          issue: "Missing artifact.",
          suggestion: "Write it.",
          disposition: "must-fix",
          rationale: "Requirement blocker.",
        },
        {
          findingKey: "drop-outside",
          title: "Drop outside",
          failureMode: "spec_behavior_contradiction",
          file: "src/outside.js",
          requirementId: "R4",
          issue: "Outside diff.",
          suggestion: "Drop it.",
          disposition: "must-fix",
          rationale: "Out of scope.",
        },
      ],
      nonBlockingImprovements: [
        {
          findingKey: "keep-advisory",
          title: "Keep advisory",
          failureMode: "refactor",
          file: "src/flow/commands/review.js",
          requirementId: "R4",
          issue: "Optional touched-file issue.",
          suggestion: "Optional fix.",
          disposition: "informational",
          rationale: "Non-blocking.",
        },
        {
          findingKey: "drop-missing-file",
          title: "Drop missing file",
          failureMode: "refactor",
          file: "",
          requirementId: "R4",
          issue: "No file.",
          suggestion: "Drop it.",
          disposition: "informational",
          rationale: "Missing file.",
        },
      ],
    }), { requirementIds: new Set(["R4"]) });
    const filtered = filterImplReviewFindingsByScope({
      parsed,
      touchedFiles: new Set(["src/flow/commands/review.js"]),
      requirementIds: new Set(["R4"]),
    });

    assert.deepEqual(filtered.excluded, { missingFile: 1, outOfScope: 1 });
    assert.deepEqual(filtered.blockingFindings.map((item) => item.title), ["Keep missing requirement"]);
    assert.deepEqual(filtered.nonBlockingImprovements.map((item) => item.title), ["Keep advisory"]);
  });

  it("renders review.md and impl-review.json with advisory verdicts", () => {
    const input = {
      blockingFindings: [],
      nonBlockingImprovements: [{
        findingKey: "optional-cleanup",
        title: "Optional cleanup",
        failureMode: "refactor",
        file: "src/flow/lib/run-review.js",
        requirementId: "R4",
        issue: "A branch could be clearer.",
        suggestion: "Rename the branch.",
        disposition: "informational",
        rationale: "Readability-only.",
      }],
      excluded: { missingFile: 0, outOfScope: 0 },
    };
    const json = JSON.parse(formatImplReviewJson(input));
    const md = formatImplReviewMd(input);

    assert.equal(json.verdict, "ADVISORY");
    assert.deepEqual(json.summary, { blocking: 0, nonBlocking: 1, total: 1 });
    assert.match(json.nonBlockingImprovements[0].findingId, /^[a-f0-9]{64}$/);
    assert.match(md, /## Non-blocking Improvements/);
    assert.match(md, /Optional cleanup/);
  });

  it("persists explicit reject dispositions for advisory findings", async () => {
    const tmp = createTmpDir();
    try {
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/example.js"), "export const value = 1;\n");
      fs.mkdirSync(path.join(tmp, "specs/demo"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "specs/demo/spec.json"), JSON.stringify({
        requirements: [{ id: "R1", priority: "should" }],
      }));
      await runImplReview({
        root: tmp,
        flow: { spec: "specs/demo/spec.json" },
        touchedFiles: new Set(["src/example.js"]),
        reviewOutput: JSON.stringify({
          blockingFindings: [],
          nonBlockingImprovements: [{
            findingKey: "optional-cleanup",
            title: "Optional cleanup",
            failureMode: "refactor",
            file: "src/example.js",
            requirementId: "R1",
            issue: "The branch could be clearer.",
            suggestion: "Rename the branch.",
            disposition: "informational",
            rationale: "Readability-only.",
          }],
        }),
      });

      const review = JSON.parse(fs.readFileSync(path.join(tmp, "specs/demo/impl-review.json"), "utf8"));
      const triage = JSON.parse(fs.readFileSync(path.join(tmp, "specs/demo/impl-triage.json"), "utf8"));
      assert.equal(review.verdict, "ADVISORY");
      assert.match(review.nonBlockingImprovements[0].findingId, /^[a-f0-9]{64}$/);
      assert.deepEqual(
        triage.items.map(({ findingId, decision }) => ({ findingId, decision })),
        [{ findingId: review.nonBlockingImprovements[0].findingId, decision: "reject" }],
      );
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("persists apply and reject dispositions for mixed FAIL findings", async () => {
    const tmp = createTmpDir();
    try {
      fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "src/example.js"), "export const value = 1;\n");
      fs.mkdirSync(path.join(tmp, "specs/demo"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "specs/demo/spec.json"), JSON.stringify({
        requirements: [
          { id: "R1", priority: "must" },
          { id: "R2", priority: "should" },
        ],
      }));
      await runImplReview({
        root: tmp,
        flow: { spec: "specs/demo/spec.json" },
        touchedFiles: new Set(["src/example.js"]),
        reviewOutput: JSON.stringify({
          blockingFindings: [{
            findingKey: "behavior-mismatch",
            title: "Behavior mismatch",
            failureMode: "spec_behavior_contradiction",
            file: "src/example.js",
            requirementId: "R1",
            issue: "The behavior contradicts R1.",
            suggestion: "Implement R1.",
            disposition: "must-fix",
            rationale: "R1 is required.",
          }],
          nonBlockingImprovements: [{
            findingKey: "optional-cleanup",
            title: "Optional cleanup",
            failureMode: "refactor",
            file: "src/example.js",
            requirementId: "R2",
            issue: "The branch could be clearer.",
            suggestion: "Rename the branch.",
            disposition: "informational",
            rationale: "Readability-only.",
          }],
        }),
      });

      const review = JSON.parse(fs.readFileSync(path.join(tmp, "specs/demo/impl-review.json"), "utf8"));
      const triage = JSON.parse(fs.readFileSync(path.join(tmp, "specs/demo/impl-triage.json"), "utf8"));
      assert.deepEqual(
        triage.items.map(({ findingId, decision }) => ({ findingId, decision })),
        [
          { findingId: review.blockingFindings[0].findingId, decision: "apply" },
          { findingId: review.nonBlockingImprovements[0].findingId, decision: "reject" },
        ],
      );
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("builds prompts with the blocking and non-blocking policy", () => {
    const prompt = buildImplReviewPrompt({
      requirementFileMap: { R1: ["src/flow/commands/review.js"] },
      requirementIds: new Set(["R1"]),
      diff: "diff",
      touchedFiles: ["src/flow/commands/review.js"],
    });
    const combined = `${prompt.systemPrompt}\n${prompt.userPrompt}`;

    assert.match(combined, /blockingFindings\[\]/);
    assert.match(combined, /nonBlockingImprovements\[\]/);
    assert.match(combined, /missing_acceptance_requirement/);
    assert.match(combined, /spec_behavior_contradiction/);
    assert.match(combined, /security_or_data_integrity_bug/);
    assert.match(combined, /touched file/);
    assert.match(combined, /replacement action/);
    assert.match(combined, /requirementId is always required/);
    assert.match(combined, /findingKey/);
  });

  it("uses a strict-compatible JSON schema for optional impl review fields", () => {
    const prompt = buildImplReviewPrompt({ requirementIds: new Set(["R1"]) });
    const itemSchema = prompt.jsonSchema.properties.blockingFindings.items;
    const propertyKeys = Object.keys(itemSchema.properties).sort();

    assert.deepEqual([...itemSchema.required].sort(), propertyKeys);
    assert.deepEqual(itemSchema.properties.file.type, ["string", "null"]);
    assert.equal(itemSchema.properties.requirementId.type, "string");
    assert.deepEqual(itemSchema.properties.requirementId.enum, ["R1"]);
    assert.deepEqual(itemSchema.properties.disposition.enum, ["must-fix", "deferred", "informational"]);
  });

  it("assigns a stable findingKey to loop review proposals", () => {
    const proposal = {
      title: "Extract shared branch",
      body: "Extract the duplicated branch.",
      file: "src/example.js",
      requirementId: "R1",
    };
    const first = parseImplReviewFindings(
      loopProposalsToImplReviewJson([proposal], new Set(["R1"])),
      { requirementIds: new Set(["R1"]) },
    );
    const second = parseImplReviewFindings(
      loopProposalsToImplReviewJson([proposal], new Set(["R1"])),
      { requirementIds: new Set(["R1"]) },
    );

    assert.match(first.nonBlockingImprovements[0].findingKey, /^loop-[a-f0-9]{20}$/);
    assert.equal(
      first.nonBlockingImprovements[0].findingKey,
      second.nonBlockingImprovements[0].findingKey,
    );
  });

  it("persists trusted loop proposals as informational even when their requirement is mandatory", async () => {
    const fixture = createMandatoryLoopReviewFixture(
      "impl-loop-review-authority-",
      "src/example-0.js",
    );
    try {
      const touchedFiles = new Set(Array.from(
        { length: 10 },
        (_, index) => `src/example-${index}.js`,
      ));

      const result = await runActiveImplReviewWithDependencies({
        touchedFiles,
        shouldUseLoopReview: () => true,
        runLoopReview: async () => fixture.reviewOutput,
        runSingleReview: async () => assert.fail("single-shot review must not run"),
        persistImplReview: persistSelectedImplReview({ ...fixture, touchedFiles }),
      });
      const artifact = JSON.parse(fs.readFileSync(path.join(fixture.root, "specs/demo/impl-review.json"), "utf8"));
      const triage = JSON.parse(fs.readFileSync(path.join(fixture.root, "specs/demo/impl-triage.json"), "utf8"));

      assert.equal(result.artifacts.verdict, "ADVISORY");
      assert.equal(artifact.blockingFindings.length, 0);
      assert.equal(artifact.nonBlockingImprovements.length, 1);
      assert.equal(artifact.nonBlockingImprovements[0].requirementId, "R1");
      assert.equal(artifact.nonBlockingImprovements[0].disposition, "informational");
      assert.equal(triage.items[0].decision, "reject");
      assert.ok(fs.existsSync(path.join(fixture.root, "specs/demo/review-history/impl-attempt-001.json")));
      assert.match(artifact.repairFingerprint, /^[a-f0-9]{64}$/);
      assert.doesNotThrow(() => new ReviewFindingGateArtifact(artifact));
    } finally {
      removeTmpDir(fixture.root);
    }
  });

  it("does not select trusted persistence from loop-shaped JSON alone", async () => {
    const fixture = createMandatoryLoopReviewFixture(
      "impl-loop-review-untrusted-json-",
      "src/example-0.js",
    );
    try {
      const touchedFiles = new Set(Array.from(
        { length: 10 },
        (_, index) => `src/example-${index}.js`,
      ));

      await assert.rejects(
        () => runActiveImplReviewWithDependencies({
          touchedFiles,
          shouldUseLoopReview: () => true,
          runLoopReview: async () => String(fixture.reviewOutput),
          runSingleReview: async () => assert.fail("single-shot review must not run"),
          persistImplReview: persistSelectedImplReview({ ...fixture, touchedFiles }),
        }),
        /disposition informational conflicts with policy disposition must-fix/,
      );
    } finally {
      removeTmpDir(fixture.root);
    }
  });

  it("requires serializer capability instead of constructor or prototype identity", async () => {
    const fixture = createMandatoryLoopReviewFixture(
      "impl-loop-review-forged-output-",
      "src/example-0.js",
    );
    try {
      const arbitraryJson = String(fixture.reviewOutput).replace(
        "Extract shared branch",
        "Forged proposal",
      );
      assert.throws(
        () => new fixture.reviewOutput.constructor(arbitraryJson),
        /creation capability/,
      );

      const prototypeClone = Object.create(Object.getPrototypeOf(fixture.reviewOutput));
      assert.throws(() => String(prototypeClone), /private member|#value/);
      Object.defineProperty(prototypeClone, "toString", { value: () => arbitraryJson });
      const touchedFiles = new Set(Array.from(
        { length: 10 },
        (_, index) => `src/example-${index}.js`,
      ));

      await assert.rejects(
        () => runActiveImplReviewWithDependencies({
          touchedFiles,
          shouldUseLoopReview: () => true,
          runLoopReview: async () => prototypeClone,
          runSingleReview: async () => assert.fail("single-shot review must not run"),
          persistImplReview: persistSelectedImplReview({ ...fixture, touchedFiles }),
        }),
        /disposition informational conflicts with policy disposition must-fix/,
      );
    } finally {
      removeTmpDir(fixture.root);
    }
  });

  it("keeps direct single-shot persistence strict for loop-shaped informational output", async () => {
    const fixture = createMandatoryLoopReviewFixture(
      "impl-single-review-authority-",
      "src/example.js",
    );
    try {
      await assert.rejects(
        () => runImplReview({
          ...fixture,
          touchedFiles: new Set(["src/example.js"]),
        }),
        /disposition informational conflicts with policy disposition must-fix/,
      );
    } finally {
      removeTmpDir(fixture.root);
    }
  });

  it("keeps task review persistence strict for loop-shaped informational output", async () => {
    const fixture = createMandatoryLoopReviewFixture(
      "impl-task-review-authority-",
      "src/example.js",
    );
    try {
      await assert.rejects(
        () => runImplReview({
          ...fixture,
          touchedFiles: new Set(["src/example.js"]),
          taskSpec: { task: { id: "T-1" }, relPath: "specs/demo/tasks/T-1.md" },
        }),
        /disposition informational conflicts with policy disposition must-fix/,
      );
    } finally {
      removeTmpDir(fixture.root);
    }
  });

  it("uses strict persistence when the active branch selects single-shot review", async () => {
    const fixture = createMandatoryLoopReviewFixture(
      "impl-single-review-branch-",
      "src/example.js",
    );
    try {
      const touchedFiles = new Set(["src/example.js"]);
      let loopCalls = 0;
      let singleCalls = 0;

      await assert.rejects(
        () => runActiveImplReviewWithDependencies({
          touchedFiles,
          shouldUseLoopReview: () => false,
          runLoopReview: async () => {
            loopCalls += 1;
            return fixture.reviewOutput;
          },
          runSingleReview: async () => {
            singleCalls += 1;
            return fixture.reviewOutput;
          },
          persistImplReview: persistSelectedImplReview({ ...fixture, touchedFiles }),
        }),
        /disposition informational conflicts with policy disposition must-fix/,
      );
      assert.equal(loopCalls, 0);
      assert.equal(singleCalls, 1);
    } finally {
      removeTmpDir(fixture.root);
    }
  });

  it("aggregates a stable fingerprint and defers the must-fix finding at the bounded attempt", async () => {
    const tmp = createTmpDir("impl-review-disposition-");
    try {
      fs.mkdirSync(path.join(tmp, "specs/demo"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "specs/demo/spec.json"), `${JSON.stringify({
        requirements: [{ id: "R4", priority: "must", desc: "Write the review artifact." }],
      }, null, 2)}\n`);
      const finding = {
        findingKey: "missing-artifact",
        title: "Missing artifact",
        failureMode: "missing_acceptance_requirement",
        file: null,
        requirementId: "R4",
        issue: "impl-review.json is not written.",
        suggestion: "Write impl-review.json.",
        disposition: "must-fix",
        rationale: "R4 requires a machine-readable artifact.",
      };
      const flow = { spec: "specs/demo/spec.json" };
      const reviewOutput = JSON.stringify({
        blockingFindings: [finding, { ...finding }],
        nonBlockingImprovements: [],
      });

      await runImplReview({ root: tmp, flow, reviewOutput, touchedFiles: new Set() });
      await runImplReview({ root: tmp, flow, reviewOutput, touchedFiles: new Set() });
      await runImplReview({ root: tmp, flow, reviewOutput, touchedFiles: new Set() });
      const result = await runImplReview({ root: tmp, flow, reviewOutput, touchedFiles: new Set() });
      const artifact = JSON.parse(fs.readFileSync(path.join(tmp, "specs/demo/impl-review.json"), "utf8"));

      assert.equal(result.artifacts.verdict, "REJECTED");
      assert.equal(artifact.summary.total, 1);
      assert.equal(artifact.nonBlockingImprovements.length, 0);
      assert.equal(artifact.blockingFindings[0].disposition, "deferred");
      assert.equal(artifact.blockingFindings[0].repeatCount, 4);
      assert.equal(artifact.blockingFindings[0].findingId, artifact.blockingFindings[0].fingerprint);
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("keeps one fingerprint across wording changes and rejects same-key collisions", async () => {
    const tmp = createTmpDir("impl-review-finding-key-");
    try {
      fs.mkdirSync(path.join(tmp, "specs/demo"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "specs/demo/spec.json"), `${JSON.stringify({
        requirements: [{ id: "R1", priority: "must", desc: "Implement R1." }],
      })}\n`);
      const base = {
        findingKey: "r1-missing-branch",
        title: "Required branch is missing",
        failureMode: "maintainability",
        file: "src/example.js",
        requirementId: "R1",
        issue: "The R1 branch is absent.",
        suggestion: "Add the R1 branch.",
        disposition: "must-fix",
        rationale: "R1 makes this branch mandatory.",
      };
      const flow = { spec: "specs/demo/spec.json" };
      await runImplReview({
        root: tmp,
        flow,
        touchedFiles: new Set(["src/example.js"]),
        reviewOutput: JSON.stringify({ blockingFindings: [base], nonBlockingImprovements: [] }),
      });
      const first = JSON.parse(fs.readFileSync(path.join(tmp, "specs/demo/impl-review.json"), "utf8"));
      await runImplReview({
        root: tmp,
        flow,
        touchedFiles: new Set(["src/example.js"]),
        reviewOutput: JSON.stringify({
          blockingFindings: [{
            ...base,
            title: "R1 still lacks its branch",
            issue: "No R1-specific branch is present.",
          }],
          nonBlockingImprovements: [],
        }),
      });
      const second = JSON.parse(fs.readFileSync(path.join(tmp, "specs/demo/impl-review.json"), "utf8"));

      assert.equal(second.blockingFindings[0].fingerprint, first.blockingFindings[0].fingerprint);
      assert.equal(second.blockingFindings[0].repeatCount, 2);
      await assert.rejects(
        () => runImplReview({
          root: tmp,
          flow,
          touchedFiles: new Set(["src/example.js"]),
          reviewOutput: JSON.stringify({
            blockingFindings: [
              base,
              { ...base, title: "Different defect", issue: "A separate R1 defect." },
            ],
            nonBlockingImprovements: [],
          }),
        }),
        /findingKey collision/,
      );
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("derives the blocking bucket from requirement authority instead of trusting the model bucket", async () => {
    const tmp = createTmpDir("impl-review-policy-bucket-");
    try {
      fs.mkdirSync(path.join(tmp, "specs/demo"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "specs/demo/spec.json"), `${JSON.stringify({
        requirements: [{ id: "R1", priority: "must", desc: "Keep the implementation maintainable." }],
      }, null, 2)}\n`);
      const result = await runImplReview({
        root: tmp,
        flow: { spec: "specs/demo/spec.json" },
        touchedFiles: new Set(["src/example.js"]),
        reviewOutput: JSON.stringify({
          blockingFindings: [],
          nonBlockingImprovements: [{
            findingKey: "duplicated-mandatory-branch",
            title: "Duplicated mandatory branch",
            failureMode: "maintainability",
            file: "src/example.js",
            requirementId: "R1",
            issue: "The required branch is duplicated.",
            suggestion: "Extract the shared branch.",
            disposition: "must-fix",
            rationale: "R1 makes the maintainability constraint mandatory.",
          }],
        }),
      });
      const artifact = JSON.parse(fs.readFileSync(path.join(tmp, "specs/demo/impl-review.json"), "utf8"));

      assert.equal(result.artifacts.verdict, "REJECTED");
      assert.equal(artifact.blockingFindings.length, 1);
      assert.equal(artifact.blockingFindings[0].disposition, "must-fix");
      assert.equal(artifact.nonBlockingImprovements.length, 0);
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("defaults an unprioritized requirement to mandatory and keeps distinct findings separate", async () => {
    const tmp = createTmpDir("impl-review-distinct-authority-findings-");
    try {
      fs.mkdirSync(path.join(tmp, "specs/demo"), { recursive: true });
      fs.writeFileSync(path.join(tmp, "specs/demo/spec.json"), `${JSON.stringify({
        requirements: [{ id: "R1", desc: "Keep both required branches correct." }],
      }, null, 2)}\n`);
      const common = {
        failureMode: "maintainability",
        file: "src/example.js",
        requirementId: "R1",
        suggestion: "Repair the named branch.",
        disposition: "must-fix",
        rationale: "R1 makes both branches mandatory.",
      };
      await runImplReview({
        root: tmp,
        flow: { spec: "specs/demo/spec.json" },
        touchedFiles: new Set(["src/example.js"]),
        reviewOutput: JSON.stringify({
          blockingFindings: [
            { ...common, findingKey: "first-branch-missing", title: "First branch is missing", issue: "The first branch is absent." },
            { ...common, findingKey: "second-branch-stale", title: "Second branch returns stale data", issue: "The second branch is stale." },
          ],
          nonBlockingImprovements: [],
        }),
      });
      const artifact = JSON.parse(fs.readFileSync(path.join(tmp, "specs/demo/impl-review.json"), "utf8"));

      assert.equal(artifact.blockingFindings.length, 2);
      assert.equal(artifact.blockingFindings[0].disposition, "must-fix");
      assert.notEqual(
        artifact.blockingFindings[0].fingerprint,
        artifact.blockingFindings[1].fingerprint,
      );
    } finally {
      removeTmpDir(tmp);
    }
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

describe("resolveReviewTarget untracked spec tests", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("includes an active spec's untracked test source without flow artifacts", async () => {
    tmp = createTmpDir();
    fs.mkdirSync(join(tmp, "src"), { recursive: true });
    initTestRepo(tmp, { "src/base.js": "export const base = true;\n" });
    const baseSha = execFileSync("git", ["-C", tmp, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    fs.mkdirSync(join(tmp, "specs/demo/tests"), { recursive: true });
    fs.writeFileSync(join(tmp, "specs/demo/spec.json"), `${JSON.stringify({
      goal: "Review untracked spec tests.",
      scope: { in: [], out: [] },
      constraints: [],
      design_principles: [],
      overview: { modules: [], data_flow: [], decisions: [] },
      background: "Test fixture.",
      requirements: [],
      acceptance_criteria: [],
      clarifications: [],
      alternatives_considered: [],
      open_questions: [],
    })}\n`);
    fs.writeFileSync(join(tmp, "specs/demo/tests/bounded-recovery.test.js"), "// spec: R1\n");
    fs.writeFileSync(join(tmp, "specs/demo/issue-log.json"), '{"entries":[]}\n');

    const target = await resolveReviewTarget(tmp, { spec: "specs/demo/spec.json" }, baseSha);

    assert.ok(target.untrackedFiles.has("specs/demo/tests/bounded-recovery.test.js"));
    assert.match(target.diff, /bounded-recovery\.test\.js/);
    assert.doesNotMatch(target.diff, /issue-log\.json/);
  });

  it("applies configured exclusions to the fallback tracked diff", async () => {
    tmp = createTmpDir();
    fs.mkdirSync(join(tmp, "specs/demo"), { recursive: true });
    initTestRepo(tmp, {
      "base.js": "export const base = true;\n",
      "specs/demo/flow.json": "{\"version\":1}\n",
    });
    const baseSha = execFileSync("git", ["-C", tmp, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    fs.mkdirSync(join(tmp, "specs/demo"), { recursive: true });
    fs.writeFileSync(join(tmp, "specs/demo/spec.json"), `${JSON.stringify({
      goal: "Review configured exclusions.",
      scope: { in: [], out: [] },
      constraints: [],
      design_principles: [],
      overview: { modules: [], data_flow: [], decisions: [] },
      background: "Test fixture.",
      requirements: [],
      acceptance_criteria: [],
      clarifications: [],
      alternatives_considered: [],
      open_questions: [],
    })}\n`);
    fs.writeFileSync(join(tmp, "base.js"), "export const base = false;\n");
    fs.writeFileSync(join(tmp, "specs/demo/flow.json"), "{\"version\":2}\n");

    const exclusions = ["specs/"];
    const target = await resolveReviewTarget(
      tmp,
      { spec: "specs/demo/spec.json" },
      baseSha,
      createReviewExcludeMatcher({ root: tmp, exclusions }),
      exclusions,
    );

    assert.match(target.diff, /base\.js/);
    assert.doesNotMatch(target.diff, /specs\/demo\/flow\.json/);
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
