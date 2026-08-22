import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { IssueLogStore } from "../../../src/flow/lib/issue-log-store.js";
import { ProcessIdentitySource } from "../../../src/lib/process-identity.js";
import { CanonicalFlowFixture, makeFlowManager } from "../../support/infrastructure/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";

function makeStore(t, { processIdentitySource } = {}) {
  const root = createTmpDir("sennel-issue-log-store-v1-");
  t.after(() => removeTmpDir(root));
  const manager = makeFlowManager(root);
  const fixture = new CanonicalFlowFixture({
    flowManager: manager,
    specId: "100-issue-log",
    runId: "run-100-issue-log",
  }).create().activate("branch");
  const location = fixture.location();
  const store = IssueLogStore.forVersion({ location, processIdentitySource });
  return { root, manager, fixture, location, store };
}

test("IssueLogStore serializes idempotent Version publications through the Activity catalog", (t) => {
  const { manager, fixture, store } = makeStore(t);
  const beforeActivities = manager.activityLedger(fixture.specId).length;
  const first = store.append({ step: "gate", reason: "first" }, "event-1");
  const duplicate = store.append({ step: "gate", reason: "ignored duplicate" }, "event-1");
  const second = store.append({ step: "review", reason: "next" }, "event-2");

  assert.equal(first.appended.length, 1);
  assert.equal(duplicate.appended.length, 0);
  assert.equal(second.appended.length, 1);
  assert.deepEqual(store.read().document.entries.map((entry) => entry.issueLogId), ["event-1", "event-2"]);
  assert.equal(manager.activityLedger(fixture.specId).length, beforeActivities + 2);
  assert.equal(manager.artifactCatalog(fixture.specId).resolve("issue-log.json").logicalKey, "issue.log");
});

test("IssueLogStore claims an abandoned Version writer lock and releases it after append", (t) => {
  const abandonedIdentity = new ProcessIdentitySource({
    platform: "linux",
    pid: 999999999,
    readBootIdentity() { return "test-boot"; },
    readProcessStartFingerprint() { return "1"; },
  });
  const { location, store: abandoned } = makeStore(t, { processIdentitySource: abandonedIdentity });
  const lockPath = path.join(location.directory, ".runtime", "locks", "issue-log.lock");
  abandoned.lock.acquire();
  assert.equal(fs.existsSync(lockPath), true);

  const store = IssueLogStore.forVersion({ location });
  assert.equal(store.append({ step: "gate", reason: "after crash" }, "event-after-crash").appended.length, 1);
  assert.equal(fs.existsSync(lockPath), false);
});

test("IssueLogStore requires a canonical typed Version location", () => {
  assert.throws(
    () => new IssueLogStore({}),
    /FlowVersionLocation is required/,
  );
});

test("IssueLogStore preserves a publication failure together with writer-lock release failure", (t) => {
  const { store } = makeStore(t);
  const release = store.lock.release.bind(store.lock);
  store.lock.release = () => {
    throw Object.assign(new Error("injected lock release failure"), { code: "LOCK_RELEASE_FAILURE" });
  };

  try {
    assert.throws(
      () => store.appendMany([null]),
      (error) => {
        assert.equal(error instanceof AggregateError, true);
        assert.match(error.message, /issue-log operation and writer-lock release both failed/);
        assert.equal(error.errors.at(-1).code, "LOCK_RELEASE_FAILURE");
        return true;
      },
    );
  } finally {
    store.lock.release = release;
    release();
  }
});
