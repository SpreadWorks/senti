import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { afterEach, describe, it } from "node:test";

import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { makeFlowState } from "../../helpers/flow-setup.js";
import { IssueLogStore } from "../../../src/flow/lib/issue-log-store.js";
import { OfflineMigrationTransaction } from "../../../src/lib/offline-migration-transaction.js";
import { RepositoryMaintenanceLock } from "../../../src/lib/repository-maintenance-lock.js";
import { applyMigration } from "../../../src/scripts/rename-phase-steps.js";

const SCRIPT = path.resolve("src/scripts/rename-phase-steps.js");
const JOURNAL = path.join(".senti", "migrations", "rename-phase-steps.json");

function initRepository(root) {
  execFileSync("git", ["init", "--quiet", root]);
  execFileSync("git", ["-C", root, "config", "user.email", "test@example.com"]);
  execFileSync("git", ["-C", root, "config", "user.name", "Test User"]);
  fs.writeFileSync(path.join(root, "README.md"), "# migration test\n");
}

function commitAll(root) {
  execFileSync("git", ["-C", root, "add", "-A"]);
  execFileSync("git", ["-C", root, "commit", "--quiet", "-m", "migration fixture"]);
}

function legacyFlow(specId) {
  const state = makeFlowState({
    spec: `specs/${specId}/spec.json`,
    featureBranch: `feature/${specId}`,
  });
  const queue = [...state.steps];
  while (queue.length > 0) {
    const step = queue.shift();
    if (step.id === "spec-gate") step.id = "gate";
    if (Array.isArray(step.children)) queue.push(...step.children);
  }
  return `${JSON.stringify(state, null, 2)}\n`;
}

function authorityContent(kind, specId) {
  if (kind === "flow.json") return legacyFlow(specId);
  if (kind === "issue-log.json") return '{"entries":[{"step":"gate","reason":"legacy"}]}\n';
  if (kind === "review.md") return "result: `gate`\n";
  return '{"artifactPath":"checks/gate/result.json"}\n';
}

function runCli(root) {
  return spawnSync(process.execPath, [SCRIPT, "--apply"], {
    cwd: root,
    env: { ...process.env, SENTI_WORK_ROOT: root },
    encoding: "utf8",
  });
}

function seedSpec(root, specId, { flow = true, issue = true, review = true } = {}) {
  const dir = path.join(root, "specs", specId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "spec.json"), '{}\n');
  if (flow) fs.writeFileSync(path.join(dir, "flow.json"), legacyFlow(specId));
  if (issue) fs.writeFileSync(path.join(dir, "issue-log.json"), authorityContent("issue-log.json", specId));
  if (review) fs.writeFileSync(path.join(dir, "review.md"), authorityContent("review.md", specId));
  return dir;
}

