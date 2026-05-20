// spec: R1 R2 R3
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import * as merge from "../../../src/flow/commands/merge.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { RunFinalizeCommitCommand } from "../../../src/flow/lib/run-finalize-commit.js";
import { runCmd } from "../../../src/lib/process.js";

function buildSquashCommitMessage(input) {
  assert.equal(typeof merge.buildSquashCommitMessage, "function");
  return merge.buildSquashCommitMessage(input);
}

function collectImplementationSubjects(input) {
  assert.equal(typeof merge.collectImplementationSubjects, "function");
  return merge.collectImplementationSubjects(input);
}

function initRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "squash-msg-"));
  runCmd("git", ["init", "-q", "-b", "main", dir]);
  runCmd("git", ["-C", dir, "config", "user.email", "t@example.com"]);
  runCmd("git", ["-C", dir, "config", "user.name", "T"]);
  runCmd("git", ["-C", dir, "config", "commit.gpgsign", "false"]);
  return dir;
}

function commitIn(dir, file, content, message) {
  fs.writeFileSync(path.join(dir, file), content);
  runCmd("git", ["-C", dir, "add", file]);
  runCmd("git", ["-C", dir, "commit", "-q", "-m", message]);
}

describe("buildSquashCommitMessage", () => {
  it("R1: uses the first non-empty spec goal line as the squash commit subject", () => {
    const message = buildSquashCommitMessage({
      state: { issue: 339 },
      spec: { goal: "\nReadable finalize merge message\nignored second line" },
      fallbackTitle: "finalize-merge-message",
      implementationSubjects: ["feat: implementation subject"],
    });

    assert.equal(message, "Readable finalize merge message\n\nfixes #339");
  });

  it("R2: filters finalize-generated subjects before choosing implementation fallback", () => {
    const repo = initRepo();
    try {
      commitIn(repo, "base.txt", "base", "base");
      runCmd("git", ["-C", repo, "checkout", "-b", "feature"]);
      commitIn(repo, "impl-old.txt", "impl", "feat: older implementation subject");
      commitIn(repo, "impl-new.txt", "impl", "feat: use spec goal for squash commit message");
      commitIn(repo, "retro.txt", "retro", "chore: add retro and report");
      commitIn(repo, "metadata.txt", "metadata", "chore: record finalize metadata before merge");

      const subjects = collectImplementationSubjects({
        cwd: repo,
        baseBranch: "main",
        featureBranch: "feature",
        limit: 50,
      });
      assert.deepEqual(subjects, [
        "feat: use spec goal for squash commit message",
        "feat: older implementation subject",
      ]);

      const message = buildSquashCommitMessage({
        state: {},
        spec: { goal: "" },
        fallbackTitle: "finalize-merge-message",
        implementationSubjects: subjects,
      });
      assert.equal(message, "feat: use spec goal for squash commit message");

      const unreadableSpecMessage = buildSquashCommitMessage({
        state: {},
        spec: null,
        fallbackTitle: "finalize-merge-message",
        implementationSubjects: subjects,
      });
      assert.equal(unreadableSpecMessage, "feat: use spec goal for squash commit message");
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("R2: inspects at most 50 implementation subjects before slug fallback", () => {
    const repo = initRepo();
    try {
      commitIn(repo, "base.txt", "base", "base");
      runCmd("git", ["-C", repo, "checkout", "-b", "feature"]);
      commitIn(repo, "outside.txt", "outside", "feat: outside scan limit");
      for (let i = 0; i < 50; i += 1) {
        commitIn(repo, `metadata-${i}.txt`, String(i), "chore: record finalize metadata before merge");
      }

      const subjects = collectImplementationSubjects({
        cwd: repo,
        baseBranch: "main",
        featureBranch: "feature",
        limit: 50,
      });
      assert.deepEqual(subjects, []);

      const message = buildSquashCommitMessage({
        state: {},
        spec: { goal: "" },
        fallbackTitle: "finalize-merge-message",
        implementationSubjects: subjects,
      });
      assert.equal(message, "finalize-merge-message");
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("R2: honors an explicit zero implementation subject scan limit", () => {
    const repo = initRepo();
    try {
      commitIn(repo, "base.txt", "base", "base");
      runCmd("git", ["-C", repo, "checkout", "-b", "feature"]);
      commitIn(repo, "impl.txt", "impl", "feat: implementation subject");

      const subjects = collectImplementationSubjects({
        cwd: repo,
        baseBranch: "main",
        featureBranch: "feature",
        limit: 0,
      });
      assert.deepEqual(subjects, []);
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("R2: falls back to the slug when implementation subject collection fails", () => {
    const repo = initRepo();
    try {
      commitIn(repo, "base.txt", "base", "base");

      const subjects = collectImplementationSubjects({
        cwd: repo,
        baseBranch: "main",
        featureBranch: "missing-feature",
        limit: 50,
      });
      assert.deepEqual(subjects, []);

      const message = buildSquashCommitMessage({
        state: {},
        spec: { goal: "" },
        fallbackTitle: "finalize-merge-message",
        implementationSubjects: subjects,
      });
      assert.equal(message, "finalize-merge-message");
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });

  it("R3: preserves issue footer while leaving PR title and body helpers unchanged", async () => {
    const message = buildSquashCommitMessage({
      state: { issue: 339 },
      spec: { goal: "Squash subject" },
      fallbackTitle: "fallback-title",
      implementationSubjects: [],
    });
    assert.equal(message, "Squash subject\n\nfixes #339");

    const prSpec = {
      goal: "PR title goal",
      scopeIn: ["scope item"],
      scopeOut: [],
      requirements: [{ id: "R1", desc: "requirement", priority: "must" }],
    };
    assert.equal(merge.buildPrTitle(prSpec, "fallback-title"), "PR title goal");
    const body = merge.buildPrBody({ issue: 339, request: "request fallback" }, prSpec);
    assert.ok(body.includes("fixes #339"));
    assert.ok(body.includes("## Goal"));
    assert.ok(body.includes("PR title goal"));
    assert.equal(merge.resolveMergeStrategy({ featureBranch: "feature", baseBranch: "feature" }, {}), "skip");
    assert.equal(merge.resolveMergeStrategy({ featureBranch: "feature", baseBranch: "main" }, {}), "squash");
    assert.ok(FLOW_COMMANDS.run["finalize-commit"].args.options.includes("--message"));
    assert.ok(FLOW_COMMANDS.run["finalize-commit"].help.includes("--message <msg>"));
    assert.ok(FLOW_COMMANDS.run["finalize-commit"].help.includes("Custom commit message"));

    const repo = initRepo();
    try {
      commitIn(repo, "base.txt", "base", "base");
      runCmd("git", ["-C", repo, "checkout", "-b", "feature"]);
      fs.mkdirSync(path.join(repo, "src"), { recursive: true });
      fs.writeFileSync(path.join(repo, "src", "change.txt"), "implementation");

      const command = new RunFinalizeCommitCommand();
      const result = await command.execute({
        root: repo,
        message: "custom finalize message",
        flowState: {
          baseBranch: "main",
          featureBranch: "feature",
          spec: "specs/264-finalize-merge-message/spec.json",
        },
        flowManager: { saveFinalizedAt() {} },
      });

      assert.equal(result.status, "done");
      assert.equal(result.message, "custom finalize message");
      const subject = runCmd("git", ["-C", repo, "log", "-1", "--pretty=%s"]).stdout.trim();
      assert.equal(subject, "custom finalize message");
    } finally {
      fs.rmSync(repo, { recursive: true, force: true });
    }
  });
});
