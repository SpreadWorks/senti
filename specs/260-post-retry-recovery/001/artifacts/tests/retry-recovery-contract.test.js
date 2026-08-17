// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../tests/helpers/tmp-dir.js";
import { makeFlowManager, setupFlow, setupFlowConfig } from "../../../tests/helpers/flow-setup.js";
import { ProcessIdentitySource } from "../../../src/lib/process-identity.js";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..", "..", "..");
const recoveryPath = path.join(repoRoot, "src/flow/lib/retry-recovery.js");
const sentiBin = path.join(repoRoot, "src/senti.js");
const specId = "001-test";
const specPath = `specs/${specId}/spec.json`;
const artifactPath = `specs/${specId}/retry-recovery.json`;
const transactionPath = `specs/${specId}/.retry-recovery.transaction.json`;
const issueLogPath = `specs/${specId}/issue-log.json`;
const reason = "Re-evaluate after implementation evidence changed.";
const publicRecoveryEntryFields = [
  "attemptsBefore",
  "canonicalPhase",
  "changedEvidence",
  "counterAfter",
  "createdAt",
  "id",
  "kind",
  "maxAttempts",
  "permittedReevaluationCount",
  "phase",
  "reason",
  "recoveryCommand",
];

function assertPublicRecoveryArtifact(value) {
  assert.deepEqual(Object.keys(value).sort(), ["entries", "version"]);
  assert.equal(value.version, 1);
  assert.ok(Array.isArray(value.entries));
  for (const entry of value.entries) {
    assert.deepEqual(Object.keys(entry).sort(), publicRecoveryEntryFields);
    assert.match(entry.id, /^recovery-/);
    assert.ok(["gate", "review"].includes(entry.kind));
    assert.equal(typeof entry.phase, "string");
    assert.equal(typeof entry.canonicalPhase, "string");
    assert.equal(typeof entry.reason, "string");
    assert.deepEqual(Object.keys(entry.changedEvidence).sort(), [
      "baselineHash", "changed", "changedPaths", "currentHash", "sourceKind", "truncated",
    ]);
    for (const field of ["permittedReevaluationCount", "attemptsBefore", "maxAttempts", "counterAfter"]) {
      assert.ok(Number.isSafeInteger(entry[field]) && entry[field] >= 0, field);
    }
    assert.equal(typeof entry.recoveryCommand, "string");
    assert.equal(typeof entry.createdAt, "string");
  }
  return value;
}

function assertPrivateRecoveryTransaction(value) {
  assert.deepEqual(Object.keys(value).sort(), ["transaction", "version"]);
  assert.equal(value.version, 1);
  if (value.transaction == null) return null;
  const transaction = value.transaction;
  assert.deepEqual(Object.keys(transaction).sort(), [
    "createdAt", "expectedFlowRevision", "fingerprint", "grant", "grantId", "rejection",
    "request", "status", "updatedAt",
  ]);
  assert.ok(["pending", "rejected"].includes(transaction.status));
  if (transaction.status === "pending") {
    assert.equal(transaction.rejection, null);
    assertPublicRecoveryArtifact({ version: 1, entries: [transaction.grant] });
    assert.equal(transaction.grantId, transaction.grant.id);
  } else {
    assert.equal(transaction.grant, null);
    assert.deepEqual(Object.keys(transaction.rejection).sort(), ["code", "message"]);
  }
  return transaction;
}

function readPrivateRecoveryTransaction(root) {
  if (!fs.existsSync(path.join(root, transactionPath))) return null;
  return assertPrivateRecoveryTransaction(readJson(root, transactionPath));
}

function publicRecoveryEntry(id = "recovery-11111111-1111-4111-8111-111111111111") {
  return {
    id,
    kind: "gate",
    phase: "task-impl",
    canonicalPhase: "task-impl",
    reason,
    changedEvidence: {
      sourceKind: "implementation-diff",
      baselineHash: "a".repeat(64),
      currentHash: "b".repeat(64),
      changedPaths: ["src/changed.js"],
      truncated: false,
      changed: true,
    },
    permittedReevaluationCount: 1,
    attemptsBefore: 3,
    maxAttempts: 3,
    counterAfter: 2,
    recoveryCommand: `senti flow set retry reset gate task-impl --reason "${reason}" --yes`,
    createdAt: "2026-05-18T00:00:00.000Z",
  };
}

function pendingRecoveryTransaction(grant = publicRecoveryEntry()) {
  return {
    grantId: grant?.id || "recovery-11111111-1111-4111-8111-111111111111",
    status: "pending",
    fingerprint: "c".repeat(64),
    expectedFlowRevision: "d".repeat(64),
    request: {
      runId: "run-test",
      spec: specPath,
      hasIssue: false,
      issue: null,
      kind: "gate",
      phase: "task-impl",
      canonicalPhase: "task-impl",
      reason,
      attempts: 3,
      maxAttempts: 3,
      changedEvidence: grant?.changedEvidence || null,
    },
    grant,
    rejection: null,
    createdAt: "2026-05-18T00:00:00.000Z",
    updatedAt: "2026-05-18T00:00:00.000Z",
  };
}

async function loadRecovery() {
  assert.ok(fs.existsSync(recoveryPath), "src/flow/lib/retry-recovery.js should exist");
  return import(pathToFileURL(recoveryPath).href);
}

function readJson(root, relPath) {
  return JSON.parse(fs.readFileSync(path.join(root, relPath), "utf8"));
}

function writeFixtureSpec(root) {
  writeJson(root, specPath, {
    goal: "Retry recovery fixture.",
    background: "",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements: [{ id: "R1", priority: "must", status: "pending", desc: "fixture" }],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
  });
  writeFile(root, `specs/${specId}/tests/recovery.test.js`, "test('fixture', () => {});\n");
}

function setStepStatus(steps, id, status) {
  for (const step of steps || []) {
    if (step.id === id) {
      step.status = status;
      return true;
    }
    if (setStepStatus(step.children, id, status)) return true;
  }
  return false;
}

function setupRecoveryFixture({
  activeStep = "task-gate",
  kind = "gate",
  phase = "task-impl",
  attempts = 3,
  maxAttempts = 3,
  baselineHash = "before",
  currentHash = "after",
  recovered = false,
} = {}) {
  const root = createTmpDir("retry-recovery-");
  setupFlowConfig(root, "ja");
  writeFixtureSpec(root);

  const metrics = Array.from({ length: attempts }, () => ({
    phase,
    counter: kind === "gate" ? "gateRetry" : "reviewRetry",
    delta: 1,
    taskId: null,
    ts: "2026-05-18T00:00:00.000Z",
  }));
  const state = setupFlow(root, {
    spec: specPath,
    baseBranch: "main",
    featureBranch: `feature/${specId}`,
    metrics,
    reviewRecoveryBaselines: [
      {
        kind,
        phase,
        canonicalPhase: phase,
        fingerprint: {
          sourceKind: kind === "gate" ? "implementation-diff" : "spec-json",
          hash: baselineHash,
          paths: [kind === "gate" ? "src/changed.js" : specPath],
          truncated: false,
        },
        createdAt: "2026-05-18T00:00:00.000Z",
      },
    ],
    retryRecovery: recovered
      ? {
          version: 1,
          entries: [{
            id: "recovery-existing",
            kind,
            phase,
            canonicalPhase: phase,
            reason,
            changedEvidence: {
              sourceKind: kind === "gate" ? "implementation-diff" : "spec-json",
              baselineHash,
              currentHash,
              changedPaths: [kind === "gate" ? "src/changed.js" : specPath],
              truncated: false,
              changed: true,
            },
            permittedReevaluationCount: 1,
            attemptsBefore: maxAttempts,
            maxAttempts,
            counterAfter: maxAttempts - 1,
            recoveryCommand: `senti flow set retry reset ${kind} ${phase} --reason "${reason}" --yes`,
            createdAt: "2026-05-18T00:00:00.000Z",
          }],
        }
      : undefined,
  });
  setStepStatus(state.steps, activeStep, "in_progress");
  for (const task of state.tasks || []) {
    if (setStepStatus(task.steps, activeStep, "in_progress")) {
      setStepStatus(state.steps, "branch", "done");
      task.status = "in_progress";
      state.currentTaskId = task.id;
    }
  }
  writeJson(root, `specs/${specId}/flow.json`, state);
  writeJson(root, issueLogPath, { entries: [] });
  writeJson(root, artifactPath, { version: 1, entries: [] });
  writeFile(root, "src/changed.js", `export const value = "${currentHash}";\n`);
  return root;
}

function snapshotRecoveryFiles(root) {
  const flowFile = path.join(root, `specs/${specId}/flow.json`);
  const issueFile = path.join(root, issueLogPath);
  const recoveryFile = path.join(root, artifactPath);
  const transactionFile = path.join(root, transactionPath);
  return {
    flow: fs.readFileSync(flowFile, "utf8"),
    flowMode: fs.statSync(flowFile).mode & 0o777,
    issueLog: fs.readFileSync(issueFile, "utf8"),
    issueLogMode: fs.statSync(issueFile).mode & 0o777,
    recovery: fs.readFileSync(recoveryFile, "utf8"),
    recoveryMode: fs.statSync(recoveryFile).mode & 0o777,
    transaction: fs.existsSync(transactionFile)
      ? fs.readFileSync(transactionFile, "utf8")
      : null,
    transactionMode: fs.existsSync(transactionFile) ? fs.statSync(transactionFile).mode & 0o777 : null,
  };
}

function runSenti(root, args) {
  try {
    const stdout = execFileSync(process.execPath, [sentiBin, ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: root, SENTI_SOURCE_ROOT: root },
    });
    return { status: 0, envelope: JSON.parse(stdout) };
  } catch (error) {
    return {
      status: error.status || 1,
      envelope: JSON.parse(error.stdout || "{}"),
      stderr: error.stderr || "",
    };
  }
}

