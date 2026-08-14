import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import { pathToFileURL } from "node:url";

import { createTmpDir, removeTmpDir } from "../../../helpers/tmp-dir.js";
import { commitAll, initGitRepo } from "../../../helpers/git-repo.js";
import { FlowAtStepFixture, makeFlowManager } from "../../../helpers/flow-setup.js";
import { FlowTargetBinding } from "../../../../src/lib/flow-target-guard.js";

const SENNEL = path.resolve("src/sennel.js");

class DispatchFlowScenario {
  constructor(root, {
    step = "draft",
    autoApprove = false,
    specId = "001-dispatch",
    runId = "run-dispatch",
  } = {}) {
    this.root = root;
    this.manager = makeFlowManager(root);
    this.fixture = new FlowAtStepFixture({
      flowManager: this.manager,
      specId,
      runId,
      request: "Verify canonical dispatch boundaries.",
      execution: { mode: "direct" },
      autoApprove,
      targetStep: step,
      specRecord: { goal: "Dispatch fixture", requirements: [] },
    }).create();
    this.state = this.fixture.state();
  }

  binding() {
    return FlowTargetBinding.capture({
      flowState: this.state,
      mainRoot: this.root,
      authorityRoot: this.root,
    }).serialize();
  }

  args(extra = []) {
    return [
      SENNEL,
      "flow",
      "run",
      "dispatch",
      "--expect-run-id",
      this.state.runId,
      "--expect-spec",
      this.state.specId,
      ...extra,
    ];
  }
}

function installWorker(root, { delayMs = 75, holdForRelease = false } = {}) {
  const worker = path.join(root, "serial-worker.mjs");
  const workDir = path.join(root, ".tmp");
  const count = path.join(workDir, "worker-count.txt");
  const lock = path.join(workDir, "worker.lock");
  const overlap = path.join(workDir, "worker-overlap.txt");
  const release = path.join(workDir, "worker.release");
  fs.mkdirSync(workDir, { recursive: true });
  fs.writeFileSync(worker, [
    'import fs from "node:fs";',
    `const countFile=${JSON.stringify(count)};`,
    `const lockFile=${JSON.stringify(lock)};`,
    `const overlapFile=${JSON.stringify(overlap)};`,
    `const releaseFile=${JSON.stringify(release)};`,
    'if (fs.existsSync(lockFile)) fs.writeFileSync(overlapFile, "overlap\\n");',
    'fs.writeFileSync(lockFile, String(process.pid));',
    'const previous=fs.existsSync(countFile)?Number(fs.readFileSync(countFile,"utf8")):0;',
    'fs.writeFileSync(countFile, String(previous+1));',
    holdForRelease
      ? 'const releaseDeadline=Date.now()+10_000; while (!fs.existsSync(releaseFile)) { if (Date.now() >= releaseDeadline) { fs.rmSync(lockFile,{force:true}); throw new Error("timed out waiting for worker release"); } await new Promise((resolve)=>setTimeout(resolve,10)); }'
      : `await new Promise((resolve)=>setTimeout(resolve,${delayMs}));`,
    'fs.rmSync(lockFile,{force:true});',
    'process.stdout.write("premature normal worker response");',
  ].join("\n"));
  fs.mkdirSync(path.join(root, ".sennel"), { recursive: true });
  fs.writeFileSync(path.join(root, ".sennel/config.json"), `${JSON.stringify({
    lang: "ja",
    type: "base",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
    agent: {
      default: "test-worker",
      workDir: ".tmp",
      timeout: 30,
      providers: {
        "test-worker": { command: process.execPath, args: [worker, "{{PROMPT}}"] },
      },
    },
  }, null, 2)}\n`);
  return { count, lock, overlap, release };
}

function ensureGitRepository(root) {
  if (fs.existsSync(path.join(root, ".git"))) return;
  initGitRepo(root);
  commitAll(root, "initial dispatch fixture");
}

function invocationOptions(root) {
  return {
    cwd: root,
    encoding: "utf8",
    timeout: 30_000,
    env: { ...process.env, SENNEL_WORK_ROOT: root },
  };
}

function invoke(scenario, extra = []) {
  ensureGitRepository(scenario.root);
  const result = spawnSync(process.execPath, scenario.args(extra), invocationOptions(scenario.root));
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
      resolve({ status, signal, stdout, stderr, envelope: JSON.parse(stdout) });
    });
  });
}

