// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11 R12 R13 R14 R15 R16 R17 R18
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const tempRoot = path.join(root, ".tmp");
fs.mkdirSync(tempRoot, { recursive: true });
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");
const readJson = (rel) => JSON.parse(read(rel));
const readJsonAbs = (abs) => JSON.parse(fs.readFileSync(abs, "utf8"));
const importRoot = (rel) => import(pathToFileURL(path.join(root, rel)).href);
const exists = (rel) => fs.existsSync(path.join(root, rel));

async function importExisting(rel) {
  assert.ok(exists(rel), `${rel} must exist`);
  return importRoot(rel);
}

function readExisting(rel) {
  assert.ok(exists(rel), `${rel} must exist`);
  return read(rel);
}

function readJsonExisting(rel) {
  return JSON.parse(readExisting(rel));
}

function assertTextMatches(text, regex, message) {
  assert.ok(regex.test(text), message);
}

function assertTextNotMatches(text, regex, message) {
  assert.equal(regex.test(text), false, message);
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function violationSection(body, violationName) {
  const start = body.search(new RegExp(`Violation:\\s*${escapeRegex(violationName)}`, "i"));
  assert.notEqual(start, -1, `violation section must exist: ${violationName}`);
  const rest = body.slice(start);
  const next = rest.slice(1).search(/\n\s*Violation:/i);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

function functionSource(source, name) {
  const idx = source.indexOf(`function ${name}`);
  assert.notEqual(idx, -1, `${name} must exist`);
  const nextExport = source.indexOf("\nexport function ", idx + 1);
  const nextPlain = source.indexOf("\nfunction ", idx + 1);
  const candidates = [nextExport, nextPlain].filter((value) => value > idx);
  const end = candidates.length > 0 ? Math.min(...candidates) : source.length;
  return source.slice(idx, end);
}

function validObservation(overrides = {}) {
  return {
    kind: "violation",
    failureMode: "guardrail-violation",
    requirementRef: "guardrail:no-overengineering",
    where: { file: "src/example.js", locator: "L10" },
    observed: "single-caller indirection without shared behavior",
    severity: "blocking",
    refs: ["R14"],
    ...overrides,
  };
}

function aiObservation(overrides = {}) {
  return {
    failureMode: "guardrail-violation",
    requirementRef: "guardrail:no-overengineering",
    where: { file: "src/example.js", locator: "L10" },
    observed: "single-caller indirection without shared behavior",
    ...overrides,
  };
}

test("R1: Observation, Diagnosis, and NextAction are class exports with JSON and markdown behavior", async () => {
  const mod = await importExisting("src/flow/lib/observation.js");
  for (const name of ["Observation", "Diagnosis", "NextAction"]) {
    assert.equal(typeof mod[name], "function", `${name} must be exported as a class`);
    assert.equal(typeof mod[name].fromJSON, "function", `${name}.fromJSON must exist`);
  }
  const observation = mod.Observation.fromJSON(validObservation());
  const constructedObservation = new mod.Observation(validObservation({ observed: "constructed directly" }));
  const diagnosis = new mod.Diagnosis({ summary: "one blocking observation", observations: [observation] });
  const nextAction = new mod.NextAction({ diagnosis, prescription: "gate-impl" });
  const diagnosisFromJson = mod.Diagnosis.fromJSON({
    summary: "json diagnosis",
    observations: [validObservation({ observed: "from diagnosis json" })],
  });
  const nextActionFromJson = mod.NextAction.fromJSON({
    diagnosis: diagnosisFromJson.toJSON(),
    prescription: "gate-impl",
  });
  assert.equal(typeof observation.toJSON, "function");
  assert.equal(typeof observation.toMarkdown, "function");
  assert.equal(typeof observation.signature, "function");
  assert.equal(constructedObservation.toJSON().observed, "constructed directly");
  assert.equal(typeof diagnosis.toJSON, "function");
  assert.equal(typeof diagnosis.toMarkdown, "function");
  assert.equal(typeof nextAction.toJSON, "function");
  assert.equal(typeof nextAction.toMarkdown, "function");
  assert.equal(diagnosisFromJson.toJSON().summary, "json diagnosis");
  assert.equal(diagnosisFromJson.toJSON().observations[0].observed, "from diagnosis json");
  assert.equal(nextActionFromJson.toJSON().diagnosis.observations[0].observed, "from diagnosis json");
  assert.equal(nextActionFromJson.toJSON().prescription, "gate-impl");
  assert.ok(observation.toMarkdown().includes("guardrail:no-overengineering"));
  assert.ok(diagnosis.toMarkdown().includes("one blocking observation"));
  assert.ok(nextAction.toMarkdown().includes("gate-impl"));
  assert.throws(() => new mod.NextAction({ diagnosis, prescription: "" }), /prescription/i);
});

test("R2: Observation JSON uses exactly the approved fields and rejects invalid shape", async () => {
  const { Observation } = await importExisting("src/flow/lib/observation.js");
  const observation = Observation.fromJSON(validObservation());
  assert.deepEqual(Object.keys(observation.toJSON()).sort(), [
    "failureMode",
    "kind",
    "observed",
    "refs",
    "requirementRef",
    "severity",
    "where",
  ]);
  assert.throws(() => Observation.fromJSON(validObservation({ extra: true })), /unknown|extra/i);
  assert.throws(() => Observation.fromJSON(validObservation({ kind: "note" })), /kind/i);
  assert.throws(() => Observation.fromJSON(validObservation({ severity: "critical" })), /severity/i);
  assert.throws(() => Observation.fromJSON(validObservation({ observed: "" })), /observed/i);
  assert.throws(() => Observation.fromJSON(validObservation({ refs: "R14" })), /refs/i);
  assert.throws(() => Observation.fromJSON(validObservation({ refs: ["R14", 12] })), /refs/i);
  assert.throws(() => Observation.fromJSON(validObservation({ where: { locator: "L10" } })), /where|file/i);
  assert.throws(() => Observation.fromJSON(validObservation({ where: { file: "", locator: "L10" } })), /where|file/i);
  assert.throws(() => Observation.fromJSON(validObservation({ where: { file: 12, locator: "L10" } })), /where|file/i);
  assert.throws(() => Observation.fromJSON(validObservation({ where: { file: "src/example.js", locator: "L10", extra: true } })), /where|extra/i);
  assert.throws(() => new Observation(validObservation({ severity: "critical" })), /severity/i);
  assert.throws(() => new Observation(validObservation({ observed: "" })), /observed/i);
  assert.throws(() => new Observation(validObservation({ refs: "R14" })), /refs/i);
  assert.throws(() => new Observation(validObservation({ refs: ["R14", 12] })), /refs/i);
  assert.throws(() => new Observation(validObservation({ where: { locator: "L10" } })), /where|file/i);
  assert.throws(() => new Observation(validObservation({ where: { file: "", locator: "L10" } })), /where|file/i);
  assert.throws(() => new Observation(validObservation({ where: { file: 12, locator: "L10" } })), /where|file/i);
  assert.throws(() => new Observation(validObservation({ where: { file: "src/example.js", locator: "L10", extra: true } })), /where|extra/i);
  assert.equal(Observation.fromJSON(validObservation({ where: null })).toJSON().where, null);
});

test("R3: failureMode enum and severity policy are enforced", async () => {
  const { Observation } = await importExisting("src/flow/lib/observation.js");
  const { buildGateReport } = await importRoot("src/flow/lib/run-gate.js");
  for (const failureMode of ["spec-impl-mismatch", "guardrail-violation"]) {
    assert.throws(
      () => Observation.fromJSON(validObservation({ failureMode, severity: "advisory" })),
      /severity|blocking/i,
    );
  }
  assert.doesNotThrow(() => Observation.fromJSON(validObservation({
    failureMode: "process-evidence-missing",
    severity: "advisory",
  })));
  const diffVerifiableProcessEvidence = Observation.processEvidenceMissing({
    requirementRef: "process:evidence",
    where: null,
    observed: "required command output evidence is absent from a changed artifact",
    diffVerifiable: true,
  });
  assert.equal(diffVerifiableProcessEvidence.toJSON().severity, "blocking");
  const nonDiffProcessEvidence = Observation.processEvidenceMissing({
    requirementRef: "process:evidence",
    where: null,
    observed: "review narration does not mention a command result",
    diffVerifiable: false,
  });
  assert.equal(nonDiffProcessEvidence.toJSON().severity, "advisory");
  assert.throws(
    () => Observation.processEvidenceMissing({
      requirementRef: "process:evidence",
      where: null,
      observed: "ambiguous process evidence",
      diffVerifiable: "yes",
    }),
    /diffVerifiable/i,
  );
  assert.throws(
    () => Observation.fromJSON(validObservation({
      failureMode: "process-evidence-missing",
      requirementRef: "process:ambient-evidence",
      observed: "general process narration is missing",
      severity: "blocking",
      refs: ["process:ambient-evidence"],
    })),
    /severity|advisory|diff/i,
  );
  assert.doesNotThrow(() => Observation.fromJSON(validObservation({
    failureMode: "process-evidence-missing",
    requirementRef: "process:diff-evidence",
    observed: "diff-verifiable command output evidence is missing",
    severity: "blocking",
    refs: ["process:diff-evidence"],
  })));
  assert.throws(
    () => Observation.fromJSON(validObservation({ failureMode: "test-phase-only" })),
    /failureMode/i,
  );
  for (const { level, phase } of [
    { level: "parent", phase: "draft" },
    { level: "parent", phase: "spec" },
    { level: "task", phase: "task-spec" },
    { level: "task", phase: "task-impl" },
    { level: "integration", phase: "integration" },
  ]) {
    const report = buildGateReport({
      level,
      phase,
      observations: [validObservation()],
      passPrescription: "complete-task",
      failPrescription: "gate-impl",
    });
    const observation = report.nextAction.diagnosis.observations[0];
    assert.ok(["spec-impl-mismatch", "guardrail-violation", "process-evidence-missing"].includes(observation.failureMode));
    assert.equal(observation.severity, "blocking");
  }
});

test("R4: gate-impl AI output accepts Observation fields and derives class-owned fields", async () => {
  const { buildGuardrailArticleEvalPrompt, parseGuardrailArticleEvaluation } = await importRoot("src/flow/lib/run-gate.js");
  const prompt = buildGuardrailArticleEvalPrompt(
    "diff text",
    [{
      id: "guardrail:no-overengineering",
      title: "No Overengineering",
      body: "Report concrete overengineering violations.",
    }],
    "task-impl",
  ).build().userPrompt;
  assertTextMatches(prompt, /failureMode[\s\S]*requirementRef[\s\S]*where[\s\S]*observed/, "gate-impl evaluator prompt must request only the AI-owned Observation fields");
  assertTextNotMatches(prompt, /"kind"|"severity"|"refs"/, "gate-impl evaluator prompt must not ask AI to emit class-derived fields in the JSON contract");

  const parsed = parseGuardrailArticleEvaluation(JSON.stringify({
    observations: [{
      failureMode: "guardrail-violation",
      requirementRef: "guardrail:no-overengineering",
      where: { file: "src/example.js" },
      observed: "duplicate shape introduced in two modules",
    }],
  }), ["guardrail:no-overengineering"]);
  assert.equal(parsed[0].kind, "violation");
  assert.equal(parsed[0].severity, "blocking");
  assert.deepEqual(parsed[0].refs, ["guardrail:no-overengineering"]);
});

test("R5: invalid Observation output is classified as retryable schema failure", async () => {
  const { evaluateGuardrailObservationsWithRetry, buildGateRetryExhaustedEnvelope } = await importRoot("src/flow/lib/run-gate.js");
  async function assertRetryableInvalidObservation(observation) {
    let calls = 0;
    const result = await evaluateGuardrailObservationsWithRetry({
      knownIds: ["guardrail:no-overengineering"],
      maxAttempts: 2,
      callAgent: async () => {
        calls += 1;
        return calls === 1
          ? JSON.stringify({ observations: [observation] })
          : JSON.stringify({ observations: [aiObservation()] });
      },
    });
    assert.equal(calls, 2, "one invalid Observation parse should consume one retry attempt");
    assert.equal(result.observations[0].failureMode, "guardrail-violation");
  }

  await assertRetryableInvalidObservation(aiObservation({ failureMode: "unknown-mode" }));
  await assertRetryableInvalidObservation(aiObservation({ requirementRef: "guardrail:unknown" }));
  const missingObserved = aiObservation();
  delete missingObserved.observed;
  await assertRetryableInvalidObservation(missingObserved);
  await assertRetryableInvalidObservation({
    ...aiObservation(),
    kind: "violation",
    severity: "blocking",
    refs: ["guardrail:no-overengineering"],
  });

  const expectedExhaustion = buildGateRetryExhaustedEnvelope({
    phase: "task-impl",
    attempts: 2,
    max: 2,
    reason: "invalid Observation output",
  });
  await assert.rejects(
    () => evaluateGuardrailObservationsWithRetry({
      knownIds: ["guardrail:no-overengineering"],
      maxAttempts: 2,
      phase: "task-impl",
      callAgent: async () => JSON.stringify({ observations: [aiObservation({ failureMode: "unknown-mode" })] }),
    }),
    (err) => {
      assert.equal(err.code, expectedExhaustion.errors[0].code);
      assert.deepEqual(err.retryExhaustionEnvelope?.errors, expectedExhaustion.errors);
      assert.deepEqual(err.retryExhaustionEnvelope?.data, expectedExhaustion.data);
      return true;
    },
  );
  const source = read("src/flow/lib/run-gate.js");
  assertTextMatches(functionSource(source, "checkRetryBelowMax"), /buildGateRetryExhaustedEnvelope/, "gate retry precheck must use the shared retry exhaustion path");
  assertTextMatches(functionSource(source, "evaluateGuardrailObservationsWithRetry"), /buildGateRetryExhaustedEnvelope/, "invalid Observation retry exhaustion must use the shared retry exhaustion path");
});

test("R6: gate report includes NextAction and aggregates blocking versus advisory observations", async () => {
  const { buildGateReport, buildGateResultArtifact } = await importRoot("src/flow/lib/run-gate.js");
  const failReport = buildGateReport({
    level: "task",
    phase: "task-impl",
    observations: [validObservation()],
    passPrescription: "complete-task",
    failPrescription: "gate-impl",
  });
  assert.equal(failReport.verdict, "fail");
  assert.equal(failReport.nextAction.prescription, "gate-impl");
  assert.equal(failReport.nextAction.diagnosis.observations[0].severity, "blocking");

  const passReport = buildGateReport({
    level: "task",
    phase: "task-impl",
    observations: [validObservation({
      failureMode: "process-evidence-missing",
      severity: "advisory",
    })],
    passPrescription: "complete-task",
    failPrescription: "gate-impl",
  });
  assert.equal(passReport.verdict, "pass");
  assert.equal(passReport.nextAction.prescription, "complete-task");
  assert.equal(passReport.nextAction.diagnosis.observations[0].severity, "advisory");

  const diffEvidenceReport = buildGateReport({
    level: "task",
    phase: "task-impl",
    observations: [validObservation({
      failureMode: "process-evidence-missing",
      requirementRef: "process:diff-evidence",
      observed: "diff-verifiable command output evidence is missing",
      severity: "blocking",
      refs: ["process:diff-evidence"],
    })],
    passPrescription: "complete-task",
    failPrescription: "gate-impl",
  });
  assert.equal(diffEvidenceReport.verdict, "fail");
  assert.equal(diffEvidenceReport.nextAction.prescription, "gate-impl");

  const failArtifact = buildGateResultArtifact({
    level: "task",
    phase: "task-impl",
    target: "diff",
    verdict: "fail",
    observations: [validObservation()],
    passPrescription: "complete-task",
    failPrescription: "gate-impl",
  });
  assert.equal(failArtifact.result, "fail");
  assert.equal(failArtifact.artifacts.nextAction.prescription, "gate-impl");
  assert.equal(failArtifact.artifacts.nextAction.diagnosis.observations[0].failureMode, "guardrail-violation");
  assert.equal("failedEvaluations" in failArtifact.artifacts, false);

  const passArtifact = buildGateResultArtifact({
    level: "task",
    phase: "task-impl",
    target: "diff",
    verdict: "pass",
    observations: [],
    passPrescription: "complete-task",
    failPrescription: "gate-impl",
  });
  assert.equal(passArtifact.result, "pass");
  assert.equal(passArtifact.artifacts.nextAction.prescription, "complete-task");
  assert.deepEqual(passArtifact.artifacts.nextAction.diagnosis.observations, []);

  const emptyReport = buildGateReport({
    level: "task",
    phase: "task-impl",
    observations: [],
    passPrescription: "complete-task",
    failPrescription: "gate-impl",
  });
  assert.equal(emptyReport.verdict, "pass");
  assert.equal(emptyReport.nextAction.prescription, "complete-task");
  assert.deepEqual(emptyReport.nextAction.diagnosis.observations, []);
});

test("R7: issue-log gate entries persist observations and omit failedEvaluations behavior memory", async () => {
  const { appendIssueLogFromGateResult } = await importRoot("src/flow/lib/run-gate.js");
  const tmp = fs.mkdtempSync(path.join(tempRoot, "spec-266-issue-log-"));
  try {
    const specRel = "specs/example/spec.json";
    const specDir = path.join(tmp, "specs/example");
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, "spec.json"), "{}");
    appendIssueLogFromGateResult({
      root: tmp,
      phase: "task-impl",
      flowState: { spec: specRel },
      gitState: { headSha: "h1", worktreeHash: "w1" },
    }, {
      result: "fail",
      artifacts: {
        phase: "task-impl",
        nextAction: {
          diagnosis: { summary: "blocking", observations: [validObservation()] },
          prescription: "gate-impl",
        },
      },
    });
    const entry = readJsonAbs(path.join(specDir, "issue-log.json")).entries[0];
    assert.deepEqual(entry.observations, [validObservation()]);
    assert.equal("failedEvaluations" in entry, false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("R7: no-progress, previous PASS lookup, and flip override use gateImplMemory behavior state", async () => {
  const {
    updateGateImplMemory,
    checkNoProgressSinceLastFail,
    findPreviousPassedGuardrails,
    applyFlipOverride,
  } = await importRoot("src/flow/lib/run-gate.js");
  const tmp = fs.mkdtempSync(path.join(tempRoot, "spec-266-behavior-memory-"));
  try {
    const specRel = "specs/example/spec.json";
    const specDir = path.join(tmp, "specs/example");
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, "spec.json"), "{}");
    const flowState = {
      spec: specRel,
      metrics: [{ phase: "task-impl", counter: "gateRetry", delta: 1 }],
    };
    updateGateImplMemory({
      root: tmp,
      flowState,
      phase: "task-impl",
      round: 1,
      status: "blocking",
      statusReason: "blocking observation",
      gitState: { headSha: "memory-head", worktreeHash: "memory-worktree" },
      passedGuardrails: ["guardrail:no-overengineering"],
      observations: [validObservation()],
    });
    const poisonedIssueLog = {
      entries: [{
        phase: "task-impl",
        headSha: "issue-log-head",
        worktreeHash: "issue-log-worktree",
        passedGuardrails: ["guardrail:poison"],
        failedEvaluations: [{ guardrail_id: "guardrail:poison", reason: "poison" }],
      }],
    };
    const currentState = { headSha: "memory-head", worktreeHash: "memory-worktree" };
    const noProgress = checkNoProgressSinceLastFail({
      flowState,
      issueLog: poisonedIssueLog,
      phase: "task-impl",
      currentState,
      ctx: { root: tmp, flowState },
    });
    assert.equal(noProgress?.errors?.[0]?.code, "NO_PROGRESS_SINCE_LAST_FAIL");

    const previousPass = findPreviousPassedGuardrails({ flowState, issueLog: poisonedIssueLog, phase: "task-impl" });
    assert.deepEqual(previousPass.passedGuardrails, ["guardrail:no-overengineering"]);
    assert.equal(previousPass.headSha, "memory-head");
    assert.equal(previousPass.worktreeHash, "memory-worktree");
    const flipped = applyFlipOverride({
      evaluations: [{
        guardrail_id: "guardrail:no-overengineering",
        result: "fail",
        reason: "same content regressed",
        violations: [{ target: "poison" }],
      }],
      previousEntry: previousPass,
      currentState,
      phase: "task-impl",
    });
    assert.equal(flipped[0].result, "pass");
    assert.equal("violations" in flipped[0], false);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("R8: flow.json gateImplMemory stores behavior index including hash and passed guardrail state", async () => {
  const { updateGateImplMemory } = await importRoot("src/flow/lib/run-gate.js");
  const { FlowManager } = await importRoot("src/lib/flow-manager.js");
  const tmp = fs.mkdtempSync(path.join(tempRoot, "spec-266-memory-index-"));
  try {
    const specRel = "specs/example/spec.json";
    const specDir = path.join(tmp, "specs/example");
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, "spec.json"), "{}");
    const flowState = { spec: specRel };
    updateGateImplMemory({
      root: tmp,
      flowState,
      phase: "task-impl",
      round: 1,
      gitState: { headSha: "h1", worktreeHash: "w1" },
      passedGuardrails: ["g-pass"],
      observations: [validObservation()],
    });
    assert.equal(flowState.gateImplMemory.version, 1);
    assert.equal(flowState.gateImplMemory.artifactPath, "specs/example/gate-impl-memory.json");
    assert.equal(flowState.gateImplMemory.roundsKept, 3);
    assert.match(flowState.gateImplMemory.lastUpdatedAt, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(flowState.gateImplMemory.headSha, "h1");
    assert.equal(flowState.gateImplMemory.worktreeHash, "w1");
    assert.deepEqual(flowState.gateImplMemory.passedGuardrails, ["g-pass"]);
    assert.deepEqual(Object.keys(flowState.gateImplMemory.entries[0]).sort(), ["observationRef", "signature", "status"]);

    const flowManager = new FlowManager({ root: tmp, mainRoot: tmp, inWorktree: false, specId: "example" });
    flowManager.save({
      spec: specRel,
      tasks: [],
      currentTaskId: null,
      metrics: [],
      notes: [],
    });
    flowManager.mutate((state) => {
      updateGateImplMemory({
        root: tmp,
        flowState: state,
        phase: "task-impl",
        round: 2,
        gitState: { headSha: "h2", worktreeHash: "w2" },
        passedGuardrails: ["g-persisted"],
        observations: [validObservation({ observed: "persisted memory observation" })],
      });
    });
    const persisted = flowManager.loadReadOnly("example");
    assert.equal(persisted.gateImplMemory.headSha, "h2");
    assert.equal(persisted.gateImplMemory.worktreeHash, "w2");
    assert.deepEqual(persisted.gateImplMemory.passedGuardrails, ["g-persisted"]);
    assert.equal(persisted.gateImplMemory.entries[0].status, "blocking");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("R9: spec-local gate-impl memory artifact stores full latest-three round details", async () => {
  const { updateGateImplMemory, readGateImplMemoryForPrompt, buildGateImplPriorMemoryPrompt } = await importRoot("src/flow/lib/run-gate.js");
  const tmp = fs.mkdtempSync(path.join(tempRoot, "spec-266-memory-artifact-"));
  try {
    const specRel = "specs/example/spec.json";
    const specDir = path.join(tmp, "specs/example");
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, "spec.json"), "{}");
    const flowState = { spec: specRel };
    for (let round = 1; round <= 4; round += 1) {
      updateGateImplMemory({
        root: tmp,
        flowState,
        phase: "task-impl",
        round,
        status: round === 4 ? "advisory" : "blocking",
        statusReason: `round ${round}`,
        gitState: { headSha: `h${round}`, worktreeHash: `w${round}` },
        passedGuardrails: [`g${round}`],
        observations: [validObservation({ observed: `round ${round} observation` })],
      });
    }
    fs.writeFileSync(path.join(specDir, "issue-log.json"), JSON.stringify({
      entries: [{
        observations: [validObservation({ observed: "poison issue-log observation" })],
        failedEvaluations: [{ reason: "poison legacy failure" }],
      }],
    }));
    const artifact = readJsonAbs(path.join(specDir, "gate-impl-memory.json"));
    assert.deepEqual(artifact.entries.map((entry) => entry.round), [2, 3, 4]);
    for (const entry of artifact.entries) {
      assert.ok(["blocking", "advisory"].includes(entry.status), "artifact entry must keep gate status");
      assert.equal(entry.statusReason, `round ${entry.round}`);
      assert.match(entry.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
      assert.deepEqual(Object.keys(entry.observations[0]).sort(), [
        "failureMode",
        "kind",
        "observed",
        "refs",
        "requirementRef",
        "severity",
        "where",
      ]);
    }
    const latestEntry = artifact.entries[2];
    assert.equal(latestEntry.headSha, "h4");
    assert.equal(latestEntry.worktreeHash, "w4");
    assert.deepEqual(latestEntry.passedGuardrails, ["g4"]);
    assert.deepEqual(latestEntry.observations[0], validObservation({ observed: "round 4 observation" }));
    flowState.gateImplMemory.entries = [];
    const promptMemory = readGateImplMemoryForPrompt({ root: tmp, flowState, phase: "task-impl" });
    assert.deepEqual(promptMemory.map((entry) => entry.round), [2, 3, 4]);
    assert.equal(promptMemory[2].observations[0].observed, "round 4 observation");
    const promptSection = buildGateImplPriorMemoryPrompt({ root: tmp, flowState, phase: "task-impl" });
    assertTextNotMatches(promptSection, /round 1 observation/, "prompt context must omit artifact entries older than the latest three rounds");
    assertTextNotMatches(promptSection, /poison issue-log observation|poison legacy failure/, "prompt context must ignore issue-log state");
    for (const round of [2, 3, 4]) {
      assertTextMatches(promptSection, new RegExp(`round ${round} observation`), `prompt context must include round ${round} artifact observations`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("R10: repeated FAIL similarity compares Observation requirementRef and observed", async () => {
  const { assertNoRepeatedFail } = await importRoot("src/flow/lib/run-gate.js");
  assert.throws(
    () => assertNoRepeatedFail({
      phase: "task-impl",
      priorObservations: [validObservation({
        observed: "same repeated condition",
        where: { file: "src/old-place.js", locator: "L1" },
      })],
      currentObservations: [validObservation({
        observed: "Same repeated condition",
        where: { file: "src/new-place.js", locator: "L99" },
      })],
    }),
    (err) => err.code === "ESCALATE_REPEATED_FAIL",
  );
  assert.doesNotThrow(() => assertNoRepeatedFail({
    phase: "task-impl",
    priorObservations: [validObservation({
      requirementRef: "guardrail:no-overengineering",
      observed: "same repeated condition",
    })],
    currentObservations: [validObservation({
      requirementRef: "guardrail:code-placement",
      observed: "Same repeated condition",
      refs: ["guardrail:code-placement"],
    })],
  }));
});

test("R11: legacy evaluations convert to NextAction without phase-specific adapter branches", async () => {
  const { legacyEvaluationsToNextAction } = await importExisting("src/flow/lib/observation.js");
  const nextAction = legacyEvaluationsToNextAction({
    evaluations: [
      {
        guardrail_id: "guardrail:no-overengineering",
        result: "fail",
        violations: [{ target: "duplicate shape", where: "src/a.js", why_violates: "same code added twice" }],
      },
      {
        guardrail_id: "R2",
        result: "fail",
        reason: "required Observation field missing",
      },
      {
        guardrail_id: "T-1",
        result: "fail",
        reason: "task implementation does not match the task spec",
      },
      {
        result: "fail",
        reason: "diff evidence missing for command output",
      },
      {
        result: "fail",
        category: "structure",
        reason: "required artifact file is missing",
      },
    ],
    prescription: "gate-impl",
  });
  assert.equal(nextAction.diagnosis.observations[0].failureMode, "guardrail-violation");
  assert.equal(nextAction.diagnosis.observations[0].where.file, "src/a.js");
  assert.equal(nextAction.diagnosis.observations[1].failureMode, "spec-impl-mismatch");
  assert.equal(nextAction.diagnosis.observations[2].failureMode, "spec-impl-mismatch");
  assert.equal(nextAction.diagnosis.observations[3].failureMode, "process-evidence-missing");
  assert.equal(nextAction.diagnosis.observations[3].where, null);
  assert.deepEqual(nextAction.diagnosis.observations[3].refs, []);
  assert.equal(nextAction.diagnosis.observations[4].failureMode, "process-evidence-missing");
  const source = readExisting("src/flow/lib/observation.js");
  assertTextNotMatches(functionSource(source, "legacyEvaluationsToNextAction"), /phase\s*===|["'](?:task-impl|integration|task-spec|draft|spec)["']/, "legacy adapter must not branch on phase-specific names");
});

test("R11: unmigrated gate wire output converts legacy evaluations to NextAction observations", async () => {
  const { buildGateResultArtifact } = await importRoot("src/flow/lib/run-gate.js");
  const artifact = buildGateResultArtifact({
    level: "parent",
    phase: "spec",
    target: "specs/example/spec.json",
    verdict: "fail",
    evaluations: [{
      guardrail_id: "R2",
      result: "fail",
      reason: "required Observation field missing",
    }],
    passPrescription: "complete-spec",
    failPrescription: "spec-repair",
  });
  assert.equal(artifact.result, "fail");
  assert.equal(artifact.artifacts.nextAction.prescription, "spec-repair");
  assert.equal(artifact.artifacts.nextAction.diagnosis.observations[0].failureMode, "spec-impl-mismatch");
  assert.equal("failedEvaluations" in artifact.artifacts, false);
  assert.equal("reasons" in artifact.artifacts, false);
});

test("R12: gate next-action schema documents diagnosis observations and prescription", () => {
  const schema = readJson("src/flow/schemas/next-action/gate.schema.json");
  const schemaText = JSON.stringify(schema);
  assert.ok(schema.properties.nextAction, "gate schema must expose nextAction");
  const observationSchema = schema.properties.nextAction.properties.diagnosis.properties.observations.items;
  assert.ok(observationSchema, "diagnosis observations must be an array with an item schema");
  for (const field of ["kind", "failureMode", "requirementRef", "where", "observed", "severity", "refs"]) {
    assert.ok(observationSchema.properties[field], `Observation schema must document ${field}`);
  }
  assert.ok(schema.properties.nextAction.properties.prescription);
  assertTextNotMatches(schemaText, /"if"|"then"|"else"|"allOf"|"anyOf"|"oneOf"|"minLength"/, "wire schema must not duplicate constructor-only Observation invariants");
});

test("R13: gate-impl prompt uses nextAction observations as the primary repair input", async () => {
  const { deploySkills } = await importRoot("src/lib/skills.js");
  const prompt = read("src/flow/prompts/impl/gate-impl.md");
  assertTextMatches(prompt, /artifacts\.nextAction\.diagnosis\.observations/, "gate-impl prompt must name NextAction observations");
  assertTextMatches(prompt, /show every Observation[\s\S]*artifacts\.nextAction\.diagnosis\.observations|artifacts\.nextAction\.diagnosis\.observations[\s\S]*show every Observation/i, "gate-impl prompt must tell agents to show every Observation on FAIL");
  assertTextNotMatches(prompt, /data\.artifacts\.reasons|artifacts\.reasons/, "gate-impl prompt must not use flattened reasons as primary input");
  const tmp = fs.mkdtempSync(path.join(tempRoot, "spec-266-skill-copy-"));
  try {
    deploySkills(tmp);
    for (const copyPath of [".agents/skills/sdd-forge.flow/SKILL.md", ".claude/skills/sdd-forge.flow/SKILL.md"]) {
      const copy = fs.readFileSync(path.join(tmp, copyPath), "utf8");
      assertTextMatches(copy, /artifacts\.nextAction\.diagnosis\.observations/, `${copyPath} must contain generated NextAction guidance`);
      assertTextMatches(copy, /show every Observation[\s\S]*artifacts\.nextAction\.diagnosis\.observations|artifacts\.nextAction\.diagnosis\.observations[\s\S]*show every Observation/i, `${copyPath} must contain generated show-every-Observation guidance`);
      assertTextNotMatches(copy, /data\.artifacts\.reasons|artifacts\.reasons/, `${copyPath} must not contain stale flattened-reason guidance`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("R14: base no-overengineering defines diff-verifiable named violations and severity criteria", () => {
  const guardrails = readJsonExisting("src/presets/base/guardrail.json").guardrails;
  const entry = guardrails.find((g) => g.id === "no-overengineering");
  assert.ok(entry, "no-overengineering guardrail must exist");
  for (const name of [
    "single-caller indirection",
    "duplicate code shape",
    "missing design-confirmation evidence",
  ]) {
    const section = violationSection(entry.body, name);
    assertTextMatches(section, /Diff-verification conditions/i, `${name} section must contain diff-verification conditions`);
    assertTextMatches(section, /Blocking when/i, `${name} section must contain blocking criteria`);
    assertTextMatches(section, /Advisory when/i, `${name} section must contain advisory criteria`);
  }
});

test("R15: base code-placement defines derivation-in-consumer violation conditions", () => {
  const guardrails = readJsonExisting("src/presets/base/guardrail.json").guardrails;
  const entry = guardrails.find((g) => g.id === "code-placement");
  assert.ok(entry, "code-placement guardrail must exist");
  for (const phrase of [
    "Violation: derivation logic placed in consumer module",
    "new export or module",
    "data owned by an existing data-owner module",
    "no change to that owner module",
    "Diff-verification conditions",
    "Blocking when",
  ]) {
    assertTextMatches(entry.body, new RegExp(phrase, "i"), `code-placement body must contain ${phrase}`);
  }
});

test("R16: reusable guardrail rewrite rubric ships under src/presets/base", async () => {
  const { deploySkills } = await importRoot("src/lib/skills.js");
  const rubric = readExisting("src/presets/base/guardrail-rewrite-rubric.md");
  for (const phrase of ["named violation", "diff-verification condition", "severity-policy"]) {
    assertTextMatches(rubric, new RegExp(phrase, "i"), `rubric must contain ${phrase}`);
  }
  const tmp = fs.mkdtempSync(path.join(tempRoot, "spec-266-rubric-copy-"));
  try {
    deploySkills(tmp);
    for (const copyPath of [".agents/skills/sdd-forge.flow/SKILL.md", ".claude/skills/sdd-forge.flow/SKILL.md"]) {
      const copy = fs.readFileSync(path.join(tmp, copyPath), "utf8");
      assertTextMatches(copy, /guardrail rewrite rubric|diff-verification condition|severity-policy/i, `${copyPath} must include generated rubric guidance`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("R17: generated skill and project template copies are synchronized with source changes", async () => {
  const { deploySkills } = await importRoot("src/lib/skills.js");
  const { deployPresetCopies } = await importExisting("src/lib/preset-deploy.js");
  const promptSource = readExisting("src/flow/prompts/impl/gate-impl.md");
  const promptPhrase = /artifacts\.nextAction\.diagnosis\.observations/;
  assertTextMatches(promptSource, promptPhrase, "source gate-impl prompt must contain NextAction observation guidance");
  const sourceSkill = readExisting("src/skills/sdd-forge.flow/SKILL.md");
  assertTextMatches(sourceSkill, promptPhrase, "source flow skill template must contain gate-impl prompt guidance before generated skill copies can sync it");

  const rubricSource = readExisting("src/presets/base/guardrail-rewrite-rubric.md");
  for (const phrase of ["named violation", "diff-verification condition", "severity-policy"]) {
    assertTextMatches(rubricSource, new RegExp(phrase, "i"), `source rubric must contain ${phrase}`);
  }
  for (const sourcePath of ["src/presets/base/templates/en/AGENTS.sdd.md", "src/presets/base/templates/ja/AGENTS.sdd.md"]) {
    assertTextMatches(readExisting(sourcePath), /sdd-forge upgrade/, `${sourcePath} must retain the source template instruction that drives generated project copies`);
  }

  const tmp = fs.mkdtempSync(path.join(tempRoot, "spec-266-generated-copies-"));
  try {
    deploySkills(tmp);
    deployPresetCopies(tmp, { presetKeys: ["base"], languages: ["en", "ja"] });
    for (const copyPath of [".agents/skills/sdd-forge.flow/SKILL.md", ".claude/skills/sdd-forge.flow/SKILL.md"]) {
      assertTextMatches(fs.readFileSync(path.join(tmp, copyPath), "utf8"), promptPhrase, `${copyPath} must be synchronized with gate-impl prompt guidance`);
    }
    for (const copyPath of [".sdd-forge/templates/en/docs/creating_presets.md", ".sdd-forge/templates/ja/docs/creating_presets.md"]) {
      const generated = fs.readFileSync(path.join(tmp, copyPath), "utf8");
      assertTextMatches(generated, /guardrail rewrite rubric|diff-verification condition|severity-policy/i, `${copyPath} must contain generated base-preset rubric guidance`);
    }
    const sourceGuardrails = readJsonExisting("src/presets/base/guardrail.json").guardrails;
    const generatedGuardrails = readJsonAbs(path.join(tmp, ".sdd-forge/presets/base/guardrail.json")).guardrails;
    for (const id of ["no-overengineering", "code-placement"]) {
      const sourceBody = sourceGuardrails.find((entry) => entry.id === id).body;
      const generatedBody = generatedGuardrails.find((entry) => entry.id === id).body;
      assert.equal(generatedBody, sourceBody, `generated base preset guardrail ${id} must match source`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("R18: structured gate behavior areas are covered through production APIs", async () => {
  const {
    Observation,
    Diagnosis,
    NextAction,
    legacyEvaluationsToNextAction,
  } = await importExisting("src/flow/lib/observation.js");
  const {
    appendIssueLogFromGateResult,
    buildGateResultArtifact,
    buildGuardrailArticleEvalPrompt,
    evaluateGuardrailObservationsWithRetry,
    readGateImplMemoryForPrompt,
    updateGateImplMemory,
  } = await importRoot("src/flow/lib/run-gate.js");

  const observation = new Observation(validObservation());
  assert.throws(() => new Observation(validObservation({ observed: "" })), /observed/i);
  const nextAction = new NextAction({
    diagnosis: new Diagnosis({ summary: "covered", observations: [observation] }),
    prescription: "gate-impl",
  });
  assert.equal(nextAction.toJSON().diagnosis.observations[0].failureMode, "guardrail-violation");

  let calls = 0;
  const retryResult = await evaluateGuardrailObservationsWithRetry({
    knownIds: ["guardrail:no-overengineering"],
    maxAttempts: 2,
    phase: "task-impl",
    callAgent: async () => {
      calls += 1;
      return calls === 1
        ? JSON.stringify({ observations: [aiObservation({ failureMode: "unknown-mode" })] })
        : JSON.stringify({ observations: [aiObservation()] });
    },
  });
  assert.equal(retryResult.observations[0].failureMode, "guardrail-violation");

  const artifact = buildGateResultArtifact({
    level: "task",
    phase: "task-impl",
    target: "diff",
    verdict: "fail",
    observations: [observation.toJSON()],
    passPrescription: "complete-task",
    failPrescription: "gate-impl",
  });
  assert.equal(artifact.artifacts.nextAction.diagnosis.observations[0].observed, observation.observed);

  const legacyNextAction = legacyEvaluationsToNextAction({
    evaluations: [{ guardrail_id: "R2", result: "fail", reason: "missing required field" }],
    prescription: "spec-repair",
  });
  assert.equal(legacyNextAction.diagnosis.observations[0].failureMode, "spec-impl-mismatch");

  const prompt = buildGuardrailArticleEvalPrompt(
    "diff text",
    [{ id: "guardrail:no-overengineering", title: "No Overengineering", body: "Report violations." }],
    "task-impl",
  ).build().userPrompt;
  assertTextMatches(prompt, /failureMode[\s\S]*requirementRef[\s\S]*where[\s\S]*observed/, "prompt must request AI-owned Observation fields");

  const tmp = fs.mkdtempSync(path.join(tempRoot, "spec-266-r18-"));
  try {
    const specRel = "specs/example/spec.json";
    const specDir = path.join(tmp, "specs/example");
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, "spec.json"), "{}");
    const flowState = { spec: specRel };
    appendIssueLogFromGateResult({
      root: tmp,
      phase: "task-impl",
      flowState,
      gitState: { headSha: "h-r18", worktreeHash: "w-r18" },
    }, artifact);
    assert.equal(readJsonAbs(path.join(specDir, "issue-log.json")).entries[0].observations[0].observed, observation.observed);

    updateGateImplMemory({
      root: tmp,
      flowState,
      phase: "task-impl",
      round: 1,
      gitState: { headSha: "h-r18", worktreeHash: "w-r18" },
      passedGuardrails: ["guardrail:no-overengineering"],
      observations: [observation.toJSON()],
    });
    assert.equal(readGateImplMemoryForPrompt({ root: tmp, flowState, phase: "task-impl" })[0].observations[0].observed, observation.observed);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }

  assertTextMatches(readExisting("src/presets/base/guardrail.json"), /Violation: single-caller indirection|Violation: derivation logic placed in consumer module/i, "base guardrail updates must be covered");
  assertTextMatches(readExisting("src/presets/base/guardrail-rewrite-rubric.md"), /named violation|diff-verification condition|severity-policy/i, "base rubric update must be covered");
});
