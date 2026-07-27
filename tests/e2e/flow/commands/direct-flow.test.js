import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

import {
  createDirectFlowFixture,
  git,
} from "../../../helpers/direct-flow-fixture.js";
import {
  createTmpDir,
  removeTmpDir,
} from "../../../helpers/tmp-dir.js";

const SENTI = path.resolve("src/senti.js");

function targetGuards(fixture) {
  return [
    "--expect-run-id", fixture.runId,
    "--expect-issue", String(fixture.issue),
    "--expect-spec", fixture.spec,
  ];
}

function invoke(fixture, args, { cwd = fixture.worktreePath } = {}) {
  return invokeAt(cwd, args);
}

function invokeAt(cwd, args) {
  const result = spawnSync(process.execPath, [SENTI, "flow", ...args], {
    cwd,
    encoding: "utf8",
    env: process.env,
  });
  let envelope = null;
  try {
    envelope = JSON.parse(result.stdout);
  } catch {
    assert.fail(`CLI did not return JSON.\nstdout: ${result.stdout}\nstderr: ${result.stderr}`);
  }
  return { ...result, envelope };
}

function snapshotNonGitFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
      } else {
        files.push([
          path.relative(root, absolute).split(path.sep).join("/"),
          fs.readFileSync(absolute, "utf8"),
        ]);
      }
    }
  };
  visit(root);
  return files.sort(([left], [right]) => left.localeCompare(right));
}

test("flow direct CLI reports no Flow without changing files or Git state", () => {
  const root = createTmpDir("senti-direct-no-flow-");
  try {
    git(root, ["init", "--quiet"]);
    git(root, ["config", "user.email", "test@example.com"]);
    git(root, ["config", "user.name", "Test User"]);
    fs.mkdirSync(path.join(root, ".senti"), { recursive: true });
    fs.writeFileSync(path.join(root, "README.md"), "# no active flow\n");
    fs.writeFileSync(path.join(root, ".senti", "config.json"), `${JSON.stringify({
      lang: "en",
      type: "base",
      commands: { gh: "disable" },
    }, null, 2)}\n`);
    git(root, ["add", "README.md", ".senti/config.json"]);
    git(root, ["commit", "--quiet", "-m", "initial"]);
    const before = {
      head: git(root, ["rev-parse", "HEAD"]),
      status: git(root, ["status", "--porcelain=v1", "--untracked-files=all"]),
      files: snapshotNonGitFiles(root),
    };

    const inspected = invokeAt(root, ["get", "direct"]);

    assert.equal(inspected.status, 0, inspected.stderr || inspected.stdout);
    assert.equal(inspected.envelope.data.code, "NO_FLOW");
    assert.equal(inspected.envelope.data.directMode, false);
    assert.equal(inspected.envelope.data.normalDirectFix, true);
    assert.equal(inspected.envelope.data.yieldsControl, false);
    assert.deepEqual({
      head: git(root, ["rev-parse", "HEAD"]),
      status: git(root, ["status", "--porcelain=v1", "--untracked-files=all"]),
      files: snapshotNonGitFiles(root),
    }, before);
  } finally {
    removeTmpDir(root);
  }
});

