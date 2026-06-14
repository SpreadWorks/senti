// spec: R1 R2 R3 R4 R5 R6 R7

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..", "..", "..");

async function importRepoModule(relPath) {
  const file = path.join(repoRoot, relPath);
  assert.ok(fs.existsSync(file), `${relPath} must exist before this behavior can pass`);
  const url = pathToFileURL(file).href;
  return import(`${url}?spec295=${Date.now()}-${Math.random()}`);
}

function requireExport(module, name, type = "function") {
  assert.equal(typeof module[name], type, `${name} must be exported as a ${type}`);
  return module[name];
}

function assertIssueCodes(result, expectedCodes) {
  assert.ok(Array.isArray(result.issueCodes), "mechanical failure must expose issueCodes");
  assert.deepEqual([...result.issueCodes].sort(), [...expectedCodes].sort());
}

function makeTempSpecDir() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "senti-producer-contract-"));
  const specDir = path.join(root, "specs", "001-fixture");
  fs.mkdirSync(specDir, { recursive: true });
  return { root, specDir, specPath: "specs/001-fixture/spec.json" };
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function baseSpec(requirementStatus = "pending") {
  return {
    goal: "Fixture spec.",
    background: "",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements: [
      { id: "R1", desc: "First behavior.", priority: "must", status: requirementStatus },
      { id: "R2", desc: "Second behavior.", priority: "must", status: requirementStatus },
    ],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
    tasks: [],
  };
}

function flowState(specPath) {
  return {
    spec: specPath,
    baseBranch: "main",
    featureBranch: "feature/fixture",
    steps: [],
    metrics: [],
  };
}

test("R1: shared artifact completion executes normalize, validate, one repair, and revalidate", async () => {
  const completion = await importRepoModule("src/flow/lib/artifact-completion.js");
  const ArtifactCompletionSuccess = requireExport(completion, "ArtifactCompletionSuccess");
  const ArtifactCompletionMechanicalFailure = requireExport(completion, "ArtifactCompletionMechanicalFailure");
  const completeArtifactChange = requireExport(completion, "completeArtifactChange");

  const calls = [];
  const result = await completeArtifactChange({
    artifactName: "draft.json",
    load: () => {
      calls.push("load");
      return { ready: false };
    },
    normalize: (artifact) => {
      calls.push("normalize");
      return artifact;
    },
    validate: (artifact) => {
      calls.push(`validate:${artifact.ready ? "ready" : "missing"}`);
      return artifact.ready ? { ok: true } : { ok: false, issues: ["ready missing"] };
    },
    repair: (artifact, validation) => {
      calls.push(`repair:${validation.issues[0]}`);
      return { ...artifact, ready: true };
    },
  });

  assert.ok(result instanceof ArtifactCompletionSuccess);
  assert.deepEqual(calls, [
    "load",
    "normalize",
    "validate:missing",
    "repair:ready missing",
    "validate:ready",
  ]);
  assert.deepEqual(result.artifact, { ready: true });

  const unresolved = await completeArtifactChange({
    artifactName: "spec.json",
    load: () => ({ ready: false }),
    normalize: (artifact) => artifact,
    validate: () => ({ ok: false, issues: ["still invalid"] }),
    repair: (artifact) => artifact,
  });

  assert.ok(unresolved instanceof ArtifactCompletionMechanicalFailure);
  assert.equal(unresolved.artifactName, "spec.json");
  assert.deepEqual(unresolved.issues, ["still invalid"]);
});

