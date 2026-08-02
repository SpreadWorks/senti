import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import {
  FlowManager,
  ParkedFlowError,
  ParkedFlowIdentity,
} from "../../../src/lib/flow-manager.js";
import { ActiveFlowRegistry } from "../../../src/lib/active-flow-registry.js";
import {
  WorktreeFlowBindingStore,
  WorktreeFlowIdentity,
} from "../../../src/lib/worktree-flow-binding.js";
import RunResumeCommand from "../../../src/flow/lib/run-resume.js";

const roots = [];

function createRoot() {
  const root = createTmpDir("park-flow-authority-");
  roots.push(root);
  return root;
}

function createManagedFlow(root, specId, issue = 453) {
  const worktreePath = path.join(root, ".senti", "worktree", `feature-${specId}`);
  fs.mkdirSync(worktreePath, { recursive: true });
  const runId = `run-${specId}`;
  const manager = new FlowManager({
    root: worktreePath,
    mainRoot: root,
    inWorktree: true,
    specId,
  });
  const state = {
    specId,
    runId,
    ...(issue == null ? {} : { issue }),
    baseBranch: "main",
    featureBranch: `feature/${specId}`,
    worktree: true,
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [],
    currentTaskId: null,
  };
  manager.create(state);
  new WorktreeFlowBindingStore({ worktreePath }).save(new WorktreeFlowIdentity({
    runId,
    issue,
    specId,
    worktreePath,
  }));
  const specDir = path.join(root, "specs", specId);
  fs.writeFileSync(path.join(specDir, "spec.json"), "{}\n");
  fs.writeFileSync(path.join(specDir, "spec-review.json"), "{\"verdict\":\"pass\"}\n");
  fs.writeFileSync(path.join(specDir, "spec-gate.json"), "{\"verdict\":\"pass\"}\n");
  manager.addActiveFlow(specId, "worktree");
  return {
    root,
    worktreePath,
    manager,
    specId,
    runId,
    issue,
    flowPath: path.join(specDir, "flow.json"),
    bindingPath: path.join(worktreePath, ".senti", "flow-identity.json"),
    specPath: path.join(specDir, "spec.json"),
    reviewPath: path.join(specDir, "spec-review.json"),
    gatePath: path.join(specDir, "spec-gate.json"),
  };
}

function exactIdentity(flow, overrides = {}) {
  return new ParkedFlowIdentity({
    expectRunId: flow.runId,
    expectSpec: flow.specId,
    ...(flow.issue == null ? { expectNoIssue: true } : { expectIssue: flow.issue }),
    ...overrides,
  });
}

function registryPath(root) {
  return path.join(root, ".senti", ".active-flow");
}

function snapshot(paths) {
  return Object.fromEntries(paths.map((file) => [
    file,
    fs.existsSync(file) ? fs.readFileSync(file).toString("base64") : null,
  ]));
}

function flowSnapshot(flow) {
  return snapshot([
    registryPath(flow.root),
    flow.bindingPath,
    flow.flowPath,
    flow.specPath,
    flow.reviewPath,
    flow.gatePath,
  ]);
}

afterEach(() => {
  for (const root of roots.splice(0)) removeTmpDir(root);
});