describe("rename-phase-steps migration transaction", () => {
  const roots = [];
  afterEach(() => {
    for (const root of roots.splice(0)) removeTmpDir(root);
  });

  it("rejects symlink and hardlink target authorities before external mutation", () => {
    const cases = [
      ["spec-directory", "symlink"],
      ...["flow.json", "issue-log.json", "report.json", "retro.json", "review.md"]
        .flatMap((file) => [[file, "symlink"], [file, "hardlink"]]),
    ];
    for (const [targetKind, linkKind] of cases) {
      const root = createTmpDir(`rename-authority-${targetKind.replace(".", "-")}-${linkKind}-`);
      const external = fs.mkdtempSync(path.join(os.tmpdir(), "rename-authority-external-"));
      roots.push(root, external);
      initRepository(root);
      const specId = "441-authority";
      const specDir = path.join(root, "specs", specId);
      const externalTarget = targetKind === "spec-directory"
        ? external
        : path.join(external, targetKind);
      if (targetKind === "spec-directory") {
        fs.mkdirSync(path.dirname(specDir), { recursive: true });
        fs.writeFileSync(path.join(external, "review.md"), authorityContent("review.md", specId));
        fs.symlinkSync(external, specDir, "dir");
      } else {
        fs.mkdirSync(specDir, { recursive: true });
        fs.writeFileSync(path.join(specDir, "spec.json"), '{}\n');
        fs.writeFileSync(externalTarget, authorityContent(targetKind, specId));
        if (linkKind === "symlink") fs.symlinkSync(externalTarget, path.join(specDir, targetKind));
        else fs.linkSync(externalTarget, path.join(specDir, targetKind));
      }
      const before = targetKind === "spec-directory"
        ? fs.readFileSync(path.join(external, "review.md"))
        : fs.readFileSync(externalTarget);
      commitAll(root);

      const result = runCli(root);

      assert.notEqual(result.status, 0, `${targetKind}/${linkKind}: ${result.stdout}`);
      assert.deepEqual(
        targetKind === "spec-directory"
          ? fs.readFileSync(path.join(external, "review.md"))
          : fs.readFileSync(externalTarget),
        before,
        `${targetKind}/${linkKind}`,
      );
      assert.equal(fs.existsSync(path.join(root, JOURNAL)), false, `${targetKind}/${linkKind}`);
    }
  });

  it("rejects a malformed issue-log instead of skipping it with exit zero", () => {
    const root = createTmpDir("rename-malformed-issue-");
    roots.push(root);
    initRepository(root);
    const dir = seedSpec(root, "441-malformed", { flow: false, review: false });
    const issuePath = path.join(dir, "issue-log.json");
    fs.writeFileSync(issuePath, "{malformed\n");
    const before = fs.readFileSync(issuePath);
    commitAll(root);

    const result = runCli(root);

    assert.notEqual(result.status, 0, result.stdout);
    assert.deepEqual(fs.readFileSync(issuePath), before);
    assert.equal(fs.existsSync(path.join(root, JOURNAL)), false);
  });

  it("rolls back every authority after the second flat-file apply fails and retries without manual repair", () => {
    const root = createTmpDir("rename-transaction-rollback-");
    roots.push(root);
    initRepository(root);
    const specIds = ["441-first", "442-second"];
    const targets = [];
    for (const specId of specIds) {
      const dir = seedSpec(root, specId);
      for (const file of ["flow.json", "issue-log.json", "review.md"]) targets.push(path.join(dir, file));
    }
    commitAll(root);
    const before = new Map(targets.map((target) => [target, fs.readFileSync(target)]));
    const originalWrite = fs.writeFileSync;
    const originalRename = fs.renameSync;
    let reviewWrites = 0;
    const failSecondReview = (target) => {
      if (typeof target !== "string" || !target.endsWith("review.md")) return;
      reviewWrites += 1;
      if (reviewWrites === 2) throw Object.assign(new Error("second flat apply failed"), { code: "EIO" });
    };
    fs.writeFileSync = (target, ...args) => {
      failSecondReview(target);
      return originalWrite(target, ...args);
    };
    fs.renameSync = (from, to) => {
      failSecondReview(to);
      return originalRename(from, to);
    };
    try {
      assert.throws(() => applyMigration(root), /second flat apply failed/);
    } finally {
      fs.writeFileSync = originalWrite;
      fs.renameSync = originalRename;
    }

    for (const target of targets) assert.deepEqual(fs.readFileSync(target), before.get(target), target);
    const journalPath = path.join(root, JOURNAL);
    assert.equal(JSON.parse(fs.readFileSync(journalPath, "utf8")).phase, "rolled-back");

    const retried = applyMigration(root);
    assert.ok(retried.changes.length > 0);
    assert.equal(fs.existsSync(journalPath), false);
    for (const target of targets) assert.notDeepEqual(fs.readFileSync(target), before.get(target), target);
  });

  it("blocks an actual second IssueLogStore writer while migration owns maintenance", () => {
    const root = createTmpDir("rename-maintenance-issue-writer-");
    roots.push(root);
    initRepository(root);
    const specId = "441-writer";
    const dir = seedSpec(root, specId, { flow: false, review: false });
    const issuePath = path.join(dir, "issue-log.json");
    commitAll(root);
    let writerError = null;

    const plan = applyMigration(root, {
      afterMaintenanceAcquired() {
        try {
          new IssueLogStore({ root, spec: `specs/${specId}/spec.json` }).append({
            step: "gate",
            reason: "concurrent runtime writer",
          }, "concurrent-writer");
        } catch (error) {
          writerError = error;
        }
      },
    });

    assert.ok(plan.changes.length > 0);
    assert.equal(writerError?.code, "REPOSITORY_MAINTENANCE_BUSY");
    const entries = JSON.parse(fs.readFileSync(issuePath, "utf8")).entries;
    assert.equal(entries.some((entry) => entry.issueLogId === "concurrent-writer"), false);
    assert.equal(entries[0].step, "spec-gate");
  });

  it("resumes a target committed before its journal index without manual repair", () => {
    const root = createTmpDir("rename-transaction-crash-resume-");
    roots.push(root);
    initRepository(root);
    const specId = "441-crash";
    const dir = seedSpec(root, specId, { issue: false, review: false });
    const flowPath = path.join(dir, "flow.json");
    const before = fs.readFileSync(flowPath);
    commitAll(root);
    const journalPath = path.join(root, JOURNAL);
    const originalRename = fs.renameSync;
    let journalRenames = 0;
    fs.renameSync = (from, to) => {
      if (path.resolve(String(to)) === journalPath) {
        journalRenames += 1;
        if (journalRenames >= 3) throw Object.assign(new Error("journal phase commit failed"), { code: "EIO" });
      }
      return originalRename(from, to);
    };
    try {
      assert.throws(() => applyMigration(root), /journal phase commit failed|apply and rollback both failed/);
    } finally {
      fs.renameSync = originalRename;
    }

    assert.notDeepEqual(fs.readFileSync(flowPath), before);
    const interrupted = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    assert.equal(interrupted.phase, "applying");
    assert.equal(interrupted.applyIndex, 0);

    const resumed = applyMigration(root);
    assert.equal(resumed.changes.length, 0);
    assert.equal(fs.existsSync(journalPath), false);
    assert.match(fs.readFileSync(flowPath, "utf8"), /"spec-gate"/);
  });

  it("continues a durable rollback after rollback target replacement fails", () => {
    const root = createTmpDir("rename-transaction-rollback-resume-");
    roots.push(root);
    initRepository(root);
    const specId = "441-rollback-crash";
    const dir = seedSpec(root, specId, { issue: false });
    const flowPath = path.join(dir, "flow.json");
    const reviewPath = path.join(dir, "review.md");
    commitAll(root);
    const originalRename = fs.renameSync;
    fs.renameSync = (from, to) => {
      const target = path.resolve(String(to));
      if (target === reviewPath) throw Object.assign(new Error("review apply failed"), { code: "EIO" });
      if (target === flowPath && /"spec-gate"/.test(fs.readFileSync(flowPath, "utf8"))) {
        throw Object.assign(new Error("flow rollback failed"), { code: "EIO" });
      }
      return originalRename(from, to);
    };
    try {
      assert.throws(
        () => applyMigration(root),
        (error) => error instanceof AggregateError
          && error.errors.some((item) => /review apply failed/.test(item.message))
          && error.errors.some((item) => /flow rollback failed/.test(item.message)),
      );
    } finally {
      fs.renameSync = originalRename;
    }
    const journalPath = path.join(root, JOURNAL);
    assert.equal(JSON.parse(fs.readFileSync(journalPath, "utf8")).phase, "rolling-back");

    const retried = applyMigration(root);
    assert.ok(retried.changes.length > 0);
    assert.equal(fs.existsSync(journalPath), false);
    assert.match(fs.readFileSync(flowPath, "utf8"), /"spec-gate"/);
    assert.match(fs.readFileSync(reviewPath, "utf8"), /`spec-gate`/);
  });

  it("continues rollback after crashing immediately after a durable rolling-back marker", () => {
    const root = createTmpDir("rename-transaction-rolling-marker-crash-");
    roots.push(root);
    initRepository(root);
    const specId = "441-rolling-marker";
    const dir = seedSpec(root, specId, { issue: false, review: false });
    const flowPath = path.join(dir, "flow.json");
    const before = fs.readFileSync(flowPath);
    commitAll(root);
    const journalPath = path.join(root, JOURNAL);
    const originalRename = fs.renameSync;
    fs.renameSync = (from, to) => {
      if (path.resolve(String(to)) === journalPath) {
        const staged = JSON.parse(fs.readFileSync(from, "utf8"));
        if (staged.phase === "applied") {
          throw Object.assign(new Error("applied marker failed before commit"), { code: "EIO" });
        }
        if (staged.phase === "rolling-back") {
          originalRename(from, to);
          throw Object.assign(new Error("crashed after rolling-back marker commit"), { code: "EIO" });
        }
      }
      return originalRename(from, to);
    };
    try {
      assert.throws(
        () => applyMigration(root),
        (error) => error instanceof AggregateError
          && error.errors.some((item) => /applied marker failed/.test(item.message))
          && error.errors.some((item) => /crashed after rolling-back marker/.test(item.message)),
      );
    } finally {
      fs.renameSync = originalRename;
    }

    assert.notDeepEqual(fs.readFileSync(flowPath), before);
    const interrupted = JSON.parse(fs.readFileSync(journalPath, "utf8"));
    assert.equal(interrupted.phase, "rolling-back");
    assert.equal(interrupted.applyIndex, interrupted.targets.length);

    const recovered = OfflineMigrationTransaction.recover({
      root,
      name: "rename-phase-steps",
      journalPath: JOURNAL,
    });

    assert.deepEqual(recovered, { recovered: true, completed: false });
    assert.deepEqual(fs.readFileSync(flowPath), before);
    assert.equal(fs.existsSync(journalPath), false);
    for (const snapshot of interrupted.snapshots) {
      for (const entry of snapshot.entries.filter((item) => item.kind === "file")) {
        assert.ok(Number.isSafeInteger(entry.mode));
        assert.match(entry.revision, /^[a-f0-9]{64}$/);
      }
    }
  });

  it("fails closed for tampered, foreign, symlink, and hardlink journals", () => {
    const root = createTmpDir("rename-transaction-journal-authority-");
    const external = createTmpDir("rename-transaction-journal-external-");
    roots.push(root, external);
    initRepository(root);
    for (const specId of ["441-journal-first", "442-journal-second"]) seedSpec(root, specId);
    commitAll(root);
    const journalPath = path.join(root, JOURNAL);
    const originalRename = fs.renameSync;
    let reviewRenames = 0;
    fs.renameSync = (from, to) => {
      if (String(to).endsWith("review.md")) {
        reviewRenames += 1;
        if (reviewRenames === 2) throw Object.assign(new Error("seed rolled-back journal"), { code: "EIO" });
      }
      return originalRename(from, to);
    };
    try {
      assert.throws(() => applyMigration(root), /seed rolled-back journal/);
    } finally {
      fs.renameSync = originalRename;
    }
    const journalBytes = fs.readFileSync(journalPath);
    const journal = JSON.parse(journalBytes);
    const externalPath = path.join(external, "journal.json");
    const cases = [
      ["malformed", () => fs.writeFileSync(journalPath, "{malformed\n")],
      ["unknown-field", () => fs.writeFileSync(journalPath, `${JSON.stringify({ ...journal, unexpected: true })}\n`)],
      ["foreign-root", () => fs.writeFileSync(journalPath, `${JSON.stringify({ ...journal, root: external })}\n`)],
      ["symlink", () => {
        fs.writeFileSync(externalPath, journalBytes);
        fs.unlinkSync(journalPath);
        fs.symlinkSync(externalPath, journalPath);
      }],
      ["hardlink", () => {
        fs.writeFileSync(externalPath, journalBytes);
        fs.unlinkSync(journalPath);
        fs.linkSync(externalPath, journalPath);
      }],
    ];
    for (const [label, tamper] of cases) {
      fs.rmSync(journalPath, { force: true });
      fs.rmSync(externalPath, { force: true });
      fs.writeFileSync(journalPath, journalBytes);
      tamper();
      assert.throws(() => applyMigration(root), undefined, label);
      if (fs.existsSync(externalPath)) assert.deepEqual(fs.readFileSync(externalPath), journalBytes, label);
    }
    fs.rmSync(journalPath, { force: true });
    fs.rmSync(externalPath, { force: true });
    fs.writeFileSync(journalPath, journalBytes);
    assert.ok(applyMigration(root).changes.length > 0);
  });

  it("rejects a symlinked migration journal directory without external writes", () => {
    const root = createTmpDir("rename-transaction-directory-authority-");
    const external = createTmpDir("rename-transaction-directory-external-");
    roots.push(root, external);
    initRepository(root);
    seedSpec(root, "441-journal-directory", { issue: false, review: false });
    fs.mkdirSync(path.join(root, ".senti"));
    fs.writeFileSync(path.join(external, "sentinel"), "unchanged");
    fs.symlinkSync(external, path.join(root, ".senti", "migrations"), "dir");
    commitAll(root);

    assert.throws(() => applyMigration(root), /real directory|authority/i);
    assert.deepEqual(fs.readdirSync(external), ["sentinel"]);
    assert.equal(fs.readFileSync(path.join(external, "sentinel"), "utf8"), "unchanged");
  });

  it("rejects a legacy spec added after planning before journal or target mutation", () => {
    const root = createTmpDir("rename-transaction-phantom-spec-");
    roots.push(root);
    initRepository(root);
    const originalDir = seedSpec(root, "441-planned", { issue: false, review: false });
    const originalFlow = path.join(originalDir, "flow.json");
    const before = fs.readFileSync(originalFlow);
    commitAll(root);

    assert.throws(
      () => applyMigration(root, {
        afterPlanBuilt() {
          seedSpec(root, "442-phantom", { issue: false, review: false });
        },
      }),
      /changed after migration planning|authority|snapshot|spec/i,
    );

    assert.deepEqual(fs.readFileSync(originalFlow), before);
    assert.match(fs.readFileSync(path.join(root, "specs", "442-phantom", "flow.json"), "utf8"), /"gate"/);
    assert.equal(fs.existsSync(path.join(root, JOURNAL)), false);
  });

  it("rejects a relevant authority added to an existing spec after planning", () => {
    const root = createTmpDir("rename-transaction-phantom-file-");
    roots.push(root);
    initRepository(root);
    const dir = seedSpec(root, "441-planned", { issue: false, review: false });
    const flowPath = path.join(dir, "flow.json");
    const reviewPath = path.join(dir, "review.md");
    const before = fs.readFileSync(flowPath);
    commitAll(root);

    assert.throws(
      () => applyMigration(root, {
        afterPlanBuilt() {
          fs.writeFileSync(reviewPath, authorityContent("review.md", "441-planned"));
        },
      }),
      /changed after migration planning|authority|snapshot|file/i,
    );

    assert.deepEqual(fs.readFileSync(flowPath), before);
    assert.equal(fs.readFileSync(reviewPath, "utf8"), "result: `gate`\n");
    assert.equal(fs.existsSync(path.join(root, JOURNAL)), false);
  });

  it("rejects same-inode content drift in an existing non-target relevant file", () => {
    const root = createTmpDir("rename-transaction-same-inode-drift-");
    roots.push(root);
    initRepository(root);
    const dir = seedSpec(root, "441-same-inode", { issue: false, review: false });
    const flowPath = path.join(dir, "flow.json");
    const reviewPath = path.join(dir, "review.md");
    fs.writeFileSync(reviewPath, "result: `spec-gate`\n");
    const before = fs.readFileSync(flowPath);
    commitAll(root);
    const originalIdentity = fs.lstatSync(reviewPath);

    assert.throws(
      () => applyMigration(root, {
        afterPlanBuilt() {
          fs.writeFileSync(reviewPath, authorityContent("review.md", "441-same-inode"));
          const changedIdentity = fs.lstatSync(reviewPath);
          assert.equal(changedIdentity.dev, originalIdentity.dev);
          assert.equal(changedIdentity.ino, originalIdentity.ino);
        },
      }),
      /changed after migration planning|authority|snapshot|content/i,
    );

    assert.deepEqual(fs.readFileSync(flowPath), before);
    assert.equal(fs.readFileSync(reviewPath, "utf8"), "result: `gate`\n");
    assert.equal(fs.existsSync(path.join(root, JOURNAL)), false);
  });

  it("preserves migration body and maintenance release failures in causal order", () => {
    const root = createTmpDir("rename-transaction-release-failure-");
    roots.push(root);
    initRepository(root);
    seedSpec(root, "441-release", { issue: false, review: false });
    commitAll(root);
    const originalRelease = RepositoryMaintenanceLock.prototype.release;
    RepositoryMaintenanceLock.prototype.release = function releaseFailure() {
      throw new Error("maintenance release failed");
    };
    try {
      assert.throws(
        () => applyMigration(root, {
          afterPlanBuilt() {
            throw new Error("migration body failed");
          },
        }),
        (error) => error instanceof AggregateError
          && error.errors.length === 2
          && error.errors[0].message === "migration body failed"
          && error.errors[1].message === "maintenance release failed"
          && error.cause === error.errors[0],
      );
    } finally {
      RepositoryMaintenanceLock.prototype.release = originalRelease;
    }
  });
});
