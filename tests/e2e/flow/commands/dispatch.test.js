import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { pathToFileURL } from "node:url";

import { createTmpDir, removeTmpDir } from "../../../helpers/tmp-dir.js";
import {
  makeFlowState,
  makeFlowManager,
  setupFlow,
  setupFlowAtStep,
} from "../../../helpers/flow-setup.js";
import { commitAll, initGitRepo } from "../../../helpers/git-repo.js";
import { buildRepairFingerprint } from "../../../../src/flow/lib/impl-repair-artifacts.js";
import { resolveCurrentReviewTreeSha } from "../../../../src/flow/lib/review-evidence-store.js";
import { findStepById, flattenSteps } from "../../../../src/flow/lib/step-tree.js";
import { FlowTargetBinding } from "../../../../src/lib/flow-target-guard.js";
import { captureRepairBaseline } from "../../../../src/flow/lib/repair-state-identity.js";

const SENRAIL = path.resolve("src/senrail.js");

function specPath(state) {
  return `specs/${state.specId}/spec.json`;
}

function installWorker(root, { delayMs = 75 } = {}) {
  const worker = path.join(root, "serial-worker.mjs");
  const workDir = path.join(root, ".tmp");
  const count = path.join(workDir, "worker-count.txt");
  const lock = path.join(workDir, "worker.lock");
  const overlap = path.join(workDir, "worker-overlap.txt");
  fs.mkdirSync(workDir, { recursive: true });
  fs.writeFileSync(worker, [
    'import fs from "node:fs";',
    `const countFile=${JSON.stringify(count)};`,
    `const lockFile=${JSON.stringify(lock)};`,
    `const overlapFile=${JSON.stringify(overlap)};`,
    'if (fs.existsSync(lockFile)) fs.writeFileSync(overlapFile, "overlap\\n");',
    'fs.writeFileSync(lockFile, String(process.pid));',
    'const previous=fs.existsSync(countFile)?Number(fs.readFileSync(countFile,"utf8")):0;',
    'fs.writeFileSync(countFile, String(previous+1));',
    `await new Promise((resolve)=>setTimeout(resolve,${delayMs}));`,
    'fs.rmSync(lockFile,{force:true});',
    'process.stdout.write("premature normal worker response");',
  ].join("\n"));
  fs.mkdirSync(path.join(root, ".senrail"), { recursive: true });
  fs.writeFileSync(path.join(root, ".senrail/config.json"), `${JSON.stringify({
    lang: "ja",
    type: "base",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
    agent: {
      default: "test-worker",
      workDir: ".tmp",
      timeout: 30,
      providers: {
        "test-worker": {
          command: process.execPath,
          args: [worker, "{{PROMPT}}"],
        },
      },
    },
  }, null, 2)}\n`);
  return { count, lock, overlap };
}

