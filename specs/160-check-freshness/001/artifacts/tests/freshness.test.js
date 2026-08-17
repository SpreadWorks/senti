/**
 * specs/160-check-freshness/tests/freshness.test.js
 *
 * Spec verification tests for `sdd-forge check freshness`.
 * NOT run by `npm test` — these are spec-scoped tests kept as historical record.
 *
 * Run with: node --test specs/160-check-freshness/tests/freshness.test.js
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "child_process";
import { join } from "path";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from "fs";
import { tmpdir } from "os";

const SDD_FORGE = join(process.cwd(), "src/sdd-forge.js");

function createTmp() {
  return mkdtempSync(join(tmpdir(), "sdd-freshness-test-"));
}

function removeTmp(dir) {
  rmSync(dir, { recursive: true, force: true });
}

function writeFile(dir, relPath, content = "x") {
  const full = join(dir, relPath);
  mkdirSync(join(full, ".."), { recursive: true });
  writeFileSync(full, content);
  return full;
}

function setMtime(filePath, date) {
  utimesSync(filePath, date, date);
}

/**
 * Run `sdd-forge check freshness [args]` in an isolated tmp environment.
 * Returns { stdout, stderr, status }.
 */
function runFreshness(workRoot, sourceRoot, extraArgs = []) {
  const result = spawnSync(
    "node",
    [SDD_FORGE, "check", "freshness", ...extraArgs],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        SDD_WORK_ROOT: workRoot,
        SDD_SOURCE_ROOT: sourceRoot,
      },
    }
  );
  return {
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    status: result.status,
  };
}

// ─── never-built ────────────────────────────────────────────────────────────

describe("check freshness: never-built (docs/ does not exist)", () => {
  let tmp;
  before(() => { tmp = createTmp(); });
  after(() => removeTmp(tmp));

  it("exits 1 when docs/ does not exist", () => {
    const srcDir = join(tmp, "src");
    mkdirSync(srcDir, { recursive: true });
    writeFile(srcDir, "index.js");

    const result = runFreshness(tmp, srcDir);
    assert.equal(result.status, 1, `expected exit 1, got ${result.status}. stdout: ${result.stdout} stderr: ${result.stderr}`);
  });

  it("outputs never-built in text mode", () => {
    const srcDir = join(tmp, "src");
    mkdirSync(srcDir, { recursive: true });

    const result = runFreshness(tmp, srcDir);
    assert.match(result.stdout, /never.built/i);
  });

  it("outputs never-built in JSON mode", () => {
    const srcDir = join(tmp, "src2");
    mkdirSync(srcDir, { recursive: true });
    writeFile(srcDir, "index.js");

    const result = runFreshness(tmp, srcDir, ["--format", "json"]);
    assert.equal(result.status, 1);
    const json = JSON.parse(result.stdout);
    assert.equal(json.ok, false);
    assert.equal(json.result, "never-built");
  });
});

// ─── stale ──────────────────────────────────────────────────────────────────

describe("check freshness: stale (src newer than docs/)", () => {
  let tmp;
  before(() => { tmp = createTmp(); });
  after(() => removeTmp(tmp));

  it("exits 1 when a src file is newer than the newest docs file", () => {
    const past = new Date("2024-01-01T00:00:00Z");
    const recent = new Date("2024-06-01T00:00:00Z");

    const docsDir = join(tmp, "docs");
    const srcDir = join(tmp, "src");
    const docsFile = writeFile(docsDir, "overview.md");
    const srcFile = writeFile(srcDir, "index.js");
    setMtime(docsFile, past);
    setMtime(srcFile, recent);

    const result = runFreshness(tmp, srcDir);
    assert.equal(result.status, 1, `expected exit 1, got ${result.status}. stdout: ${result.stdout} stderr: ${result.stderr}`);
  });

  it("outputs stale in text mode", () => {
    const past = new Date("2024-01-01T00:00:00Z");
    const recent = new Date("2024-06-01T00:00:00Z");

    const docsDir = join(tmp, "docs2");
    const srcDir = join(tmp, "src2");
    const docsFile = writeFile(docsDir, "overview.md");
    const srcFile = writeFile(srcDir, "index.js");
    setMtime(docsFile, past);
    setMtime(srcFile, recent);

    const result = runFreshness(tmp, srcDir);
    assert.match(result.stdout, /stale/i);
  });

  it("outputs stale in JSON mode with timestamps", () => {
    const past = new Date("2024-01-01T00:00:00Z");
    const recent = new Date("2024-06-01T00:00:00Z");

    const docsDir = join(tmp, "docs3");
    const srcDir = join(tmp, "src3");
    const docsFile = writeFile(docsDir, "overview.md");
    const srcFile = writeFile(srcDir, "index.js");
    setMtime(docsFile, past);
    setMtime(srcFile, recent);

    const result = runFreshness(tmp, srcDir, ["--format", "json"]);
    assert.equal(result.status, 1);
    const json = JSON.parse(result.stdout);
    assert.equal(json.ok, false);
    assert.equal(json.result, "stale");
    assert.ok(json.srcNewest, "srcNewest should be set");
    assert.ok(json.docsNewest, "docsNewest should be set");
  });
});