test("R2: draft and spec producers block semantic guardrails until completion succeeds", async () => {
  const completion = await importRepoModule("src/flow/lib/artifact-completion.js");
  const gate = await importRepoModule("src/flow/lib/run-gate.js");
  const ArtifactCompletionSuccess = requireExport(completion, "ArtifactCompletionSuccess");
  const ArtifactCompletionMechanicalFailure = requireExport(completion, "ArtifactCompletionMechanicalFailure");
  const completeDraftArtifactChange = requireExport(completion, "completeDraftArtifactChange");
  const completeSpecArtifactChange = requireExport(completion, "completeSpecArtifactChange");
  const completeGateArtifactBeforeSemanticEvaluation = requireExport(gate, "completeGateArtifactBeforeSemanticEvaluation");
  const { root, specDir, specPath } = makeTempSpecDir();

  let semanticCalls = 0;
  const invalidCases = [
    {
      phase: "draft",
      completeArtifact: () => completeDraftArtifactChange({
        root,
        specDir,
        state: flowState(specPath),
        rawText: "{ malformed draft json",
      }),
      expectedIssueCodes: ["invalid-json"],
    },
    {
      phase: "draft",
      completeArtifact: () => completeDraftArtifactChange({
        root,
        specDir,
        state: flowState(specPath),
        artifact: {
          goal: "Fixture",
          questions: [{ id: "Q1", answer: "{{text}} unresolved" }],
          review: { verdict: "FAIL", triage: [] },
        },
      }),
      expectedIssueCodes: [
        "draft-schema-invalid",
        "draft-lifecycle-invalid",
        "review-triage-repair-audit-invalid",
        "unresolved-marker",
      ],
    },
    {
      phase: "spec",
      completeArtifact: () => completeSpecArtifactChange({
        root,
        specDir,
        state: flowState(specPath),
        rawText: "{ malformed spec json",
      }),
      expectedIssueCodes: ["invalid-json"],
    },
    {
      phase: "spec",
      completeArtifact: () => completeSpecArtifactChange({
        root,
        specDir,
        state: flowState(specPath),
        artifact: {
          goal: "Fixture",
          requirements: [
            { id: "R2", desc: "out of order", priority: "must", status: "pending" },
            { id: "R1", desc: "task monotonic fixture", priority: "must", status: "pending" },
          ],
          tasks: [
            { id: "T-2", title: "second", origin: "plan", added_round: 0 },
            { id: "T-1", title: "first", origin: "plan", added_round: 0 },
          ],
          repairAudit: { applied: false, unresolved: ["spec repair audit missing"] },
        },
      }),
      expectedIssueCodes: [
        "spec-schema-invalid",
        "task-monotonic-invalid",
        "spec-repair-audit-invalid",
      ],
    },
  ];

  for (const item of invalidCases) {
    const blocked = await completeGateArtifactBeforeSemanticEvaluation({
      phase: item.phase,
      completeArtifact: item.completeArtifact,
      evaluateSemanticGuardrail: () => {
        semanticCalls += 1;
        return { result: "pass" };
      },
    });
    assert.equal(semanticCalls, 0, `${item.phase} semantic guardrail must not run after mechanical failure`);
    assert.ok(blocked instanceof ArtifactCompletionMechanicalFailure);
    assertIssueCodes(blocked, item.expectedIssueCodes);
  }

  const allowed = await completeGateArtifactBeforeSemanticEvaluation({
    phase: "spec",
    completeArtifact: () => new ArtifactCompletionSuccess({
      artifactName: "spec.json",
      artifact: { requirements: [] },
    }),
    evaluateSemanticGuardrail: (completed) => {
      semanticCalls += 1;
      assert.ok(completed instanceof ArtifactCompletionSuccess);
      return { result: "pass", phase: "spec" };
    },
  });

  assert.equal(semanticCalls, 1);
  assert.deepEqual(allowed, { result: "pass", phase: "spec" });
});

