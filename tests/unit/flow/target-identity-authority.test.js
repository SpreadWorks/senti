import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { FlowTargetExpectation } from "../../../src/lib/flow-target-guard.js";
import { FlowTargetIdentityAuthority } from "../../../src/lib/flow-target-identity-authority.js";
import { resolvePreparingRunId } from "../../../src/flow/lib/resolve-preparing-run-id.js";
import { makeFlowManager, makeFlowState } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

function activeFlow(manager, specId, issue, mode = "local") {
  const state = makeFlowState({
    specId,
    runId: `run-${specId}`,
    issue,
    featureBranch: `feature/${specId}`,
  });
  manager.create(state);
  manager.addActiveFlow(specId, mode);
  return state;
}

function preparingPath(root, runId) {
  return path.join(root, ".senti", `.active-flow.${runId}`);
}

function activePath(root, specId) {
  return path.join(root, "specs", specId, "flow.json");
}

function treeSnapshot(root, directory = root) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
    .flatMap((entry) => {
      const absolute = path.join(directory, entry.name);
      const relative = path.relative(root, absolute).split(path.sep).join("/");
      if (entry.isDirectory()) return [{ path: `${relative}/`, content: null }, ...treeSnapshot(root, absolute)];
      const stat = fs.lstatSync(absolute);
      return [{
        path: relative,
        mode: stat.mode & 0o777,
        content: fs.readFileSync(absolute).toString("base64"),
      }];
    });
}

