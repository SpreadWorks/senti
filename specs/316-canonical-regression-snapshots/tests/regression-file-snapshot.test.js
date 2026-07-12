// spec: R1
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initGitRepo, commitAll, checkoutNewBranch } from "../../../tests/helpers/git-repo.js";
import { listRegressionChangedFiles } from "../../../src/flow/lib/test-regression.js";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const TEST_TMP_ROOT = path.join(
  REPO_ROOT,
  "specs/316-canonical-regression-snapshots/tests/.tmp",
);
const SNAPSHOT_MODULE = new URL(
  "../../../src/flow/lib/regression-file-snapshot.js",
  import.meta.url,
);
const fixtures = [];

function fixtureRoot(prefix = "snapshot-") {
  fs.mkdirSync(TEST_TMP_ROOT, { recursive: true });
  const root = fs.mkdtempSync(path.join(TEST_TMP_ROOT, prefix));
  fixtures.push(root);
  return root;
}

function writeFile(root, relativePath, content) {
  const absolutePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content, "utf8");
}

async function snapshotTypes() {
  try {
    return await import(SNAPSHOT_MODULE.href);
  } catch (err) {
    assert.fail(`R1 implementation module could not be loaded: ${err.code || err.message}`);
  }
}

afterEach(() => {
  for (const root of fixtures.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
  fs.rmSync(TEST_TMP_ROOT, { recursive: true, force: true });
});

describe("Issue #410 canonical regression snapshots", () => {
  it("R1: canonical serialization ignores input ordering and detects a one-byte change", async () => {
    const { RegressionFileSnapshotList } = await snapshotTypes();
    const root = fixtureRoot();
    writeFile(root, "src/a.js", "export const a = 1;\n");
    writeFile(root, "src/b.js", "export const b = 1;\n");
    const entries = [
      { status: "modified", path: "src/b.js" },
      { status: "modified", path: "src/a.js" },
    ];

    const first = RegressionFileSnapshotList.fromChangedFiles(root, entries);
    const reordered = RegressionFileSnapshotList.fromChangedFiles(root, [...entries].reverse());
    assert.equal(first.equals(reordered), true);
    assert.deepEqual(first.toJSON(), reordered.toJSON());
    assert.equal(JSON.stringify(first.toJSON()), JSON.stringify(reordered.toJSON()));

    writeFile(root, "src/a.js", "export const a = 2;\n");
    const changed = RegressionFileSnapshotList.fromChangedFiles(root, entries);
    assert.equal(first.equals(changed), false);
  });

  it("R1: add delete rename untracked and deleted-file snapshots retain canonical identity", async () => {
    const { RegressionFileSnapshotList } = await snapshotTypes();
    const root = fixtureRoot();
    writeFile(root, "added.js", "added\n");
    writeFile(root, "renamed.js", "renamed\n");
    writeFile(root, "untracked.js", "untracked\n");
    const entries = [
      { status: "untracked", path: "untracked.js" },
      { status: "deleted", path: "deleted.js" },
      { status: "renamed", old_path: "before.js", path: "renamed.js" },
      { status: "added", path: "added.js" },
    ];

    const snapshots = RegressionFileSnapshotList.fromChangedFiles(root, entries);
    const json = snapshots.toJSON();
    assert.deepEqual(json.map((entry) => entry.path), [
      "added.js",
      "deleted.js",
      "renamed.js",
      "untracked.js",
    ]);
    assert.equal(json.find((entry) => entry.path === "deleted.js").fingerprint, null);
    assert.equal(json.find((entry) => entry.path === "renamed.js").old_path, "before.js");
    for (const entry of json.filter((item) => item.status !== "deleted")) {
      assert.match(entry.fingerprint, /^[a-f0-9]{64}$/);
    }

    const restored = RegressionFileSnapshotList.fromJSON([...json].reverse());
    assert.equal(snapshots.equals(restored), true);
    assert.equal(Object.isFrozen(snapshots), true);
    assert.equal(Object.isFrozen(snapshots.entries), true);
    assert.equal(Object.isFrozen(snapshots.entries[0]), true);
  });

  it("R1: malformed duplicate legacy and over-limit snapshot inputs fail closed", async () => {
    const { RegressionFileSnapshotList } = await snapshotTypes();
    const root = fixtureRoot();
    const fingerprint = "a".repeat(64);

    writeFile(root, "src/nested/a.js", "normalized\n");
    writeFile(root, "src/nested/renamed.js", "renamed\n");
    const normalized = RegressionFileSnapshotList.fromChangedFiles(root, [
      { status: "modified", path: "src\\nested\\a.js" },
      {
        status: "renamed",
        old_path: "src\\nested\\before.js",
        path: "src\\nested\\renamed.js",
      },
    ]).toJSON();
    assert.deepEqual(normalized.map((entry) => entry.path), [
      "src/nested/a.js",
      "src/nested/renamed.js",
    ]);
    assert.equal(normalized[1].old_path, "src/nested/before.js");

    assert.throws(
      () => RegressionFileSnapshotList.fromJSON([
        { status: "modified", path: "src/a.js" },
      ]),
      /fingerprint|rerun test-execute/i,
    );
    for (const malformed of [
      { status: "invalid", path: "src/a.js", fingerprint },
      { status: "modified", path: "", fingerprint },
      { status: "modified", path: 42, fingerprint },
      { status: "modified", path: "../outside.js", fingerprint },
      { status: "modified", path: "/absolute.js", fingerprint },
      { status: "modified", path: "src/a.js", old_path: "src/old.js", fingerprint },
      { status: "renamed", path: "src/a.js", fingerprint },
      { status: "modified", path: "src/a.js", fingerprint: "not-sha256" },
    ]) {
      assert.throws(
        () => RegressionFileSnapshotList.fromJSON([malformed]),
        /status|path|old_path|fingerprint|relative|sha-?256/i,
      );
    }
    assert.throws(
      () => RegressionFileSnapshotList.fromJSON([
        { status: "modified", path: "src/a.js", fingerprint },
        { status: "modified", path: "src/a.js", fingerprint },
      ]),
      /duplicate/i,
    );
    assert.throws(
      () => RegressionFileSnapshotList.fromChangedFiles(
        root,
        Array.from({ length: 2001 }, (_, index) => ({
          status: "deleted",
          path: `deleted/${index}.js`,
        })),
      ),
      /2000|limit|entries/i,
    );
  });

  it("R1: regression Git enumeration expands untracked directories to bounded leaf files", () => {
    const root = fixtureRoot("git-");
    writeFile(root, "tracked.js", "tracked\n");
    initGitRepo(root);
    commitAll(root, "initial");
    checkoutNewBranch(root, "feature/snapshot");
    writeFile(root, "scratch/nested.js", "one\n");

    const changed = listRegressionChangedFiles({
      root,
      state: { baseBranch: "main" },
    });
    assert.deepEqual(changed, [
      { status: "untracked", path: "scratch/nested.js" },
    ]);
  });

  it("R1: file hashing computes SHA-256 while whole-file reads are blocked", async () => {
    const { RegressionFileSnapshotList } = await snapshotTypes();
    const root = fixtureRoot();
    const relativePath = "large.js";
    const content = "0123456789abcdef".repeat(8192);
    writeFile(root, relativePath, content);
    const absolutePath = path.join(root, relativePath);
    const expected = crypto.createHash("sha256").update(content).digest("hex");
    const originalReadFileSync = fs.readFileSync;
    fs.readFileSync = function guardedReadFileSync(filePath, ...args) {
      if (path.resolve(String(filePath)) === absolutePath) {
        throw new Error("whole-file read blocked by R1 test");
      }
      return originalReadFileSync.call(this, filePath, ...args);
    };
    try {
      const snapshots = RegressionFileSnapshotList.fromChangedFiles(root, [
        { status: "modified", path: relativePath },
      ]);
      assert.equal(snapshots.toJSON()[0].fingerprint, expected);
    } finally {
      fs.readFileSync = originalReadFileSync;
    }
  });
});
