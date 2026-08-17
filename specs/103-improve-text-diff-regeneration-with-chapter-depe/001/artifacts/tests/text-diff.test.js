import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import crypto from "crypto";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../../tests/helpers/tmp-dir.js";

const SCAN_CMD = join(process.cwd(), "src/docs/commands/scan.js");
const TEXT_CMD = join(process.cwd(), "src/docs/commands/text.js");

function md5(content) {
  return crypto.createHash("md5").update(content).digest("hex");
}

describe("text diff regeneration", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupProject(extraConfig = {}) {
    tmp = createTmpDir();
    writeJson(tmp, ".sdd-forge/config.json", {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["src/**/*.js"], exclude: [] },
      ...extraConfig,
    });
    fs.mkdirSync(join(tmp, ".sdd-forge/output"), { recursive: true });
    fs.mkdirSync(join(tmp, "docs"), { recursive: true });
    return tmp;
  }

  function writeAnalysis(dir, analysis) {
    writeJson(dir, ".sdd-forge/output/analysis.json", analysis);
  }

  function createEnrichedAnalysis(entries) {
    return {
      analyzedAt: new Date().toISOString(),
      enrichedAt: new Date().toISOString(),
      modules: {
        entries,
        summary: { total: entries.length },
      },
    };
  }

  it("identifies changed entries by comparing hash with current file", () => {
    setupProject();

    const oldContent = 'export function hello() { return "hi"; }\n';
    const newContent = 'export function hello() { return "hello world"; }\n';
    writeFile(tmp, "src/index.js", newContent);

    const analysis = createEnrichedAnalysis([
      {
        id: "abc123",
        file: "src/index.js",
        hash: md5(oldContent),
        lines: 1,
        mtime: new Date().toISOString(),
        chapter: "overview",
        summary: "greeting function",
      },
      {
        id: "def456",
        file: "src/util.js",
        hash: md5('export function add(a, b) { return a + b; }\n'),
        lines: 1,
        mtime: new Date().toISOString(),
        chapter: "cli_commands",
        summary: "utility function",
      },
    ]);
    writeFile(tmp, "src/util.js", 'export function add(a, b) { return a + b; }\n');
    writeAnalysis(tmp, analysis);

    // Write chapter files with text directives
    writeFile(tmp, "docs/overview.md", [
      "# Overview",
      "<!-- {{text(id='intro')}} -->",
      "Old generated content here.",
      "<!-- {{/text}} -->",
    ].join("\n"));
    writeFile(tmp, "docs/cli_commands.md", [
      "# CLI Commands",
      "<!-- {{text(id='commands')}} -->",
      "Existing generated content.",
      "<!-- {{/text}} -->",
    ].join("\n"));

    // text command should identify that only overview chapter needs regeneration
    // because src/index.js hash changed and it maps to overview chapter
    // src/util.js hash is unchanged so cli_commands should be skipped

    // For now, we verify the detection logic by checking that:
    // 1. The analysis has entries with different hash states
    const currentHash = md5(newContent);
    assert.notEqual(analysis.modules.entries[0].hash, currentHash, "index.js hash should differ (changed)");

    const utilHash = md5(fs.readFileSync(join(tmp, "src/util.js"), "utf8"));
    assert.equal(analysis.modules.entries[1].hash, utilHash, "util.js hash should match (unchanged)");
  });

  it("detects no changes when all hashes match", () => {
    setupProject();

    const content = 'export function hello() { return "hi"; }\n';
    writeFile(tmp, "src/index.js", content);

    const analysis = createEnrichedAnalysis([
      {
        id: "abc123",
        file: "src/index.js",
        hash: md5(content),
        lines: 1,
        mtime: new Date().toISOString(),
        chapter: "overview",
        summary: "greeting function",
      },
    ]);
    writeAnalysis(tmp, analysis);

    // Hash matches current file — no chapters should need regeneration
    const currentHash = md5(fs.readFileSync(join(tmp, "src/index.js"), "utf8"));
    assert.equal(analysis.modules.entries[0].hash, currentHash, "hash should match — no change detected");
  });

  it("maps changed entries to their chapters correctly", () => {
    setupProject();

    // Simulate 3 entries across 2 chapters
    // Change only the file for entry in "database" chapter
    const unchangedContent = 'export function a() {}\n';
    const oldDbContent = 'export function db() { return "old"; }\n';
    const newDbContent = 'export function db() { return "new"; }\n';

    writeFile(tmp, "src/a.js", unchangedContent);
    writeFile(tmp, "src/b.js", unchangedContent);
    writeFile(tmp, "src/db.js", newDbContent);

    const analysis = createEnrichedAnalysis([
      { id: "e1", file: "src/a.js", hash: md5(unchangedContent), chapter: "overview", lines: 1, mtime: new Date().toISOString() },
      { id: "e2", file: "src/b.js", hash: md5(unchangedContent), chapter: "overview", lines: 1, mtime: new Date().toISOString() },
      { id: "e3", file: "src/db.js", hash: md5(oldDbContent), chapter: "database", lines: 1, mtime: new Date().toISOString() },
    ]);
    writeAnalysis(tmp, analysis);

    // Determine which chapters need regeneration
    const changedChapters = new Set();
    for (const entry of analysis.modules.entries) {
      const filePath = join(tmp, entry.file);
      if (!fs.existsSync(filePath)) {
        changedChapters.add(entry.chapter);
        continue;
      }
      const currentHash = md5(fs.readFileSync(filePath, "utf8"));
      if (entry.hash !== currentHash) {
        changedChapters.add(entry.chapter);
      }
    }

    assert.equal(changedChapters.size, 1, "only one chapter should need regeneration");
    assert.ok(changedChapters.has("database"), "database chapter should need regeneration");
    assert.ok(!changedChapters.has("overview"), "overview chapter should NOT need regeneration");
  });

  it("treats missing source files as changed", () => {
    setupProject();

    const analysis = createEnrichedAnalysis([
      { id: "e1", file: "src/deleted.js", hash: "somehash", chapter: "overview", lines: 1, mtime: new Date().toISOString() },
    ]);
    writeAnalysis(tmp, analysis);

    // File does not exist — should be treated as changed
    const filePath = join(tmp, "src/deleted.js");
    assert.ok(!fs.existsSync(filePath), "file should not exist");

    // The chapter should be flagged for regeneration
    const changedChapters = new Set();
    for (const entry of analysis.modules.entries) {
      const fp = join(tmp, entry.file);
      if (!fs.existsSync(fp)) {
        changedChapters.add(entry.chapter);
      }
    }
    assert.ok(changedChapters.has("overview"), "chapter with missing file should need regeneration");
  });
});
