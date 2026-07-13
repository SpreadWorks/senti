import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import {
  RepositoryFlowOperationLock,
  RepositoryMaintenanceLock,
} from "../../../src/lib/repository-maintenance-lock.js";
import { ProcessIdentitySource } from "../../../src/lib/flow-state-atomic-writer.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";

function identitySource({ boot = "boot", start = "100", unknown = false } = {}) {
  return new ProcessIdentitySource({
    platform: "linux",
    pid: process.pid,
    readBootIdentity() {
      if (unknown) throw Object.assign(new Error("unavailable"), { code: "EACCES" });
      return boot;
    },
    readProcessStartFingerprint() {
      if (unknown) throw Object.assign(new Error("unavailable"), { code: "EACCES" });
      return start;
    },
  });
}

describe("repository maintenance lock", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("serializes maintenance and flow activation across the common main authority", () => {
    tmp = createTmpDir("repository-maintenance-");
    const maintenance = new RepositoryMaintenanceLock({ mainRoot: tmp, processIdentitySource: identitySource() });
    maintenance.acquire();
    assert.throws(
      () => new RepositoryFlowOperationLock({ mainRoot: tmp, processIdentitySource: identitySource() }).acquire(),
      (error) => error.code === "REPOSITORY_MAINTENANCE_BUSY",
    );
    maintenance.release();

    const flow = new RepositoryFlowOperationLock({ mainRoot: tmp, processIdentitySource: identitySource() });
    flow.acquire();
    assert.throws(
      () => new RepositoryMaintenanceLock({ mainRoot: tmp, processIdentitySource: identitySource() }).acquire(),
      (error) => error.code === "REPOSITORY_FLOW_OPERATION_BUSY",
    );
    flow.release();
  });

  it("fails closed for malformed, stale, and unknown maintenance owners", () => {
    tmp = createTmpDir("repository-maintenance-owner-");
    const lockPath = RepositoryMaintenanceLock.pathFor(tmp);
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    const cases = [
      ["malformed", "{broken\n", identitySource(), "REPOSITORY_MAINTENANCE_LOCK_CORRUPT"],
      ["stale", JSON.stringify({
        version: 1,
        kind: "repository-maintenance",
        mainRoot: fs.realpathSync(tmp),
        processIdentity: {
          pid: process.pid,
          bootIdentity: "old-boot",
          startFingerprint: "100",
          ownerToken: "11111111-1111-4111-8111-111111111111",
        },
      }), identitySource(), "REPOSITORY_MAINTENANCE_LOCK_STALE"],
      ["unknown", JSON.stringify({
        version: 1,
        kind: "repository-maintenance",
        mainRoot: fs.realpathSync(tmp),
        processIdentity: {
          pid: process.pid,
          bootIdentity: "boot",
          startFingerprint: "100",
          ownerToken: "11111111-1111-4111-8111-111111111111",
        },
      }), identitySource({ unknown: true }), "REPOSITORY_MAINTENANCE_LOCK_UNKNOWN"],
    ];

    for (const [label, content, source, code] of cases) {
      fs.writeFileSync(lockPath, content);
      assert.throws(
        () => new RepositoryFlowOperationLock({ mainRoot: tmp, processIdentitySource: source }).acquire(),
        (error) => error.code === code,
        label,
      );
      assert.equal(fs.readFileSync(lockPath, "utf8"), content, label);
      fs.unlinkSync(lockPath);
    }
  });

  it("blocks FlowStateCreator and AtomicFlowStateWriter without target mutation", () => {
    tmp = createTmpDir("repository-maintenance-flow-state-");
    const specId = "441-maintenance";
    const state = {
      spec: `specs/${specId}/spec.json`,
      runId: "run-maintenance",
      baseBranch: "main",
      featureBranch: `feature/${specId}`,
      steps: buildInitialSteps(),
      requirements: [],
      tasks: [],
      currentTaskId: null,
    };
    const fm = new FlowManager({ root: tmp, mainRoot: tmp, inWorktree: false, specId });
    const maintenance = new RepositoryMaintenanceLock({ mainRoot: tmp });
    maintenance.acquire();
    assert.throws(
      () => fm.create(state),
      (error) => error.code === "REPOSITORY_MAINTENANCE_BUSY",
    );
    assert.equal(fs.existsSync(path.join(tmp, "specs", specId, "flow.json")), false);
    maintenance.release();

    fm.create(state);
    const flowPath = path.join(tmp, "specs", specId, "flow.json");
    const before = fs.readFileSync(flowPath);
    maintenance.acquire();
    assert.throws(
      () => fm.mutate((fresh) => { fresh.request = "blocked"; }),
      (error) => error.code === "REPOSITORY_MAINTENANCE_BUSY",
    );
    assert.deepEqual(fs.readFileSync(flowPath), before);
    maintenance.release();
  });

  it("rejects symlink, non-directory, and replaced .senti authorities without external writes", () => {
    for (const Lock of [RepositoryMaintenanceLock, RepositoryFlowOperationLock]) {
      const external = createTmpDir("repository-lock-external-");
      const sentinel = path.join(external, "sentinel");
      fs.writeFileSync(sentinel, "unchanged");
      try {
        const symlinkRoot = createTmpDir("repository-lock-symlink-");
        fs.symlinkSync(external, path.join(symlinkRoot, ".senti"), "dir");
        assert.throws(
          () => new Lock({ mainRoot: symlinkRoot }).acquire(),
          (error) => error.code === "REPOSITORY_LOCK_AUTHORITY_INVALID",
        );
        assert.deepEqual(fs.readdirSync(external), ["sentinel"]);
        removeTmpDir(symlinkRoot);

        const fileRoot = createTmpDir("repository-lock-file-");
        fs.writeFileSync(path.join(fileRoot, ".senti"), "not-a-directory");
        assert.throws(
          () => new Lock({ mainRoot: fileRoot }).acquire(),
          (error) => error.code === "REPOSITORY_LOCK_AUTHORITY_INVALID",
        );
        assert.equal(fs.readFileSync(path.join(fileRoot, ".senti"), "utf8"), "not-a-directory");
        removeTmpDir(fileRoot);

        const replacementRoot = createTmpDir("repository-lock-replaced-");
        fs.mkdirSync(path.join(replacementRoot, ".senti"));
        const lock = new Lock({ mainRoot: replacementRoot });
        fs.renameSync(path.join(replacementRoot, ".senti"), path.join(replacementRoot, ".senti-original"));
        fs.symlinkSync(external, path.join(replacementRoot, ".senti"), "dir");
        assert.throws(
          () => lock.acquire(),
          (error) => error.code === "REPOSITORY_LOCK_AUTHORITY_INVALID",
        );
        assert.deepEqual(fs.readdirSync(external), ["sentinel"]);
        removeTmpDir(replacementRoot);
      } finally {
        removeTmpDir(external);
      }
    }
  });

  it("reclaims only a proven-stale flow-operation owner and preserves all rejected owners", () => {
    tmp = createTmpDir("repository-flow-operation-stale-");
    const lockPath = path.join(tmp, ".senti", ".repository-flow-operation.lock");
    fs.mkdirSync(path.dirname(lockPath), { recursive: true });
    const owner = (overrides = {}) => ({
      version: 1,
      kind: "repository-flow-operation",
      mainRoot: fs.realpathSync(tmp),
      processIdentity: {
        pid: process.pid,
        bootIdentity: "boot",
        startFingerprint: "100",
        ownerToken: "11111111-1111-4111-8111-111111111111",
      },
      ...overrides,
    });

    fs.writeFileSync(lockPath, `${JSON.stringify(owner({
      processIdentity: { ...owner().processIdentity, bootIdentity: "old-boot" },
    }))}\n`);
    const reclaimed = new RepositoryFlowOperationLock({ mainRoot: tmp, processIdentitySource: identitySource() });
    assert.notEqual(reclaimed.acquire(), owner().processIdentity.ownerToken);
    reclaimed.release();
    assert.equal(fs.existsSync(lockPath), false);

    const rejected = [
      ["live", owner(), identitySource(), "REPOSITORY_FLOW_OPERATION_BUSY"],
      ["unknown", owner(), identitySource({ unknown: true }), "REPOSITORY_FLOW_OPERATION_LOCK_UNKNOWN"],
      ["corrupt", { broken: true }, identitySource(), "REPOSITORY_FLOW_OPERATION_LOCK_CORRUPT"],
      ["foreign-authority", owner({ mainRoot: path.join(tmp, "foreign") }), identitySource(), "REPOSITORY_FLOW_OPERATION_LOCK_CORRUPT"],
    ];
    for (const [label, value, source, code] of rejected) {
      const bytes = `${JSON.stringify(value)}\n`;
      fs.writeFileSync(lockPath, bytes);
      assert.throws(
        () => new RepositoryFlowOperationLock({ mainRoot: tmp, processIdentitySource: source }).acquire(),
        (error) => error.code === code,
        label,
      );
      assert.equal(fs.readFileSync(lockPath, "utf8"), bytes, label);
      fs.unlinkSync(lockPath);
    }
  });

  it("preserves acquire conflict and cleanup failures in causal order", () => {
    tmp = createTmpDir("repository-maintenance-acquire-cleanup-");
    const flow = new RepositoryFlowOperationLock({
      mainRoot: tmp,
      processIdentitySource: identitySource(),
    });
    flow.acquire();
    const maintenance = new RepositoryMaintenanceLock({
      mainRoot: tmp,
      processIdentitySource: identitySource(),
    });
    const originalRelease = maintenance.lock.release;
    maintenance.lock.release = () => {
      throw new Error("maintenance acquire cleanup failed");
    };
    try {
      assert.throws(
        () => maintenance.acquire(),
        (error) => error instanceof AggregateError
          && error.errors.length === 2
          && error.errors[0].code === "REPOSITORY_FLOW_OPERATION_BUSY"
          && error.errors[1].message === "maintenance acquire cleanup failed"
          && error.cause === error.errors[0],
      );
    } finally {
      maintenance.lock.release = originalRelease;
      maintenance.release();
      flow.release();
    }
  });
});
