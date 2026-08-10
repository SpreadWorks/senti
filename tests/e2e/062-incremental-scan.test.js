import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../helpers/tmp-dir.js";

const CMD = join(process.cwd(), "src/sennel.js");
const CMD_ARGS = ["docs", "scan"];

describe("incremental scan by hash", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupProject(files = {}) {
    tmp = createTmpDir();
    writeJson(tmp, ".sennel/config.json", {
      lang: "ja",
      type: "sample-node-command",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["src/**/*.js"], exclude: [] },
    });
    for (const [relPath, content] of Object.entries(files)) {
      writeFile(tmp, relPath, content);
    }
    return tmp;
  }

  function runScan() {
    execFileSync("node", [CMD, ...CMD_ARGS], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp, SENNEL_SOURCE_ROOT: tmp },
    });
    const outputPath = join(tmp, ".sennel/output/analysis.json");
    return JSON.parse(fs.readFileSync(outputPath, "utf8"));
  }

  function enrichEntry(analysis, index, enrichment) {
    const entry = analysis.modules.entries[index];
    Object.assign(entry, enrichment);
    analysis.enrichedAt = "2026-01-01T00:00:00.000Z";
    const outputPath = join(tmp, ".sennel/output/analysis.json");
    fs.writeFileSync(outputPath, JSON.stringify(analysis) + "\n");
  }

  it("skips unchanged files and preserves their entries", () => {
    setupProject({
      "src/a.js": 'export function a() { return "a"; }\n',
      "src/b.js": 'export function b() { return "b"; }\n',
    });

    const first = runScan();
    assert.equal(first.modules.summary.total, 2);

    // Enrich both entries
    enrichEntry(first, 0, { summary: "func a", detail: "returns a", chapter: "overview", role: "lib" });
    const enriched = JSON.parse(fs.readFileSync(join(tmp, ".sennel/output/analysis.json"), "utf8"));
    enrichEntry(enriched, 1, { summary: "func b", detail: "returns b", chapter: "cli_commands", role: "lib" });

    // 2nd scan (no changes)
    const second = runScan();
    assert.equal(second.modules.summary.total, 2);
    // Both enrichments should be preserved
    assert.equal(second.modules.entries[0].summary, "func a");
    assert.equal(second.modules.entries[1].summary, "func b");
  });

  it("re-scans only changed files and drops their enrichment", () => {
    setupProject({
      "src/a.js": 'export function a() { return "a"; }\n',
      "src/b.js": 'export function b() { return "b"; }\n',
    });

    const first = runScan();
    const hashA = first.modules.entries.find(e => e.file.includes("a.js")).hash;
    const hashB = first.modules.entries.find(e => e.file.includes("b.js")).hash;

    // Enrich both
    for (let i = 0; i < first.modules.entries.length; i++) {
      first.modules.entries[i].summary = `summary ${i}`;
      first.modules.entries[i].chapter = "overview";
    }
    first.enrichedAt = "2026-01-01T00:00:00.000Z";
    fs.writeFileSync(join(tmp, ".sennel/output/analysis.json"), JSON.stringify(first) + "\n");

    // Change only a.js
    writeFile(tmp, "src/a.js", 'export function a() { return "changed"; }\n');

    const second = runScan();
    const newA = second.modules.entries.find(e => e.file.includes("a.js"));
    const newB = second.modules.entries.find(e => e.file.includes("b.js"));

    // a.js: hash changed → enrichment dropped
    assert.notEqual(newA.hash, hashA);
    assert.ok(!newA.summary, "changed file should lose enrichment");

    // b.js: hash unchanged → enrichment preserved
    assert.equal(newB.hash, hashB);
    assert.ok(newB.summary, "unchanged file should keep enrichment");
  });

  it("adds new files to analysis", () => {
    setupProject({
      "src/a.js": 'export function a() { return "a"; }\n',
    });

    const first = runScan();
    assert.equal(first.modules.summary.total, 1);

    // Add a new file
    writeFile(tmp, "src/c.js", 'export function c() { return "c"; }\n');

    const second = runScan();
    assert.equal(second.modules.summary.total, 2);
    const files = second.modules.entries.map(e => e.file);
    assert.ok(files.some(f => f.includes("c.js")), "new file should be in analysis");
  });

  it("removes deleted files from analysis", () => {
    setupProject({
      "src/a.js": 'export function a() { return "a"; }\n',
      "src/b.js": 'export function b() { return "b"; }\n',
    });

    const first = runScan();
    assert.equal(first.modules.summary.total, 2);

    // Delete b.js
    fs.unlinkSync(join(tmp, "src/b.js"));

    const second = runScan();
    assert.equal(second.modules.summary.total, 1);
    const files = second.modules.entries.map(e => e.file);
    assert.ok(!files.some(f => f.includes("b.js")), "deleted file should be removed from analysis");
    assert.ok(files.some(f => f.includes("a.js")), "remaining file should stay");
  });

  it("does full scan when analysis.json does not exist", () => {
    setupProject({
      "src/a.js": 'export function a() { return "a"; }\n',
      "src/b.js": 'export function b() { return "b"; }\n',
    });

    // No prior analysis.json → full scan
    const result = runScan();
    assert.equal(result.modules.summary.total, 2);
    assert.ok(result.analyzedAt);
  });
});
