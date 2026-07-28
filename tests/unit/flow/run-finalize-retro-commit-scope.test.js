import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  collectExistingArtifactPathspecs,
  durableTestArtifactPathspecs,
  implementationCommitExcludedTestArtifactPathspecs,
  removeRebuildableTestArtifacts,
} from "../../../src/flow/lib/test-artifacts.js";
import { commitDurableFinalizeArtifacts } from "../../../src/flow/lib/run-finalize.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../helpers/tmp-dir.js";
import { commitAll, initGitRepo } from "../../helpers/git-repo.js";

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

function readRunFinalizeSource() {
  const file = path.join(process.cwd(), "src/flow/lib/run-finalize.js");
  return fs.readFileSync(file, "utf8");
}

function extractDurableArtifactCommit(source) {
  const marker = "export async function commitDurableFinalizeArtifacts";
  const start = source.indexOf(marker);
  assert.ok(start >= 0, "commitDurableFinalizeArtifacts must be exported from run-finalize.js");
  let depth = 0;
  let i = source.indexOf("{", start);
  const bodyStart = i;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(bodyStart, i + 1);
    }
  }
  throw new Error("could not locate end of commitDurableFinalizeArtifacts body");
}

function readDurableArtifactCommitBodySource() {
  return extractDurableArtifactCommit(readRunFinalizeSource());
}

describe("run-finalize retro/report commit scope (regression for issue #197)", () => {
  it("durable artifact commit does not stage all tracked changes with `git add -A`", () => {
    assert.doesNotMatch(
      readDurableArtifactCommitBodySource(),
      /runGit\(\s*\[\s*"add"\s*,\s*"-A"\s*\]/,
      "artifact commit must not use `git add -A`; it would sweep unrelated changes into finalization",
    );
  });

  it("durable artifact commit stages paths scoped to the current spec directory", () => {
    const body = readDurableArtifactCommitBodySource();
    assert.match(body, /durableTestArtifactPathspecs\(/);
    assert.match(body, /collectExistingArtifactPathspecs\(root,\s*durablePathspecPatterns\)/);
  });

  it("force-adds only allowlisted ignored raw evidence for the current spec", async () => {
    const root = createTmpDir("finalize-ignored-durable-evidence-");
    try {
      initGitRepo(root);
      writeFile(root, ".gitignore", "specs/**/tests/.raw/*.log\n");
      writeFile(root, "specs/001/spec.json", "{\n  \"requirements\": []\n}\n");
      commitAll(root, "test: baseline");

      const retainedLog = "specs/001/tests/.raw/final-regression-attempt-001.log";
      const unrelatedLog = "specs/999/tests/.raw/final-regression-attempt-001.log";
      writeFile(root, retainedLog, "final regression passed\n");
      writeFile(root, unrelatedLog, "unrelated ignored log\n");

      const result = await commitDurableFinalizeArtifacts({
        root,
        flowState: { spec: "specs/001/spec.json" },
      });

      assert.equal(result.status, "done");
      const committed = git(root, ["ls-tree", "-r", "--name-only", "HEAD"]).trim().split("\n");
      assert.ok(committed.includes(retainedLog));
      assert.equal(committed.includes(unrelatedLog), false);
      assert.equal(git(root, ["status", "--porcelain"]), "");
    } finally {
      removeTmpDir(root);
    }
  });
});

describe("test-artifacts", () => {
  it("durableTestArtifactPathspecs scopes artifact pathspecs under the requested spec", () => {
    const pathspecs = durableTestArtifactPathspecs("001");

    assert.deepEqual(pathspecs, [
      "specs/001/upgrade-result.json",
      "specs/001/scenario-validity-result.json",
      "specs/001/test-execute-result.json",
      "specs/001/test-result-review.json",
      "specs/001/test-result-review.md",
      "specs/001/impl-gate-result.json",
      "specs/001/final-regression-result.json",
      "specs/001/retro.json",
      "specs/001/report.json",
      "specs/001/tests/.raw/upgrade.log",
      "specs/001/tests/.raw/scenario-validity.log",
      "specs/001/tests/.raw/test-execution.log",
      "specs/001/tests/.raw/final-regression-attempt-*.log",
    ]);
  });

  it("implementationCommitExcludedTestArtifactPathspecs includes final regression logs and reset artifacts", () => {
    const pathspecs = implementationCommitExcludedTestArtifactPathspecs("001");

    assert.ok(pathspecs.includes("specs/001/tests/.raw/final-regression-attempt-*.log"));
    assert.ok(pathspecs.includes("specs/001/tests/.raw/requirement-summary.json"));
  });

  it("collectExistingArtifactPathspecs filters missing artifact files before staging", () => {
    const tmp = createTmpDir();
    try {
      writeFile(tmp, "specs/001/report.json", "{}\n");
      assert.deepEqual(
        collectExistingArtifactPathspecs(tmp, [
          "specs/001/report.json",
          "specs/001/scenario-validity-result.json",
        ]),
        ["specs/001/report.json"],
      );
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("removeRebuildableTestArtifacts preserves plan-phase and final-regression evidence", () => {
    const tmp = createTmpDir();
    try {
      writeFile(tmp, "scenario-validity-result.json", "{}\n");
      writeFile(tmp, "tests/.raw/scenario-validity.log", "scenario validity\n");
      writeFile(tmp, "final-regression-result.json", "{}\n");
      writeFile(tmp, "tests/.raw/final-regression-attempt-001.log", "attempt 1\n");
      writeFile(tmp, "tests/.raw/requirement-summary.json", "[]\n");

      removeRebuildableTestArtifacts(tmp);

      assert.equal(fs.existsSync(path.join(tmp, "scenario-validity-result.json")), true);
      assert.equal(fs.existsSync(path.join(tmp, "tests/.raw/scenario-validity.log")), true);
      assert.equal(fs.existsSync(path.join(tmp, "final-regression-result.json")), false);
      assert.equal(fs.existsSync(path.join(tmp, "tests/.raw/requirement-summary.json")), false);
      assert.equal(fs.existsSync(path.join(tmp, "tests/.raw/final-regression-attempt-001.log")), true);
    } finally {
      removeTmpDir(tmp);
    }
  });
});
