import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../helpers/tmp-dir.js";

const CMD = join(process.cwd(), "src/senti.js");
const CMD_ARGS = ["docs", "scan"];

describe("scan pipeline redesign — analysis[cat].entries structure", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupProject(files = {}) {
    tmp = createTmpDir();
    writeJson(tmp, ".senti/config.json", {
      lang: "ja",
      type: "node-cli",
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
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });
    const outputPath = join(tmp, ".senti/output/analysis.json");
    return JSON.parse(fs.readFileSync(outputPath, "utf8"));
  }

  // -------------------------------------------------------------------------
  // Req 8: analysis[cat].entries structure
  // -------------------------------------------------------------------------

  it("produces analysis.json with analysis[cat].entries structure", () => {
    setupProject({
      "src/a.js": 'export function a() { return "a"; }\n',
      "src/b.js": 'export function b() { return "b"; }\n',
    });

    const result = runScan();
    assert.ok(result.analyzedAt, "should have analyzedAt");

    // Find a category that has entries
    const categories = Object.keys(result).filter(
      (k) => typeof result[k] === "object" && result[k] !== null && !k.startsWith("_") && k !== "analyzedAt" && k !== "enrichedAt" && k !== "generatedAt"
    );
    assert.ok(categories.length > 0, "should have at least one category");

    for (const cat of categories) {
      const catData = result[cat];
      if (catData.entries) {
        assert.ok(Array.isArray(catData.entries), `${cat}.entries should be an array`);
        assert.ok(catData.summary !== undefined, `${cat} should have a summary`);
        assert.equal(catData.summary.total, catData.entries.length, `${cat}.summary.total should match entries length`);
      }
    }
  });

  // -------------------------------------------------------------------------
  // Req 5: hash skip — identical analysis on unchanged project
  // -------------------------------------------------------------------------

  it("produces identical analysis.json on unchanged project (hash skip)", () => {
    setupProject({
      "src/a.js": 'export function a() { return "a"; }\n',
      "src/b.js": 'export function b() { return "b"; }\n',
    });

    const first = runScan();
    const second = runScan();

    // Compare entries (ignore analyzedAt timestamp)
    const categories = Object.keys(first).filter(
      (k) => typeof first[k] === "object" && first[k] !== null && first[k].entries
    );
    for (const cat of categories) {
      assert.deepEqual(second[cat].entries, first[cat].entries, `${cat} entries should be identical`);
      assert.deepEqual(second[cat].summary, first[cat].summary, `${cat} summary should be identical`);
    }
  });

  // -------------------------------------------------------------------------
  // Req 6: only changed file is re-parsed
  // -------------------------------------------------------------------------

  it("re-parses only the changed file on re-scan", () => {
    setupProject({
      "src/a.js": 'export function a() { return "a"; }\n',
      "src/b.js": 'export function b() { return "b"; }\n',
    });

    const first = runScan();

    // Enrich entries to detect if enrichment is preserved or lost
    const outputPath = join(tmp, ".senti/output/analysis.json");
    const categories = Object.keys(first).filter(
      (k) => typeof first[k] === "object" && first[k] !== null && first[k].entries
    );
    for (const cat of categories) {
      for (const entry of first[cat].entries) {
        entry.summary = `enriched: ${entry.file}`;
        entry.chapter = "overview";
      }
    }
    first.enrichedAt = "2026-01-01T00:00:00.000Z";
    fs.writeFileSync(outputPath, JSON.stringify(first) + "\n");

    // Change only a.js
    writeFile(tmp, "src/a.js", 'export function a() { return "changed"; }\n');

    const second = runScan();
    for (const cat of Object.keys(second).filter(k => second[k]?.entries)) {
      for (const entry of second[cat].entries) {
        if (entry.file && entry.file.includes("a.js")) {
          // Changed file: enrichment should be lost
          assert.ok(!entry.summary, "changed file should lose enrichment");
        } else if (entry.file && entry.file.includes("b.js")) {
          // Unchanged file: enrichment should be preserved
          assert.ok(entry.summary, "unchanged file should keep enrichment");
        }
      }
    }
  });

  // -------------------------------------------------------------------------
  // Req 7: deleted files removed
  // -------------------------------------------------------------------------

  it("removes deleted files from analysis.json on re-scan", () => {
    setupProject({
      "src/a.js": 'export function a() { return "a"; }\n',
      "src/b.js": 'export function b() { return "b"; }\n',
    });

    const first = runScan();
    const catWithEntries = Object.keys(first).find(
      (k) => first[k]?.entries?.length > 0
    );
    assert.ok(catWithEntries, "should have a category with entries");
    const initialCount = first[catWithEntries].entries.length;
    assert.ok(initialCount >= 2, "should have at least 2 entries");

    // Delete b.js
    fs.unlinkSync(join(tmp, "src/b.js"));

    const second = runScan();
    const entries = second[catWithEntries].entries;
    assert.equal(entries.length, initialCount - 1, "should have one fewer entry");
    assert.ok(!entries.some(e => e.file && e.file.includes("b.js")), "deleted file should be gone");
    assert.ok(entries.some(e => e.file && e.file.includes("a.js")), "remaining file should stay");
  });

  // -------------------------------------------------------------------------
  // Req 9: parse failure → non-zero exit
  // -------------------------------------------------------------------------

  it("exits with non-zero code when analysis.json is corrupted", () => {
    setupProject({
      "src/a.js": 'export function a() { return "a"; }\n',
    });

    // Create corrupted analysis.json
    const outputDir = join(tmp, ".senti/output");
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(join(outputDir, "analysis.json"), "NOT VALID JSON{{{");

    assert.throws(
      () => {
        execFileSync("node", [CMD, ...CMD_ARGS], {
          encoding: "utf8",
          env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
        });
      },
      (err) => err.status !== 0,
      "should exit with non-zero code on corrupted analysis.json"
    );
  });
});