test("R3: durable test artifact producers reuse completion while preserving trust checks", async () => {
  const completion = await importRepoModule("src/flow/lib/artifact-completion.js");
  const artifacts = await importRepoModule("src/flow/lib/test-artifacts.js");
  const ArtifactCompletionMechanicalFailure = requireExport(completion, "ArtifactCompletionMechanicalFailure");
  const completeScenarioValidityArtifactChange = requireExport(artifacts, "completeScenarioValidityArtifactChange");
  const completeTestExecuteArtifactChange = requireExport(artifacts, "completeTestExecuteArtifactChange");
  const completeTestResultReviewArtifactChange = requireExport(artifacts, "completeTestResultReviewArtifactChange");
  const { root, specDir, specPath } = makeTempSpecDir();
  writeJson(path.join(specDir, "spec.json"), baseSpec());

  const cases = [
    {
      complete: completeScenarioValidityArtifactChange,
      artifact: {
        version: "1",
        result: "pass",
        requirements: [{ id: "R1", classification: "not_run" }],
      },
      expectedIssueCodes: [
        "scenario-validity-schema-invalid",
        "scenario-validity-classification-not-expected-fail",
      ],
    },
    {
      complete: completeTestExecuteArtifactChange,
      artifact: {
        version: "2",
        command: "node --test fixture.test.js",
        exitCode: 0,
        result: "pass",
        requirements: [],
        rawOutputPath: "tests/.raw/test-execution.log",
      },
      expectedIssueCodes: [
        "raw-output-missing",
        "file-map-missing",
        "requirement-summary-missing",
        "regression-evidence-missing",
      ],
    },
    {
      complete: completeTestExecuteArtifactChange,
      prepare: () => {
        fs.mkdirSync(path.join(specDir, "tests", ".raw"), { recursive: true });
        fs.writeFileSync(path.join(specDir, "tests", ".raw", "range.log"), "line 1\nline 2\n");
        writeJson(path.join(specDir, "file-map.json"), { R1: ["src/a.js"], R2: ["src/b.js"] });
      },
      artifact: {
        version: "2",
        command: "node --test fixture.test.js",
        exitCode: 0,
        result: "pass",
        requirements: [
          { id: "R1", status: "pass", rawOutputLines: { start_line: 5, end_line: 8 } },
          { id: "R2", status: "pass", rawOutputLines: { start_line: 2, end_line: 1 } },
        ],
        rawOutputPath: "tests/.raw/range.log",
        regression: { started: true, result: "pass" },
      },
      expectedIssueCodes: ["raw-evidence-range-invalid"],
    },
    {
      complete: completeTestResultReviewArtifactChange,
      prepare: () => {
        fs.rmSync(path.join(specDir, "file-map.json"), { force: true });
      },
      artifact: {
        version: 1,
        verdict: "pass",
        checkedItems: [],
      },
      expectedIssueCodes: [
        "test-result-review-schema-invalid",
        "checked-items-empty",
        "file-map-missing",
        "regression-evidence-missing",
      ],
    },
  ];

  for (const item of cases) {
    if (item.prepare) item.prepare();
    const result = await item.complete({
      root,
      specDir,
      state: flowState(specPath),
      artifact: item.artifact,
    });
    assert.ok(result instanceof ArtifactCompletionMechanicalFailure);
    assertIssueCodes(result, item.expectedIssueCodes);
  }
});

test("R4: implement completion rejects missing observable readiness data", async () => {
  const setStep = await importRepoModule("src/flow/lib/set-step.js");
  const preValidateImplementStepCompletion = requireExport(setStep, "preValidateImplementStepCompletion");
  const { root, specDir, specPath } = makeTempSpecDir();
  writeJson(path.join(specDir, "spec.json"), baseSpec("pending"));

  const missing = await preValidateImplementStepCompletion({
    root,
    state: flowState(specPath),
    requestedStatus: "done",
  });

  assert.equal(missing.ok, false);
  assert.match(missing.errors.map((entry) => entry.code || entry.message || entry).join("\n"), /FILE_MAP|ARTIFACT|READINESS|VALIDATION/i);

  writeJson(path.join(specDir, "file-map.json"), { R1: ["src/a.js"], R2: ["src/b.js"] });
  fs.mkdirSync(path.join(specDir, "tests", ".raw"), { recursive: true });
  fs.writeFileSync(
    path.join(specDir, "tests", "fixture.test.js"),
    "test('R1 fixture', () => {});\ntest('R2 fixture', () => {});\n",
  );
  fs.writeFileSync(path.join(specDir, "tests", ".raw", "test-execution.log"), "R1 pass\nR2 pass\n");
  writeJson(path.join(specDir, "test-execute-result.json"), {
    version: "2",
    command: "node --test",
    exitCode: 0,
    result: "pass",
    raw_output_path: "tests/.raw/test-execution.log",
    summary: [
      {
        id: "R1",
        result: "pass",
        evidence: {
          command: "node --test specs/001-fixture/tests/fixture.test.js",
          test_file: "specs/001-fixture/tests/fixture.test.js",
          test_name: "R1 fixture",
          raw_output_lines: { start_line: 1, end_line: 1 },
        },
      },
      {
        id: "R2",
        result: "pass",
        evidence: {
          command: "node --test specs/001-fixture/tests/fixture.test.js",
          test_file: "specs/001-fixture/tests/fixture.test.js",
          test_name: "R2 fixture",
          raw_output_lines: { start_line: 2, end_line: 2 },
        },
      },
    ],
    regression: {
      required: false,
      category: "full-regression-deferred",
      reason: "full project regression deferred to final-regression",
      changed_files: [],
      trigger_relevant_changed_files: [],
      classified_paths: [],
    },
  });

  const pending = await preValidateImplementStepCompletion({
    root,
    state: flowState(specPath),
    requestedStatus: "done",
  });
  assert.equal(pending.ok, false);
  assertIssueCodes(pending.data, ["requirement-status-incomplete"]);

  writeJson(path.join(specDir, "spec.json"), baseSpec("done"));
  const ready = await preValidateImplementStepCompletion({
    root,
    state: flowState(specPath),
    requestedStatus: "done",
  });
  assert.equal(ready, null);
});

