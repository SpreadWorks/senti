// spec: R1 R2 R3 R4
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const cliPath = path.join(repoRoot, "src/sdd-forge.js");

function makeTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "freshness-guidance-"));
}

function removeTempRoot(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

function writeFile(root, relativePath, content = "content") {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}

function setMtime(filePath, value) {
  fs.utimesSync(filePath, value, value);
}

function runFreshness(workRoot, sourceRoot, args = []) {
  const env = { ...process.env };
  delete env.SDD_WORK_ROOT;
  delete env.SDD_SOURCE_ROOT;
  env.SDD_FORGE_WORK_ROOT = workRoot;
  env.SDD_FORGE_SOURCE_ROOT = sourceRoot;

  return spawnSync("node", [cliPath, "check", "freshness", ...args], {
    encoding: "utf8",
    env,
  });
}

function assertNoLegacyBuildGuidance(output) {
  assert.doesNotMatch(output, /sdd-forge build\b/);
}

test("R1: help guidance points to sdd-forge docs build", () => {
  const root = makeTempRoot();
  try {
    const result = runFreshness(root, root, ["--help"]);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /sdd-forge docs build/);
    assertNoLegacyBuildGuidance(result.stdout);
  } finally {
    removeTempRoot(root);
  }
});

test("R2: stale and never-built text output point to sdd-forge docs build", () => {
  const staleRoot = makeTempRoot();
  const missingDocsRoot = makeTempRoot();
  try {
    const oldTime = new Date("2024-01-01T00:00:00Z");
    const newTime = new Date("2024-06-01T00:00:00Z");
    const staleDocs = writeFile(staleRoot, "docs/overview.md");
    const staleSource = writeFile(staleRoot, "src/index.js");
    setMtime(staleDocs, oldTime);
    setMtime(staleSource, newTime);

    const stale = runFreshness(staleRoot, path.join(staleRoot, "src"));
    assert.equal(stale.status, 1);
    assert.match(stale.stdout, /stale/);
    assert.match(stale.stdout, /run: sdd-forge docs build/);
    assertNoLegacyBuildGuidance(stale.stdout);

    const missingSourceDir = path.join(missingDocsRoot, "src");
    writeFile(missingDocsRoot, "src/index.js");
    const neverBuilt = runFreshness(missingDocsRoot, missingSourceDir);
    assert.equal(neverBuilt.status, 1);
    assert.match(neverBuilt.stdout, /never-built/);
    assert.match(neverBuilt.stdout, /run: sdd-forge docs build/);
    assertNoLegacyBuildGuidance(neverBuilt.stdout);
  } finally {
    removeTempRoot(staleRoot);
    removeTempRoot(missingDocsRoot);
  }
});

test("R3: JSON output shape and exit code contract stay unchanged", () => {
  const staleRoot = makeTempRoot();
  const freshRoot = makeTempRoot();
  const missingDocsRoot = makeTempRoot();
  try {
    const oldTime = new Date("2024-01-01T00:00:00Z");
    const newTime = new Date("2024-06-01T00:00:00Z");
    const staleDocs = writeFile(staleRoot, "docs/overview.md");
    const staleSource = writeFile(staleRoot, "src/index.js");
    setMtime(staleDocs, oldTime);
    setMtime(staleSource, newTime);

    const stale = runFreshness(staleRoot, path.join(staleRoot, "src"), ["--format", "json"]);
    assert.equal(stale.status, 1);
    assert.deepEqual(Object.keys(JSON.parse(stale.stdout)), ["ok", "result", "srcNewest", "docsNewest"]);
    assert.equal(JSON.parse(stale.stdout).result, "stale");

    writeFile(missingDocsRoot, "src/index.js");
    const neverBuilt = runFreshness(missingDocsRoot, path.join(missingDocsRoot, "src"), ["--format", "json"]);
    assert.equal(neverBuilt.status, 1);
    const neverBuiltPayload = JSON.parse(neverBuilt.stdout);
    assert.deepEqual(Object.keys(neverBuiltPayload), ["ok", "result", "srcNewest", "docsNewest"]);
    assert.equal(neverBuiltPayload.ok, false);
    assert.equal(neverBuiltPayload.result, "never-built");

    const freshDocs = writeFile(freshRoot, "docs/overview.md");
    const freshSource = writeFile(freshRoot, "src/index.js");
    setMtime(freshSource, oldTime);
    setMtime(freshDocs, newTime);

    const fresh = runFreshness(freshRoot, path.join(freshRoot, "src"), ["--format", "json"]);
    assert.equal(fresh.status, 0);
    const payload = JSON.parse(fresh.stdout);
    assert.deepEqual(Object.keys(payload), ["ok", "result", "srcNewest", "docsNewest"]);
    assert.equal(payload.ok, true);
    assert.equal(payload.result, "fresh");
  } finally {
    removeTempRoot(staleRoot);
    removeTempRoot(freshRoot);
    removeTempRoot(missingDocsRoot);
  }
});

test("R4: format validation and help arguments keep the existing contract", () => {
  const root = makeTempRoot();
  try {
    const invalid = runFreshness(root, root, ["--format", "xml"]);
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /unknown format 'xml'/);

    const shortHelp = runFreshness(root, root, ["-h"]);
    assert.equal(shortHelp.status, 0);
    assert.match(shortHelp.stdout, /Usage: sdd-forge check freshness/);

    const longHelp = runFreshness(root, root, ["--help"]);
    assert.equal(longHelp.status, 0);
    assert.match(longHelp.stdout, /--format <text\|json>/);
  } finally {
    removeTempRoot(root);
  }
});