describe("managed worktree flow park authority", () => {
  it("parks only the exact target and keeps every non-pointer byte unchanged", () => {
    const root = createRoot();
    const target = createManagedFlow(root, "453-target", 453);
    const other = createManagedFlow(root, "454-other", 454);
    const targetFiles = snapshot([
      target.bindingPath,
      target.flowPath,
      target.specPath,
      target.reviewPath,
      target.gatePath,
      other.bindingPath,
      other.flowPath,
      other.specPath,
      other.reviewPath,
      other.gatePath,
    ]);

    const receipt = target.manager.parkActiveFlow(exactIdentity(target)).toJSON();

    assert.deepEqual(new ActiveFlowRegistry({ mainRoot: root }).load(), [
      { specId: other.specId, mode: "worktree" },
    ]);
    assert.deepEqual(snapshot(Object.keys(targetFiles)), targetFiles);
    assert.deepEqual(receipt, {
      parked: true,
      changed: true,
      identity: { runId: target.runId, specId: target.specId, issue: 453 },
      mode: "worktree",
      executionRoot: target.worktreePath,
      resume: {
        executionRoot: target.worktreePath,
        argv: [
          "flow", "resume", "--parked",
          "--expect-run-id", target.runId,
          "--expect-spec", target.specId,
          "--expect-issue", "453",
        ],
      },
    });
  });

  it("retains an empty durable authority for the last parked pointer", () => {
    const root = createRoot();
    const flow = createManagedFlow(root, "453-last", null);

    flow.manager.parkActiveFlow(exactIdentity(flow));

    assert.equal(fs.existsSync(registryPath(root)), true);
    assert.deepEqual(JSON.parse(fs.readFileSync(registryPath(root), "utf8")), []);
  });

  it("restores the exact worktree pointer and makes an exact retry idempotent", () => {
    const root = createRoot();
    const flow = createManagedFlow(root, "453-resume", 453);
    const identity = exactIdentity(flow);
    flow.manager.parkActiveFlow(identity);
    const nonPointerBefore = snapshot([
      flow.bindingPath,
      flow.flowPath,
      flow.specPath,
      flow.reviewPath,
      flow.gatePath,
    ]);

    const first = flow.manager.resumeParkedFlow(identity).toJSON();
    const registryAfterFirst = fs.readFileSync(registryPath(root));
    const second = flow.manager.resumeParkedFlow(identity).toJSON();

    assert.equal(first.resumed, true);
    assert.equal(first.changed, true);
    assert.equal(second.resumed, true);
    assert.equal(second.changed, false);
    assert.deepEqual(fs.readFileSync(registryPath(root)), registryAfterFirst);
    assert.deepEqual(new ActiveFlowRegistry({ mainRoot: root }).load(), [
      { specId: flow.specId, mode: "worktree" },
    ]);
    assert.deepEqual(snapshot(Object.keys(nonPointerBefore)), nonPointerBefore);
  });

  it("requires all three identity guards and rejects each mismatch without mutation", () => {
    const root = createRoot();
    const flow = createManagedFlow(root, "453-identity", 453);
    for (const input of [
      { expectSpec: flow.specId, expectIssue: 453 },
      { expectRunId: flow.runId, expectIssue: 453 },
      { expectRunId: flow.runId, expectSpec: flow.specId },
    ]) {
      assert.throws(
        () => new ParkedFlowIdentity(input),
        (error) => error.code === "FLOW_PARK_TARGET_REQUIRED",
      );
    }

    for (const overrides of [
      { expectRunId: "run-foreign" },
      { expectSpec: "999-foreign" },
      { expectIssue: 999 },
      { expectIssue: undefined, expectNoIssue: true },
    ]) {
      const before = flowSnapshot(flow);
      assert.throws(
        () => flow.manager.parkActiveFlow(exactIdentity(flow, overrides)),
        (error) => error.code === "FLOW_PARK_IDENTITY_MISMATCH",
      );
      assert.deepEqual(flowSnapshot(flow), before);
    }
  });

  it("fails closed for an absent target, wrong root, and unsupported local mode", () => {
    const root = createRoot();
    const flow = createManagedFlow(root, "453-boundary", 453);
    const identity = exactIdentity(flow);
    flow.manager.parkActiveFlow(identity);
    let before = flowSnapshot(flow);
    assert.throws(
      () => flow.manager.parkActiveFlow(identity),
      (error) => error.code === "FLOW_PARK_TARGET_ABSENT",
    );
    assert.deepEqual(flowSnapshot(flow), before);

    const wrongRoot = new FlowManager({ root, mainRoot: root, inWorktree: false, specId: flow.specId });
    before = flowSnapshot(flow);
    assert.throws(
      () => wrongRoot.resumeParkedFlow(identity),
      (error) => error.code === "FLOW_PARK_MODE_UNSUPPORTED",
    );
    assert.deepEqual(flowSnapshot(flow), before);

    const localSpecId = "455-local";
    const local = new FlowManager({ root, mainRoot: root, inWorktree: false, specId: localSpecId });
    local.create({
      specId: localSpecId,
      runId: "run-local",
      issue: 455,
      baseBranch: "main",
      featureBranch: "main",
      steps: buildInitialSteps(),
      requirements: [],
      tasks: [],
      currentTaskId: null,
    });
    local.addActiveFlow(localSpecId, "local");
    const localIdentity = new ParkedFlowIdentity({
      expectRunId: "run-local",
      expectSpec: localSpecId,
      expectIssue: 455,
    });
    const localRegistry = fs.readFileSync(registryPath(root));
    assert.throws(
      () => local.parkActiveFlow(localIdentity),
      (error) => error.code === "FLOW_PARK_MODE_UNSUPPORTED",
    );
    assert.deepEqual(fs.readFileSync(registryPath(root)), localRegistry);
  });

  it("fails closed for missing, corrupt, mismatched, or finalized worktree authority", () => {
    const cases = [
      ["missing binding", (flow) => fs.rmSync(flow.bindingPath)],
      ["corrupt binding", (flow) => fs.writeFileSync(flow.bindingPath, "{broken\n")],
      ["missing state", (flow) => fs.rmSync(flow.flowPath)],
      ["corrupt state", (flow) => fs.writeFileSync(flow.flowPath, "{broken\n")],
      ["mismatched state", (flow) => {
        const state = JSON.parse(fs.readFileSync(flow.flowPath, "utf8"));
        state.runId = "run-foreign";
        fs.writeFileSync(flow.flowPath, `${JSON.stringify(state, null, 2)}\n`);
      }],
      ["finalized state", (flow) => {
        const state = JSON.parse(fs.readFileSync(flow.flowPath, "utf8"));
        state.state = { finalizedAt: "2026-07-23T00:00:00.000Z" };
        fs.writeFileSync(flow.flowPath, `${JSON.stringify(state, null, 2)}\n`);
      }],
    ];

    for (const [name, breakAuthority] of cases) {
      const root = createRoot();
      const flow = createManagedFlow(root, `453-${name.replaceAll(" ", "-")}`, 453);
      const identity = exactIdentity(flow);
      flow.manager.parkActiveFlow(identity);
      breakAuthority(flow);
      const before = flowSnapshot(flow);
      assert.throws(() => flow.manager.resumeParkedFlow(identity), ParkedFlowError, name);
      assert.deepEqual(flowSnapshot(flow), before, name);
    }
  });

  it("rejects a foreign same-spec mode and bypasses every discovery path", () => {
    const root = createRoot();
    const flow = createManagedFlow(root, "453-conflict", 453);
    const identity = exactIdentity(flow);
    flow.manager.parkActiveFlow(identity);
    new ActiveFlowRegistry({ mainRoot: root }).add(flow.specId, "branch");
    const before = flowSnapshot(flow);
    assert.throws(
      () => flow.manager.resumeParkedFlow(identity),
      (error) => error.code === "FLOW_PARK_ACTIVE_CONFLICT",
    );
    assert.deepEqual(flowSnapshot(flow), before);

    new ActiveFlowRegistry({ mainRoot: root }).remove(flow.specId);
    const originalReaddir = fs.readdirSync;
    fs.readdirSync = () => { throw new Error("directory enumeration must not run"); };
    try {
      const result = new RunResumeCommand().execute({
        parked: true,
        flowManager: flow.manager,
        expectRunId: flow.runId,
        expectSpec: flow.specId,
        expectIssue: flow.issue,
      });
      assert.equal(result.resumed, true);
    } finally {
      fs.readdirSync = originalReaddir;
    }
  });
});