// ─── fresh ───────────────────────────────────────────────────────────────────

describe("check freshness: fresh (docs/ equal or newer than src)", () => {
  let tmp;
  before(() => { tmp = createTmp(); });
  after(() => removeTmp(tmp));

  it("exits 0 when docs is newer than src", () => {
    const past = new Date("2024-01-01T00:00:00Z");
    const recent = new Date("2024-06-01T00:00:00Z");

    const docsDir = join(tmp, "docs");
    const srcDir = join(tmp, "src");
    const docsFile = writeFile(docsDir, "overview.md");
    const srcFile = writeFile(srcDir, "index.js");
    setMtime(srcFile, past);
    setMtime(docsFile, recent);

    const result = runFreshness(tmp, srcDir);
    assert.equal(result.status, 0, `expected exit 0, got ${result.status}. stdout: ${result.stdout} stderr: ${result.stderr}`);
  });

  it("outputs fresh in text mode", () => {
    const past = new Date("2024-01-01T00:00:00Z");
    const recent = new Date("2024-06-01T00:00:00Z");

    const docsDir = join(tmp, "docs2");
    const srcDir = join(tmp, "src2");
    const docsFile = writeFile(docsDir, "overview.md");
    const srcFile = writeFile(srcDir, "index.js");
    setMtime(srcFile, past);
    setMtime(docsFile, recent);

    const result = runFreshness(tmp, srcDir);
    assert.match(result.stdout, /fresh/i);
  });

  it("exits 0 and outputs fresh when src and docs have equal mtime", () => {
    const sameTime = new Date("2024-03-15T12:00:00Z");

    const docsDir = join(tmp, "docs3");
    const srcDir = join(tmp, "src3");
    const docsFile = writeFile(docsDir, "overview.md");
    const srcFile = writeFile(srcDir, "index.js");
    setMtime(srcFile, sameTime);
    setMtime(docsFile, sameTime);

    const result = runFreshness(tmp, srcDir);
    assert.equal(result.status, 0, `expected exit 0 for equal mtime, got ${result.status}`);
    assert.match(result.stdout, /fresh/i);
  });

  it("outputs fresh in JSON mode", () => {
    const past = new Date("2024-01-01T00:00:00Z");
    const recent = new Date("2024-06-01T00:00:00Z");

    const docsDir = join(tmp, "docs4");
    const srcDir = join(tmp, "src4");
    const docsFile = writeFile(docsDir, "overview.md");
    const srcFile = writeFile(srcDir, "index.js");
    setMtime(srcFile, past);
    setMtime(docsFile, recent);

    const result = runFreshness(tmp, srcDir, ["--format", "json"]);
    assert.equal(result.status, 0);
    const json = JSON.parse(result.stdout);
    assert.equal(json.ok, true);
    assert.equal(json.result, "fresh");
  });
});

// ─── --help ──────────────────────────────────────────────────────────────────

describe("check freshness: --help", () => {
  it("prints usage information and exits 0", () => {
    const result = spawnSync("node", [SDD_FORGE, "check", "freshness", "--help"], { encoding: "utf8" });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /freshness/i);
  });
});
