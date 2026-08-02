import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import {
  FlowSpecLocation,
  FlowSpecRoot,
  relativeFlowSpecFile,
} from "../../../src/lib/flow-workspace.js";
import { makeFlowState } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

describe("FlowWorkspace configured artifact authority", () => {
  let root;
  afterEach(() => root && removeTmpDir(root));

  it("stores flow state by specId under the configured repository-relative root", () => {
    root = createTmpDir("senti-flow-workspace-");
    const specRoot = new FlowSpecRoot("flow-artifacts/specs");
    const manager = new FlowManager({
      root,
      mainRoot: root,
      inWorktree: false,
      specRoot,
    });
    const state = makeFlowState({ specId: "485-shared-artifacts" });

    manager.create(state);
    const loaded = manager.loadReadOnly(state.specId);
    const location = new FlowSpecLocation({
      repositoryRoot: root,
      specRoot,
      specId: state.specId,
    });

    assert.equal(manager.pathFor(state.specId), location.flowStateFile);
    assert.equal(relativeFlowSpecFile(loaded), "flow-artifacts/specs/485-shared-artifacts/spec.json");
    assert.equal(fs.existsSync(location.flowStateFile), true);
    const persisted = JSON.parse(fs.readFileSync(location.flowStateFile, "utf8"));
    assert.equal(persisted.specId, state.specId);
    assert.equal(Object.hasOwn(persisted, "spec"), false);
    assert.equal(Object.hasOwn(persisted, "specPath"), false);
    assert.equal(Object.hasOwn(persisted, "specRoot"), false);
  });

  it("fails closed when an active flow is absent from a newly configured root", () => {
    root = createTmpDir("senti-flow-root-change-");
    const state = makeFlowState({ specId: "485-root-change" });
    const original = new FlowManager({
      root,
      mainRoot: root,
      inWorktree: false,
      specRoot: "specs",
    });
    original.create(state);
    original.addActiveFlow(state.specId, "local");
    const registryPath = path.join(root, ".senti", ".active-flow");
    const registryBefore = fs.readFileSync(registryPath);
    const changed = new FlowManager({
      root,
      mainRoot: root,
      inWorktree: false,
      specRoot: "moved/specs",
    });

    for (const operation of [
      () => changed.resolveActiveFlow(null),
      () => changed.cleanStaleFlows(),
    ]) {
      assert.throws(
        operation,
        (error) => error.code === "ACTIVE_FLOW_STATE_AUTHORITY_MISSING"
          && error.specId === state.specId
          && error.statePath.endsWith("moved/specs/485-root-change/flow.json"),
      );
    }
    assert.deepEqual(fs.readFileSync(registryPath), registryBefore);
    assert.equal(fs.existsSync(path.join(root, "specs", state.specId, "flow.json")), true);
    assert.equal(fs.existsSync(path.join(root, "moved", "specs", state.specId, "flow.json")), false);
  });

  it("rejects absolute and traversal-based configured roots", () => {
    assert.throws(() => new FlowSpecRoot("/tmp/specs"), /repository-relative/);
    assert.throws(() => new FlowSpecRoot("../specs"), /parent path/);
    assert.throws(() => new FlowSpecRoot("specs//nested"), /empty/);
  });
});
