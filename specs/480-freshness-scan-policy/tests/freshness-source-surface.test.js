// spec: R1 R2 R3 R4
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { checkFreshness } from "../../../src/check/commands/freshness.js";
import { ScanPolicy } from "../../../src/lib/file-tree-walker.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../../tests/helpers/tmp-dir.js";

function setMtime(file, value) {
  const time = new Date(value);
  fs.utimesSync(file, time, time);
}

function writeMany(root, directory, count) {
  for (let index = 0; index < count; index += 1) {
    writeFile(root, `${directory}/evidence-${index}.json`, "{}\n");
  }
}

function writeOverProductionLimit(root, directory) {
  const templates = [0, 1, 2].map((index) => path.join(
    root,
    `.fixture-${directory.replaceAll("/", "-")}-${index}.json`
  ));
  for (const template of templates) {
    if (!fs.existsSync(template)) fs.writeFileSync(template, "{}\n");
  }
  const targetDirectory = path.join(root, directory);
  fs.mkdirSync(targetDirectory, { recursive: true });
  for (let index = 0; index <= 10_000; index += 1) {
    fs.linkSync(templates[index % templates.length], path.join(targetDirectory, `evidence-${index}.json`));
  }
  return templates;
}

function assertScanDetail(detail, target, policy) {
  assert.equal(detail.target, target);
  assert.equal(detail.policy, policy);
  assert.equal(typeof detail.complete, "boolean");
  assert.equal(Array.isArray(detail.limits), true);
}

test("R1: excludes every named generated and runtime source boundary before the file budget", async () => {
  const root = createTmpDir();
  try {
    writeFile(root, "src/current.js", "export const current = true;\n");
    writeFile(root, "docs/overview.md", "# Overview\n");
    const templates = new Set();
    for (const directory of [
      ".git/objects",
      ".senti/output",
      "node_modules/example",
      "vendor/example",
      "specs/480/review-history",
      "specs/480/review-evidence",
      "specs/480/tests/.raw",
    ]) {
      for (const template of writeOverProductionLimit(root, directory)) templates.add(template);
    }

    setMtime(path.join(root, "src/current.js"), "2026-01-02T00:00:00.000Z");
    setMtime(path.join(root, "docs/overview.md"), "2026-01-01T00:00:00.000Z");
    for (const template of templates) setMtime(template, "2026-01-01T00:00:00.000Z");
    const result = await checkFreshness(root, root);

    assert.equal(result.result, "stale");
  } finally {
    removeTmpDir(root);
  }
});

test("R2: fails closed when a non-excluded source or documentation surface reaches a limit", async () => {
  const root = createTmpDir();
  try {
    writeFile(root, "src/one.js", "export {};\n");
    writeFile(root, "src/two.js", "export {};\n");
    writeFile(root, "src/three.js", "export {};\n");
    writeFile(root, "docs/overview.md", "# Overview\n");
    const result = await checkFreshness(root, root, { policy: new ScanPolicy({ maxFiles: 2 }) });

    assert.equal(result.result, "indeterminate");
    const json = result.toJSON();
    assertScanDetail(json.sourceScan, root, "freshness-source");
    assertScanDetail(json.docsScan, path.join(root, "docs"), "default");
    assert.equal(json.sourceScan.complete, false);
    assert.deepEqual(json.sourceScan.limits[0], {
      kind: "files",
      relativePath: "src/two.js",
      maximum: 2,
    });
    assert.match(result.toText(), /^indeterminate — source: files limit 2 at src\/two\.js$/);
  } finally {
    removeTmpDir(root);
  }
});

test("R2: fails closed when documentation traversal reaches a limit", async () => {
  const root = createTmpDir();
  try {
    writeFile(root, "src/current.js", "export {};\n");
    writeFile(root, "docs/one.md", "# One\n");
    writeFile(root, "docs/two.md", "# Two\n");
    writeFile(root, "docs/three.md", "# Three\n");
    const result = await checkFreshness(root, path.join(root, "src"), { policy: new ScanPolicy({ maxFiles: 2 }) });
    const json = result.toJSON();

    assert.equal(result.result, "indeterminate");
    assertScanDetail(json.docsScan, path.join(root, "docs"), "default");
    assert.equal(json.docsScan.complete, false);
    assert.deepEqual(json.docsScan.limits[0], {
      kind: "files",
      relativePath: "two.md",
      maximum: 2,
    });
    assert.match(result.toText(), /^indeterminate — docs: files limit 2 at two\.md$/);
  } finally {
    removeTmpDir(root);
  }
});

