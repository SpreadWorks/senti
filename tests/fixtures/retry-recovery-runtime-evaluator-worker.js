import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SPEC_ID = "001-runtime-evaluator-recovery";
const SPEC_PATH = `specs/${SPEC_ID}/spec.json`;
const TASK_SPEC_PATH = `specs/${SPEC_ID}/tasks/T-1.md`;
const FEATURE_PATH = "src/feature-evidence.js";
const FINDING_ID = "f".repeat(64);
const MAX_ATTEMPTS = 5;

class ScenarioTrace {
  constructor(filePath) {
    if (!path.isAbsolute(filePath)) throw new Error("diagnostic path must be absolute");
    this.filePath = filePath;
    this.sequence = 0;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "");
  }

  phase(phase, status, data = {}) {
    this.#append({ kind: "phase", phase, status, ...data });
  }

  dispatcher(phase, command, args, result) {
    this.#append({
      kind: "dispatcher",
      phase,
      command,
      args,
      exitCode: result.exitCode,
      signal: null,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }

  failure(phase, error) {
    this.#append({
      kind: "failure",
      phase,
      code: error?.code ?? null,
      message: error?.message ?? String(error),
      stack: error?.stack ?? null,
    });
  }

  #append(value) {
    this.sequence += 1;
    fs.appendFileSync(this.filePath, `${JSON.stringify({
      sequence: this.sequence,
      timestamp: new Date().toISOString(),
      ...value,
    })}\n`);
  }
}

