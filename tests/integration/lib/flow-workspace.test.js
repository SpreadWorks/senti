import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import {
  FlowWorkspace,
  FlowSpecRoot,
  relativeFlowSpecFile,
} from "../../../src/lib/flow-workspace.js";
import { CanonicalFlowFixture } from "../../support/infrastructure/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";

describe("FlowWorkspace configured artifact authority", () => {
  let root;
  afterEach(() => root && removeTmpDir(root));

  it("stores flow state by specId under the configured repository-relative root", () => {
    root = createTmpDir("sennel-flow-workspace-");
    const specRoot = new FlowSpecRoot("flow-artifacts/specs");
    const manager = new FlowManager({
      root,
      mainRoot: root,
      inWorktree: false,
      specRoot,
    });
    const fixture = new CanonicalFlowFixture({
      flowManager: manager,
      specId: "485-shared-artifacts",
      runId: "flow-workspace",
      execution: { mode: "direct", baseBranch: "main", featureBranch: null },
    }).create();
    const loaded = fixture.state();
    const location = manager.specLocation(loaded.specId);

    assert.equal(manager.pathFor(loaded.specId), location.flowStateFile);
    assert.equal(relativeFlowSpecFile(loaded), location.relativeSpecFile);
    assert.equal(fs.existsSync(location.flowStateFile), true);
    const persisted = JSON.parse(fs.readFileSync(location.flowStateFile, "utf8"));
    assert.equal(persisted.specId, loaded.specId);
    assert.equal(Object.hasOwn(persisted, "spec"), false);
    assert.equal(Object.hasOwn(persisted, "specPath"), false);
    assert.equal(Object.hasOwn(persisted, "specRoot"), false);
  });

  it("fails closed when an active flow is absent from a newly configured root", () => {
    root = createTmpDir("sennel-flow-root-change-");
    const original = new FlowManager({
      root,
      mainRoot: root,
      inWorktree: false,
      specRoot: "specs",
    });
    const fixture = new CanonicalFlowFixture({
      flowManager: original,
      specId: "485-root-change",
      runId: "flow-root-change",
      execution: { mode: "direct", baseBranch: "main", featureBranch: null },
    }).create().registerActive();
    const state = fixture.state();
    const originalLocation = original.specLocation(state.specId);
    const registryPath = path.join(root, ".sennel", ".active-flow");
    const registryBefore = fs.readFileSync(registryPath);
    const changed = new FlowManager({
      root,
      mainRoot: root,
      inWorktree: false,
      specRoot: "moved/specs",
    });
    const changedLocation = changed.specLocation(state.specId);

    for (const operation of [
      () => changed.resolveActiveFlow(null),
      () => changed.cleanStaleFlows(),
    ]) {
      assert.throws(
          operation,
          (error) => error.code === "ACTIVE_FLOW_STATE_AUTHORITY_MISSING"
            && error.specId === state.specId
          && error.statePath === changedLocation.flowStateFile,
      );
    }
    assert.deepEqual(fs.readFileSync(registryPath), registryBefore);
    assert.equal(fs.existsSync(originalLocation.flowStateFile), true);
    assert.equal(fs.existsSync(changedLocation.flowStateFile), false);
  });

  it("rejects absolute and traversal-based configured roots", () => {
    assert.throws(() => new FlowSpecRoot("/tmp/specs"), /repository-relative/);
    assert.throws(() => new FlowSpecRoot("../specs"), /parent path/);
    assert.throws(() => new FlowSpecRoot("specs//nested"), /empty/);
  });

  it("keeps canonical and execution Version authorities explicit in a worktree", () => {
    root = createTmpDir("sennel-flow-version-workspace-");
    const executionRoot = path.join(root, "worktree");
    fs.mkdirSync(executionRoot);
    const workspace = new FlowWorkspace({ repositoryRoot: root, executionRoot, specRoot: "specs" });
    const canonical = workspace.canonicalVersion("485-shared-artifacts", 1);
    const execution = workspace.executionVersion("485-shared-artifacts", 1);
    assert.equal(canonical.repositoryRoot, root);
    assert.equal(canonical.authorityScope.toString(), "canonical");
    assert.equal(execution.repositoryRoot, executionRoot);
    assert.equal(execution.authorityScope.toString(), "execution");
    assert.notEqual(canonical.consumers.report(), execution.consumers.report());

    const manager = new FlowManager({
      root: executionRoot,
      mainRoot: root,
      inWorktree: true,
      specId: "485-shared-artifacts",
    });
    assert.equal(manager.canonicalVersionLocation(1).repositoryRoot, root);
    assert.equal(manager.executionVersionLocation(1).repositoryRoot, executionRoot);
    assert.equal(typeof manager.versionLocation, "undefined");
  });

  it("rejects repository and execution roots reached through symlink ancestors", () => {
    root = createTmpDir("sennel-flow-version-symlink-root-");
    const real = path.join(root, "real");
    const linked = path.join(root, "linked");
    fs.mkdirSync(real);
    fs.symlinkSync(real, linked);
    const canonicalLinked = new FlowWorkspace({ repositoryRoot: linked, executionRoot: real });
    const executionLinked = new FlowWorkspace({ repositoryRoot: real, executionRoot: linked });
    assert.throws(() => canonicalLinked.canonicalVersion("485-shared-artifacts", 1), /symbolic-link|canonical/);
    assert.throws(() => executionLinked.executionVersion("485-shared-artifacts", 1), /symbolic-link|canonical/);
  });
});
