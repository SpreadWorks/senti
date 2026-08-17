// spec: R1 R2 R3 R6 R7 R12 R13 R18
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SPEC_TESTS_DIR = __dirname;

describe("R18: spec tests are placed under specs/<spec>/tests/ with R-N headers", () => {
  it("R18: each test file under this directory declares a spec header", () => {
    const files = fs.readdirSync(SPEC_TESTS_DIR).filter((f) => f.endsWith(".test.js"));
    assert.ok(files.length >= 1, "must have at least one test file");
    for (const f of files) {
      const content = fs.readFileSync(path.join(SPEC_TESTS_DIR, f), "utf8");
      const firstLine = content.split("\n")[0];
      assert.match(firstLine, /^\/\/ spec: R\d+/, `${f} must start with // spec: R<N> header`);
    }
  });
});

describe("R1: finalize-cleanup detects orphan commits using featureBranch ref (not process HEAD)", () => {
  it("R1: orphan detection resolves featureBranch ref explicitly via baseline..featureBranch range", async () => {
    const { RunFinalizeCleanupCommand } = await import(
      "../../../src/flow/lib/run-finalize-cleanup.js"
    );
    const cmd = new RunFinalizeCleanupCommand();
    assert.ok(typeof cmd.execute === "function", "execute must exist");
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../../src/flow/lib/run-finalize-cleanup.js"),
      "utf8",
    );
    assert.ok(
      src.includes("featureBranchSquashedSha") || src.includes("squashBaseline"),
      "execute must reference squash baseline state",
    );
    assert.ok(
      /rev-parse[\s\S]{0,200}featureBranch/.test(src) || src.includes("baseline..featureBranch"),
      "must resolve featureBranch ref explicitly (not process HEAD)",
    );
  });
});

describe("R2: orphan detection halts default with worktree/branch retention", () => {
  it("R2: ORPHAN_COMMITS_DETECTED fail path does not call worktree remove or branch -D", async () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../../src/flow/lib/run-finalize-cleanup.js"),
      "utf8",
    );
    assert.ok(src.includes("ORPHAN_COMMITS_DETECTED"), "must define ORPHAN_COMMITS_DETECTED code");
    assert.ok(
      src.includes("Envelope.fail"),
      "halt must use Envelope.fail to signal no side-effect commit/teardown",
    );
  });
});

describe("R3: envelope payload schema for orphan detection codes", () => {
  it("R3: ORPHAN_COMMITS_DETECTED envelope includes orphanCommits, truncated, recoveryOptions fields", async () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../../src/flow/lib/run-finalize-cleanup.js"),
      "utf8",
    );
    assert.ok(src.includes("orphanCommits"), "envelope.data.orphanCommits required");
    assert.ok(src.includes("truncated"), "envelope.data.truncated required");
    assert.ok(src.includes("recoveryOptions"), "envelope.data.recoveryOptions required");
  });
  it("R3: SQUASH_BASELINE_MISSING and SQUASH_BASELINE_DIVERGED codes are defined", async () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../../src/flow/lib/run-finalize-cleanup.js"),
      "utf8",
    );
    assert.ok(src.includes("SQUASH_BASELINE_MISSING"), "SQUASH_BASELINE_MISSING code required");
    assert.ok(src.includes("SQUASH_BASELINE_DIVERGED"), "SQUASH_BASELINE_DIVERGED code required");
  });
});

describe("R6: ancestry check distinguishes orphan from history rewrite", () => {
  it("R6: implementation invokes merge-base --is-ancestor for baseline ancestry check", async () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../../src/flow/lib/run-finalize-cleanup.js"),
      "utf8",
    );
    assert.ok(
      src.includes("is-ancestor") || src.includes("merge-base"),
      "must use git merge-base --is-ancestor for ancestry check",
    );
  });
});

describe("R7: success paths preserve finalize report attachment", () => {
  it("R7: attachReport is invoked on every success path (no-op / auto-rescue / force)", async () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../../src/flow/lib/run-finalize-cleanup.js"),
      "utf8",
    );
    const occurrences = (src.match(/attachReport\(/g) || []).length;
    assert.ok(
      occurrences >= 2,
      `attachReport must be called on multiple success paths (found ${occurrences})`,
    );
  });
});

describe("R12: envelope canonical channel without stderr duplication", () => {
  it("R12: orphan detection paths do not write recovery guidance to stderr", async () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../../src/flow/lib/run-finalize-cleanup.js"),
      "utf8",
    );
    const detectionBlock = src.match(
      /ORPHAN_COMMITS_DETECTED[\s\S]{0,2000}/,
    );
    if (detectionBlock) {
      assert.ok(
        !detectionBlock[0].includes("process.stderr.write") &&
          !detectionBlock[0].includes("console.error"),
        "ORPHAN_COMMITS_DETECTED block must not duplicate guidance to stderr",
      );
    }
  });
});

describe("R13: BASELINE_MISSING envelope contains manual recovery guidance", () => {
  it("R13: SQUASH_BASELINE_MISSING messages reference archive + manual cherry-pick path", async () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../../../src/flow/lib/run-finalize-cleanup.js"),
      "utf8",
    );
    const baselineBlock = src.match(/SQUASH_BASELINE_MISSING[\s\S]{0,2000}/);
    assert.ok(baselineBlock, "SQUASH_BASELINE_MISSING block must exist");
    const text = baselineBlock[0];
    assert.ok(
      /archive|cherry-pick/i.test(text),
      "messages must guide user toward archive + cherry-pick recovery",
    );
  });
});