function waitFor(predicate, message, timeoutMs = 5000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (predicate()) return resolve();
      if (Date.now() - started >= timeoutMs) return reject(new Error(message));
      setTimeout(poll, 10);
    };
    poll();
  });
}

function startSenti(root, args, { importFile, env = {}, readyFd = false } = {}) {
  const nodeArgs = [...(importFile ? ["--import", importFile] : []), sentiBin, ...args];
  const child = spawn(process.execPath, nodeArgs, {
    cwd: repoRoot,
    env: { ...process.env, ...env, SENTI_WORK_ROOT: root, SENTI_SOURCE_ROOT: root },
    stdio: readyFd ? ["ignore", "pipe", "pipe", "pipe"] : ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const result = new Promise((resolve) => {
    child.on("close", (status, signal) => resolve({
      status,
      signal,
      envelope: JSON.parse(stdout || "{}"),
      stderr,
    }));
  });
  return { child, result, stdout: () => stdout, stderr: () => stderr };
}

function spawnSenti(root, args, options) {
  return startSenti(root, args, options).result;
}

function inspectDiagnosticPath(file) {
  try {
    const stat = fs.lstatSync(file);
    return {
      path: file,
      type: stat.isSymbolicLink() ? "symlink" : stat.isFile() ? "file" : stat.isDirectory() ? "directory" : "other",
      mode: stat.mode & 0o777,
      nlink: stat.nlink,
      bytes: stat.isFile() && stat.size <= 64 * 1024 ? fs.readFileSync(file, "utf8") : null,
    };
  } catch (error) {
    return { path: file, error: error.code || error.message };
  }
}

function waitForReadySignal(processHandle, diagnosticPaths) {
  const { child } = processHandle;
  const expectedPid = child.pid;
  const ready = child.stdio[3];
  return new Promise((resolve, reject) => {
    let signal = "";
    const cleanup = () => {
      ready.off("data", onData);
      child.off("error", onError);
      child.off("exit", onExit);
    };
    const onData = (chunk) => {
      signal += chunk;
      if (signal === `${expectedPid}\n`) {
        cleanup();
        resolve();
      }
    };
    const onError = (error) => {
      cleanup();
      error.diagnostics = {
        pid: expectedPid,
        stdout: processHandle.stdout(),
        stderr: processHandle.stderr(),
        paths: diagnosticPaths.map(inspectDiagnosticPath),
      };
      reject(error);
    };
    const onExit = (code, childSignal) => {
      cleanup();
      void processHandle.result.then(() => reject(new Error(JSON.stringify({
        message: "retry barrier child exited before ready",
        pid: expectedPid,
        code,
        signal: childSignal,
        stdout: processHandle.stdout(),
        stderr: processHandle.stderr(),
        paths: diagnosticPaths.map(inspectDiagnosticPath),
      }))));
    };
    ready.setEncoding("utf8");
    ready.on("data", onData);
    child.once("error", onError);
    child.once("exit", onExit);
  });
}

function assertNoMutation(root, before) {
  const flowFile = path.join(root, `specs/${specId}/flow.json`);
  const issueFile = path.join(root, issueLogPath);
  const recoveryFile = path.join(root, artifactPath);
  const transactionFile = path.join(root, transactionPath);
  assert.equal(fs.readFileSync(flowFile, "utf8"), before.flow);
  assert.equal(fs.statSync(flowFile).mode & 0o777, before.flowMode);
  assert.equal(fs.readFileSync(issueFile, "utf8"), before.issueLog);
  assert.equal(fs.statSync(issueFile).mode & 0o777, before.issueLogMode);
  assert.equal(fs.readFileSync(recoveryFile, "utf8"), before.recovery);
  assert.equal(fs.statSync(recoveryFile).mode & 0o777, before.recoveryMode);
  const transaction = fs.existsSync(transactionFile)
    ? fs.readFileSync(transactionFile, "utf8")
    : null;
  assert.equal(transaction, before.transaction);
  assert.equal(
    fs.existsSync(transactionFile) ? fs.statSync(transactionFile).mode & 0o777 : null,
    before.transactionMode,
  );
}

function recoveryGrantRequest(root, input, {
  attempts,
  maxAttempts,
  createdAt,
  faultInjector,
} = {}) {
  const flow = readJson(root, `specs/${specId}/flow.json`);
  return {
    root,
    spec: flow.spec,
    flowManager: makeFlowManager(root),
    input,
    expectedAttempts: attempts,
    expectedMaxAttempts: maxAttempts,
    expectedRunId: flow.runId,
    expectedHasIssue: Object.hasOwn(flow, "issue"),
    expectedIssue: flow.issue,
    resolveConfiguredMaxAttempts: () => maxAttempts,
    createdAt,
    faultInjector,
  };
}

describe("retry recovery contract", () => {
  const cleanup = [];
  afterEach(() => {
    while (cleanup.length > 0) removeTmpDir(cleanup.pop());
  });

  it("uses the recovery artifact as the sole committed-grant authority", async () => {
    const { buildRecoveryEligibilityForState, resolveRecoveryMaxAttempts } = await loadRecovery();
    const root = setupRecoveryFixture({ recovered: true });
    cleanup.push(root);
    const flow = readJson(root, `specs/${specId}/flow.json`);
    flow.retryRecovery.entries[0].maxAttempts = 9;
    const initialEligibility = buildRecoveryEligibilityForState({
      root,
      flowState: flow,
      kind: "gate",
      phase: "task-impl",
      attempts: 3,
      maxAttempts: 3,
    });
    flow.retryRecovery.entries[0].changedEvidence.currentHash = initialEligibility.changedEvidence.currentHash;
    writeJson(root, `specs/${specId}/flow.json`, flow);

    assert.equal(resolveRecoveryMaxAttempts({
      root,
      flowState: flow,
      kind: "gate",
      phase: "task-impl",
      attempts: 3,
      resolvedMax: 3,
    }), 3);
    assert.equal(buildRecoveryEligibilityForState({
      root,
      flowState: flow,
      kind: "gate",
      phase: "task-impl",
      attempts: 3,
      maxAttempts: 3,
    }).reason, "changed-evidence");
  });

  it("propagates artifact authority through the CLI and rejects a missing root authority", async () => {
    const { resolveRecoveryMaxAttempts } = await loadRecovery();
    const root = setupRecoveryFixture({ recovered: true });
    cleanup.push(root);
    const flow = readJson(root, `specs/${specId}/flow.json`);
    flow.retryRecovery.entries[0].maxAttempts = 9;
    writeJson(root, `specs/${specId}/flow.json`, flow);

    const result = runSenti(root, [
      "flow", "set", "retry", "reset", "gate", "task-impl",
      "--reason", reason, "--yes",
    ]);
    assert.equal(result.status, 0, JSON.stringify(result));
    const artifact = assertPublicRecoveryArtifact(readJson(root, artifactPath));
    assert.equal(artifact.entries.length, 1);
    assert.equal(readPrivateRecoveryTransaction(root), null);
    assert.throws(() => resolveRecoveryMaxAttempts({
      flowState: flow,
      kind: "gate",
      phase: "task-impl",
      attempts: 3,
      resolvedMax: 3,
    }), /root authority is required/);
  });

  it("R6: real CLI output matches the unchanged public retry-recovery v1 schema", () => {
    const root = setupRecoveryFixture();
    cleanup.push(root);
    const result = runSenti(root, [
      "flow", "set", "retry", "reset", "gate", "task-impl",
      "--reason", reason, "--yes",
    ]);
    assert.equal(result.status, 0, JSON.stringify(result));
    const artifact = assertPublicRecoveryArtifact(readJson(root, artifactPath));
    assert.equal(artifact.entries.length, 1);
    assert.equal(artifact.entries[0].kind, "gate");
    assert.equal(artifact.entries[0].phase, "task-impl");
  });

  it("rejects tampered recovery artifacts without side effects and permits retry after repair", () => {
    const grant = publicRecoveryEntry();
    const pending = pendingRecoveryTransaction(grant);
    const invalidArtifacts = [
      {
        name: "multiple-pending-transactions",
        privateValue: { version: 1, transaction: [pending, { ...pending, grantId: "recovery-22222222-2222-4222-8222-222222222222" }] },
      },
      {
        name: "pending-without-grant",
        privateValue: { version: 1, transaction: pendingRecoveryTransaction(null) },
      },
      {
        name: "pending-with-rejection",
        privateValue: { version: 1, transaction: { ...pending, rejection: { code: "BAD", message: "invalid pending rejection" } } },
      },
      {
        name: "rejected-with-grant",
        privateValue: { version: 1, transaction: { ...pending, status: "rejected", rejection: { code: "BAD", message: "invalid rejected grant" } } },
      },
      {
        name: "foreign-grant-id",
        privateValue: { version: 1, transaction: { ...pending, grantId: "recovery-22222222-2222-4222-8222-222222222222" } },
      },
      {
        name: "foreign-spec",
        privateValue: { version: 1, transaction: { ...pending, request: { ...pending.request, spec: "specs/999-foreign/spec.json" } } },
      },
      {
        name: "foreign-run-id",
        privateValue: { version: 1, transaction: { ...pending, request: { ...pending.request, runId: "run-foreign" } } },
      },
      {
        name: "unexpected-private-key",
        privateValue: { version: 1, transaction: { ...pending, unexpected: true } },
      },
      {
        name: "duplicate-public-grant-id",
        publicValue: { version: 1, entries: [grant, { ...grant }] },
      },
      {
        name: "missing-public-required-field",
        publicValue: { version: 1, entries: [{ ...grant, recoveryCommand: undefined }] },
      },
    ];

    for (const tamper of invalidArtifacts) {
      const root = setupRecoveryFixture();
      cleanup.push(root);
      const external = createTmpDir("retry-recovery-tamper-external-");
      cleanup.push(external);
      const sentinel = path.join(external, "sentinel");
      fs.writeFileSync(sentinel, "unchanged");
      if (tamper.publicValue) writeJson(root, artifactPath, tamper.publicValue);
      if (tamper.privateValue) writeJson(root, transactionPath, tamper.privateValue);
      const before = snapshotRecoveryFiles(root);
      const result = runSenti(root, [
        "flow", "set", "retry", "reset", "gate", "task-impl",
        "--reason", reason, "--yes",
      ]);
      assert.notEqual(result.status, 0, tamper.name);
      assertNoMutation(root, before);
      assert.equal(fs.readFileSync(sentinel, "utf8"), "unchanged", tamper.name);
      assert.equal(fs.existsSync(path.join(root, "specs", specId, ".retry-recovery.lock")), false, tamper.name);

      writeJson(root, artifactPath, { version: 1, entries: [] });
      writeJson(root, transactionPath, { version: 1, transaction: null });
      const retry = runSenti(root, [
        "flow", "set", "retry", "reset", "gate", "task-impl",
        "--reason", reason, "--yes",
      ]);
      assert.equal(retry.status, 0, `${tamper.name}: ${JSON.stringify(retry)}`);
      assertPublicRecoveryArtifact(readJson(root, artifactPath));
    }
  });

  it("R1: TC-4 TC-5 TC-6 TC-7 TC-8 TC-9 TC-10: command input validates before side effects", async () => {
    const { RetryRecoveryInput } = await loadRecovery();
    const valid = new RetryRecoveryInput({
      action: "reset",
      kind: "gate",
      phase: "task-impl",
      reason,
      yes: true,
    });
    assert.equal(valid.kind, "gate");
    assert.equal(valid.canonicalPhase, "task-impl");

    const invalidInputs = [
      [{ action: "clear", kind: "gate", phase: "task-impl", reason, yes: true }, /action/i],
      [{ action: "reset", kind: "build", phase: "task-impl", reason, yes: true }, /kind/i],
      [{ action: "reset", kind: "gate", phase: "draft", reason, yes: true }, /phase/i],
      [{ action: "reset", kind: "review", phase: "integration", reason, yes: true }, /phase/i],
      [{ action: "reset", kind: "gate", phase: "task-impl", yes: true }, /reason/i],
      [{ action: "reset", kind: "review", phase: "spec", reason: "   ", yes: true }, /reason/i],
      [{ action: "reset", kind: "review", phase: "spec", reason: "x".repeat(501), yes: true }, /reason/i],
      [{ action: "reset", kind: "review", phase: "impl", reason, yes: false }, /yes/i],
    ];
    for (const [input, pattern] of invalidInputs) {
      assert.throws(() => new RetryRecoveryInput(input), pattern);
    }

    const root = setupRecoveryFixture();
    cleanup.push(root);
    const invalidCommands = [
      ["flow", "set", "retry", "clear", "gate", "task-impl", "--reason", reason, "--yes"],
      ["flow", "set", "retry", "reset", "build", "task-impl", "--reason", reason, "--yes"],
      ["flow", "set", "retry", "reset", "gate", "draft", "--reason", reason, "--yes"],
      ["flow", "set", "retry", "reset", "review", "integration", "--reason", reason, "--yes"],
      ["flow", "set", "retry", "reset", "gate", "task-impl", "--yes"],
      ["flow", "set", "retry", "reset", "review", "impl", "--reason", reason],
    ];
    for (const args of invalidCommands) {
      const before = snapshotRecoveryFiles(root);
      const result = runSenti(root, args);
      assert.notEqual(result.status, 0, `invalid command must fail: ${args.join(" ")}`);
      assert.equal(result.envelope.ok, false);
      assertNoMutation(root, before);
    }
  });

  it("R1: R2: R6: R7: TC-1 TC-2 TC-3: valid CLI recovery grants each recoverable target independently", async () => {
    const cases = [
      { kind: "gate", phase: "task-impl", activeStep: "task-gate" },
      { kind: "gate", phase: "integration", activeStep: "impl-gate" },
      { kind: "review", phase: "draft-questions", activeStep: "draft-questions-review" },
      { kind: "review", phase: "draft-coverage", activeStep: "draft-coverage-review" },
      { kind: "review", phase: "spec", activeStep: "spec-review" },
      { kind: "review", phase: "test", activeStep: "test-review" },
      { kind: "review", phase: "impl", activeStep: "impl-review" },
    ];

    for (const item of cases) {
      const root = setupRecoveryFixture(item);
      cleanup.push(root);
      const result = runSenti(root, [
        "flow",
        "set",
        "retry",
        "reset",
        item.kind,
        item.phase,
        "--reason",
        reason,
        "--yes",
      ]);
      assert.equal(result.status, 0, `${item.kind}/${item.phase} reset should exit 0`);
      assert.equal(result.envelope.ok, true);
      const flow = readJson(root, `specs/${specId}/flow.json`);
      const recovery = assertPublicRecoveryArtifact(readJson(root, artifactPath));
      const issueLog = readJson(root, issueLogPath);
      assert.equal(flow.retryRecovery.entries.length, 1, `${item.kind}/${item.phase} writes one flow recovery entry`);
      assert.equal(recovery.entries.length, 1, "artifact records one durable grant");
      assert.equal(recovery.entries[0].kind, item.kind);
      assert.equal(recovery.entries[0].phase, item.phase);
      assert.equal(readPrivateRecoveryTransaction(root), null);
      assert.equal(issueLog.entries.length, 1, "issue-log records one durable grant");
      assert.equal(issueLog.entries[0].grantId, recovery.entries[0].id);
      assert.equal(flow.retryRecovery.entries[0].kind, item.kind);
      assert.equal(flow.retryRecovery.entries[0].phase, item.phase);
      assert.equal(flow.retryRecovery.entries[0].counterAfter, 2);
      assert.equal(flow.metrics.at(-1).delta, 2, "reset grant leaves one reevaluation before exhaustion");
    }
  });

  it("R1: TC-9: reason length boundary accepts the configured maximum and rejects maximum plus one", async () => {
    const { RECOVERY_REASON_MAX_LENGTH, RetryRecoveryInput } = await loadRecovery();
    const maxReason = "x".repeat(RECOVERY_REASON_MAX_LENGTH);
    const valid = new RetryRecoveryInput({
      action: "reset",
      kind: "review",
      phase: "spec",
      reason: maxReason,
      yes: true,
    });
    assert.equal(valid.reason.length, RECOVERY_REASON_MAX_LENGTH);
    assert.throws(() => new RetryRecoveryInput({
      action: "reset",
      kind: "review",
      phase: "spec",
      reason: `${maxReason}x`,
      yes: true,
    }), /reason/i);
  });

  it("R2: recoverable target matrix is strict and displayable", async () => {
    const { resolveRecoveryTarget, buildRetryRecoveryView } = await loadRecovery();

    for (const phase of ["task-impl", "integration"]) {
      assert.deepEqual(resolveRecoveryTarget("gate", phase).toJSON(), {
        kind: "gate",
        phase,
        canonicalPhase: phase,
        recoverable: true,
        reason: "recoverable",
      });
    }
    for (const [phase, canonicalPhase] of [
      ["draft-questions", "draft-questions"],
      ["draft-coverage", "draft-coverage"],
      ["draft-questions-review", "draft-questions"],
      ["draft-coverage-review", "draft-coverage"],
      ["spec", "spec"],
      ["test", "test"],
      ["impl", "impl"],
    ]) {
      const target = resolveRecoveryTarget("review", phase);
      assert.equal(target.recoverable, true);
      assert.equal(target.canonicalPhase, canonicalPhase);
    }

    for (const phase of ["draft", "spec"]) {
      const target = resolveRecoveryTarget("gate", phase);
      assert.equal(target.recoverable, false);
      assert.equal(target.reason, "unsupported-plan-gate-phase");
      const view = buildRetryRecoveryView({
        kind: "gate",
        phase,
        canonicalPhase: phase,
        attempts: 3,
        max: 3,
        recoveryPossible: false,
        recoveryReason: target.reason,
        changedEvidence: null,
        reason,
      });
      assert.equal(view.recoveryPossible, false);
      assert.equal(view.recoveryCommand, null);
    }
  });

  it("R2: R8: TC-11 TC-12: exhausted gate draft and spec display no recovery command and reject reset", () => {
    for (const phase of ["draft", "spec"]) {
      const root = setupRecoveryFixture({
        activeStep: phase === "draft" ? "draft-gate" : "spec-gate",
        kind: "gate",
        phase,
      });
      cleanup.push(root);
      const next = runSenti(root, ["flow", "get", "next-action"]);
      const status = runSenti(root, ["flow", "get", "status"]);
      for (const envelope of [next.envelope, status.envelope]) {
        const view = envelope.data.retryRecovery || envelope.data.gateStop || envelope.data.reviewStop;
        assert.equal(view.kind, "gate");
        assert.equal(view.phase, phase);
        assert.equal(view.recoveryPossible, false);
        assert.equal(view.recoveryReason, "unsupported-plan-gate-phase");
        assert.equal(view.recoveryCommand, null);
      }
      const before = snapshotRecoveryFiles(root);
      const reset = runSenti(root, [
        "flow",
        "set",
        "retry",
        "reset",
        "gate",
        phase,
        "--reason",
        reason,
        "--yes",
      ]);
      assert.notEqual(reset.status, 0);
      assert.equal(reset.envelope.ok, false);
      assertNoMutation(root, before);
    }
  });

  it("R3: TC-13 TC-14: review FAIL and review stop persist canonical phase baselines before exhaustion", async () => {
    const {
      EvidenceFingerprint,
      ReviewRecoveryBaseline,
      persistReviewRecoveryBaseline,
    } = await loadRecovery();
    const state = { reviewRecoveryBaselines: [] };
    const fingerprint = new EvidenceFingerprint({
      sourceKind: "spec-json",
      hash: "spec-before",
      paths: [specPath],
      truncated: false,
    });

    const failBaseline = persistReviewRecoveryBaseline(state, {
      phase: "draft-questions-review",
      trigger: "review-verdict-fail",
      fingerprint,
      createdAt: "2026-05-18T00:00:00.000Z",
    });
    const stopBaseline = persistReviewRecoveryBaseline(state, {
      phase: "spec",
      trigger: "review-stop",
      fingerprint,
      createdAt: "2026-05-18T00:00:01.000Z",
    });

    assert.ok(failBaseline instanceof ReviewRecoveryBaseline);
    assert.equal(failBaseline.canonicalPhase, "draft-questions");
    assert.equal(stopBaseline.canonicalPhase, "spec");
    assert.deepEqual(state.reviewRecoveryBaselines.map((entry) => entry.trigger), [
      "review-verdict-fail",
      "review-stop",
    ]);
  });

  it("R4: R5: TC-15 TC-16: eligibility uses mapped evidence and latest matching baseline", async () => {
    const {
      EvidenceFingerprint,
      ReviewRecoveryBaseline,
      evaluateRecoveryEligibility,
      resolveRecoveryEvidenceSource,
    } = await loadRecovery();
    const oldDraftBaseline = new ReviewRecoveryBaseline({
      kind: "review",
      phase: "draft-questions",
      canonicalPhase: "draft-questions",
      fingerprint: new EvidenceFingerprint({
        sourceKind: "draft-json",
        hash: "old-draft",
        paths: ["specs/001-test/draft.json"],
        truncated: false,
      }),
      createdAt: "2026-05-18T00:00:00.000Z",
    });
    const matchingBaseline = new ReviewRecoveryBaseline({
      kind: "review",
      phase: "spec",
      canonicalPhase: "spec",
      fingerprint: new EvidenceFingerprint({
        sourceKind: "spec-json",
        hash: "spec-before",
        paths: [specPath],
        truncated: false,
      }),
      createdAt: "2026-05-18T00:00:01.000Z",
    });
    const current = new EvidenceFingerprint({
      sourceKind: "spec-json",
      hash: "spec-after",
      paths: [specPath, "unmapped.log"],
      truncated: false,
    });

    const eligibility = evaluateRecoveryEligibility({
      kind: "review",
      phase: "spec",
      maxAttempts: 3,
      attempts: 3,
      baselines: [oldDraftBaseline, matchingBaseline],
      currentFingerprint: current,
      mappedSource: resolveRecoveryEvidenceSource({
        kind: "review",
        canonicalPhase: "spec",
        specDir: `specs/${specId}`,
      }),
    });
    assert.equal(eligibility.recoverable, true);
    assert.equal(eligibility.changedEvidence.changed, true);
    assert.deepEqual(eligibility.changedEvidence.changedPaths, [specPath]);

    const unchanged = evaluateRecoveryEligibility({
      kind: "review",
      phase: "spec",
      maxAttempts: 3,
      attempts: 3,
      baselines: [matchingBaseline],
      currentFingerprint: matchingBaseline.fingerprint,
      mappedSource: resolveRecoveryEvidenceSource({
        kind: "review",
        canonicalPhase: "spec",
        specDir: `specs/${specId}`,
      }),
    });
    assert.equal(unchanged.recoverable, false);
    assert.equal(unchanged.reason, "unchanged-evidence");

    const missingBaseline = evaluateRecoveryEligibility({
      kind: "gate",
      phase: "task-impl",
      maxAttempts: 3,
      attempts: 3,
      baselines: [matchingBaseline],
      currentFingerprint: current,
      mappedSource: resolveRecoveryEvidenceSource({
        kind: "gate",
        canonicalPhase: "task-impl",
        specDir: `specs/${specId}`,
      }),
    });
    assert.equal(missingBaseline.recoverable, false);
    assert.equal(missingBaseline.reason, "missing-baseline");
  });

  it("R5: TC-17: unchanged exhausted reset leaves public and private audit authorities unchanged", () => {
    const root = setupRecoveryFixture({
      activeStep: "spec-review",
      kind: "review",
      phase: "spec",
      baselineHash: "same",
      currentHash: "same",
    });
    cleanup.push(root);
    const before = snapshotRecoveryFiles(root);
    const result = runSenti(root, [
      "flow",
      "set",
      "retry",
      "reset",
      "review",
      "spec",
      "--reason",
      reason,
      "--yes",
    ]);
    assert.notEqual(result.status, 0);
    assert.equal(result.envelope.ok, false);
    assert.equal(result.envelope.errors[0].code, "UNCHANGED_EVIDENCE");
    assert.equal(fs.readFileSync(path.join(root, `specs/${specId}/flow.json`), "utf8"), before.flow);
    assert.equal(fs.readFileSync(path.join(root, issueLogPath), "utf8"), before.issueLog);
    const artifact = assertPublicRecoveryArtifact(readJson(root, artifactPath));
    assert.equal(artifact.entries.length, 0);
    assert.equal(readPrivateRecoveryTransaction(root), null);
  });

  it("two CLI processes released from the same pre-lock barrier commit exactly one grant", async () => {
    const root = setupRecoveryFixture();
    cleanup.push(root);
    const command = [
      "flow", "set", "retry", "reset", "gate", "task-impl",
      "--reason", reason, "--yes",
    ];
    const barrierDir = path.join(root, ".retry-barrier");
    const releasePath = path.join(barrierDir, "release");
    const hookPath = path.join(root, "retry-barrier-hook.mjs");
    fs.mkdirSync(barrierDir);
    fs.writeFileSync(hookPath, `
      import fs from "node:fs";
      import path from "node:path";
      import { RetryRecoveryOperationLock } from ${JSON.stringify(pathToFileURL(recoveryPath).href)};
      const original = RetryRecoveryOperationLock.prototype.acquire;
      RetryRecoveryOperationLock.prototype.acquire = function acquireWithBarrier(...args) {
        fs.writeSync(Number(process.env.RETRY_READY_FD), process.pid + "\\n");
        fs.closeSync(Number(process.env.RETRY_READY_FD));
        const release = path.join(process.env.RETRY_BARRIER_DIR, "release");
        while (!fs.existsSync(release)) {
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
        }
        return original.apply(this, args);
      };
    `);
    const childOptions = {
      importFile: hookPath,
      env: { RETRY_BARRIER_DIR: barrierDir, RETRY_READY_FD: "3" },
      readyFd: true,
    };
    const first = startSenti(root, command, childOptions);
    const second = startSenti(root, command, childOptions);
    const diagnosticPaths = [
      path.join(root, path.dirname(specPath), ".retry-recovery.lock"),
      path.join(root, artifactPath),
      path.join(root, transactionPath),
      path.join(root, `.senti/.repository-flow-operation.lock`),
      path.join(root, `specs/${specId}/flow.json`),
    ];
    let results;
    try {
      await Promise.all([
        waitForReadySignal(first, diagnosticPaths),
        waitForReadySignal(second, diagnosticPaths),
      ]);
      fs.writeFileSync(releasePath, "release");
      results = await Promise.all([first.result, second.result]);
    } finally {
      if (!fs.existsSync(releasePath)) fs.writeFileSync(releasePath, "release");
      await Promise.allSettled([first.result, second.result]);
    }
    const winners = results.filter((result) => result.status === 0);
    const losers = results.filter((result) => result.status !== 0);
    assert.equal(winners.length, 1, JSON.stringify(results));
    assert.equal(losers.length, 1, JSON.stringify(results));
    assert.ok(
      ["RECOVERY_OPERATION_BUSY", "RECOVERY_ALREADY_GRANTED"].includes(losers[0].envelope.errors[0].code),
      JSON.stringify(losers[0]),
    );
    const flow = readJson(root, `specs/${specId}/flow.json`);
    assert.equal(flow.retryRecovery.entries.length, 1);
    const recovery = assertPublicRecoveryArtifact(readJson(root, artifactPath));
    const issueLog = readJson(root, issueLogPath);
    assert.equal(recovery.entries.length, 1);
    assert.equal(readPrivateRecoveryTransaction(root), null);
    assert.equal(issueLog.entries.length, 1);
    assert.equal(issueLog.entries[0].grantId, recovery.entries[0].id);
    const grantMetrics = flow.metrics.slice(3);
    assert.equal(grantMetrics.filter((metric) => metric.reset === true).length, 1);
    assert.equal(grantMetrics.filter((metric) => metric.delta === 2).length, 1);
  });

  it("serializes a concurrent issue-log CLI append with retry recovery without lost entries", async () => {
    const root = setupRecoveryFixture();
    cleanup.push(root);
    const barrierDir = path.join(root, ".issue-log-barrier");
    const readyPath = path.join(barrierDir, "ready");
    const releasePath = path.join(barrierDir, "release");
    const hookPath = path.join(root, "issue-log-write-barrier.mjs");
    fs.mkdirSync(barrierDir);
    fs.writeFileSync(hookPath, `
      import fs from "node:fs";
      import path from "node:path";
      import { AtomicJsonFile } from ${JSON.stringify(pathToFileURL(path.join(repoRoot, "src/lib/atomic-json-file.js")).href)};
      const original = AtomicJsonFile.prototype.write;
      let paused = false;
      AtomicJsonFile.prototype.write = function writeWithIssueLogBarrier(value) {
        if (!paused && path.basename(this.filePath) === "issue-log.json") {
          paused = true;
          fs.writeFileSync(process.env.ISSUE_LOG_READY, "ready");
          const deadline = Date.now() + 5000;
          while (!fs.existsSync(process.env.ISSUE_LOG_RELEASE)) {
            if (Date.now() >= deadline) throw new Error("issue-log barrier timed out");
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
          }
        }
        return original.call(this, value);
      };
    `);
    const recovery = spawnSenti(root, [
      "flow", "set", "retry", "reset", "gate", "task-impl",
      "--reason", reason, "--yes",
    ], {
      importFile: hookPath,
      env: { ISSUE_LOG_READY: readyPath, ISSUE_LOG_RELEASE: releasePath },
    });
    await waitFor(() => fs.existsSync(readyPath), "retry process must pause before issue-log write");
    const concurrent = spawnSenti(root, [
      "flow", "set", "issue-log",
      "--step", "concurrent-writer",
      "--reason", "Concurrent writer entry must remain durable.",
    ]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    fs.writeFileSync(releasePath, "release");
    const [recoveryResult, concurrentResult] = await Promise.all([recovery, concurrent]);
    assert.equal(recoveryResult.status, 0, JSON.stringify(recoveryResult));
    assert.equal(concurrentResult.status, 0, JSON.stringify(concurrentResult));
    const entries = readJson(root, issueLogPath).entries;
    assert.equal(entries.filter((entry) => entry.step === "retry-recovery").length, 1);
    assert.equal(entries.filter((entry) => entry.step === "concurrent-writer").length, 1);
  });

  it("pending recovery resumes idempotently after each durable crash phase", async () => {
    const { RetryRecoveryInput, applyRetryRecoveryGrant, resolveRecoveryMaxAttempts } = await loadRecovery();
    const phases = ["after-pending", "after-flow-commit", "after-issue-log"];
    for (const phase of phases) {
      const root = setupRecoveryFixture();
      cleanup.push(root);
      const input = new RetryRecoveryInput({
        action: "reset",
        kind: "gate",
        phase: "task-impl",
        reason,
        yes: true,
      });
      assert.throws(() => applyRetryRecoveryGrant({
        ...recoveryGrantRequest(root, input, { attempts: 3, maxAttempts: 3 }),
        recoveryFaultInjector(event) {
          if (event.phase === phase) throw new Error(`crash:${phase}`);
        },
      }), new RegExp(`crash:${phase}`));

      const publicBeforeResume = assertPublicRecoveryArtifact(readJson(root, artifactPath));
      assert.equal(publicBeforeResume.entries.length, 0, phase);
      const pending = readPrivateRecoveryTransaction(root);
      assert.equal(pending.status, "pending", phase);
      const pendingFlow = readJson(root, `specs/${specId}/flow.json`);
      assert.equal(resolveRecoveryMaxAttempts({
        root,
        flowState: pendingFlow,
        kind: "gate",
        phase: "task-impl",
        attempts: 3,
        resolvedMax: 5,
      }), 3, `${phase}: pending request snapshot owns the in-flight budget`);
      const next = runSenti(root, ["flow", "get", "next-action"]);
      assert.equal(next.envelope.data.retryRecovery.recoveryReason, "recovery-resume-required", phase);

      const resumed = applyRetryRecoveryGrant(
        recoveryGrantRequest(root, input, { attempts: 3, maxAttempts: 3 }),
      );
      assert.equal(resumed.id, pending.grantId, phase);
      const artifact = assertPublicRecoveryArtifact(readJson(root, artifactPath));
      const issueLog = readJson(root, issueLogPath);
      const flow = readJson(root, `specs/${specId}/flow.json`);
      assert.equal(artifact.entries.length, 1, phase);
      assert.equal(artifact.entries[0].id, resumed.id, phase);
      assert.equal(readPrivateRecoveryTransaction(root), null, phase);
      assert.equal(issueLog.entries.filter((entry) => entry.grantId === resumed.id).length, 1, phase);
      assert.equal(flow.retryRecovery.entries.filter((entry) => entry.id === resumed.id).length, 1, phase);
    }
  });

  it("a crash after public artifact commit resumes the private transaction without duplicate append", async () => {
    const { RetryRecoveryInput, applyRetryRecoveryGrant } = await loadRecovery();
    const root = setupRecoveryFixture();
    cleanup.push(root);
    const input = new RetryRecoveryInput({
      action: "reset",
      kind: "gate",
      phase: "task-impl",
      reason,
      yes: true,
    });
    assert.throws(() => applyRetryRecoveryGrant({
      ...recoveryGrantRequest(root, input, { attempts: 3, maxAttempts: 3 }),
      recoveryFaultInjector(event) {
        if (event.phase === "after-artifact-commit") throw new Error("crash:after-artifact-commit");
      },
    }), /crash:after-artifact-commit/);
    const beforeArtifact = assertPublicRecoveryArtifact(readJson(root, artifactPath));
    assert.equal(beforeArtifact.entries.length, 1);
    assert.equal(readPrivateRecoveryTransaction(root).status, "pending");
    const result = runSenti(root, [
      "flow", "set", "retry", "reset", "gate", "task-impl",
      "--reason", reason, "--yes",
    ]);
    assert.equal(result.status, 0, JSON.stringify(result));
    const artifact = assertPublicRecoveryArtifact(readJson(root, artifactPath));
    assert.deepEqual(artifact, beforeArtifact);
    assert.equal(readPrivateRecoveryTransaction(root), null);
    assert.equal(readJson(root, issueLogPath).entries.filter((entry) => entry.grantId === artifact.entries[0].id).length, 1);
  });

  it("real SIGKILL at every durable boundary is reclaimed and converges exactly once", async () => {
    const phases = ["pending", "flow", "issue", "artifact"];
    for (const phase of phases) {
      const root = setupRecoveryFixture();
      cleanup.push(root);
      const marker = path.join(root, `.sigkill-${phase}`);
      const hookPath = path.join(root, `sigkill-${phase}.mjs`);
      fs.writeFileSync(hookPath, `
        import fs from "node:fs";
        import path from "node:path";
        import { AtomicJsonFile } from ${JSON.stringify(pathToFileURL(path.join(repoRoot, "src/lib/atomic-json-file.js")).href)};
        import { AtomicFlowStateWriter } from ${JSON.stringify(pathToFileURL(path.join(repoRoot, "src/lib/flow-state-atomic-writer.js")).href)};
        const crash = (phase) => {
          if (process.env.RECOVERY_CRASH_PHASE !== phase) return;
          fs.writeFileSync(process.env.RECOVERY_CRASH_MARKER, phase);
          process.kill(process.pid, "SIGKILL");
        };
        const originalJsonWrite = AtomicJsonFile.prototype.write;
        AtomicJsonFile.prototype.write = function writeWithCrash(value) {
          const result = originalJsonWrite.call(this, value);
          const name = path.basename(this.filePath);
          const records = Array.isArray(value?.entries) ? value.entries : [];
          if (
            name === ".retry-recovery.transaction.json"
            && value?.transaction?.status === "pending"
          ) crash("pending");
          if (
            name === "issue-log.json"
            && records.some((entry) => typeof entry?.grantId === "string")
          ) crash("issue");
          if (
            name === "retry-recovery.json"
            && records.length > 0
            && records.every((entry) => typeof entry?.kind === "string")
          ) crash("artifact");
          return result;
        };
        const originalFlowMutate = AtomicFlowStateWriter.prototype.mutate;
        AtomicFlowStateWriter.prototype.mutate = function mutateWithCrash(...args) {
          const result = originalFlowMutate.apply(this, args);
          const state = JSON.parse(fs.readFileSync(this.pathAuthority.statePath, "utf8"));
          if (state.retryRecovery?.entries?.length > 0) crash("flow");
          return result;
        };
      `);
      const killed = spawnSenti(root, [
        "flow", "set", "retry", "reset", "gate", "task-impl",
        "--reason", reason, "--yes",
      ], {
        importFile: hookPath,
        env: { RECOVERY_CRASH_PHASE: phase, RECOVERY_CRASH_MARKER: marker },
      });
      await waitFor(() => fs.existsSync(marker), `${phase}: child must reach durable boundary`);
      const killedResult = await killed;
      assert.equal(killedResult.signal, "SIGKILL", phase);
      assert.equal(fs.existsSync(path.join(root, "specs", specId, ".retry-recovery.lock")), true, phase);

      const resumed = runSenti(root, [
        "flow", "set", "retry", "reset", "gate", "task-impl",
        "--reason", reason, "--yes",
      ]);
      if (resumed.status !== 0) {
        assert.equal(resumed.envelope.errors[0].code, "RECOVERY_ALREADY_GRANTED", `${phase}: ${JSON.stringify(resumed)}`);
      }
      const artifact = assertPublicRecoveryArtifact(readJson(root, artifactPath));
      const issueLog = readJson(root, issueLogPath);
      const flow = readJson(root, `specs/${specId}/flow.json`);
      assert.equal(artifact.entries.length, 1, phase);
      assert.equal(issueLog.entries.filter((entry) => entry.grantId === artifact.entries[0].id).length, 1, phase);
      assert.equal(flow.retryRecovery.entries.filter((entry) => entry.id === artifact.entries[0].id).length, 1, phase);
      const metrics = flow.metrics.slice(3);
      assert.equal(metrics.filter((entry) => entry.reset === true).length, 1, phase);
      assert.equal(metrics.filter((entry) => entry.delta === 2).length, 1, phase);
      assert.equal(fs.existsSync(path.join(root, "specs", specId, ".retry-recovery.lock")), false, phase);
      assert.equal(fs.existsSync(path.join(root, "specs", specId, ".issue-log.lock")), false, phase);
    }
  });

  it("explicit retry claims a stale recovery owner while unknown and corrupt owners fail closed", async () => {
    const { RetryRecoveryInput, RetryRecoveryOperationLock, applyRetryRecoveryGrant } = await loadRecovery();
    const root = setupRecoveryFixture();
    cleanup.push(root);
    const input = new RetryRecoveryInput({
      action: "reset",
      kind: "gate",
      phase: "task-impl",
      reason,
      yes: true,
    });
    assert.throws(() => applyRetryRecoveryGrant({
      ...recoveryGrantRequest(root, input, { attempts: 3, maxAttempts: 3 }),
      recoveryFaultInjector(event) {
        if (event.phase === "after-pending") throw new Error("crash leaves pending");
      },
    }), /crash leaves pending/);

    const lockPath = path.join(root, "specs", specId, ".retry-recovery.lock");
    const owner = {
      version: 1,
      kind: "retry-recovery-operation",
      root: path.resolve(root),
      spec: specPath,
      artifactPath: path.join(root, artifactPath),
      processIdentity: {
        pid: process.pid,
        bootIdentity: "definitely-stale-boot",
        startFingerprint: "1",
        ownerToken: "11111111-1111-4111-8111-111111111111",
      },
    };
    fs.writeFileSync(lockPath, `${JSON.stringify(owner)}\n`);
    const resumed = runSenti(root, [
      "flow", "set", "retry", "reset", "gate", "task-impl",
      "--reason", reason, "--yes",
    ]);
    assert.equal(resumed.status, 0, JSON.stringify(resumed));
    assertPublicRecoveryArtifact(readJson(root, artifactPath));
    assert.equal(readPrivateRecoveryTransaction(root), null);

    const secondRoot = setupRecoveryFixture();
    cleanup.push(secondRoot);
    const secondLockPath = path.join(secondRoot, "specs", specId, ".retry-recovery.lock");
    const liveOwner = {
      ...owner,
      root: path.resolve(secondRoot),
      artifactPath: path.join(secondRoot, artifactPath),
      processIdentity: {
        ...owner.processIdentity,
        bootIdentity: "boot",
        startFingerprint: "100",
      },
    };
    fs.writeFileSync(secondLockPath, `${JSON.stringify(liveOwner)}\n`);
    const unknownSource = new ProcessIdentitySource({
      platform: "linux",
      pid: process.pid,
      readBootIdentity() { throw Object.assign(new Error("unavailable"), { code: "EACCES" }); },
      readProcessStartFingerprint() { return "100"; },
    });
    const unknownLock = new RetryRecoveryOperationLock({
      root: secondRoot,
      spec: specPath,
      processIdentitySource: unknownSource,
    });
    const unknownBefore = fs.readFileSync(secondLockPath);
    assert.throws(
      () => unknownLock.acquire(),
      (error) => error.code === "RECOVERY_OPERATION_LOCK_UNKNOWN",
    );
    assert.deepEqual(fs.readFileSync(secondLockPath), unknownBefore);

    fs.writeFileSync(secondLockPath, "{broken\n");
    const corruptBefore = fs.readFileSync(secondLockPath);
    assert.throws(
      () => new RetryRecoveryOperationLock({ root: secondRoot, spec: specPath }).acquire(),
      (error) => error.code === "RECOVERY_OPERATION_LOCK_CORRUPT",
    );
    assert.deepEqual(fs.readFileSync(secondLockPath), corruptBefore);
  });

  it("R6: R11: artifact authority commits before success and agrees with issue-log and flow", () => {
    const root = setupRecoveryFixture();
    cleanup.push(root);
    const before = snapshotRecoveryFiles(root);
    const result = runSenti(root, [
      "flow", "set", "retry", "reset", "gate", "task-impl",
      "--reason", reason, "--yes",
    ]);

    assert.equal(result.status, 0, JSON.stringify(result));
    const after = snapshotRecoveryFiles(root);
    assert.notEqual(after.flow, before.flow);
    assert.notEqual(after.recovery, before.recovery);
    assert.notEqual(after.issueLog, before.issueLog);
    const flow = JSON.parse(after.flow);
    const artifact = assertPublicRecoveryArtifact(JSON.parse(after.recovery));
    const issueLog = JSON.parse(after.issueLog);
    assert.equal(flow.retryRecovery.entries.length, 1);
    assert.equal(flow.retryRecovery.entries[0].reason, reason);
    assert.equal(artifact.entries.length, 1);
    assert.equal(artifact.entries[0].id, flow.retryRecovery.entries[0].id);
    assert.equal(readPrivateRecoveryTransaction(root), null);
    assert.equal(issueLog.entries.length, 1);
    assert.equal(issueLog.entries[0].grantId, artifact.entries[0].id);
  });

  it("R5: R6: R7: TC-18 TC-19 TC-20: granted recovery appends audit artifacts after eligibility succeeds", async () => {
    const {
      ChangedEvidenceSummary,
      RetryRecoveryInput,
      applyRetryRecoveryGrant,
      buildOneAttemptGrantMetrics,
    } = await loadRecovery();
    const root = setupRecoveryFixture({ attempts: 4, maxAttempts: 4 });
    cleanup.push(root);
    const flowPath = path.join(root, `specs/${specId}/flow.json`);
    const input = new RetryRecoveryInput({
      action: "reset",
      kind: "gate",
      phase: "task-impl",
      reason,
      yes: true,
    });
    const changedEvidence = new ChangedEvidenceSummary({
      sourceKind: "implementation-diff",
      baselineHash: "before",
      currentHash: "after",
      changedPaths: ["src/changed.js"],
      truncated: false,
    });

    const grant = applyRetryRecoveryGrant(recoveryGrantRequest(root, input, {
      attempts: 4,
      maxAttempts: 4,
      createdAt: "2026-05-18T00:00:02.000Z",
    }));

    assert.equal(grant.counterAfter, 3);
    assert.deepEqual(buildOneAttemptGrantMetrics({
      counter: "gateRetry",
      phase: "task-impl",
      maxAttempts: 4,
    }), [
      { phase: "task-impl", counter: "gateRetry", delta: 0, reset: true },
      { phase: "task-impl", counter: "gateRetry", delta: 3 },
    ]);

    const flow = JSON.parse(fs.readFileSync(flowPath, "utf8"));
    const lastMetric = flow.metrics.at(-1);
    const entry = flow.retryRecovery.entries.at(-1);

    assert.equal(entry.kind, "gate");
    assert.equal(entry.phase, "task-impl");
    assert.equal(entry.canonicalPhase, "task-impl");
    assert.equal(entry.reason, reason);
    assert.equal(entry.permittedReevaluationCount, 1);
    assert.equal(entry.attemptsBefore, 4);
    assert.equal(entry.maxAttempts, 4);
    assert.equal(entry.counterAfter, 3);
    assert.equal(entry.recoveryCommand, `senti flow set retry reset gate task-impl --reason "${reason}" --yes`);
    const artifact = assertPublicRecoveryArtifact(readJson(root, artifactPath));
    const issueLog = readJson(root, issueLogPath);
    assert.equal(artifact.entries.length, 1);
    assert.equal(artifact.entries[0].id, entry.id);
    assert.equal(readPrivateRecoveryTransaction(root), null);
    assert.equal(issueLog.entries.length, 1);
    assert.equal(issueLog.entries[0].grantId, artifact.entries[0].id);
    assert.equal(lastMetric.counter, "gateRetry");
    assert.equal(lastMetric.delta, 3);
    assert.ok(new Date(lastMetric.ts) >= new Date(entry.createdAt), "metrics are appended after artifact creation");
  });

  it("R7: TC-20: counterAfter is maxAttempts minus one for boundary values", async () => {
    const { buildOneAttemptGrantMetrics } = await loadRecovery();
    for (const maxAttempts of [1, 2, 3]) {
      const metrics = buildOneAttemptGrantMetrics({
        counter: "reviewRetry",
        phase: "spec",
        maxAttempts,
      });
      assert.deepEqual(metrics, [
        { phase: "spec", counter: "reviewRetry", delta: 0, reset: true },
        { phase: "spec", counter: "reviewRetry", delta: maxAttempts - 1 },
      ]);
    }
  });

  it("R6: separate recovery grants append flow audit entries in chronological order", async () => {
    const {
      RetryRecoveryInput,
      applyRetryRecoveryGrant,
    } = await loadRecovery();
    const root = setupRecoveryFixture();
    cleanup.push(root);
    const firstInput = new RetryRecoveryInput({
        action: "reset",
        kind: "gate",
        phase: "task-impl",
        reason,
        yes: true,
    });
    applyRetryRecoveryGrant(recoveryGrantRequest(root, firstInput, {
      attempts: 3,
      maxAttempts: 3,
      createdAt: "2026-05-18T00:00:01.000Z",
    }));
    makeFlowManager(root).mutate((flow) => {
      flow.metrics.push({ phase: "task-impl", counter: "gateRetry", delta: 1, taskId: null });
    });
    writeFile(root, "src/changed.js", "export const value = 'second-change';\n");
    applyRetryRecoveryGrant(recoveryGrantRequest(root, firstInput, {
      attempts: 3,
      maxAttempts: 3,
      createdAt: "2026-05-18T00:00:02.000Z",
    }));
    const recovery = readJson(root, `specs/${specId}/flow.json`).retryRecovery;
    assert.deepEqual(recovery.entries.map((entry) => entry.kind), ["gate", "gate"]);
    assert.ok(recovery.entries[0].createdAt < recovery.entries[1].createdAt);
    const artifact = readJson(root, artifactPath);
    const issueLog = readJson(root, issueLogPath);
    assertPublicRecoveryArtifact(artifact);
    assert.deepEqual(artifact.entries.map((entry) => entry.kind), ["gate", "gate"]);
    assert.deepEqual(issueLog.entries.map((entry) => entry.grantId), artifact.entries.map((entry) => entry.id));
    assert.equal(readPrivateRecoveryTransaction(root), null);
  });

  it("records a private rejection and leaves public artifact, issue-log, and flow bytes unchanged when flow save fails", async () => {
    const {
      ChangedEvidenceSummary,
      RetryRecoveryInput,
      applyRetryRecoveryGrant,
    } = await loadRecovery();
    const root = setupRecoveryFixture({ attempts: 3, maxAttempts: 3 });
    cleanup.push(root);
    const before = snapshotRecoveryFiles(root);

    const input = new RetryRecoveryInput({
        action: "reset",
        kind: "gate",
        phase: "task-impl",
        reason,
        yes: true,
    });
    assert.throws(() => applyRetryRecoveryGrant(recoveryGrantRequest(root, input, {
      attempts: 3,
      maxAttempts: 3,
      faultInjector({ phase }) {
        if (phase === "before-state-temp-write") throw new Error("injected flow save failure");
      },
    })), /injected flow save failure/);

    assert.equal(fs.readFileSync(path.join(root, `specs/${specId}/flow.json`), "utf8"), before.flow);
    assert.equal(fs.readFileSync(path.join(root, issueLogPath), "utf8"), before.issueLog);
    const artifact = assertPublicRecoveryArtifact(readJson(root, artifactPath));
    assert.equal(artifact.entries.length, 0);
    const transaction = readPrivateRecoveryTransaction(root);
    assert.equal(transaction.status, "rejected");
    assert.equal(transaction.grant, null);
    assert.match(transaction.rejection.message, /injected flow save failure/);
  });

  it("rejects a symlinked issue-log authority before mutation and releases the operation lock", async () => {
    const { RetryRecoveryInput, applyRetryRecoveryGrant } = await loadRecovery();
    const root = setupRecoveryFixture();
    cleanup.push(root);
    const external = createTmpDir("retry-recovery-external-issue-log-");
    cleanup.push(external);
    const externalIssueLog = path.join(external, "issue-log.json");
    fs.writeFileSync(externalIssueLog, '{"entries":[]}\n');
    const localIssueLog = path.join(root, issueLogPath);
    fs.unlinkSync(localIssueLog);
    fs.symlinkSync(externalIssueLog, localIssueLog);
    const before = {
      flow: fs.readFileSync(path.join(root, `specs/${specId}/flow.json`)),
      artifact: fs.readFileSync(path.join(root, artifactPath)),
      issueLog: fs.readFileSync(localIssueLog),
      external: fs.readFileSync(externalIssueLog),
    };
    const input = new RetryRecoveryInput({
      action: "reset",
      kind: "gate",
      phase: "task-impl",
      reason,
      yes: true,
    });

    assert.throws(
      () => applyRetryRecoveryGrant(recoveryGrantRequest(root, input, { attempts: 3, maxAttempts: 3 })),
      /JSON authority must be a regular real file/,
    );
    assert.deepEqual(fs.readFileSync(path.join(root, `specs/${specId}/flow.json`)), before.flow);
    assert.deepEqual(fs.readFileSync(path.join(root, artifactPath)), before.artifact);
    assert.deepEqual(fs.readFileSync(localIssueLog), before.issueLog);
    assert.deepEqual(fs.readFileSync(externalIssueLog), before.external);
    assert.equal(fs.lstatSync(localIssueLog).isSymbolicLink(), true);
    assert.equal(fs.existsSync(path.join(root, "specs", specId, ".retry-recovery.lock")), false);

    fs.unlinkSync(localIssueLog);
    fs.writeFileSync(localIssueLog, '{"entries":[]}\n');
    const grant = applyRetryRecoveryGrant(
      recoveryGrantRequest(root, input, { attempts: 3, maxAttempts: 3 }),
    );
    const repairedArtifact = assertPublicRecoveryArtifact(readJson(root, artifactPath));
    assert.equal(repairedArtifact.entries[0].id, grant.id);
    assert.equal(readPrivateRecoveryTransaction(root), null);
    assert.equal(readJson(root, issueLogPath).entries[0].grantId, grant.id);
    assert.deepEqual(fs.readFileSync(externalIssueLog), before.external);
  });

  it("direct recovery grant before exhaustion is rejected without public or private audit mutation", async () => {
    const { RetryRecoveryInput, applyRetryRecoveryGrant } = await loadRecovery();
    const root = setupRecoveryFixture({
      attempts: 2,
      maxAttempts: 3,
      baselineHash: "a".repeat(64),
    });
    cleanup.push(root);
    const before = snapshotRecoveryFiles(root);
    const input = new RetryRecoveryInput({
      action: "reset",
      kind: "gate",
      phase: "task-impl",
      reason,
      yes: true,
    });
    assert.throws(
      () => applyRetryRecoveryGrant(recoveryGrantRequest(root, input, { attempts: 2, maxAttempts: 3 })),
      (error) => error.code === "RETRY_NOT_EXHAUSTED",
    );
    assert.equal(fs.readFileSync(path.join(root, `specs/${specId}/flow.json`), "utf8"), before.flow);
    assert.equal(fs.readFileSync(path.join(root, issueLogPath), "utf8"), before.issueLog);
    const artifact = assertPublicRecoveryArtifact(readJson(root, artifactPath));
    assert.equal(artifact.entries.length, 0);
    assert.equal(readPrivateRecoveryTransaction(root), null);
  });

  it("R6: requirement verification exposes the full recovery audit entry schema", async () => {
    const { ChangedEvidenceSummary, RetryRecoveryEntry } = await loadRecovery();
    const entry = new RetryRecoveryEntry({
      id: "recovery-schema",
      kind: "review",
      phase: "spec",
      canonicalPhase: "spec",
      reason,
      changedEvidence: new ChangedEvidenceSummary({
        sourceKind: "spec-json",
        baselineHash: "before",
        currentHash: "after",
        changedPaths: [specPath],
        truncated: false,
      }),
      permittedReevaluationCount: 1,
      attemptsBefore: 3,
      maxAttempts: 3,
      counterAfter: 2,
      recoveryCommand: `senti flow set retry reset review spec --reason "${reason}" --yes`,
      createdAt: "2026-05-18T00:00:02.000Z",
    }).toJSON();

    assert.deepEqual(Object.keys(entry), [
      "id",
      "kind",
      "phase",
      "canonicalPhase",
      "reason",
      "changedEvidence",
      "permittedReevaluationCount",
      "attemptsBefore",
      "maxAttempts",
      "counterAfter",
      "recoveryCommand",
      "createdAt",
    ]);
  });

  it("R7: R9: TC-21 TC-22 TC-25: one reevaluation re-exhausts, pass resets, and second recovery needs new evidence", async () => {
    const {
      ChangedEvidenceSummary,
      applyRecoveredRetryOutcome,
      buildRetryRecoveryView,
      evaluateRepeatedRecovery,
    } = await loadRecovery();
    const state = {
      metrics: [
        { phase: "spec", counter: "reviewRetry", delta: 0, reset: true },
        { phase: "spec", counter: "reviewRetry", delta: 2 },
      ],
      retryRecovery: { version: 1, entries: [{ kind: "review", canonicalPhase: "spec" }] },
    };

    const failed = applyRecoveredRetryOutcome(state, {
      kind: "review",
      phase: "spec",
      verdict: "fail",
      maxAttempts: 3,
    });
    assert.equal(failed.counterAfter, 3);
    assert.equal(failed.exhausted, true);
    const repeated = buildRetryRecoveryView({
      kind: "review",
      phase: "spec",
      canonicalPhase: "spec",
      attempts: 3,
      max: 3,
      recoveryPossible: false,
      recoveryReason: "one-recovery-already-used",
      changedEvidence: null,
      reason,
    });
    assert.equal(repeated.recoveryCommand, null);

    const unchangedSecond = evaluateRepeatedRecovery({
      priorRecoveryEntries: state.retryRecovery.entries,
      changedEvidence: new ChangedEvidenceSummary({
        sourceKind: "spec-json",
        baselineHash: "same",
        currentHash: "same",
        changedPaths: [],
        truncated: false,
      }),
    });
    assert.equal(unchangedSecond.recoverable, false);
    assert.equal(unchangedSecond.reason, "unchanged-evidence");

    const changedSecond = evaluateRepeatedRecovery({
      priorRecoveryEntries: state.retryRecovery.entries,
      changedEvidence: new ChangedEvidenceSummary({
        sourceKind: "spec-json",
        baselineHash: "same",
        currentHash: "new",
        changedPaths: [specPath],
        truncated: false,
      }),
    });
    assert.equal(changedSecond.recoverable, true);

    const passed = applyRecoveredRetryOutcome(state, {
      kind: "review",
      phase: "spec",
      verdict: "pass",
      maxAttempts: 3,
    });
    assert.equal(passed.counterAfter, 0);
    assert.equal(passed.exhausted, false);
  });

  it("R7: R9: TC-21 TC-22 TC-25: subsequent fail re-exhausts, pass resets, and unchanged second reset is rejected", async () => {
    const {
      ChangedEvidenceSummary,
      applyRecoveredRetryOutcome,
      evaluateRepeatedRecovery,
    } = await loadRecovery();
    const state = {
      metrics: [
        { phase: "task-impl", counter: "gateRetry", delta: 0, reset: true },
        { phase: "task-impl", counter: "gateRetry", delta: 2 },
      ],
      retryRecovery: {
        version: 1,
        entries: [{ kind: "gate", canonicalPhase: "task-impl", createdAt: "2026-05-18T00:00:01.000Z" }],
      },
    };

    const fail = applyRecoveredRetryOutcome(state, {
      kind: "gate",
      phase: "task-impl",
      verdict: "fail",
      maxAttempts: 3,
    });
    assert.equal(fail.counterAfter, 3);
    assert.equal(fail.exhausted, true);
    assert.equal(fail.autoRecoveryGranted, false);

    const repeated = evaluateRepeatedRecovery({
      priorRecoveryEntries: state.retryRecovery.entries,
      changedEvidence: new ChangedEvidenceSummary({
        sourceKind: "implementation-diff",
        baselineHash: "same",
        currentHash: "same",
        changedPaths: [],
        truncated: false,
      }),
    });
    assert.equal(repeated.recoverable, false);
    assert.equal(repeated.reason, "unchanged-evidence");

    const pass = applyRecoveredRetryOutcome(state, {
      kind: "gate",
      phase: "task-impl",
      verdict: "pass",
      maxAttempts: 3,
    });
    assert.equal(pass.counterAfter, 0);
    assert.equal(pass.exhausted, false);
  });

  it("R9: requirement verification does not expose an automatic second recovery command", async () => {
    const { buildRetryRecoveryView } = await loadRecovery();
    const view = buildRetryRecoveryView({
      kind: "review",
      phase: "spec",
      canonicalPhase: "spec",
      attempts: 3,
      max: 3,
      recoveryPossible: false,
      recoveryReason: "one-recovery-already-used",
      changedEvidence: null,
      reason,
    });

    assert.equal(view.recoveryPossible, false);
    assert.equal(view.recoveryCommand, null);
  });

  it("R8: TC-23 TC-24: next-action and status show exhausted recovery details", async () => {
    const root = setupRecoveryFixture({ activeStep: "spec-review", kind: "review", phase: "spec" });
    cleanup.push(root);
    const reset = runSenti(root, ["flow", "set", "retry", "reset", "review", "spec", "--reason", reason, "--yes"]);
    assert.equal(reset.status, 0);
    assert.equal(reset.envelope.ok, true);

    const next = runSenti(root, ["flow", "get", "next-action"]);
    const status = runSenti(root, ["flow", "get", "status"]);
    for (const envelope of [next.envelope, status.envelope]) {
      const view = envelope.data.reviewStop || envelope.data.retryRecovery;
      assert.equal(view.kind, "review");
      assert.equal(view.phase, "spec");
      assert.equal(view.canonicalPhase, "spec");
      assert.equal(view.attempts, 3);
      assert.equal(view.max, 3);
      assert.equal(view.recoveryPossible, true);
      assert.equal(view.recoveryReason, "changed-evidence");
      assert.deepEqual(view.changedEvidence.changedPaths, [specPath]);
      assert.match(view.recoveryCommand, /flow set retry reset review spec --reason/);
    }
  });

  it("R8: TC-23 TC-24: next-action and status display gate, review, and unrecoverable exhaustion", () => {
    const cases = [
      { kind: "gate", phase: "integration", activeStep: "impl-gate", recoverable: true },
      { kind: "review", phase: "spec", activeStep: "spec-review", recoverable: true },
      { kind: "gate", phase: "spec", activeStep: "spec-gate", recoverable: false },
    ];

    for (const item of cases) {
      const root = setupRecoveryFixture(item);
      cleanup.push(root);
      const next = runSenti(root, ["flow", "get", "next-action"]);
      const status = runSenti(root, ["flow", "get", "status"]);
      for (const envelope of [next.envelope, status.envelope]) {
        const view = envelope.data.retryRecovery || envelope.data.reviewStop || envelope.data.gateStop;
        assert.ok(view, `missing retry recovery view for ${item.kind}/${item.phase}: ${JSON.stringify(envelope.data)}`);
        assert.equal(view.kind, item.kind);
        assert.equal(view.phase, item.phase);
        assert.equal(view.canonicalPhase, item.phase);
        assert.equal(view.attempts, 3);
        assert.equal(view.max, 3);
        assert.equal(view.recoveryPossible, item.recoverable);
        if (item.recoverable) {
          assert.equal(view.recoveryReason, "changed-evidence");
          assert.deepEqual(view.changedEvidence.changedPaths.length > 0, true);
          assert.match(view.recoveryCommand, /flow set retry reset/);
        } else {
          assert.equal(view.recoveryReason, "unsupported-plan-gate-phase");
          assert.equal(view.recoveryCommand, null);
        }
      }
    }
  });

  it("R8: TC-23 TC-24: recovery display distinguishes changed and unchanged evidence", async () => {
    const { ChangedEvidenceSummary, buildRetryRecoveryView } = await loadRecovery();
    const changed = buildRetryRecoveryView({
      kind: "review",
      phase: "spec",
      canonicalPhase: "spec",
      attempts: 3,
      max: 3,
      recoveryPossible: true,
      recoveryReason: "changed-evidence",
      changedEvidence: new ChangedEvidenceSummary({
        sourceKind: "spec-json",
        baselineHash: "before",
        currentHash: "after",
        changedPaths: [specPath],
        truncated: false,
      }),
      reason,
    });
    assert.equal(changed.recoveryPossible, true);
    assert.deepEqual(changed.changedEvidence.changedPaths, [specPath]);
    assert.match(changed.recoveryCommand, /--reason/);

    const unchanged = buildRetryRecoveryView({
      kind: "review",
      phase: "spec",
      canonicalPhase: "spec",
      attempts: 3,
      max: 3,
      recoveryPossible: false,
      recoveryReason: "unchanged-evidence",
      changedEvidence: new ChangedEvidenceSummary({
        sourceKind: "spec-json",
        baselineHash: "same",
        currentHash: "same",
        changedPaths: [],
        truncated: false,
      }),
      reason,
    });
    assert.equal(unchanged.recoveryPossible, false);
    assert.equal(unchanged.recoveryCommand, null);
    assert.equal(unchanged.recoveryReason, "unchanged-evidence");
  });

  it("R4: R6: R7: TC-18 TC-19 TC-20: resolved maxAttempts and audit command/timestamps stay consistent", async () => {
    const {
      ChangedEvidenceSummary,
      RetryRecoveryInput,
      applyRetryRecoveryGrant,
      buildRetryRecoveryView,
    } = await loadRecovery();
    const root = setupRecoveryFixture({ attempts: 5, maxAttempts: 5 });
    cleanup.push(root);
    const command = `senti flow set retry reset gate task-impl --reason "${reason}" --yes`;
    const changedEvidence = new ChangedEvidenceSummary({
      sourceKind: "implementation-diff",
      baselineHash: "before",
      currentHash: "after",
      changedPaths: ["src/changed.js"],
      truncated: false,
    });
    const input = new RetryRecoveryInput({
        action: "reset",
        kind: "gate",
        phase: "task-impl",
        reason,
        yes: true,
    });
    const grant = applyRetryRecoveryGrant(recoveryGrantRequest(root, input, {
      attempts: 5,
      maxAttempts: 5,
      createdAt: "2026-05-18T00:00:05.000Z",
    }));
    const artifact = readJson(root, `specs/${specId}/flow.json`).retryRecovery.entries.at(-1);
    const view = buildRetryRecoveryView({
      kind: "gate",
      phase: "task-impl",
      canonicalPhase: "task-impl",
      attempts: 5,
      max: 5,
      recoveryPossible: true,
      recoveryReason: "changed-evidence",
      changedEvidence,
      reason,
    });

    assert.equal(grant.counterAfter, 4);
    assert.equal(artifact.attemptsBefore, 5);
    assert.equal(artifact.maxAttempts, 5);
    assert.equal(artifact.counterAfter, 4);
    assert.equal(artifact.createdAt, "2026-05-18T00:00:05.000Z");
    assert.equal(artifact.recoveryCommand, command);
    const publicArtifact = assertPublicRecoveryArtifact(readJson(root, artifactPath));
    const recoveryRecord = publicArtifact.entries.at(-1);
    const issueEntry = readJson(root, issueLogPath).entries.at(-1);
    assert.equal(recoveryRecord.id, artifact.id);
    assert.equal(issueEntry.grantId, recoveryRecord.id);
    assert.equal(issueEntry.id, artifact.id);
    assert.equal(readPrivateRecoveryTransaction(root), null);
    assert.equal(view.recoveryCommand, command);
  });

  it("R10: TC-26 TC-27 TC-28: CLI help, prompts, and generated skill template document audited recovery", () => {
    const help = execFileSync(process.execPath, [
      sentiBin,
      "flow",
      "set",
      "retry",
      "--help",
    ], { cwd: repoRoot, encoding: "utf8" });
    assert.match(help, /flow set retry reset <gate\|review> <phase> --reason <text> --yes/);
    assert.match(help, /one re-evaluation/);
    assert.match(help, /unchanged evidence/i);

    const prompt = fs.readFileSync(path.join(repoRoot, "src/flow/prompts/task/task-review.md"), "utf8");
    const template = fs.readFileSync(path.join(repoRoot, "src/skills/senti.flow/SKILL.md"), "utf8");
    for (const text of [prompt, template]) {
      assert.match(text, /flow set retry reset <gate\|review> <phase> --reason <text> --yes/);
      assert.match(text, /required --reason|reason is required/i);
      assert.match(text, /one re-evaluation/);
      assert.match(text, /unchanged/i);
    }
  });

  it("R11: TC-29: spec-local lifecycle covers eligible recovery, unchanged rejection, display, repeated failure, and pass reset", async () => {
    const {
      ChangedEvidenceSummary,
      RetryRecoveryInput,
      applyRecoveredRetryOutcome,
      applyRetryRecoveryGrant,
      buildRetryRecoveryView,
      evaluateRecoveryEligibility,
    } = await loadRecovery();
    const root = setupRecoveryFixture({ activeStep: "task-gate", kind: "gate", phase: "task-impl" });
    cleanup.push(root);
    const flow = readJson(root, `specs/${specId}/flow.json`);
    const input = new RetryRecoveryInput({
      action: "reset",
      kind: "gate",
      phase: "task-impl",
      reason,
      yes: true,
    });
    const unchanged = evaluateRecoveryEligibility({
      kind: "gate",
      phase: "task-impl",
      attempts: 3,
      maxAttempts: 3,
      baselines: flow.reviewRecoveryBaselines,
      currentFingerprint: flow.reviewRecoveryBaselines[0].fingerprint,
    });
    assert.equal(unchanged.recoverable, false);

    const changedEvidence = new ChangedEvidenceSummary({
      sourceKind: "implementation-diff",
      baselineHash: "before",
      currentHash: "after",
      changedPaths: ["src/changed.js"],
      truncated: false,
    });
    const grant = applyRetryRecoveryGrant(recoveryGrantRequest(root, input, {
      attempts: 3,
      maxAttempts: 3,
      createdAt: "2026-05-18T00:00:03.000Z",
    }));
    assert.equal(grant.counterAfter, 2);

    const display = buildRetryRecoveryView({
      kind: "gate",
      phase: "task-impl",
      canonicalPhase: "task-impl",
      attempts: 3,
      max: 3,
      recoveryPossible: true,
      recoveryReason: "changed-evidence",
      changedEvidence,
      reason,
    });
    assert.match(display.recoveryCommand, /flow set retry reset gate task-impl/);

    const fail = applyRecoveredRetryOutcome(flow, {
      kind: "gate",
      phase: "task-impl",
      verdict: "fail",
      maxAttempts: 3,
    });
    assert.equal(fail.exhausted, true);
    const pass = applyRecoveredRetryOutcome(flow, {
      kind: "gate",
      phase: "task-impl",
      verdict: "pass",
      maxAttempts: 3,
    });
    assert.equal(pass.counterAfter, 0);
  });
});
