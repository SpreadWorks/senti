// spec: R3 R6
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { ProcessIdentitySource } from "../../../src/lib/process-identity.js";
import { RepositoryFlowOperationLock } from "../../../src/lib/repository-maintenance-lock.js";

function identitySource({ unknown = false } = {}) {
  const source = new ProcessIdentitySource({
    platform: "linux",
    pid: process.pid,
    readBootIdentity: () => "spec-test-boot",
    readProcessStartFingerprint: () => "100",
  });
  if (unknown) source.assess = () => ({ status: "unknown", reason: "simulated unknown owner" });
  return source;
}

function writeForeignOwner(lockPath, mainRoot) {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  fs.writeFileSync(lockPath, `${JSON.stringify({
    version: 1,
    kind: "repository-flow-operation",
    mainRoot,
    processIdentity: {
      pid: process.pid,
      bootIdentity: "spec-test-boot",
      startFingerprint: "100",
      ownerToken: "11111111-1111-4111-8111-111111111111",
    },
  })}\n`);
}

describe("repository lock diagnostics", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("R3: rejects a foreign live lock with owner, requester, and boundary diagnostics", () => {
    tmp = createTmpDir("spec-474-foreign-");
    const lockPath = path.join(tmp, ".senti", ".repository-flow-operation.lock");
    writeForeignOwner(lockPath, fs.realpathSync(tmp));

    assert.throws(
      () => new RepositoryFlowOperationLock({ mainRoot: tmp, processIdentitySource: identitySource() }).acquire(),
      (error) => error.code === "REPOSITORY_FLOW_OPERATION_BUSY"
        && error.contention?.owner?.ownerToken === "11111111-1111-4111-8111-111111111111"
        && error.contention?.requester?.pid === process.pid
        && error.contention?.operation === "repository-flow-operation"
        && error.contention?.boundary === "acquire",
    );
  });

  it("R3: keeps owner and requester diagnostics when owner liveness is unknown", () => {
    tmp = createTmpDir("spec-474-unknown-");
    const lockPath = path.join(tmp, ".senti", ".repository-flow-operation.lock");
    writeForeignOwner(lockPath, fs.realpathSync(tmp));

    assert.throws(
      () => new RepositoryFlowOperationLock({
        mainRoot: tmp,
        processIdentitySource: identitySource({ unknown: true }),
      }).acquire(),
      (error) => error.code === "REPOSITORY_FLOW_OPERATION_LOCK_UNKNOWN"
        && error.contention?.owner?.ownerToken === "11111111-1111-4111-8111-111111111111"
        && error.contention?.requester?.pid === process.pid
        && error.contention?.requester?.bootIdentity === "spec-test-boot"
        && error.contention?.boundary === "acquire",
    );
  });

  it("R3: records an unknown owner for malformed lock content", () => {
    tmp = createTmpDir("spec-474-malformed-");
    const lockPath = path.join(tmp, ".senti", ".repository-flow-operation.lock");
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    fs.writeFileSync(lockPath, "{broken\n");

    assert.throws(
      () => new RepositoryFlowOperationLock({ mainRoot: tmp, processIdentitySource: identitySource() }).acquire(),
      (error) => error.code === "REPOSITORY_FLOW_OPERATION_LOCK_CORRUPT"
        && error.contention?.owner === null
        && error.contention?.requester?.pid === process.pid
        && error.contention?.operation === "repository-flow-operation"
        && error.contention?.boundary === "acquire",
    );
  });
});
