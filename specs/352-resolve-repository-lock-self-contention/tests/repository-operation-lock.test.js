// spec: R1 R2 R6
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { ProcessIdentitySource } from "../../../src/lib/process-identity.js";
import { RepositoryFlowOperationLock } from "../../../src/lib/repository-maintenance-lock.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";

function identitySource({ boot = "spec-test-boot", start = "100" } = {}) {
  return new ProcessIdentitySource({
    platform: "linux",
    pid: process.pid,
    readBootIdentity: () => boot,
    readProcessStartFingerprint: () => start,
  });
}

function flowState(specId) {
  return {
    spec: `specs/${specId}/spec.json`,
    runId: "run-spec-474",
    baseBranch: "main",
    featureBranch: `feature/${specId}`,
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [],
    currentTaskId: null,
  };
}

describe("repository operation lock", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("R1: borrows a same-process lock without releasing the outer owner", () => {
    tmp = createTmpDir("spec-474-reentrant-");
    const outer = new RepositoryFlowOperationLock({ mainRoot: tmp, processIdentitySource: identitySource() });
    const token = outer.acquire();
    const nested = new RepositoryFlowOperationLock({ mainRoot: tmp, processIdentitySource: identitySource() });

    assert.equal(nested.acquire(), token);
    nested.release();
    assert.equal(fs.existsSync(path.join(tmp, ".senti", ".repository-flow-operation.lock")), true);
    outer.release();
  });

  it("R2: persists runtime metadata while the dispatcher invocation owns the operation lock", () => {
    tmp = createTmpDir("spec-474-runtime-metadata-");
    const specId = "474-runtime-metadata";
    const manager = new FlowManager({ root: tmp, mainRoot: tmp, inWorktree: false, specId });
    manager.create(flowState(specId));
    const outer = new RepositoryFlowOperationLock({ mainRoot: tmp });
    outer.acquire();
    try {
      manager.setStepRuntimeLog("draft", { path: "logs/dispatcher.jsonl", closedAt: "2026-07-26T00:00:00.000Z" });
    } finally {
      outer.release();
    }

    const draft = findStepById(manager.loadReadOnly(specId).steps, "draft");
    assert.deepEqual(draft.runtimeLog, { path: "logs/dispatcher.jsonl", closedAt: "2026-07-26T00:00:00.000Z" });
  });

  it("R2: rejects a requester identity that differs from the registered owner", () => {
    tmp = createTmpDir("spec-474-foreign-requester-");
    const outer = new RepositoryFlowOperationLock({ mainRoot: tmp, processIdentitySource: identitySource() });
    outer.acquire();
    try {
      assert.throws(
        () => new RepositoryFlowOperationLock({
          mainRoot: tmp,
          processIdentitySource: identitySource({ boot: "different-requester" }),
        }).acquire(),
        (error) => error.code === "REPOSITORY_FLOW_OPERATION_BUSY"
          && error.contention?.owner?.bootIdentity === "spec-test-boot"
          && error.contention?.requester?.pid === process.pid
          && error.contention?.boundary === "acquire",
      );
    } finally {
      outer.release();
    }
  });
});