test("R5: retry counters are consumed only by AI semantic FAIL outcomes", async () => {
  const accounting = await importRepoModule("src/flow/lib/retry-accounting.js");
  const runGate = await importRepoModule("src/flow/lib/run-gate.js");
  const FailureKind = requireExport(accounting, "FailureKind", "object");
  const classifyPublicFlowFailure = requireExport(accounting, "classifyPublicFlowFailure");
  const recordReviewRetryOutcome = requireExport(accounting, "recordReviewRetryOutcome");
  const recordGateRetryOutcome = requireExport(accounting, "recordGateRetryOutcome");
  const readRetryCount = requireExport(accounting, "readRetryCount");
  const updateGateRetryCounter = requireExport(runGate, "updateGateRetryCounter");

  const state = { metrics: [] };
  recordGateRetryOutcome({ state, phase: "spec", failureKind: FailureKind.MechanicalValidation });
  recordGateRetryOutcome({ state, phase: "spec", failureKind: FailureKind.Protocol });
  recordReviewRetryOutcome({ state, phase: "impl", failureKind: FailureKind.Tooling });
  recordReviewRetryOutcome({ state, phase: "impl", failureKind: FailureKind.OutputSchema });

  assert.equal(readRetryCount({ state, kind: "gate", phase: "spec" }), 0);
  assert.equal(readRetryCount({ state, kind: "review", phase: "impl" }), 0);

  recordGateRetryOutcome({ state, phase: "spec", failureKind: FailureKind.AiSemanticFail });
  recordReviewRetryOutcome({ state, phase: "impl", failureKind: FailureKind.AiSemanticFail });

  assert.equal(readRetryCount({ state, kind: "gate", phase: "spec" }), 1);
  assert.equal(readRetryCount({ state, kind: "review", phase: "impl" }), 1);

  const publicState = { metrics: [] };
  const protocol = classifyPublicFlowFailure({
    state: publicState,
    surface: "review:spec",
    failureKind: FailureKind.Protocol,
    artifact: { code: "PROTOCOL_FAILURE", message: "agent protocol failed" },
  });
  const schema = classifyPublicFlowFailure({
    state: publicState,
    surface: "gate:spec",
    failureKind: FailureKind.OutputSchema,
    artifact: { code: "EVALUATION_SCHEMA_ERROR", message: "invalid AI output" },
  });

  assert.equal(protocol.retryBudgetConsumed, false);
  assert.equal(schema.retryBudgetConsumed, false);
  assert.equal(readRetryCount({ state: publicState, kind: "review", phase: "spec" }), 0);
  assert.equal(readRetryCount({ state: publicState, kind: "gate", phase: "spec" }), 0);
  assert.deepEqual(protocol.envelope, { ok: false, code: "PROTOCOL_FAILURE", semantic: false });
  assert.deepEqual(schema.envelope, { ok: false, code: "EVALUATION_SCHEMA_ERROR", semantic: false });

  const gateMetrics = [];
  const gateCtx = {
    phase: "spec",
    flowManager: {
      appendMetric: (metric) => gateMetrics.push(metric),
    },
  };
  updateGateRetryCounter(gateCtx, {
    result: "fail",
    artifacts: { phase: "spec", failureKind: "mechanical", evaluations: [] },
  });
  updateGateRetryCounter(gateCtx, {
    result: "fail",
    artifacts: {
      phase: "spec",
      failureKind: "ai_semantic_fail",
      evaluations: [{ guardrail_id: "G1", result: "fail", reason: "semantic" }],
    },
  });
  assert.deepEqual(gateMetrics, [{ phase: "spec", counter: "gateRetry", delta: 1 }]);
});