describe("flow target identity authority", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("loads only an exact preparing target when an unrelated preparing state is corrupt", () => {
    tmp = createTmpDir("target-identity-");
    const manager = makeFlowManager(tmp);
    manager.createPreparingFlow("run-target", { issue: 493 });
    manager.createPreparingFlow("run-corrupt", { issue: 304 });
    fs.writeFileSync(preparingPath(tmp, "run-corrupt"), "{truncated");

    const target = manager.resolveExplicitFlowTarget(new FlowTargetExpectation({
      expectRunId: "run-target",
      expectIssue: 493,
    }));

    assert.equal(target.preparing, true);
    assert.equal(target.state.runId, "run-target");
  });

  it("resolves an exact active target without loading unrelated corrupt preparing or active state", () => {
    tmp = createTmpDir("target-identity-");
    const manager = makeFlowManager(tmp);
    activeFlow(manager, "001-target", 493);
    activeFlow(manager, "002-corrupt", 304);
    manager.createPreparingFlow("run-corrupt-preparing", { issue: 305 });
    fs.writeFileSync(activePath(tmp, "002-corrupt"), "{truncated");
    fs.writeFileSync(preparingPath(tmp, "run-corrupt-preparing"), JSON.stringify({ spec: "legacy" }));

    const target = manager.resolveExplicitFlowTarget(new FlowTargetExpectation({
      expectRunId: "run-001-target",
      expectSpec: "001-target",
    }));

    assert.equal(target.preparing, false);
    assert.equal(target.specId, "001-target");
  });

  it("resolves a preparing target without loading an unrelated corrupt active state", () => {
    tmp = createTmpDir("target-identity-");
    const manager = makeFlowManager(tmp);
    activeFlow(manager, "001-corrupt", 304);
    manager.createPreparingFlow("run-target", { issue: 493 });
    fs.writeFileSync(activePath(tmp, "001-corrupt"), "{truncated");

    const target = manager.resolveExplicitFlowTarget(new FlowTargetExpectation({
      expectRunId: "run-target",
    }));

    assert.equal(target.preparing, true);
    assert.equal(target.state.issue, 493);
  });

  it("returns typed recovery with target identity and no side effects when selected state is missing", () => {
    tmp = createTmpDir("target-identity-");
    const manager = makeFlowManager(tmp);
    activeFlow(manager, "001-target", 493);
    fs.unlinkSync(activePath(tmp, "001-target"));
    const before = treeSnapshot(tmp);

    assert.throws(
      () => manager.resolveExplicitFlowTarget(new FlowTargetExpectation({ expectIssue: 493 })),
      (error) => error.code === "FLOW_TARGET_RECOVERY_REQUIRED"
        && error.data?.runId === "run-001-target"
        && error.data?.issue === 493
        && error.data?.specId === "001-target"
        && error.data?.reason === "ACTIVE_FLOW_STATE_AUTHORITY_MISSING",
    );
    assert.deepEqual(treeSnapshot(tmp), before);
  });

  it("returns typed recovery with target identity when selected active state is corrupt", () => {
    tmp = createTmpDir("target-identity-");
    const manager = makeFlowManager(tmp);
    activeFlow(manager, "001-target", 493);
    fs.writeFileSync(activePath(tmp, "001-target"), "{truncated");
    const before = treeSnapshot(tmp);

    assert.throws(
      () => manager.resolveExplicitFlowTarget(new FlowTargetExpectation({ expectIssue: 493 })),
      (error) => error.code === "FLOW_TARGET_RECOVERY_REQUIRED"
        && error.data?.runId === "run-001-target"
        && error.data?.issue === 493
        && error.data?.specId === "001-target",
    );
    assert.deepEqual(treeSnapshot(tmp), before);
  });

  it("returns typed recovery without side effects when selected state identity is stale", () => {
    tmp = createTmpDir("target-identity-");
    const manager = makeFlowManager(tmp);
    activeFlow(manager, "001-target", 493);
    const statePath = activePath(tmp, "001-target");
    const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
    state.issue = 999;
    fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
    const before = treeSnapshot(tmp);

    assert.throws(
      () => manager.resolveExplicitFlowTargetForRead(new FlowTargetExpectation({
        expectRunId: "run-001-target",
      })),
      (error) => error.code === "FLOW_TARGET_RECOVERY_REQUIRED"
        && error.data?.reason === "FLOW_TARGET_STATE_REVISION_MISMATCH"
        && error.data?.issue === 493,
    );
    assert.deepEqual(treeSnapshot(tmp), before);
  });

  it("returns typed recovery without side effects when the selected preparing state is corrupt", () => {
    tmp = createTmpDir("target-identity-");
    const manager = makeFlowManager(tmp);
    manager.createPreparingFlow("run-target", { issue: 493 });
    fs.writeFileSync(preparingPath(tmp, "run-target"), "{truncated");
    const before = treeSnapshot(tmp);

    assert.throws(
      () => manager.resolveExplicitFlowTarget(new FlowTargetExpectation({ expectRunId: "run-target" })),
      (error) => error.code === "FLOW_TARGET_RECOVERY_REQUIRED"
        && error.data?.runId === "run-target"
        && error.data?.issue === 493
        && error.data?.reason === "PREPARING_FLOW_CORRUPT",
    );
    assert.deepEqual(treeSnapshot(tmp), before);
  });

  it("returns typed recovery without side effects when the selected preparing state is missing", () => {
    tmp = createTmpDir("target-identity-");
    const manager = makeFlowManager(tmp);
    manager.createPreparingFlow("run-target", { issue: 493 });
    fs.unlinkSync(preparingPath(tmp, "run-target"));
    const before = treeSnapshot(tmp);

    assert.throws(
      () => manager.resolveExplicitFlowTarget(new FlowTargetExpectation({ expectRunId: "run-target" })),
      (error) => error.code === "FLOW_TARGET_RECOVERY_REQUIRED"
        && error.data?.runId === "run-target"
        && error.data?.issue === 493
        && error.data?.reason === "PREPARING_FLOW_NOT_FOUND",
    );
    assert.deepEqual(treeSnapshot(tmp), before);
  });

  it("classifies same-Issue active and preparing identities as ambiguous", () => {
    tmp = createTmpDir("target-identity-");
    const manager = makeFlowManager(tmp);
    activeFlow(manager, "001-active", 493);
    manager.createPreparingFlow("run-preparing", { issue: 493 });

    assert.throws(
      () => manager.resolveExplicitFlowTarget(new FlowTargetExpectation({ expectIssue: 493 })),
      (error) => error.code === "FLOW_TARGET_AMBIGUOUS" && error.data?.matchCount === 2,
    );
  });

  it("does not infer orphaned legacy state as an Issue candidate", () => {
    tmp = createTmpDir("target-identity-");
    const manager = makeFlowManager(tmp);
    manager.createPreparingFlow("run-target", { issue: 493 });
    fs.writeFileSync(preparingPath(tmp, "run-orphan"), JSON.stringify({
      runId: "run-orphan",
      issue: 493,
      spec: "legacy-field",
    }));

    const target = manager.resolveExplicitFlowTarget(new FlowTargetExpectation({ expectIssue: 493 }));

    assert.equal(target.state.runId, "run-target");
  });

  it("fails closed when the identity authority is malformed, duplicated, or stale", () => {
    for (const corruption of ["malformed", "duplicate", "stale"]) {
      const root = createTmpDir(`target-identity-${corruption}-`);
      try {
        const manager = makeFlowManager(root);
        manager.createPreparingFlow("run-target", { issue: 493 });
        const authorityPath = FlowTargetIdentityAuthority.pathFor(root);
        if (corruption === "malformed") {
          fs.writeFileSync(authorityPath, "{truncated");
        } else {
          const authority = JSON.parse(fs.readFileSync(authorityPath, "utf8"));
          if (corruption === "duplicate") authority.push(structuredClone(authority[0]));
          if (corruption === "stale") authority[0].revision = "0".repeat(64);
          fs.writeFileSync(authorityPath, `${JSON.stringify(authority, null, 2)}\n`);
        }

        assert.throws(
          () => manager.resolveExplicitFlowTarget(new FlowTargetExpectation({ expectRunId: "run-target" })),
          (error) => error.code === "FLOW_TARGET_AUTHORITY_CORRUPT",
          corruption,
        );
      } finally {
        removeTmpDir(root);
      }
    }
  });

  it("resolves an exact runId beyond the preparing scan limit", () => {
    tmp = createTmpDir("target-identity-");
    const manager = makeFlowManager(tmp);
    for (let index = 0; index < 105; index += 1) {
      manager.createPreparingFlow(`run-${String(index).padStart(3, "0")}`, { issue: index + 1 });
    }

    const target = manager.resolveExplicitFlowTarget(new FlowTargetExpectation({
      expectRunId: "run-104",
    }));
    const direct = resolvePreparingRunId(manager, "run-104", {
      type: "run",
      key: "auto-check",
    });

    assert.equal(target.state.issue, 105);
    assert.equal(direct.runId, "run-104");
  });
});
