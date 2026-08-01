import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import {
  FlowTargetBinding,
  missingExactTargetGuardNames,
  targetMismatchEnvelopeForInput,
} from "../../../src/lib/flow-target-guard.js";
import {
  createTmpDir,
  removeTmpDir,
} from "../../helpers/tmp-dir.js";

const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) removeTmpDir(root);
});

function root() {
  const value = createTmpDir("flow-target-binding-unit-");
  roots.push(value);
  return value;
}

function captureInput(repository, overrides = {}) {
  const flowState = {
    runId: "binding-unit-run",
    issue: 483,
    spec: "specs/482-cli-target-binding/spec.json",
    featureBranch: "feature/482-cli-target-binding",
    baseBranch: "main",
    worktree: false,
    ...overrides.flowState,
  };
  return {
    flowState,
    mode: overrides.mode ?? "branch",
    mainRoot: repository,
    authorityRoot: overrides.authorityRoot ?? repository,
    ...(overrides.worktreePath && { worktreePath: overrides.worktreePath }),
  };
}

test("FlowTargetBinding rejects a managed-worktree state captured as branch mode", () => {
  const repository = root();

  assert.throws(
    () => FlowTargetBinding.capture(captureInput(repository, {
      flowState: { worktree: true },
    })),
    (error) => error.code === "ACTIVE_FLOW_MISMATCH"
      && error.data.expectedMode === "branch"
      && error.data.activeMode === "worktree",
  );
});

test("FlowTargetBinding rejects a branch state captured as worktree mode", () => {
  const repository = root();
  const worktreePath = root();

  assert.throws(
    () => FlowTargetBinding.capture(captureInput(repository, {
      mode: "worktree",
      authorityRoot: worktreePath,
      worktreePath,
    })),
    (error) => error.code === "ACTIVE_FLOW_MISMATCH"
      && error.data.expectedMode === "worktree"
      && error.data.activeMode === "branch",
  );
});

test("FlowTargetBinding derives local mode from equal feature and base branches", () => {
  const repository = root();
  const binding = FlowTargetBinding.capture(captureInput(repository, {
    mode: "local",
    flowState: {
      featureBranch: "main",
      baseBranch: "main",
    },
  }));

  assert.equal(binding.authority.mode, "local");
});

test("FlowTargetBinding command exposes no-Issue guard explicitly", () => {
  const repository = root();
  const binding = FlowTargetBinding.capture(captureInput(repository, {
    flowState: {
      issue: null,
    },
  }));

  const command = binding.guardCommand("senti flow get next-action");

  assert.match(command, /^senti flow get next-action --expect-binding '[^']+' --expect-no-issue$/);
});

test("target guard envelope compares opaque binding authority before mutation", () => {
  const repository = root();
  const otherRepository = root();
  const input = captureInput(repository);
  const binding = FlowTargetBinding.capture(input);

  const envelope = targetMismatchEnvelopeForInput({
    type: "run",
    key: "reopen-draft",
    input: { expectBinding: binding.serialize() },
    flowState: input.flowState,
    mainRoot: otherRepository,
    authorityRoot: otherRepository,
  });

  assert.equal(envelope.ok, false);
  assert.equal(envelope.errors[0].code, "ACTIVE_FLOW_MISMATCH");
  assert.equal(envelope.errors[0].data.expectedMainRoot, repository);
  assert.equal(envelope.errors[0].data.activeMainRoot, otherRepository);
});

test("opaque binding satisfies exact target guard requirements", () => {
  const repository = root();
  const binding = FlowTargetBinding.capture(captureInput(repository));

  assert.deepEqual(
    missingExactTargetGuardNames({ expectBinding: binding.serialize() }, {
      issue: 483,
    }),
    [],
  );
  assert.deepEqual(
    missingExactTargetGuardNames({}, { issue: 483 }),
    ["--expect-run-id", "--expect-spec", "--expect-issue"],
  );
});

test("FlowTargetBinding rejects an oversized serialized token before decoding", () => {
  assert.throws(
    () => FlowTargetBinding.deserialize("x".repeat((32 * 1024) + 1)),
    /serialized FlowTargetBinding must not exceed 32768 bytes/,
  );
});