function writeFile(root, relPath, content) {
  const filePath = path.join(root, relPath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function runtimeModuleUrl(runtimeRoot, relPath) {
  return pathToFileURL(path.join(runtimeRoot, relPath)).href;
}

function runtimeEvaluatorFingerprint(retryModule, specDir) {
  const source = retryModule.resolveRecoveryEvidenceSource({
    kind: "gate",
    canonicalPhase: "task-impl",
    specDir,
  });
  assert.equal(source.runtimeIdentities.length, 1);
  return source.runtimeIdentities[0].fingerprint();
}

function featureEvidenceHash(root) {
  return crypto.createHash("sha256")
    .update(fs.readFileSync(path.join(root, FEATURE_PATH)))
    .digest("hex");
}

function gateRetryCount(flowState) {
  return flowState.metrics.reduce((count, metric) => {
    if (metric.phase !== "task-impl" || metric.counter !== "gateRetry") return count;
    return metric.reset ? 0 : count + (metric.delta ?? 1);
  }, 0);
}

function makeFlowState(buildInitialSteps) {
  return {
    specId: SPEC_ID,
    runId: "run-runtime-evaluator-recovery",
    baseBranch: "main",
    featureBranch: "feature/runtime-evaluator-recovery",
    steps: buildInitialSteps(),
    requirements: [],
    metrics: Array.from({ length: MAX_ATTEMPTS }, () => ({
      phase: "task-impl",
      counter: "gateRetry",
      delta: 1,
      taskId: "T-1",
      ts: "2026-07-23T00:00:00.000Z",
    })),
    tasks: [{
      id: "T-1",
      title: "Runtime evaluator recovery",
      goal: "Keep feature evidence unchanged while the runtime evaluator changes.",
      parent: null,
      origin: "plan",
      added_round: 0,
      status: "in_progress",
      spec: TASK_SPEC_PATH,
      steps: [
        { id: "task-impl", status: "done" },
        { id: "task-review", status: "done" },
        { id: "task-gate", status: "in_progress" },
      ],
    }],
    currentTaskId: "T-1",
  };
}

async function loadRuntime(runtimeRoot, projectRoot) {
  process.env.SENNEL_WORK_ROOT = projectRoot;
  const [
    containerModule,
    { coreCommandRegistry },
    { dispatch },
    { resolveFlowContext },
    { FlowManager },
    { buildInitialSteps },
    retryModule,
  ] = await Promise.all([
    import(runtimeModuleUrl(runtimeRoot, "src/lib/container.js")),
    import(runtimeModuleUrl(runtimeRoot, "src/lib/command-registry.js")),
    import(runtimeModuleUrl(runtimeRoot, "src/lib/dispatcher.js")),
    import(runtimeModuleUrl(runtimeRoot, "src/flow/lib/flow-context.js")),
    import(runtimeModuleUrl(runtimeRoot, "src/lib/flow-manager.js")),
    import(runtimeModuleUrl(runtimeRoot, "src/lib/flow-helpers.js")),
    import(runtimeModuleUrl(runtimeRoot, "src/flow/lib/retry-recovery.js")),
  ]);
  containerModule.initContainer({ entryCommand: "flow set retry reset" });
  return {
    container: containerModule.container,
    coreCommandRegistry,
    dispatch,
    resolveFlowContext,
    FlowManager,
    buildInitialSteps,
    retryModule,
  };
}

async function dispatchFlowSet(runtime, key, args) {
  const entry = runtime.coreCommandRegistry.find(["flow", "set", key]);
  assert.ok(entry?.command, `missing public flow set dispatcher entry: ${key}`);
  let stdout = "";
  let stderr = "";
  let exitCode = 0;
  await runtime.dispatch({
    container: runtime.container,
    entry,
    argv: args,
    envelopeType: "set",
    envelopeKey: key,
    runtimeLog: false,
    stdout: (value) => { stdout += value; },
    stderr: (value) => { stderr += value; },
    setExitCode: (value) => { exitCode = value; },
    buildHookCtx: (container, input = {}) => runtime.resolveFlowContext(container, {
      allowMissingActive: entry.requiresFlow === false,
      explicitTargetResolution: entry.explicitTargetResolution === true,
      mismatchTargetResolution: entry.mismatchTargetResolution === true,
      preparingRunIdSelection: entry.preparingRunIdSelection !== false,
      input,
    }),
  });
  const text = stdout.trim();
  assert.ok(text.startsWith("{"), stderr || stdout);
  return { exitCode, stdout, stderr, envelope: JSON.parse(text) };
}

async function runPublicCommand(trace, phase, runtime, key, args) {
  const result = await dispatchFlowSet(runtime, key, args);
  trace.dispatcher(phase, `flow set ${key}`, args, result);
  return result;
}

export async function runRuntimeEvaluatorScenario({ diagnosticPath, sourceRoot }) {
  const trace = new ScenarioTrace(diagnosticPath);
  let projectRoot = null;
  let runtimeV1Root = null;
  let runtimeV2Root = null;
  let phase = "setup";
  let operationError = null;
  try {
    trace.phase(phase, "started");
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sennel-runtime-evaluator-project-"));
    runtimeV1Root = fs.mkdtempSync(path.join(os.tmpdir(), "sennel-runtime-evaluator-v1-"));
    runtimeV2Root = fs.mkdtempSync(path.join(os.tmpdir(), "sennel-runtime-evaluator-v2-"));
    fs.cpSync(path.join(sourceRoot, "src"), path.join(runtimeV1Root, "src"), { recursive: true });
    fs.cpSync(path.join(sourceRoot, "src"), path.join(runtimeV2Root, "src"), { recursive: true });
    for (const runtimeRoot of [runtimeV1Root, runtimeV2Root]) {
      writeFile(runtimeRoot, "package.json", `${JSON.stringify({
        name: "sennel-runtime-evaluator-fixture",
        version: "0.0.0",
        type: "module",
      }, null, 2)}\n`);
    }
    fs.appendFileSync(
      path.join(runtimeV2Root, "src", "flow", "lib", "run-gate.js"),
      "\n// runtime evaluator fixture revision 2\n",
    );

    writeFile(projectRoot, ".sennel/config.json", `${JSON.stringify({
      lang: "en",
      type: "base",
      docs: { languages: ["en"], defaultLanguage: "en" },
    }, null, 2)}\n`);
    writeFile(projectRoot, "package.json", '{"name":"runtime-evaluator-project","version":"0.0.0","type":"module"}\n');
    writeFile(projectRoot, SPEC_PATH, `${JSON.stringify({
      goal: "Validate runtime gate evaluator recovery identity.",
      requirements: [{ id: "R1", priority: "must", desc: "Keep feature evidence unchanged." }],
    }, null, 2)}\n`);
    writeFile(projectRoot, TASK_SPEC_PATH, "# Task T-1\n\nKeep feature evidence unchanged.\n");
    writeFile(projectRoot, FEATURE_PATH, "export const featureEvidence = 2;\n");
    writeFile(projectRoot, `${path.dirname(SPEC_PATH)}/task-impl-gate-source.json`, `${JSON.stringify({
      phase: "task-impl",
      runId: "run-runtime-evaluator-recovery",
      planRewindAt: null,
      generatedAt: "2026-07-22T00:00:00.000Z",
      result: "fail",
      evaluations: [{
        findingId: FINDING_ID,
        fingerprint: FINDING_ID,
        result: "fail",
        reason: "runtime evaluator rejected the unchanged feature evidence",
        reportedAt: "2026-07-22T00:00:00.000Z",
      }],
    }, null, 2)}\n`);
    const projectEvidenceBefore = featureEvidenceHash(projectRoot);
    const runtimeV1 = await loadRuntime(runtimeV1Root, projectRoot);
    trace.phase(phase, "passed", { projectRoot, runtimeV1Root, runtimeV2Root });

    phase = "baseline";
    trace.phase(phase, "started");
    const state = makeFlowState(runtimeV1.buildInitialSteps);
    const evaluatorBefore = runtimeEvaluatorFingerprint(runtimeV1.retryModule, path.dirname(SPEC_PATH));
    const baseline = runtimeV1.retryModule.persistCurrentRecoveryBaseline({
      root: projectRoot,
      flowState: state,
      kind: "gate",
      phase: "task-impl",
      trigger: "task-gate-exhausted",
      createdAt: "2026-07-23T00:00:30.000Z",
    });
    const baseManager = new runtimeV1.FlowManager({
      root: projectRoot,
      mainRoot: projectRoot,
      inWorktree: false,
    });
    baseManager.create(state);
    baseManager.addActiveFlow(SPEC_ID, "branch");
    assert.match(baseline.fingerprint.components.projectHash, /^[a-f0-9]{64}$/);
    assert.equal(baseline.fingerprint.components.runtimeHash == null, false);
    trace.phase(phase, "passed", {
      baselineHash: baseline.fingerprint.hash,
      projectHash: baseline.fingerprint.components.projectHash,
      runtimeHash: baseline.fingerprint.components.runtimeHash,
      evaluatorDigest: evaluatorBefore.digest,
      evaluatorBytes: evaluatorBefore.bytes,
    });

    phase = "unchanged rejection";
    trace.phase(phase, "started");
    const unchanged = await runPublicCommand(trace, phase, runtimeV1, "retry", [
      "reset", "gate", "task-impl",
      "--reason", "The runtime evaluator identity has not changed after exhaustion.",
      "--yes",
    ]);
    assert.equal(unchanged.exitCode, 1, unchanged.stderr || unchanged.stdout);
    assert.equal(unchanged.envelope.ok, false);
    assert.equal(unchanged.envelope.errors[0]?.code, "UNCHANGED_EVIDENCE");
    trace.phase(phase, "passed", { code: unchanged.envelope.errors[0].code });

    phase = "evaluator update";
    trace.phase(phase, "started");
    const runtimeV2 = await loadRuntime(runtimeV2Root, projectRoot);
    const evaluatorAfter = runtimeEvaluatorFingerprint(runtimeV2.retryModule, path.dirname(SPEC_PATH));
    const currentFingerprint = runtimeV2.retryModule.buildCurrentRecoveryFingerprint({
      root: projectRoot,
      flowState: state,
      kind: "gate",
      canonicalPhase: "task-impl",
      baseline,
    });
    assert.notEqual(evaluatorAfter.digest, evaluatorBefore.digest);
    assert.equal(featureEvidenceHash(projectRoot), projectEvidenceBefore);
    assert.equal(
      currentFingerprint.components.projectHash,
      baseline.fingerprint.components.projectHash,
    );
    assert.notEqual(
      currentFingerprint.components.runtimeHash,
      baseline.fingerprint.components.runtimeHash,
    );
    trace.phase(phase, "passed", {
      evaluatorBefore: evaluatorBefore.digest,
      evaluatorAfter: evaluatorAfter.digest,
      projectEvidenceHash: projectEvidenceBefore,
      projectComponentHash: currentFingerprint.components.projectHash,
      runtimeComponentBefore: baseline.fingerprint.components.runtimeHash,
      runtimeComponentAfter: currentFingerprint.components.runtimeHash,
    });

    phase = "missing repair evidence";
    trace.phase(phase, "started");
    const missingEvidence = await runPublicCommand(trace, phase, runtimeV2, "retry", [
      "reset", "gate", "task-impl",
      "--reason", "The evaluator changed but formal repair evidence is still missing.",
      "--yes",
    ]);
    assert.equal(missingEvidence.exitCode, 1, missingEvidence.stderr || missingEvidence.stdout);
    assert.equal(missingEvidence.envelope.ok, false);
    assert.equal(
      missingEvidence.envelope.errors[0]?.code,
      "EVALUATOR_REPAIR_EVIDENCE_REQUIRED",
    );
    const rejectedState = new runtimeV2.FlowManager({
      root: projectRoot,
      mainRoot: projectRoot,
      inWorktree: false,
      specId: SPEC_ID,
    }).loadReadOnly(SPEC_ID);
    assert.equal(rejectedState.retryRecovery?.entries?.length ?? 0, 0);
    assert.equal(gateRetryCount(rejectedState), MAX_ATTEMPTS);
    trace.phase(phase, "passed", {
      code: missingEvidence.envelope.errors[0].code,
      grantCount: rejectedState.retryRecovery?.entries?.length ?? 0,
      counterAfter: gateRetryCount(rejectedState),
    });

    phase = "formal repair evidence";
    trace.phase(phase, "started");
    const repair = await runPublicCommand(trace, phase, runtimeV2, "issue-log", [
      "--step", "task-gate",
      "--task-id", "T-1",
      "--reason", "Recorded formal matching repair evidence before retry recovery.",
      "--resolution", "The exact normalized finding is bound to the unchanged feature evidence file.",
      "--normalized-finding-id", FINDING_ID,
      "--repair-ref-file", FEATURE_PATH,
    ]);
    assert.equal(repair.exitCode, 0, repair.stderr || repair.stdout);
    assert.equal(repair.envelope.ok, true);
    trace.phase(phase, "passed", {
      normalizedFindingId: repair.envelope.data.entry.normalizedFindingId,
      taskId: repair.envelope.data.entry.taskId,
    });

    phase = "recovery grant";
    trace.phase(phase, "started");
    const recovered = await runPublicCommand(trace, phase, runtimeV2, "retry", [
      "reset", "gate", "task-impl",
      "--reason", "The runtime gate evaluator identity changed after the exhausted attempt.",
      "--yes",
    ]);
    assert.equal(recovered.exitCode, 0, recovered.stderr || recovered.stdout);
    assert.equal(recovered.envelope.ok, true);
    assert.equal(recovered.envelope.data.grants.length, 1);
    trace.phase(phase, "passed", { grantId: recovered.envelope.data.grants[0].id });

    phase = "assertions";
    trace.phase(phase, "started");
    const manager = new runtimeV2.FlowManager({
      root: projectRoot,
      mainRoot: projectRoot,
      inWorktree: false,
      specId: SPEC_ID,
    });
    const persisted = manager.loadReadOnly(SPEC_ID);
    assert.equal(persisted.retryRecovery.entries.length, 1);
    const [grant] = persisted.retryRecovery.entries;
    assert.equal(grant.permittedReevaluationCount, 1);
    assert.equal(grant.counterAfter, MAX_ATTEMPTS - 1);
    assert.notEqual(grant.changedEvidence.baselineHash, grant.changedEvidence.currentHash);
    const currentRetryCount = gateRetryCount(persisted);
    assert.equal(currentRetryCount, MAX_ATTEMPTS - 1);
    assert.equal(featureEvidenceHash(projectRoot), projectEvidenceBefore);
    trace.phase(phase, "passed", {
      grantCount: persisted.retryRecovery.entries.length,
      permittedReevaluationCount: grant.permittedReevaluationCount,
      counterAfter: currentRetryCount,
      projectEvidenceHash: projectEvidenceBefore,
    });
  } catch (error) {
    operationError = error;
    trace.failure(phase, error);
    throw error;
  } finally {
    phase = "cleanup";
    trace.phase(phase, "started", { projectRoot, runtimeV1Root, runtimeV2Root });
    try {
      if (projectRoot) fs.rmSync(projectRoot, { recursive: true, force: true });
      if (runtimeV1Root) fs.rmSync(runtimeV1Root, { recursive: true, force: true });
      if (runtimeV2Root) fs.rmSync(runtimeV2Root, { recursive: true, force: true });
      trace.phase(phase, "passed");
    } catch (cleanupError) {
      trace.failure(phase, cleanupError);
      if (!operationError) throw cleanupError;
    }
  }
}