test("flow direct CLI preserves prompts and completes a bounded managed-worktree fix", () => {
  const fixture = createDirectFlowFixture({ specId: "476-direct-cli" });
  try {
    const mismatch = invoke(fixture, [
      "get", "direct",
      "--expect-run-id", "wrong-run",
      "--expect-issue", String(fixture.issue),
      "--expect-spec", fixture.spec,
    ]);
    assert.notEqual(mismatch.status, 0);
    assert.equal(mismatch.envelope.errors[0].code, "ACTIVE_FLOW_MISMATCH");
    assert.equal(mismatch.envelope.data.yieldsControl, false);
    assert.equal(mismatch.envelope.data.requiresUserAction, false);
    assert.equal(
      mismatch.envelope.data.continuation.actionId,
      "INSPECT_FLOW_STATUS",
    );
    assert.equal(Object.hasOwn(mismatch.envelope.data, "actionPrompt"), false);
    assert.equal(fixture.context().flowState.directFlowSession, undefined);

    const inspected = invoke(fixture, ["get", "direct", ...targetGuards(fixture)]);
    assert.equal(inspected.status, 0, inspected.stderr);
    assert.equal(inspected.envelope.data.code, "DIRECT_SELECTION_REQUIRED");
    assert.equal(inspected.envelope.data.yieldsControl, true);
    assert.equal(
      inspected.envelope.data.actionPrompt.choices.some((entry) => (
        entry.actionId === "SELECT_DIRECT_FIX"
          && entry.nextAction.includes("--expect-run-id")
          && entry.impact.retains.includes("normal step statuses")
      )),
      true,
    );

    const selected = invoke(fixture, [
      "run", "direct",
      "--action", "SELECT_DIRECT_FIX",
      "--reason", "Apply the explicitly bounded CLI fixture change.",
      "--scope", "src/direct-cli.js",
      "--source", "manual",
      ...targetGuards(fixture),
    ]);
    assert.equal(selected.status, 0, selected.stderr || selected.stdout);
    assert.equal(selected.envelope.data.code, "DIRECT_IMPLEMENTATION_REQUIRED");
    assert.equal(selected.envelope.data.requiresUserAction, false);

    const nextAction = invoke(fixture, ["get", "next-action", ...targetGuards(fixture)]);
    assert.equal(nextAction.status, 0, nextAction.stderr || nextAction.stdout);
    assert.equal(nextAction.envelope.data.code, "DIRECT_IMPLEMENTATION_REQUIRED");
    assert.equal(nextAction.envelope.data.requiresUserAction, false);

    const sourcePath = path.join(fixture.worktreePath, "src", "direct-cli.js");
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, "export const directCli = true;\n");

    const confirmed = invoke(fixture, [
      "run", "direct",
      "--action", "CONFIRM_DIRECT_IMPLEMENTATION",
      "--summary", "Completed the bounded direct CLI implementation and inspected the product diff.",
      ...targetGuards(fixture),
    ]);
    assert.equal(confirmed.status, 0, confirmed.stderr || confirmed.stdout);
    assert.equal(confirmed.envelope.data.code, "DIRECT_FIX");

    const verified = invoke(fixture, [
      "run", "direct",
      "--action", "VERIFY_DIRECT",
      "--test-command", "node -e \"process.exit(0)\"",
      "--timeout-ms", "10000",
      ...targetGuards(fixture),
    ]);
    assert.equal(verified.status, 0, verified.stderr || verified.stdout);
    assert.equal(verified.envelope.data.code, "DIRECT_VERIFY_PASSED");
    assert.equal(
      verified.envelope.data.actionPrompt.choices.some((entry) => (
        entry.actionId === "FINALIZE_DIRECT"
          && entry.impact.deletes.includes("managed worktree")
      )),
      true,
    );

    const finalized = invoke(fixture, [
      "run", "direct",
      "--action", "FINALIZE_DIRECT",
      ...targetGuards(fixture),
    ]);
    assert.equal(finalized.status, 0, finalized.stderr || finalized.stdout);
    assert.equal(finalized.envelope.data.status, "done");
    assert.equal(finalized.envelope.data.completionMode, "direct");
    assert.equal(finalized.envelope.data.mergeDisposition, "merged");
    assert.match(finalized.envelope.data.externalUpdateKey, /^direct-external-update-/);

    const completed = invoke(
      fixture,
      ["get", "direct", ...targetGuards(fixture)],
      { cwd: fixture.root },
    );
    assert.equal(completed.status, 0, completed.stderr || completed.stdout);
    assert.equal(completed.envelope.data.code, "COMPLETED_DIRECT");
    assert.equal(completed.envelope.data.yieldsControl, false);
    assert.equal(completed.envelope.data.completion.status, "completed");
  } finally {
    fixture.cleanup();
  }
});

test("flow direct CLI resumes a reconcile session persisted on main", () => {
  const fixture = createDirectFlowFixture({ specId: "476-direct-reconcile-cli" });
  try {
    git(fixture.root, [
      "merge",
      "--quiet",
      "--no-ff",
      fixture.featureBranch,
      "-m",
      "integrate feature outside flow",
    ]);

    const selected = invoke(fixture, [
      "run", "direct",
      "--action", "SELECT_DIRECT_RECONCILE",
      ...targetGuards(fixture),
    ]);
    assert.equal(selected.status, 0, selected.stderr || selected.stdout);
    assert.equal(selected.envelope.data.code, "DIRECT_RECONCILE");

    const resumed = invoke(fixture, ["get", "direct", ...targetGuards(fixture)]);
    assert.equal(resumed.status, 0, resumed.stderr || resumed.stdout);
    assert.equal(resumed.envelope.data.code, "DIRECT_RECONCILE");
    assert.equal(
      resumed.envelope.data.actionPrompt.choices.some((entry) => (
        entry.actionId === "FINALIZE_DIRECT_RECONCILE"
      )),
      true,
    );

    const finalized = invoke(fixture, [
      "run", "direct",
      "--action", "FINALIZE_DIRECT_RECONCILE",
      "--test-command", "node -e \"process.exit(0)\"",
      ...targetGuards(fixture),
    ]);
    assert.equal(finalized.status, 0, finalized.stderr || finalized.stdout);
    assert.equal(finalized.envelope.data.status, "done");
    assert.equal(finalized.envelope.data.mergeDisposition, "already-merged");
    assert.equal(fs.existsSync(fixture.worktreePath), false);
    assert.equal(git(fixture.root, ["branch", "--list", fixture.featureBranch]), "");
  } finally {
    fixture.cleanup();
  }
});
