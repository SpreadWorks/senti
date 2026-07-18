import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import { Container } from "../../../src/lib/container.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import {
  WorktreeFlowBindingStore,
  WorktreeFlowIdentity,
} from "../../../src/lib/worktree-flow-binding.js";
import { resolveFlowContext } from "../../../src/flow/lib/flow-context.js";
import { makeFlowState } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

function buildContainer({ root = "/repo", config = {}, flowState = null } = {}) {
  const c = new Container();
  c.register("config", config);
  c.register("paths", {
    root,
    srcRoot: root,
    sentiDir: path.join(root, ".senti"),
    outputDir: path.join(root, ".senti/output"),
    agentWorkDir: path.join(root, ".tmp"),
    logDir: path.join(root, ".tmp/logs"),
    configPath: path.join(root, ".senti/config.json"),
  });
  c.register("inWorktree", false);
  c.register("mainRoot", root);
  // Stub flowManager whose load() returns the desired snapshot.
  c.register("flowManager", { load: () => flowState });
  return c;
}

function snapshotFileIdentity(file) {
  const stat = fs.statSync(file, { bigint: true });
  return {
    bytes: fs.readFileSync(file),
    inode: stat.ino,
    mtimeNs: stat.mtimeNs,
  };
}

describe("resolveFlowContext", () => {
  it("returns flow-specific context fields", () => {
    const fs = { spec: "specs/100-demo/spec.md" };
    const c = buildContainer({ flowState: fs });
    const ctx = resolveFlowContext(c);
    assert.equal(ctx.flowState, fs);
    assert.equal(ctx.specId, "100-demo");
    assert.equal(ctx.inWorktree, false);
    assert.equal(ctx.mainRoot, "/repo");
    assert.equal(ctx.root, "/repo");
  });

  it("returns null specId when no flow state", () => {
    const c = buildContainer({ flowState: null });
    const ctx = resolveFlowContext(c);
    assert.equal(ctx.flowState, null);
    assert.equal(ctx.specId, null);
  });

  it("binds route-less worktree mutations to the identity without reading shared registry", (t) => {
    const mainRoot = createTmpDir("flow-context-bound-route-");
    t.after(() => removeTmpDir(mainRoot));
    const worktree = path.join(mainRoot, ".senti", "worktree", "feature-440-bound-route");
    fs.mkdirSync(worktree, { recursive: true });
    const targetSpecId = "440-bound-route";
    const foreignSpecId = "441-foreign-route";
    const targetSpec = `specs/${targetSpecId}/spec.json`;
    const manager = new FlowManager({ root: worktree, mainRoot, inWorktree: true });
    const targetState = makeFlowState({
      spec: targetSpec,
      runId: "run-bound-route",
      issue: 440,
      worktree: true,
      featureBranch: `feature/${targetSpecId}`,
      metrics: [],
    });
    const foreignState = makeFlowState({
      spec: `specs/${foreignSpecId}/spec.json`,
      runId: "run-foreign-route",
      issue: 441,
      worktree: true,
      featureBranch: `feature/${foreignSpecId}`,
      metrics: [],
    });
    manager.create(targetState);
    manager.create(foreignState);
    new WorktreeFlowBindingStore({ worktreePath: worktree }).save(new WorktreeFlowIdentity({
      runId: targetState.runId,
      issue: targetState.issue,
      spec: targetState.spec,
      worktreePath: worktree,
    }));

    const registryPath = path.join(mainRoot, ".senti", ".active-flow");
    fs.mkdirSync(path.dirname(registryPath), { recursive: true });
    fs.writeFileSync(registryPath, `${JSON.stringify({
      entries: [{ spec: targetSpecId, mode: "worktree", generation: "foreign-schema" }],
      generation: "shared-generation",
      migration: { version: 4 },
    }, null, 2)}\n`);
    const registryBefore = snapshotFileIdentity(registryPath);
    const foreignFlowPath = path.join(worktree, "specs", foreignSpecId, "flow.json");
    const foreignBefore = fs.readFileSync(foreignFlowPath);

    const container = buildContainer({ root: worktree });
    container.register("mainRoot", mainRoot);
    container.register("inWorktree", true);
    container.register("flowManager", manager);
    const ctx = resolveFlowContext(container, { input: {
      expectRunId: targetState.runId,
      expectIssue: targetState.issue,
      expectSpec: targetState.spec,
    } });
    ctx.flowManager.mutate((state) => { state.request = "route-less gate mutation"; });
    ctx.flowManager.incrementMetric("draft", "issueLog");

    const targetAfter = manager.load(targetSpecId);
    assert.equal(targetAfter.request, "route-less gate mutation");
    assert.deepEqual(
      { phase: targetAfter.metrics.at(-1).phase, counter: targetAfter.metrics.at(-1).counter },
      { phase: "draft", counter: "issueLog" },
    );
    assert.deepEqual(fs.readFileSync(foreignFlowPath), foreignBefore);
    assert.deepEqual(snapshotFileIdentity(registryPath), registryBefore);
  });
});