test("R2: applies no source exclusions to documentation traversal", async () => {
  const root = createTmpDir();
  try {
    writeFile(root, "src/current.js", "export {};\n");
    writeMany(root, "docs/.senti/output", 3);
    const result = await checkFreshness(root, path.join(root, "src"), { policy: new ScanPolicy({ maxFiles: 2 }) });
    const json = result.toJSON();

    assert.equal(result.result, "indeterminate");
    assertScanDetail(json.docsScan, path.join(root, "docs"), "default");
    assert.equal(json.docsScan.complete, false);
    assert.equal(json.docsScan.limits[0].kind, "files");
  } finally {
    removeTmpDir(root);
  }
});

test("R2: fails closed when source depth, directory-entry, or read access limits are reached", async () => {
  const root = createTmpDir();
  const lockedDirectory = path.join(root, "src/locked");
  const originalReadDir = fs.readdirSync;
  try {
    writeFile(root, "docs/overview.md", "# Overview\n");
    writeFile(root, "src/deep/more/file.js", "export {};\n");
    let result = await checkFreshness(root, path.join(root, "src"), { policy: new ScanPolicy({ maxDepth: 1 }) });
    assert.equal(result.result, "indeterminate");
    assert.equal(result.toJSON().sourceScan.limits[0].kind, "depth");

    removeTmpDir(path.join(root, "src"));
    writeFile(root, "src/a.js", "export {};\n");
    writeFile(root, "src/b.js", "export {};\n");
    result = await checkFreshness(root, path.join(root, "src"), { policy: new ScanPolicy({ maxDirectoryEntries: 1 }) });
    assert.equal(result.result, "indeterminate");
    assert.equal(result.toJSON().sourceScan.limits[0].kind, "directory-entries");

    removeTmpDir(path.join(root, "src"));
    writeFile(root, "src/locked/file.js", "export {};\n");
    fs.readdirSync = (directory, options) => {
      if (directory === lockedDirectory) {
        const error = new Error("permission denied");
        error.code = "EACCES";
        throw error;
      }
      return originalReadDir(directory, options);
    };
    result = await checkFreshness(root, path.join(root, "src"));
    assert.equal(result.result, "indeterminate");
    assert.equal(result.toJSON().sourceScan.limits[0].kind, "unreadable");
  } finally {
    fs.readdirSync = originalReadDir;
    removeTmpDir(root);
  }
});

test("R3: exposes source and documentation scan details without changing result labels", async () => {
  const root = createTmpDir();
  try {
    writeFile(root, "src/current.js", "export const current = true;\n");
    writeFile(root, "docs/overview.md", "# Overview\n");
    const result = await checkFreshness(root, root);
    const json = result.toJSON();

    assert.deepEqual(Object.keys(json.sourceScan).sort(), ["complete", "limits", "policy", "target"]);
    assert.deepEqual(Object.keys(json.docsScan).sort(), ["complete", "limits", "policy", "target"]);
    assertScanDetail(json.sourceScan, root, "freshness-source");
    assertScanDetail(json.docsScan, path.join(root, "docs"), "default");

    setMtime(path.join(root, "docs/overview.md"), "2026-01-01T00:00:00.000Z");
    setMtime(path.join(root, "src/current.js"), "2026-01-03T00:00:00.000Z");
    assert.equal((await checkFreshness(root, root)).toText(), "stale — source is newer than docs/, run: senti docs build");
    fs.rmSync(path.join(root, "docs"), { recursive: true, force: true });
    assert.equal((await checkFreshness(root, root)).toText(), "never-built — docs/ does not exist, run: senti docs build");
  } finally {
    removeTmpDir(root);
  }
});

test("R4: ignores generated-only timestamp changes while retaining relevant traversal evidence", async () => {
  const root = createTmpDir();
  try {
    writeFile(root, "src/current.js", "export const current = true;\n");
    writeFile(root, "docs/overview.md", "# Overview\n");
    for (const directory of [
      ".git/objects",
      ".senti/output",
      "node_modules/example",
      "vendor/example",
      "specs/480/review-history",
      "specs/480/review-evidence",
      "specs/480/tests/.raw",
    ]) writeMany(root, directory, 3);
    setMtime(path.join(root, "src/current.js"), "2026-01-01T00:00:00.000Z");
    setMtime(path.join(root, "docs/overview.md"), "2026-01-02T00:00:00.000Z");
    const before = await checkFreshness(root, root, { policy: new ScanPolicy({ maxFiles: 2 }) });
    setMtime(path.join(root, "specs/480/tests/.raw/evidence-0.json"), "2026-01-03T00:00:00.000Z");
    const after = await checkFreshness(root, root, { policy: new ScanPolicy({ maxFiles: 2 }) });

    assert.equal(before.result, "fresh");
    assert.equal(after.result, "fresh");
  } finally {
    removeTmpDir(root);
  }
});