test("R6: exhausted semantic findings are deferred with stable source ids and later summaries", async () => {
  const findings = await importRepoModule("src/flow/lib/flow-findings.js");
  const acceptance = await importRepoModule("src/flow/lib/acceptance-review-artifacts.js");
  const deferExhaustedSemanticFindings = requireExport(findings, "deferExhaustedSemanticFindings");
  const resolveRetryExhaustionForFlowStep = requireExport(findings, "resolveRetryExhaustionForFlowStep");
  const readFlowFindingsArtifact = requireExport(findings, "readFlowFindingsArtifact");
  const buildDeferredFindingsSummary = requireExport(findings, "buildDeferredFindingsSummary");
  const buildAcceptanceReviewArtifactFromEvidence = requireExport(acceptance, "buildAcceptanceReviewArtifactFromEvidence");
  const { root, specDir, specPath } = makeTempSpecDir();
  writeJson(path.join(specDir, "spec.json"), baseSpec());
  fs.mkdirSync(path.join(specDir, "tests"), { recursive: true });
  fs.writeFileSync(path.join(specDir, "tests", "deferred.test.js"), "test('deferred fixture', () => {});\n");
  writeJson(path.join(specDir, "scenario-validity-result.json"), { version: "1" });
  writeJson(path.join(specDir, "test-execute-result.json"), {
    version: "2",
    result: "pass",
    summary: [
      { id: "R1", result: "pass" },
      { id: "R2", result: "pass" },
    ],
  });
  writeJson(path.join(specDir, "test-result-review.json"), { verdict: "pass" });
  writeJson(path.join(specDir, "retro.json"), { result: "pass" });
  const sources = [
    {
      sourceStep: "draft-gate",
      sourceArtifact: "draft-gate-result.json",
      artifact: { evaluations: [{ guardrail_id: "DRAFT-R1", result: "fail", reason: "draft semantic fail" }] },
      expectedFirstId: "DRAFT-R1",
    },
    {
      sourceStep: "spec-review",
      sourceArtifact: "spec-review.json",
      artifact: {
        verdict: "FAIL",
        blocking: [
          { id: "B-1", title: "Missing check" },
          { title: "No explicit id" },
        ],
      },
      expectedFirstId: "B-1",
    },
    {
      sourceStep: "spec-review",
      sourceArtifact: "spec-review-blocking-findings.json",
      artifact: {
        verdict: "FAIL",
        blockingFindings: [
          { id: "BF-1", title: "Fallback blocking finding" },
          { title: "Fallback synthesized id" },
        ],
      },
      expectedFirstId: "BF-1",
    },
    {
      sourceStep: "spec-gate",
      sourceArtifact: "spec-gate-result.json",
      artifact: { evaluations: [{ guardrail_id: "SPEC-R1", result: "fail", reason: "spec semantic fail" }] },
      expectedFirstId: "SPEC-R1",
    },
    {
      sourceStep: "impl-review",
      sourceArtifact: "impl-review.json",
      artifact: { verdict: "FAIL", blockingFindings: [{ id: "IMPL-1", title: "impl finding" }] },
      expectedFirstId: "IMPL-1",
    },
    {
      sourceStep: "impl-review",
      sourceArtifact: "impl-review-comments.json",
      artifact: { verdict: "FAIL", comments: [{ id: "COMMENT-1", title: "comment finding" }] },
      expectedFirstId: "COMMENT-1",
    },
    {
      sourceStep: "impl-gate:task-impl",
      sourceArtifact: "task-impl-gate-result.json",
      artifact: { observations: [{ id: "TASK-1", severity: "blocking", message: "task impl finding" }] },
      expectedFirstId: "TASK-1",
    },
    {
      sourceStep: "impl-gate:integration",
      sourceArtifact: "impl-gate-result.json",
      artifact: { observations: [{ id: "INT-1", severity: "blocking", message: "integration finding" }] },
      expectedFirstId: "INT-1",
    },
  ];

  for (const source of sources) {
    writeJson(path.join(specDir, source.sourceArtifact), source.artifact);
    const deferred = deferExhaustedSemanticFindings({
      root,
      flowState: flowState(specPath),
      sourceStep: source.sourceStep,
      sourceArtifact: source.sourceArtifact,
      attempts: 5,
    });
    assert.equal(deferred.completed, true, `${source.sourceStep} should complete by deferring findings`);
    assert.equal(deferred.blockedByRetryExhaustionOnly, false);
    assert.equal(deferred.deferred[0].sourceFindingId, source.expectedFirstId);

    const stepResolution = resolveRetryExhaustionForFlowStep({
      root,
      flowState: flowState(specPath),
      surface: source.sourceStep,
      sourceArtifact: source.sourceArtifact,
      attempts: 5,
    });
    assert.equal(stepResolution.stepDisposition, "continue");
    assert.equal(stepResolution.retryExhaustionOnlyStop, false);
    assert.equal(stepResolution.deferredTo, "flow-findings.json");
  }

  const artifact = readFlowFindingsArtifact(specDir);
  assert.equal(artifact.entries.length, 10);
  assert.equal(artifact.entries[0].sourceFindingId, "DRAFT-R1");
  assert.equal(artifact.entries[1].sourceFindingId, "B-1");
  assert.match(artifact.entries[2].sourceFindingId, /^spec-review:/);
  assert.equal(artifact.entries[3].sourceFindingId, "BF-1");
  assert.match(artifact.entries[4].sourceFindingId, /^spec-review:/);

  const summary = buildDeferredFindingsSummary({ specDir });
  assert.equal(summary.count, 10);
  assert.deepEqual(summary.sourceSteps, [
    "draft-gate",
    "spec-review",
    "spec-gate",
    "impl-review",
    "impl-gate:task-impl",
    "impl-gate:integration",
  ]);
  assert.equal(summary.artifactPath, "flow-findings.json");

  const acceptanceArtifact = buildAcceptanceReviewArtifactFromEvidence({ specDir });
  assert.equal(acceptanceArtifact.deferredFindings.length, 10);
  assert.equal(acceptanceArtifact.deferredFindings[0].sourceStep, "draft-gate");
  assert.equal(acceptanceArtifact.deferredFindings[0].finalDisposition, "still_open");
  assert.equal(acceptanceArtifact.verdict, "amend_required");
});