describe("flow dispatch CLI", () => {
  let root;
  afterEach(() => {
    if (root) removeTmpDir(root);
  });

  it("serializes worker ownership and rejects a concurrent dispatcher", async () => {
    root = createTmpDir("sennel-flow-dispatch-concurrent-");
    const worker = installWorker(root, { holdForRelease: true });
    const scenario = new DispatchFlowScenario(root);
    ensureGitRepository(root);
    const first = spawn(process.execPath, scenario.args(), {
      ...invocationOptions(root),
      stdio: ["ignore", "pipe", "pipe"],
    });
    const firstResultPromise = spawnedResult(first);

    await waitForFile(worker.lock);
    let second;
    let secondFailure = null;
    try {
      second = invoke(scenario);
    } catch (error) {
      secondFailure = error;
    } finally {
      fs.writeFileSync(worker.release, "release\n");
    }
    const firstResult = await firstResultPromise;
    if (secondFailure) throw secondFailure;

    assert.notEqual(second.status, 0);
    assert.equal(second.envelope.errors[0].code, "FLOW_DISPATCH_BUSY");
    assert.notEqual(firstResult.status, 0, firstResult.stderr);
    assert.equal(firstResult.envelope.errors[0].code, "FLOW_ARTIFACT_HANDOFF_MISSING");
    assert.equal(fs.readFileSync(worker.count, "utf8"), "1");
    assert.equal(fs.existsSync(worker.overlap), false);
  });

  it("accepts an opaque Version-bound target without separate target fields", () => {
    root = createTmpDir("sennel-flow-dispatch-binding-");
    const worker = installWorker(root);
    const scenario = new DispatchFlowScenario(root);
    ensureGitRepository(root);
    const result = spawnSync(process.execPath, [
      SENNEL,
      "flow",
      "run",
      "dispatch",
      "--expect-binding",
      scenario.binding(),
    ], invocationOptions(root));
    const envelope = JSON.parse(result.stdout);

    assert.notEqual(result.status, 0);
    assert.equal(envelope.errors[0].code, "FLOW_ARTIFACT_HANDOFF_MISSING");
    assert.equal(fs.readFileSync(worker.count, "utf8"), "1");
  });

  it("does not reclaim a lease whose dispatcher owner exited", () => {
    root = createTmpDir("sennel-flow-dispatch-stale-");
    const worker = installWorker(root);
    const scenario = new DispatchFlowScenario(root);
    const dispatchModule = pathToFileURL(path.resolve("src/flow/lib/run-dispatch.js")).href;
    const invocationModule = pathToFileURL(path.resolve("src/flow/lib/dispatch-invocation.js")).href;
    const targetModule = pathToFileURL(path.resolve("src/lib/flow-target-guard.js")).href;
    const owner = spawnSync(process.execPath, ["--input-type=module", "-e", [
      `import { FlowDispatchLease } from ${JSON.stringify(dispatchModule)};`,
      `import { FlowDispatchSession, FlowDispatchTarget } from ${JSON.stringify(invocationModule)};`,
      `import { FlowTargetExpectation } from ${JSON.stringify(targetModule)};`,
      `const expectation=new FlowTargetExpectation({expectBinding:${JSON.stringify(scenario.binding())}});`,
      "const target=new FlowDispatchTarget({expectation,binding:expectation.binding});",
      "const session=new FlowDispatchSession({id:'exited-dispatcher',target});",
      "new FlowDispatchLease(session).acquire();",
    ].join("\n")], { cwd: root, encoding: "utf8" });
    assert.equal(owner.status, 0, owner.stderr);

    const result = invoke(scenario);

    assert.notEqual(result.status, 0);
    assert.equal(result.envelope.errors[0].code, "FLOW_DISPATCH_LOCK_STALE");
    assert.equal(fs.existsSync(worker.count), false);
  });

  it("returns an approval boundary without starting a worker", () => {
    root = createTmpDir("sennel-flow-dispatch-approval-");
    const worker = installWorker(root);
    const scenario = new DispatchFlowScenario(root, { step: "approval" });

    const result = invoke(scenario);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.envelope.data.dispatch.boundary, "approval_required");
    assert.match(result.envelope.data.dispatch.approvalToken, /^[a-f0-9]{64}$/);
    assert.equal(fs.existsSync(worker.count), false);
  });

  it("rejects an approval token after the canonical next action changes", () => {
    root = createTmpDir("sennel-flow-dispatch-changed-action-");
    const worker = installWorker(root);
    const scenario = new DispatchFlowScenario(root, { step: "approval" });
    const first = invoke(scenario);
    assert.equal(first.status, 0, first.stderr);

    scenario.manager.updateStepStatus({ stepId: "approval", requestedStatus: "done" }, {
      specId: scenario.state.specId,
    });
    const resumed = invoke(scenario, ["--approve", first.envelope.data.dispatch.approvalToken]);

    assert.notEqual(resumed.status, 0);
    assert.equal(resumed.envelope.errors[0].code, "FLOW_DISPATCH_APPROVAL_STALE");
    assert.notEqual(resumed.envelope.data.nextAction.step, "approval");
    assert.equal(fs.existsSync(worker.count), false);
  });

  it("keeps risk-bearing acceptance decisions manual under autoApprove", () => {
    root = createTmpDir("sennel-flow-dispatch-manual-exception-");
    const worker = installWorker(root);
    const scenario = new DispatchFlowScenario(root, {
      step: "acceptance-decision",
      autoApprove: true,
    });

    const result = invoke(scenario);

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.envelope.data.dispatch.boundary, "approval_required");
    assert.equal(fs.existsSync(worker.count), false);
  });

  it("rejects a mismatched target before starting a worker", () => {
    root = createTmpDir("sennel-flow-dispatch-target-mismatch-");
    const worker = installWorker(root);
    const scenario = new DispatchFlowScenario(root);

    ensureGitRepository(root);
    const args = scenario.args();
    args[args.indexOf("--expect-run-id") + 1] = "different-run";
    const spawned = spawnSync(process.execPath, args, invocationOptions(root));
    const result = {
      ...spawned,
      envelope: spawned.stdout.trim() ? JSON.parse(spawned.stdout) : null,
    };

    assert.notEqual(result.status, 0);
    assert.equal(result.envelope.errors[0].code, "ACTIVE_FLOW_MISMATCH");
    assert.equal(fs.existsSync(worker.count), false);
  });
});
