import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { IssueLogStore } from "../../../src/flow/lib/issue-log-store.js";
import { ProcessIdentitySource } from "../../../src/lib/process-identity.js";

function makeStore() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sennel-issue-log-store-"));
  const spec = "specs/100/spec.json";
  fs.mkdirSync(path.join(root, "specs/100"), { recursive: true });
  return { root, spec, store: new IssueLogStore({ root, spec }) };
}

test("IssueLogStore serializes idempotent append and rejects stale revisions", () => {
  const { store } = makeStore();
  const first = store.append({ step: "gate", reason: "first" }, "event-1");
  const duplicate = store.append({ step: "gate", reason: "ignored duplicate" }, "event-1");

  assert.equal(first.appended, true);
  assert.equal(duplicate.appended, false);
  assert.equal(store.read().document.entries.length, 1);

  const staleRevision = store.read().revision;
  store.append({ step: "review", reason: "concurrent" }, "event-2");
  assert.throws(
    () => store.mutate(staleRevision, () => {}),
    (error) => error.code === "ISSUE_LOG_REVISION_CONFLICT",
  );
  assert.deepEqual(store.read().document.entries.map((entry) => entry.issueLogId), ["event-1", "event-2"]);
});

test("IssueLogStore claims an abandoned writer lock and releases it after append", () => {
  const { root, spec } = makeStore();
  const lockPath = path.join(root, "specs/100/.issue-log.lock");
  const abandoned = new IssueLogStore({
    root,
    spec,
    processIdentitySource: new ProcessIdentitySource({
      platform: "linux",
      pid: 999999999,
      readBootIdentity() { return "test-boot"; },
      readProcessStartFingerprint() { return "1"; },
    }),
  });
  abandoned.lock.acquire();
  assert.equal(fs.existsSync(lockPath), true);

  const store = new IssueLogStore({ root, spec });
  assert.equal(store.append({ step: "gate", reason: "after crash" }, "event-after-crash").appended, true);
  assert.equal(fs.existsSync(lockPath), false);
});

test("IssueLogStore accepts only bounded spec.json and spec.md authorities", () => {
  for (const specFile of ["spec.json", "spec.md"]) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "sennel-issue-log-authority-"));
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "sennel-issue-log-outside-"));
    const directory = path.join(root, "specs/100");
    const spec = `specs/100/${specFile}`;
    const target = path.join(directory, specFile);
    const sentinel = path.join(outside, "sentinel");
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(sentinel, "unchanged");
    fs.symlinkSync(sentinel, target);

    assert.throws(() => new IssueLogStore({ root, spec }), /must be a real file/);
    assert.equal(fs.readFileSync(sentinel, "utf8"), "unchanged");
    assert.equal(fs.existsSync(path.join(directory, "issue-log.json")), false);

    fs.unlinkSync(target);
    fs.mkdirSync(target);
    assert.throws(() => new IssueLogStore({ root, spec }), /must be a real file/);
    assert.equal(fs.existsSync(path.join(directory, "issue-log.json")), false);
  }

  const { root } = makeStore();
  assert.throws(
    () => new IssueLogStore({ root, spec: "specs/100/arbitrary.txt" }),
    /outside the project root/,
  );
});

test("IssueLogStore preserves both the operation and lock-release failures", () => {
  const { root, store } = makeStore();
  const issuePath = path.join(root, "specs/100/issue-log.json");
  const lockPath = path.join(root, "specs/100/.issue-log.lock");
  store.append({ step: "gate", reason: "existing" }, "existing");
  const snapshot = store.read();
  const before = fs.readFileSync(issuePath);
  const beforeMode = fs.statSync(issuePath).mode & 0o777;
  const release = store.lock.release.bind(store.lock);
  store.lock.release = () => {
    throw Object.assign(new Error("injected lock release failure"), { code: "LOCK_RELEASE_FAILURE" });
  };

  try {
    assert.throws(
      () => store.mutate(snapshot.revision, () => {
        throw Object.assign(new Error("injected mutation failure"), { code: "PRIMARY_MUTATION_FAILURE" });
      }),
      (error) => {
        assert.equal(error instanceof AggregateError, true);
        assert.equal(error.cause.code, "PRIMARY_MUTATION_FAILURE");
        assert.match(error.cause.message, /mutation failure/);
        assert.deepEqual(error.errors.map((item) => item.code), [
          "PRIMARY_MUTATION_FAILURE",
          "LOCK_RELEASE_FAILURE",
        ]);
        return true;
      },
    );
    assert.deepEqual(fs.readFileSync(issuePath), before);
    assert.equal(fs.statSync(issuePath).mode & 0o777, beforeMode);
    assert.equal(fs.existsSync(lockPath), true);
  } finally {
    store.lock.release = release;
    release();
  }
  assert.equal(fs.existsSync(lockPath), false);
  assert.equal(store.append({ step: "review", reason: "retry" }, "retry").appended, true);
  assert.deepEqual(store.read().document.entries.map((entry) => entry.issueLogId), ["existing", "retry"]);
  assert.equal(fs.existsSync(lockPath), false);
});

test("IssueLogStore restores exact absence or bytes after compensating owned entries", () => {
  const absent = makeStore();
  const absentPath = path.join(absent.root, "specs/100/issue-log.json");
  absent.store.append({ step: "finalize", reason: "owned" }, "owned-absent");
  absent.store.restoreOwnedMutation({
    idempotencyKeys: ["owned-absent"],
    before: { exists: false, bytes: null, mode: null },
  });
  assert.equal(fs.existsSync(absentPath), false);

  const exact = makeStore();
  const exactPath = path.join(exact.root, "specs/100/issue-log.json");
  const before = Buffer.from('{\n  "entries" : [ { "issueLogId" : "existing", "reason" : "kept" } ]\n}\n');
  fs.writeFileSync(exactPath, before, { mode: 0o640 });
  exact.store.append({ step: "finalize", reason: "owned" }, "owned-exact");
  exact.store.restoreOwnedMutation({
    idempotencyKeys: ["owned-exact"],
    before: { exists: true, bytes: before.toString("base64"), mode: 0o640 },
  });
  assert.deepEqual(fs.readFileSync(exactPath), before);
  assert.equal(fs.statSync(exactPath).mode & 0o777, 0o640);
});

test("IssueLogStore compensation preserves a concurrent append", () => {
  const { root, store } = makeStore();
  const issuePath = path.join(root, "specs/100/issue-log.json");
  const before = Buffer.from('{"entries":[{"issueLogId":"existing","reason":"kept"}]}\n');
  fs.writeFileSync(issuePath, before);
  store.append({ step: "finalize", reason: "owned" }, "owned-concurrent");
  store.append({ step: "other", reason: "concurrent" }, "concurrent");

  const restored = store.restoreOwnedMutation({
    idempotencyKeys: ["owned-concurrent"],
    before: { exists: true, bytes: before.toString("base64"), mode: 0o644 },
  });

  assert.equal(restored.exact, false);
  assert.deepEqual(store.read().document.entries.map((entry) => entry.issueLogId), ["existing", "concurrent"]);
});
