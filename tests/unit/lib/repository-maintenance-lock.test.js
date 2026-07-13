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
});
