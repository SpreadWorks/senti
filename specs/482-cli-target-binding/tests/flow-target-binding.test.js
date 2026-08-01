// spec: R1 R2 R4 R5 R8 R9 R10 R12
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";

import {
  FlowTargetBinding,
  FlowTargetExpectation,
} from "../../../src/lib/flow-target-guard.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import {
  createTmpDir,
  removeTmpDir,
} from "../../../tests/helpers/tmp-dir.js";
import { makeFlowManager } from "../../../tests/helpers/flow-setup.js";
import {
  checkoutNewBranch,
  commitAll,
  initGitRepo,
} from "../../../tests/helpers/git-repo.js";

const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) removeTmpDir(root);
});

function temporaryRoot(label) {
  const root = createTmpDir(label);
  roots.push(root);
  return root;
}

function flowState(overrides = {}) {
  return {
    runId: "run-target-binding",
    issue: 483,
    spec: "specs/482-cli-target-binding/spec.json",
    baseBranch: "main",
    featureBranch: "feature/482-cli-target-binding",
    worktree: false,
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [],
    currentTaskId: null,
    ...structuredClone(overrides),
  };
}

function branchTarget(root, overrides = {}) {
  return {
    flowState: flowState(overrides.flowState),
    mode: overrides.mode ?? "branch",
    mainRoot: root,
    authorityRoot: overrides.authorityRoot ?? root,
    invocationRoot: overrides.invocationRoot ?? root,
  };
}

function persistFlow(root, specId, issue) {
  const state = flowState({
    runId: `run-${specId}`,
    issue,
    spec: `specs/${specId}/spec.json`,
    featureBranch: `feature/${specId}`,
  });
  const manager = makeFlowManager(root);
  manager.create(state);
  manager.addActiveFlow(specId, "branch");
  return state;
}

test("R1: captures canonical Flow identity and stable branch authority", () => {
  const root = temporaryRoot("spec-482-binding-r1-");
  fs.mkdirSync(path.join(root, "specs"), { recursive: true });
  const binding = FlowTargetBinding.capture(branchTarget(root));
  const serialized = binding.toJSON();

  assert.equal(binding.runId, "run-target-binding");
  assert.equal(binding.issue, 483);
  assert.equal(binding.spec, "specs/482-cli-target-binding/spec.json");
  assert.deepEqual(serialized.authority, {
    mode: "branch",
    mainRoot: fs.realpathSync(root),
    executionRoot: fs.realpathSync(root),
    featureBranch: "feature/482-cli-target-binding",
    baseBranch: "main",
  });
});

test("R2: rejects every changed target or branch-authority field", () => {
  const root = temporaryRoot("spec-482-binding-r2-");
  const foreignRoot = temporaryRoot("spec-482-binding-r2-foreign-");
  const binding = FlowTargetBinding.capture(branchTarget(root));
  const mismatches = [
    branchTarget(root, { flowState: { runId: "other-run" } }),
    branchTarget(root, { flowState: { issue: 999 } }),
    branchTarget(root, { flowState: { spec: "specs/999-foreign/spec.json" } }),
    branchTarget(root, { mode: "local" }),
    branchTarget(root, { authorityRoot: foreignRoot }),
    branchTarget(root, { flowState: { featureBranch: "feature/foreign" } }),
    branchTarget(root, { flowState: { baseBranch: "develop" } }),
  ];

  for (const target of mismatches) {
    assert.throws(
      () => binding.assertCurrent(target),
      (error) => error.code === "ACTIVE_FLOW_MISMATCH"
        && Object.keys(error.data || {}).length > 0,
    );
  }
});

test("R4: stale binding fails before a target-sensitive mutation callback", () => {
  const root = temporaryRoot("spec-482-binding-r4-");
  const binding = FlowTargetBinding.capture(branchTarget(root));
  let mutated = false;

  assert.throws(
    () => binding.runIfCurrent(
      branchTarget(root, { flowState: { featureBranch: "feature/replaced" } }),
      () => {
        mutated = true;
      },
    ),
    (error) => error.code === "ACTIVE_FLOW_MISMATCH",
  );
  assert.equal(mutated, false);
});

