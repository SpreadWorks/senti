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

const SENTI = path.resolve("src/senti.js");

function specPath(state) {
  return `specs/${state.specId}/spec.json`;
}

function installWorker(root, { delayMs = 75 } = {}) {
  const worker = path.join(root, "serial-worker.mjs");
  const count = path.join(root, "worker-count.txt");
  const lock = path.join(root, "worker.lock");
  const overlap = path.join(root, "worker-overlap.txt");
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
  fs.mkdirSync(path.join(root, ".senti"), { recursive: true });
  fs.writeFileSync(path.join(root, ".senti/config.json"), `${JSON.stringify({
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
  const targetSpecPath = specPath(state);
  const testFile = path.join(root, path.dirname(targetSpecPath), "tests", "recovery.test.mjs");
  fs.writeFileSync(worker, [
    'import fs from "node:fs";',
    'import {spawnSync} from "node:child_process";',
    "const prompt=process.argv[2]||'';",
    "if(!prompt.includes('You are a worker owned by the senti Flow CLI dispatcher.')){",
    "  process.stdout.write(JSON.stringify({blockingFindings:[],advisoryFindings:[]}));",
    "  process.exit(0);",
    "}",
    `const countFile=${JSON.stringify(count)};`,
    "const previous=fs.existsSync(countFile)?Number(fs.readFileSync(countFile,'utf8')):0;",
    "const current=previous+1;",
    "fs.writeFileSync(countFile,String(current));",
    `if(current===2)fs.appendFileSync(${JSON.stringify(testFile)},"\\n// repaired evidence\\n");`,
    "if(current===3){",
    "  const planned=spawnSync(process.execPath,[",
    `    ${JSON.stringify(SENTI)},'flow','get','next-action',`,
    `    '--expect-run-id',${JSON.stringify(state.runId)},`,
    `    '--expect-spec',${JSON.stringify(state.specId)}`,
    "  ],{cwd:process.cwd(),encoding:'utf8',env:process.env});",
    "  if(planned.status!==0){",
    "    process.stderr.write(planned.stderr||planned.stdout);",
    "    process.exit(planned.status||1);",
    "  }",
    "  const nextAction=JSON.parse(planned.stdout).data.directive.nextAction;",
    `  fs.writeFileSync(${JSON.stringify(nextActionFile)},nextAction);`,
    "  const command=nextAction.match(/^senti flow run review --phase test --expect-binding '([^']+)' --expect-no-issue$/);",
    "  if(!command){",
    "    process.stderr.write(`incomplete review next-action: ${nextAction}`);",
    "    process.exit(1);",
    "  }",
    "  const result=spawnSync(process.execPath,[",
    `    ${JSON.stringify(SENTI)},'flow','run','review','--phase','test',`,
    "    '--expect-binding',command[1],'--expect-no-issue'",
    "  ],{cwd:process.cwd(),encoding:'utf8',env:process.env});",
    "  if(result.status!==0){",
    "    process.stderr.write(result.stderr||result.stdout);",
    "    process.exit(result.status||1);",
    "  }",
    "}",
    "process.stdout.write('worker report only');",
  ].join("\n"));
  fs.writeFileSync(path.join(root, ".senti/config.json"), `${JSON.stringify({
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
  return { count, testFile, nextActionFile };
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
    `const senti=${JSON.stringify(SENTI)};`,
    `const invocationFile=${JSON.stringify(invocationFile)};`,
    "const invocation=JSON.parse(process.env.SENTI_FLOW_DISPATCH_INVOCATION||'null');",
    "if(invocation?.authorization?.source!=='autoApprove'||invocation.authorization.choiceId!=='1'){",
    "  process.stderr.write('missing autoApprove choice id=1 authorization');",
    "  process.exit(11);",
    "}",
    "const binding=process.env.SENTI_FLOW_TARGET_BINDING;",
    "if(!binding){process.stderr.write('missing target binding');process.exit(12);}",
    "fs.writeFileSync(invocationFile,JSON.stringify(invocation,null,2));",
    "for(const args of [",
    "  ['flow','set','approval','--approved','--expect-binding',binding],",
    "  ['flow','set','step','approval','done','--expect-binding',binding],",
    "]){",
    "  const result=spawnSync(process.execPath,[senti,...args],{cwd:process.cwd(),encoding:'utf8',env:process.env});",
    "  if(result.status!==0){process.stderr.write(result.stderr||result.stdout);process.exit(result.status||13);}",
    "}",
    "process.stderr.write('intentional stop after durable approval transition');",
    "process.exit(17);",
  ].join("\n"));
  fs.mkdirSync(path.join(root, ".senti"), { recursive: true });
  fs.writeFileSync(path.join(root, ".senti/config.json"), `${JSON.stringify({
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
    SENTI,
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
    SENTI,
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
    env: { ...process.env, SENTI_WORK_ROOT: root },
  };
}

function invoke(root, state, extra = []) {
  const result = spawnSync(process.execPath, dispatchArgs(state, extra), invocationOptions(root));
  return {
    ...result,
    envelope: result.stdout.trim() ? JSON.parse(result.stdout) : null,
  };
}

function invokeBinding(root, binding, extra = []) {
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
    root = createTmpDir("senti-flow-dispatch-stalled-");
    const worker = installWorker(root);
    const state = setupFlowAtStep(root, "draft");

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
    root = createTmpDir("senti-flow-dispatch-binding-only-");
    const worker = installWorker(root);
    const state = setupFlowAtStep(root, "draft");
    const binding = dispatchBinding(root, state);

    const result = invokeBinding(root, binding);

    assert.notEqual(result.status, 0);
    assert.notEqual(result.envelope.errors[0].code, "FLOW_DISPATCH_TARGET_REQUIRED");
    assert.equal(result.envelope.errors[0].code, "FLOW_DISPATCH_STALLED");
    assert.equal(fs.readFileSync(worker.count, "utf8"), "3");
  });

  it("rejects a concurrent dispatcher while the first worker is still running", async () => {
    root = createTmpDir("senti-flow-dispatch-concurrent-");
    const worker = installWorker(root, { delayMs: 300 });
    const state = setupFlowAtStep(root, "draft");
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
    root = createTmpDir("senti-flow-dispatch-stale-");
    const worker = installWorker(root);
    const state = setupFlowAtStep(root, "draft");
    const dispatchModule = pathToFileURL(path.resolve("src/flow/lib/run-dispatch.js")).href;
    const invocationModule = pathToFileURL(path.resolve("src/flow/lib/dispatch-invocation.js")).href;
    const targetModule = pathToFileURL(path.resolve("src/lib/flow-target-guard.js")).href;
    const binding = dispatchBinding(root, state);
    const owner = spawnSync(process.execPath, ["--input-type=module", "-e", [
      `import { FlowDispatchLease } from ${JSON.stringify(dispatchModule)};`,
      `import { FlowDispatchTarget } from ${JSON.stringify(invocationModule)};`,
      `import { FlowTargetExpectation } from ${JSON.stringify(targetModule)};`,
      `const expectation=new FlowTargetExpectation({expectBinding:${JSON.stringify(binding)}});`,
      "const target=new FlowDispatchTarget({expectation,binding:expectation.binding});",
      "new FlowDispatchLease({target,dispatchInvocationId:'exited-dispatcher'}).acquire();",
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
    root = createTmpDir("senti-flow-dispatch-review-recovery-");
    const state = setupFlowAtStep(root, "test-review", {
      baseBranch: "main",
      featureBranch: "main",
      metrics: [],
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
      verdict: "REJECTED",
      blockingFindings: [{
        findingId: "repair-required",
        fingerprint: "a".repeat(64),
        disposition: "must-fix",
        rationale: "The evidence must change before review runs again.",
      }],
    }, null, 2)}\n`);
    const worker = installReviewRecoveryWorker(root, state);
    initGitRepo(root);
    commitAll(root, "initial rejected review fixture");
    const treeSha = resolveCurrentReviewTreeSha(root, targetSpecPath);
    const targetStateDigest = buildRepairFingerprint({
      root,
      specPath: targetSpecPath,
      state,
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
          handoffFindings: [{ findingId: "repair-required" }],
          blocker: null,
          toolingOutcome: null,
          provider: "independent-reviewer",
          targetStateDigest,
        }],
      };
    });
    const bypass = spawnSync(process.execPath, [
      SENTI,
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
      /^senti flow run review --phase test --expect-binding '[^']+' --expect-no-issue$/,
    );
    assert.match(fs.readFileSync(path.join(testsDir, "recovery.test.mjs"), "utf8"), /repaired evidence/);
    const review = JSON.parse(fs.readFileSync(path.join(specDir, "test-review.json"), "utf8"));
    assert.equal(review.verdict, "PASS");
    const persisted = makeFlowManager(root).load();
    assert.equal(findStepById(persisted.steps, "test-review").status, "done");
    assert.equal(findStepById(persisted.steps, "implement").status, "in_progress");
  });

  it("returns an approval boundary without starting a worker", () => {
    root = createTmpDir("senti-flow-dispatch-approval-");
    const worker = installWorker(root);
    const state = setupFlowAtStep(root, "approval");

    const result = invoke(root, state);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.envelope.data.dispatch.boundary, "approval_required");
    assert.match(result.envelope.data.dispatch.approvalToken, /^[a-f0-9]{64}$/);
    assert.equal(fs.existsSync(worker.count), false);
  });

  it("hands choice id=1 authorization to the worker and advances the approval step in autoApprove mode", () => {
    root = createTmpDir("senti-flow-dispatch-auto-approval-");
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
    root = createTmpDir("senti-flow-dispatch-stale-approval-");
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

  it("keeps risk-bearing acceptance decisions manual when autoApprove is enabled", () => {
    root = createTmpDir("senti-flow-dispatch-manual-exception-");
    const worker = installWorker(root);
    const state = setupFlowAtStep(root, "acceptance-decision", { autoApprove: true });

    const result = invoke(root, state);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.envelope.data.dispatch.boundary, "approval_required");
    assert.equal(fs.existsSync(worker.count), false);
  });

  it("returns completed without starting a worker", () => {
    root = createTmpDir("senti-flow-dispatch-completed-");
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
    root = createTmpDir("senti-flow-dispatch-target-mismatch-");
    const worker = installWorker(root);
    const state = setupFlowAtStep(root, "draft");

    const result = invoke(root, { ...state, runId: "different-run" });

    assert.notEqual(result.status, 0);
    assert.ok(result.envelope, result.stderr);
    assert.equal(result.envelope.errors[0].code, "ACTIVE_FLOW_MISMATCH");
    assert.equal(fs.existsSync(worker.count), false);
  });
});