test("R7: retained public surfaces execute producer-completion adapters without dropping legacy checks", async () => {
  const completion = await importRepoModule("src/flow/lib/artifact-completion.js");
  const ArtifactCompletionMechanicalFailure = requireExport(completion, "ArtifactCompletionMechanicalFailure");
  const listProducerCompletionSurfaces = requireExport(completion, "listProducerCompletionSurfaces");
  const getProducerCompletionAdapter = requireExport(completion, "getProducerCompletionAdapter");
  const { root, specDir, specPath } = makeTempSpecDir();
  writeJson(path.join(specDir, "spec.json"), baseSpec());

  const surfaceCases = [
    {
      surface: "gate:draft",
      input: { root, specDir, state: flowState(specPath), artifact: { goal: "Fixture", unresolved: "{{text}}" } },
      expectedIssueCodes: [
        "draft-schema-invalid",
        "draft-lifecycle-invalid",
        "draft-static-check-invalid",
        "draft-repair-audit-invalid",
        "unresolved-marker",
      ],
    },
    {
      surface: "gate:spec",
      input: { root, specDir, state: flowState(specPath), artifact: { requirements: [], tasks: [{ id: "T-2" }, { id: "T-1" }] } },
      expectedIssueCodes: [
        "spec-schema-invalid",
        "task-monotonic-invalid",
        "spec-repair-audit-invalid",
      ],
    },
    {
      surface: "gate:task-impl",
      input: { root, specDir, state: flowState(specPath), phase: "task-impl", artifact: { result: "fail", retry: "semantic" } },
      expectedIssueCodes: [
        "phase-keyed-retry-preserved",
        "failure-envelope-preserved",
        "progression-behavior-preserved",
      ],
    },
    {
      surface: "gate:integration",
      input: { root, specDir, state: flowState(specPath), phase: "integration", artifact: { result: "pass", placeholder: true } },
      expectedIssueCodes: [
        "phase-keyed-retry-preserved",
        "artifact-trust-placeholder-rejected",
        "regression-evidence-missing",
        "failure-envelope-preserved",
      ],
    },
    {
      surface: "review:spec",
      input: {
        root,
        specDir,
        state: flowState(specPath),
        artifact: { verdict: "FAIL", blocking: "not an array" },
        protocolFailure: { code: "PROTOCOL_FAILURE" },
      },
      expectedIssueCodes: [
        "review-artifact-schema-invalid",
        "protocol-failure-non-semantic",
        "semantic-retry-not-consumed",
      ],
    },
    {
      surface: "review:draft",
      input: {
        root,
        specDir,
        state: flowState(specPath),
        artifact: { verdict: "FAIL", proposals: "not an array" },
        protocolFailure: { code: "PROTOCOL_FAILURE" },
      },
      expectedIssueCodes: [
        "review-artifact-generation-preserved",
        "review-artifact-schema-invalid",
        "protocol-failure-non-semantic",
        "semantic-retry-not-consumed",
      ],
    },
    {
      surface: "review:test",
      input: {
        root,
        specDir,
        state: flowState(specPath),
        artifact: { verdict: "FAIL", coverage: "not an object" },
        outputSchemaFailure: { code: "EVALUATION_SCHEMA_ERROR" },
      },
      expectedIssueCodes: [
        "review-artifact-generation-preserved",
        "review-artifact-schema-invalid",
        "output-schema-failure-non-semantic",
        "semantic-retry-not-consumed",
      ],
    },
    {
      surface: "review:impl",
      input: {
        root,
        specDir,
        state: flowState(specPath),
        artifact: { verdict: "FAIL", blockingFindings: "not an array" },
        protocolFailure: { code: "PROTOCOL_FAILURE" },
      },
      expectedIssueCodes: [
        "review-artifact-generation-preserved",
        "review-artifact-schema-invalid",
        "protocol-failure-non-semantic",
        "semantic-retry-not-consumed",
      ],
    },
    {
      surface: "scenario-validity",
      input: { root, specDir, state: flowState(specPath), artifact: { version: "1", result: "pass", requirements: [] } },
      expectedIssueCodes: [
        "scenario-validity-schema-invalid",
        "scenario-validity-classification-not-expected-fail",
      ],
    },
    {
      surface: "test-execute",
      input: { root, specDir, state: flowState(specPath), artifact: { version: "2", result: "pass", rawOutputPath: "missing.log" } },
      expectedIssueCodes: [
        "raw-output-missing",
        "file-map-missing",
        "requirement-summary-missing",
        "placeholder-permission-missing",
        "regression-evidence-missing",
      ],
    },
    {
      surface: "test-result-review",
      input: { root, specDir, state: flowState(specPath), artifact: { verdict: "pass", checkedItems: [] } },
      expectedIssueCodes: [
        "test-result-review-schema-invalid",
        "checked-items-empty",
        "file-map-missing",
        "regression-evidence-missing",
      ],
    },
    {
      surface: "set-step:implement:done",
      input: { root, specDir, state: flowState(specPath), requestedStatus: "done" },
      expectedIssueCodes: [
        "requirement-status-incomplete",
        "file-map-missing",
        "durable-artifact-missing",
      ],
    },
  ];
  const registered = listProducerCompletionSurfaces();

  for (const { surface, input, expectedIssueCodes } of surfaceCases) {
    assert.ok(registered.includes(surface), `${surface} must remain registered`);
    const adapter = getProducerCompletionAdapter(surface);
    assert.equal(typeof adapter, "function");
    const result = await adapter(input);
    assert.ok(result instanceof ArtifactCompletionMechanicalFailure);
    assertIssueCodes(result, expectedIssueCodes);
  }
});