test("R5: advancing the bound feature ref does not change branch identity", () => {
  const root = temporaryRoot("spec-482-binding-r5-");
  initGitRepo(root);
  commitAll(root, "initial");
  checkoutNewBranch(root, "feature/482-cli-target-binding");
  const target = branchTarget(root);
  const binding = FlowTargetBinding.capture(target);

  fs.writeFileSync(path.join(root, "change.txt"), "new commit\n");
  commitAll(root, "advance feature ref");

  assert.doesNotThrow(() => binding.assertCurrent(target));
});

test("R8: no-Issue identity is explicit and rejects an Issue-bearing target", () => {
  const root = temporaryRoot("spec-482-binding-r8-");
  const binding = FlowTargetBinding.capture(branchTarget(root, {
    flowState: { issue: null },
  }));

  assert.equal(binding.toJSON().issue, null);
  assert.match(binding.guardCommand("senti flow get next-action"), /--expect-no-issue/);
  assert.throws(
    () => binding.assertCurrent(branchTarget(root, { flowState: { issue: 483 } })),
    (error) => error.code === "ACTIVE_FLOW_MISMATCH",
  );
});

test("R9: explicit selection requires exactly one matching active Flow", () => {
  const root = temporaryRoot("spec-482-binding-r9-");
  persistFlow(root, "481-first", 483);
  persistFlow(root, "482-second", 483);
  const manager = makeFlowManager(root);

  const exact = manager.resolveExplicitFlowTarget(new FlowTargetExpectation({
    expectRunId: "run-482-second",
    expectIssue: 483,
    expectSpec: "specs/482-second/spec.json",
  }));
  assert.equal(exact.specId, "482-second");
  assert.throws(
    () => manager.resolveExplicitFlowTarget(new FlowTargetExpectation({ expectIssue: 483 })),
    (error) => error.code === "FLOW_TARGET_AMBIGUOUS" && error.data.matchCount === 2,
  );
  assert.throws(
    () => manager.resolveExplicitFlowTarget(new FlowTargetExpectation({
      expectRunId: "missing",
      expectIssue: 483,
    })),
    (error) => error.code === "FLOW_TARGET_NOT_FOUND" && error.data.matchCount === 0,
  );
});

test("R10: finalize boundaries retain lifecycle ref checks behind binding identity", () => {
  const root = temporaryRoot("spec-482-binding-r10-");
  const binding = FlowTargetBinding.capture(branchTarget(root));

  assert.throws(
    () => binding.assertCurrent(branchTarget(root, {
      flowState: { baseBranch: "release" },
    })),
    (error) => error.code === "ACTIVE_FLOW_MISMATCH"
      && error.data.expectedBaseBranch === "main"
      && error.data.activeBaseBranch === "release",
  );
  assert.equal(binding.toJSON().authority.featureRef, undefined);
  assert.equal(binding.toJSON().authority.headRef, undefined);
});

test("R12: main and managed-worktree invocation roots capture one lock authority", () => {
  const mainRoot = temporaryRoot("spec-482-binding-r12-main-");
  const worktreePath = path.join(mainRoot, ".senti", "worktree", "feature-482-cli-target-binding");
  fs.mkdirSync(worktreePath, { recursive: true });
  const state = flowState({ worktree: true });
  const input = {
    flowState: state,
    mode: "worktree",
    mainRoot,
    authorityRoot: worktreePath,
    worktreePath,
  };

  const fromMain = FlowTargetBinding.capture({ ...input, invocationRoot: mainRoot });
  const fromWorktree = FlowTargetBinding.capture({ ...input, invocationRoot: worktreePath });

  assert.equal(fromMain.digest, fromWorktree.digest);
  assert.equal(fromMain.dispatchLockRoot, fs.realpathSync(mainRoot));
  assert.equal(fromWorktree.dispatchLockRoot, fs.realpathSync(mainRoot));
  assert.throws(
    () => fromMain.assertCurrent({
      ...input,
      worktreePath: temporaryRoot("spec-482-binding-r12-foreign-"),
    }),
    (error) => error.code === "ACTIVE_FLOW_MISMATCH",
  );
});