function installReviewRecoveryWorker(root, state) {
  const worker = path.join(root, "review-recovery-worker.mjs");
  const count = path.join(root, ".tmp", "review-recovery-count.txt");
  const nextActionFile = path.join(root, ".tmp", "review-recovery-next-action.txt");
  fs.writeFileSync(worker, [
    'import fs from "node:fs";',
    'import path from "node:path";',
    'import {spawnSync} from "node:child_process";',
    "const prompt=process.argv[2]||'';",
    "if(!prompt.includes('You are a worker owned by the senrail Flow CLI dispatcher.')){",
    "  process.stdout.write(JSON.stringify({blockingFindings:[],advisoryFindings:[]}));",
    "  process.exit(0);",
    "}",
    "const invocation=JSON.parse(process.env.SENRAIL_FLOW_DISPATCH_INVOCATION);",
    `const countFile=${JSON.stringify(count)};`,
    "const previous=fs.existsSync(countFile)?Number(fs.readFileSync(countFile,'utf8')):0;",
    "const current=previous+1;",
    "fs.writeFileSync(countFile,String(current));",
    "function runGuarded(commandName,extraArgs=[]){",
    "  const nextAction=invocation.action.directive.nextAction;",
    "  const command=nextAction.match(new RegExp(`^senrail flow run ${commandName}(?: --phase test)? --expect-binding '([^']+)' --expect-no-issue$`));",
    "  if(!command){",
    "    process.stderr.write(`missing ${commandName} command in guarded invocation: ${nextAction}`);",
    "    process.exit(1);",
    "  }",
    "  const result=spawnSync(process.execPath,[",
    `    ${JSON.stringify(SENRAIL)},'flow','run',commandName,...extraArgs,`,
    "    '--expect-binding',command[1],'--expect-no-issue'",
    "  ],{cwd:process.cwd(),encoding:'utf8',env:process.env});",
    "  if(result.status!==0){",
    "    process.stderr.write(result.stderr||result.stdout);",
    "    process.exit(result.status||1);",
    "  }",
    "  return command[0];",
    "}",
    "if(current===1){",
    "  const requestPath=process.env.SENRAIL_FLOW_HANDOFF_REQUEST;",
    "  if(!requestPath){process.stderr.write('missing test repair handoff request');process.exit(1);}",
    "  const request=JSON.parse(fs.readFileSync(requestPath,'utf8'));",
    "  const payload=request.payloads.find((entry)=>entry.logicalName==='spec-tests');",
    "  const target=path.join(payload.payloadPath,'recovery.test.mjs');",
    "  fs.mkdirSync(path.dirname(target),{recursive:true});",
    "  fs.writeFileSync(target,[",
    "    '// spec: R1',",
    "    \"import assert from 'node:assert/strict';\",",
    "    \"import test from 'node:test';\",",
    "    \"test('R1: recovery',()=>assert.fail('not implemented'));\",",
    "    '// repaired evidence',",
    "    '',",
    "  ].join('\\n'));",
    "  const sealed=spawnSync(process.execPath,[",
    `    ${JSON.stringify(SENRAIL)},'flow','run','seal-handoff'`,
    "  ],{cwd:process.cwd(),encoding:'utf8',env:process.env});",
    "  if(sealed.status!==0){process.stderr.write(sealed.stderr||sealed.stdout);process.exit(sealed.status||1);}",
    "}",
    "if(current===2)runGuarded('scenario-validity');",
    "if(current===3){",
    "  const nextAction=runGuarded('review',['--phase','test']);",
    `  fs.writeFileSync(${JSON.stringify(nextActionFile)},nextAction);`,
    "}",
    "process.stdout.write('worker report only');",
  ].join("\n"));
  fs.writeFileSync(path.join(root, ".senrail/config.json"), `${JSON.stringify({
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    agent: {
      default: "test-worker",
      workDir: ".tmp",
      timeout: 30,
      providers: {
        "test-worker": {
          command: process.execPath,
          args: [worker, "{{PROMPT}}"],
        },
      },
    },
  }, null, 2)}\n`);
  return { count, nextActionFile };
}

function setupApprovalSpec(root, state) {
  const specDir = path.join(root, "specs", state.specId);
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "spec.json"), `${JSON.stringify({
    goal: "Verify dispatcher authorization.",
    background: "",
    scope: { in: ["Flow dispatch authorization"], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements: [],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(specDir, "spec.md"), "# Dispatcher authorization\n");
}

function installAuthorizationWorker(root) {
  const worker = path.join(root, "authorization-worker.mjs");
  const invocationFile = path.join(root, "authorization-invocation.json");
  fs.writeFileSync(worker, [
    'import fs from "node:fs";',
    'import {spawnSync} from "node:child_process";',
    `const senrail=${JSON.stringify(SENRAIL)};`,
    `const invocationFile=${JSON.stringify(invocationFile)};`,
    "const invocation=JSON.parse(process.env.SENRAIL_FLOW_DISPATCH_INVOCATION||'null');",
    "if(invocation?.authorization?.source!=='autoApprove'||invocation.authorization.choiceId!=='1'){",
    "  process.stderr.write('missing autoApprove choice id=1 authorization');",
    "  process.exit(11);",
    "}",
    "const binding=process.env.SENRAIL_FLOW_TARGET_BINDING;",
    "if(!binding){process.stderr.write('missing target binding');process.exit(12);}",
    "fs.writeFileSync(invocationFile,JSON.stringify(invocation,null,2));",
    "for(const args of [",
    "  ['flow','set','approval','--approved','--expect-binding',binding],",
    "  ['flow','set','step','approval','done','--expect-binding',binding],",
    "]){",
    "  const result=spawnSync(process.execPath,[senrail,...args],{cwd:process.cwd(),encoding:'utf8',env:process.env});",
    "  if(result.status!==0){process.stderr.write(result.stderr||result.stdout);process.exit(result.status||13);}",
    "}",
    "process.stderr.write('intentional stop after durable approval transition');",
    "process.exit(17);",
  ].join("\n"));
  fs.mkdirSync(path.join(root, ".senrail"), { recursive: true });
  fs.writeFileSync(path.join(root, ".senrail/config.json"), `${JSON.stringify({
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    agent: {
      default: "authorization-worker",
      workDir: ".tmp",
      timeout: 30,
      providers: {
        "authorization-worker": {
          command: process.execPath,
          args: [worker, "{{PROMPT}}"],
        },
      },
    },
  }, null, 2)}\n`);
  return { invocationFile };
}

function dispatchArgs(state, extra = []) {
  return [
    SENRAIL,
    "flow",
    "run",
    "dispatch",
    "--expect-run-id",
    state.runId,
    "--expect-spec",
    state.specId,
    ...extra,
  ];
}

function dispatchBinding(root, state) {
  return FlowTargetBinding.capture({
    flowState: state,
    mainRoot: root,
    authorityRoot: root,
  }).serialize();
}

function dispatchBindingArgs(binding, extra = []) {
  return [
    SENRAIL,
    "flow",
    "run",
    "dispatch",
    "--expect-binding",
    binding,
    ...extra,
  ];
}

function invocationOptions(root) {
  return {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
    env: { ...process.env, SENRAIL_WORK_ROOT: root },
  };
}

function ensureGitRepository(root) {
  if (fs.existsSync(path.join(root, ".git"))) return;
  initGitRepo(root);
  commitAll(root, "initial dispatch fixture");
}

function invoke(root, state, extra = []) {
  ensureGitRepository(root);
  const result = spawnSync(process.execPath, dispatchArgs(state, extra), invocationOptions(root));
  return {
    ...result,
    envelope: result.stdout.trim() ? JSON.parse(result.stdout) : null,
  };
}

function invokeBinding(root, binding, extra = []) {
  ensureGitRepository(root);
  const result = spawnSync(
    process.execPath,
    dispatchBindingArgs(binding, extra),
    invocationOptions(root),
  );
  return {
    ...result,
    envelope: result.stdout.trim() ? JSON.parse(result.stdout) : null,
  };
}

async function waitForFile(file, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (fs.existsSync(file)) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`timed out waiting for ${file}`);
}

function spawnedResult(child) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (status, signal) => {
      resolve({
        status,
        signal,
        stdout,
        stderr,
        envelope: JSON.parse(stdout),
      });
    });
  });
}

describe("flow dispatch CLI", () => {
  let root;
  afterEach(() => {
    if (root) removeTmpDir(root);
  });

  it("does not accept normal worker responses as completion or overlap worker processes", () => {
    root = createTmpDir("senrail-flow-dispatch-stalled-");
    const worker = installWorker(root);
    const state = setupFlowAtStep(root, "implement");

    const result = invoke(root, state);

    assert.notEqual(result.status, 0);
    assert.equal(
      result.envelope.errors[0].code,
      "FLOW_DISPATCH_STALLED",
      JSON.stringify(result.envelope, null, 2),
    );
    assert.equal(result.envelope.data.dispatch.boundary, "blocked");
    assert.equal(result.envelope.data.dispatch.dispatchCount, 3);
    assert.equal(fs.readFileSync(worker.count, "utf8"), "3");
    assert.equal(fs.existsSync(worker.overlap), false);
  });

  it("executes a non-terminal action when the dispatch target is supplied only by an opaque binding", () => {
    root = createTmpDir("senrail-flow-dispatch-binding-only-");
    const worker = installWorker(root);
    const state = setupFlowAtStep(root, "implement");
    const binding = dispatchBinding(root, state);

    const result = invokeBinding(root, binding);

    assert.notEqual(result.status, 0);
    assert.notEqual(result.envelope.errors[0].code, "FLOW_DISPATCH_TARGET_REQUIRED");
    assert.equal(result.envelope.errors[0].code, "FLOW_DISPATCH_STALLED");
    assert.equal(fs.readFileSync(worker.count, "utf8"), "3");
  });

  it("rejects a concurrent dispatcher while the first worker is still running", async () => {
    root = createTmpDir("senrail-flow-dispatch-concurrent-");
    const worker = installWorker(root, { delayMs: 300 });
    const state = setupFlowAtStep(root, "implement");
    ensureGitRepository(root);
    const first = spawn(process.execPath, dispatchArgs(state), {
      ...invocationOptions(root),
      stdio: ["ignore", "pipe", "pipe"],
    });
    const firstResultPromise = spawnedResult(first);

    await waitForFile(worker.lock);
    const second = invoke(root, state);
    const firstResult = await firstResultPromise;

    assert.notEqual(second.status, 0);
    assert.equal(second.envelope.errors[0].code, "FLOW_DISPATCH_BUSY");
    assert.match(second.envelope.data.dispatch.message, /do not start a duplicate review/i);
    assert.notEqual(firstResult.status, 0, firstResult.stderr);
    assert.equal(firstResult.envelope.errors[0].code, "FLOW_DISPATCH_STALLED");
    assert.equal(fs.readFileSync(worker.count, "utf8"), "3");
    assert.equal(fs.existsSync(worker.overlap), false);
  });

  it("does not automatically reclaim a lease whose dispatcher owner exited", () => {
    root = createTmpDir("senrail-flow-dispatch-stale-");
    const worker = installWorker(root);
    const state = setupFlowAtStep(root, "draft");
    const dispatchModule = pathToFileURL(path.resolve("src/flow/lib/run-dispatch.js")).href;
    const invocationModule = pathToFileURL(path.resolve("src/flow/lib/dispatch-invocation.js")).href;
    const targetModule = pathToFileURL(path.resolve("src/lib/flow-target-guard.js")).href;
    const binding = dispatchBinding(root, state);
    const owner = spawnSync(process.execPath, ["--input-type=module", "-e", [
      `import { FlowDispatchLease } from ${JSON.stringify(dispatchModule)};`,
      `import { FlowDispatchSession, FlowDispatchTarget } from ${JSON.stringify(invocationModule)};`,
      `import { FlowTargetExpectation } from ${JSON.stringify(targetModule)};`,
      `const expectation=new FlowTargetExpectation({expectBinding:${JSON.stringify(binding)}});`,
      "const target=new FlowDispatchTarget({expectation,binding:expectation.binding});",
      "const session=new FlowDispatchSession({id:'exited-dispatcher',target});",
      "new FlowDispatchLease(session).acquire();",
    ].join("\n")], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(owner.status, 0, owner.stderr);

    const result = invoke(root, state);

    assert.notEqual(result.status, 0);
    assert.equal(result.envelope.errors[0].code, "FLOW_DISPATCH_LOCK_STALE");
    assert.match(result.envelope.data.dispatch.message, /worker may still be running/i);
    assert.equal(fs.existsSync(worker.count), false);
  });

  it("continues a rejected review through changed evidence and guarded re-review", () => {
    root = createTmpDir("senrail-flow-dispatch-review-recovery-");
    const state = setupFlowAtStep(root, "test-review", {
      specId: "dispatch-test-review-repair",
      runId: "run-dispatch-test-review-repair",
      baseBranch: "main",
      featureBranch: "main",
      metrics: [],
      specTestArtifactRevision: {
        version: 1,
        runId: "run-dispatch-test-review-repair",
        specId: "dispatch-test-review-repair",
        stepId: "test",
        digest: "a".repeat(64),
        byteLength: 100,
        finalizedAt: "2026-08-05T00:00:00.000Z",
      },
    });
    const targetSpecPath = specPath(state);
    const specDir = path.join(root, path.dirname(targetSpecPath));
    const testsDir = path.join(specDir, "tests");
    fs.mkdirSync(testsDir, { recursive: true });
    fs.writeFileSync(path.join(root, targetSpecPath), `${JSON.stringify({
      goal: "Verify rejected review continuation.",
      background: "",
      scope: { in: ["Review recovery"], out: [] },
      constraints: [],
      design_principles: [],
      overview: { modules: [], data_flow: [], decisions: [] },
      requirements: [{
        id: "R1",
        desc: "The repaired test remains executable.",
        priority: "must",
        status: "pending",
        testable: true,
      }],
      acceptance_criteria: [],
      clarifications: [],
      alternatives_considered: [],
      open_questions: [],
    }, null, 2)}\n`);
    fs.writeFileSync(
      path.join(testsDir, "recovery.test.mjs"),
      "// spec: R1\nimport test from 'node:test';\ntest('R1: recovery',()=>{});\n",
    );
    fs.writeFileSync(path.join(specDir, "test-review.json"), `${JSON.stringify({
      version: 1,
      phase: "test",
      verdict: "REJECTED",
      counts: { blocking: 1, advisory: 1, total: 2 },
      coverageArtifact: `specs/${state.specId}/test-coverage.json`,
      sourceTestArtifactRevision: state.specTestArtifactRevision,
      blockingFindings: [{
        findingId: "repair-required",
        fingerprint: "a".repeat(64),
        disposition: "must-fix",
        kind: "blocking",
        title: "The test does not exercise the public behavior.",
        target: "tests/recovery.test.mjs",
        issue: "The assertion cannot detect an incorrect implementation.",
        requiredChange: "Exercise the declared public behavior.",
        whyBlocking: "Implementation cannot proceed with self-fulfilling evidence.",
        rationale: "The evidence must change before review runs again.",
      }],
      advisoryFindings: [{
        findingId: "repair-advisory",
        fingerprint: "c".repeat(64),
        disposition: "informational",
        kind: "advisory",
        title: "Add a boundary assertion for the repaired behavior.",
        target: "tests/recovery.test.mjs",
        improvement: "Add a boundary assertion for the repaired behavior.",
        whyNonBlocking: "The current test still exercises the required behavior.",
        rationale: "The existing test is sufficient to block the known regression.",
      }],
    }, null, 2)}\n`);
    const worker = installReviewRecoveryWorker(root, state);
    initGitRepo(root);
    commitAll(root, "initial rejected review fixture");
    const repairBaseline = captureRepairBaseline({
      root,
      baseRef: "main",
      runId: state.runId,
    });
    makeFlowManager(root).mutate((flow) => {
      flow.repairBaseline = repairBaseline.toJSON();
    });
    const stateWithBaseline = makeFlowManager(root).load();
    const treeSha = resolveCurrentReviewTreeSha(root, targetSpecPath);
    const targetStateDigest = buildRepairFingerprint({
      root,
      specPath: targetSpecPath,
      state: stateWithBaseline,
    }).hash;
    makeFlowManager(root).mutate((flow) => {
      flow.metrics = [{ phase: "test", counter: "reviewRetry", delta: 1, taskId: null }];
      flow.reviewConvergence = {
        version: 1,
        records: [{
          phase: "test",
          taskId: null,
          treeSha,
          semanticAttempts: 1,
          semanticMaxAttempts: 5,
          toolingAttempts: 0,
          toolingMaxAttempts: 1,
          evidence: {
            evidenceId: "b".repeat(64),
            disposition: "REJECTED",
          },
          finalizedEvidenceAvailable: true,
          handoffFindings: [{
            findingId: "repair-required",
            fingerprint: "a".repeat(64),
            sourceStep: "test-review",
            canonicalEvidenceRef: `review-evidence/${"b".repeat(64)}.json`,
          }, {
            findingId: "repair-advisory",
            fingerprint: "c".repeat(64),
            sourceStep: "test-review",
            canonicalEvidenceRef: `review-evidence/${"b".repeat(64)}.json`,
          }],
          blocker: null,
          toolingOutcome: null,
          provider: "independent-reviewer",
          targetStateDigest,
        }],
      };
    });
    const repairState = makeFlowManager(root).load();
    assert.equal(resolveCurrentReviewTreeSha(root, targetSpecPath), treeSha);
    assert.equal(buildRepairFingerprint({
      root,
      specPath: targetSpecPath,
      state: repairState,
    }).hash, targetStateDigest);
    const repairPlan = spawnSync(process.execPath, [
      SENRAIL,
      "flow",
      "get",
      "next-action",
      "--expect-run-id",
      state.runId,
      "--expect-spec",
      state.specId,
    ], invocationOptions(root));
    assert.equal(repairPlan.status, 0, repairPlan.stderr || repairPlan.stdout);
    assert.equal(JSON.parse(repairPlan.stdout).data.directive.actionId, "REPAIR_TEST_REVIEW");
    const bypass = spawnSync(process.execPath, [
      SENRAIL,
      "flow",
      "set",
      "step",
      "test-review",
      "done",
      "--expect-run-id",
      state.runId,
      "--expect-spec",
      state.specId,
    ], invocationOptions(root));
    assert.notEqual(bypass.status, 0);
    assert.equal(JSON.parse(bypass.stdout).errors[0].code, "FLOW_STEP_TRANSITION_INVALID");
    const afterBypassPlan = spawnSync(process.execPath, [
      SENRAIL,
      "flow",
      "get",
      "next-action",
      "--expect-run-id",
      state.runId,
      "--expect-spec",
      state.specId,
    ], invocationOptions(root));
    assert.equal(afterBypassPlan.status, 0, afterBypassPlan.stderr || afterBypassPlan.stdout);
    assert.equal(JSON.parse(afterBypassPlan.stdout).data.directive.actionId, "REPAIR_TEST_REVIEW");

    const result = invoke(root, state);

    assert.notEqual(result.status, 0);
    assert.equal(
      result.envelope.errors[0].code,
      "FLOW_DISPATCH_STALLED",
      JSON.stringify(result.envelope, null, 2),
    );
    assert.equal(result.envelope.data.nextAction.step, "implement");
    assert.equal(Number(fs.readFileSync(path.join(root, ".tmp", "review-recovery-count.txt"), "utf8")) >= 6, true);
    assert.match(
      fs.readFileSync(worker.nextActionFile, "utf8"),
      /^senrail flow run review --phase test --expect-binding '[^']+' --expect-no-issue$/,
    );
    assert.match(fs.readFileSync(path.join(testsDir, "recovery.test.mjs"), "utf8"), /repaired evidence/);
    const review = JSON.parse(fs.readFileSync(path.join(specDir, "test-review.json"), "utf8"));
    assert.equal(review.verdict, "PASS");
    const scenario = JSON.parse(fs.readFileSync(path.join(specDir, "scenario-validity-result.json"), "utf8"));
    const coverage = JSON.parse(fs.readFileSync(path.join(specDir, "test-coverage.json"), "utf8"));
    assert.equal(scenario.result, "pass");
    assert.equal(coverage.requirements.find((entry) => entry.id === "R1").status, "covered");
    const persisted = makeFlowManager(root).load();
    assert.equal(persisted.workerArtifactReceipts.at(-1).stepId, "test");
    assert.equal(persisted.testReviewRepairHistory.length, 1);
    assert.notEqual(persisted.specTestArtifactRevision.digest, "a".repeat(64));
    assert.equal(review.sourceTestArtifactRevision.digest, persisted.specTestArtifactRevision.digest);
    assert.equal(coverage.sourceTestArtifactRevision.digest, persisted.specTestArtifactRevision.digest);
    const convergences = persisted.reviewConvergence.records.filter((entry) => entry.phase === "test");
    assert.equal(convergences[0].semanticAttempts, 1);
    assert.equal(convergences[0].evidence.disposition, "REJECTED");
    assert.equal(convergences.at(-1).semanticAttempts, 0);
    assert.equal(convergences.at(-1).evidence.disposition, "PASS");
    assert.equal(findStepById(persisted.steps, "test-review").status, "done");
    assert.equal(findStepById(persisted.steps, "implement").status, "in_progress");
  });

  it("returns an approval boundary without starting a worker", () => {
    root = createTmpDir("senrail-flow-dispatch-approval-");
    const worker = installWorker(root);
    const state = setupFlowAtStep(root, "approval");

    const result = invoke(root, state);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.envelope.data.dispatch.boundary, "approval_required");
    assert.match(result.envelope.data.dispatch.approvalToken, /^[a-f0-9]{64}$/);
    assert.equal(fs.existsSync(worker.count), false);
  });

  it("hands choice id=1 authorization to the worker and advances the approval step in autoApprove mode", () => {
    root = createTmpDir("senrail-flow-dispatch-auto-approval-");
    const state = setupFlowAtStep(root, "approval", { autoApprove: true });
    setupApprovalSpec(root, state);
    const worker = installAuthorizationWorker(root);
    const binding = dispatchBinding(root, state);

    const result = invokeBinding(root, binding);

    assert.notEqual(result.status, 0);
    assert.equal(result.envelope.errors[0].code, "AGENT_UNKNOWN_PROVIDER_FAILURE");
    assert.equal(result.envelope.data.nextAction.step, "test");
    const invocation = JSON.parse(fs.readFileSync(worker.invocationFile, "utf8"));
    assert.equal(invocation.target.runId, state.runId);
    assert.equal(invocation.action.step, "approval");
    assert.equal(invocation.authorization.source, "autoApprove");
    assert.equal(invocation.authorization.choiceId, "1");
    const persisted = makeFlowManager(root).loadReadOnly(state.specId);
    assert.equal(findStepById(persisted.steps, "approval").status, "done");
  });

  it("rejects an explicit approval token after the repository fingerprint changes", () => {
    root = createTmpDir("senrail-flow-dispatch-stale-approval-");
    const worker = installWorker(root);
    const state = setupFlowAtStep(root, "approval");
    initGitRepo(root);
    commitAll(root, "initial approval boundary");

    const first = invoke(root, state);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(first.envelope.data.dispatch.boundary, "approval_required");

    fs.writeFileSync(path.join(root, "changed-after-approval.txt"), "changed\n");
    const resumed = invoke(root, state, ["--approve", first.envelope.data.dispatch.approvalToken]);

    assert.notEqual(resumed.status, 0);
    assert.equal(resumed.envelope.errors[0].code, "FLOW_DISPATCH_APPROVAL_STALE");
    assert.equal(fs.existsSync(worker.count), false);
  });

  it("rejects an explicit approval token after the persisted next action changes", () => {
    root = createTmpDir("senrail-flow-dispatch-changed-action-");
    const worker = installWorker(root);
    const state = setupFlowAtStep(root, "approval");

    const first = invoke(root, state);
    assert.equal(first.status, 0, first.stderr);
    assert.equal(first.envelope.data.dispatch.boundary, "approval_required");

    makeFlowManager(root).mutate((flow) => {
      findStepById(flow.steps, "approval").status = "done";
    });
    const resumed = invoke(root, state, ["--approve", first.envelope.data.dispatch.approvalToken]);

    assert.notEqual(resumed.status, 0);
    assert.equal(resumed.envelope.errors[0].code, "FLOW_DISPATCH_APPROVAL_STALE");
    assert.notEqual(resumed.envelope.data.nextAction.step, "approval");
    assert.equal(fs.existsSync(worker.count), false);
  });

  it("keeps risk-bearing acceptance decisions manual when autoApprove is enabled", () => {
    root = createTmpDir("senrail-flow-dispatch-manual-exception-");
    const worker = installWorker(root);
    const state = setupFlowAtStep(root, "acceptance-decision", { autoApprove: true });

    const result = invoke(root, state);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.envelope.data.dispatch.boundary, "approval_required");
    assert.equal(fs.existsSync(worker.count), false);
  });

  it("returns completed without starting a worker", () => {
    root = createTmpDir("senrail-flow-dispatch-completed-");
    const worker = installWorker(root);
    const state = makeFlowState();
    for (const step of flattenSteps(state.steps)) step.status = "done";
    setupFlow(root, state);

    const result = invoke(root, state);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.envelope.data.dispatch.boundary, "completed");
    assert.equal(fs.existsSync(worker.count), false);
  });

  it("returns an initial target mismatch without starting a worker", () => {
    root = createTmpDir("senrail-flow-dispatch-target-mismatch-");
    const worker = installWorker(root);
    const state = setupFlowAtStep(root, "draft");

    const result = invoke(root, { ...state, runId: "different-run" });

    assert.notEqual(result.status, 0);
    assert.ok(result.envelope, result.stderr);
    assert.equal(result.envelope.errors[0].code, "ACTIVE_FLOW_MISMATCH");
    assert.equal(fs.existsSync(worker.count), false);
  });
});
