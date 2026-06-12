import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { execFileSync, spawnSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../../helpers/tmp-dir.js";

const CMD = join(process.cwd(), "src/senti.js");
const CMD_ARGS = ["docs", "scan"];

/**
 * Create a tmp project, run scan, then simulate enrichment on analysis.json.
 * Returns { tmp, outputPath, analysis }.
 */
function setupEnrichedProject() {
  const tmp = createTmpDir();
  writeJson(tmp, ".senti/config.json", {
    lang: "ja",
    type: "sample-node-command",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
    scan: { include: ["src/**/*.js"], exclude: [] },
  });
  writeFile(tmp, "src/index.js", 'export function hello() { return "hi"; }\n');
  writeFile(tmp, "src/utils.js", 'export function add(a, b) { return a + b; }\n');

  // Run scan to generate analysis.json
  execFileSync("node", [CMD, ...CMD_ARGS], {
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
  });

  const outputPath = join(tmp, ".senti/output/analysis.json");
  const analysis = JSON.parse(fs.readFileSync(outputPath, "utf8"));

  // Simulate enrichment
  for (const entry of analysis.modules.entries) {
    entry.summary = `Summary of ${entry.file}`;
    entry.detail = `Detail of ${entry.file}`;
    entry.chapter = "overview";
    entry.role = "lib";
    entry.enrich = { processedAt: "2026-01-01T00:00:00.000Z", attempts: 1 };
  }
  analysis.enrichedAt = "2026-01-01T00:00:00.000Z";
  fs.writeFileSync(outputPath, JSON.stringify(analysis) + "\n");

  return { tmp, outputPath, analysis };
}

describe("scan --reset", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("resets hash to null for all categories when no category specified", () => {
    ({ tmp } = setupEnrichedProject());
    const outputPath = join(tmp, ".senti/output/analysis.json");

    const proc = spawnSync("node", [CMD, ...CMD_ARGS, "--reset"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });
    assert.equal(proc.status, 0);

    const after = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    for (const entry of after.modules.entries) {
      assert.equal(entry.hash, null, `hash should be null for ${entry.file}`);
    }
  });

  it("resets hash only for specified category", () => {
    // Use child-preset to get multiple categories
    tmp = createTmpDir();
    writeJson(tmp, ".senti/config.json", {
      lang: "ja",
      type: "child-preset",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
    });
    writeFile(tmp, "app/Controller/UsersController.php", [
      "<?php",
      "class UsersController extends AppController {",
      "  public function index() {}",
      "}",
    ].join("\n"));
    writeFile(tmp, "app/Model/User.php", [
      "<?php",
      "class User extends AppModel {",
      "  public $useTable = 'users';",
      "}",
    ].join("\n"));

    execFileSync("node", [CMD, ...CMD_ARGS], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });

    const outputPath = join(tmp, ".senti/output/analysis.json");
    const before = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    const categories = Object.keys(before).filter(k => before[k]?.entries);
    assert.ok(categories.length >= 2, "should have at least 2 categories");

    // Save original hashes for non-target categories
    const targetCat = categories[0];
    const otherCat = categories.find(c => c !== targetCat);
    const otherHashBefore = before[otherCat].entries[0].hash;

    const proc = spawnSync("node", [CMD, ...CMD_ARGS, "--reset", targetCat], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });
    assert.equal(proc.status, 0);

    const after = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    // Target category: hash should be null
    for (const entry of after[targetCat].entries) {
      assert.equal(entry.hash, null, `${targetCat} hash should be null`);
    }
    // Other category: hash should be unchanged
    assert.equal(after[otherCat].entries[0].hash, otherHashBefore, `${otherCat} hash should be preserved`);
  });

  it("resets hash for multiple comma-separated categories", () => {
    ({ tmp } = setupEnrichedProject());
    const outputPath = join(tmp, ".senti/output/analysis.json");

    // Add a second category manually to test comma separation
    const analysis = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    analysis.extras = {
      entries: [{ file: "extra.txt", hash: "abc123", lines: 1 }],
      summary: { total: 1 },
    };
    fs.writeFileSync(outputPath, JSON.stringify(analysis) + "\n");

    const proc = spawnSync("node", [CMD, ...CMD_ARGS, "--reset", "modules,extras"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });
    assert.equal(proc.status, 0);

    const after = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    for (const entry of after.modules.entries) {
      assert.equal(entry.hash, null, `modules hash should be null`);
    }
    assert.equal(after.extras.entries[0].hash, null, "extras hash should be null");
  });

  it("preserves enrich fields when resetting hash", () => {
    ({ tmp } = setupEnrichedProject());
    const outputPath = join(tmp, ".senti/output/analysis.json");

    spawnSync("node", [CMD, ...CMD_ARGS, "--reset"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });

    const after = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    for (const entry of after.modules.entries) {
      assert.equal(entry.hash, null, "hash should be null");
      assert.ok(entry.summary, "summary should be preserved");
      assert.ok(entry.detail, "detail should be preserved");
      assert.equal(entry.chapter, "overview", "chapter should be preserved");
      assert.equal(entry.role, "lib", "role should be preserved");
      assert.equal(entry.enrich.processedAt, "2026-01-01T00:00:00.000Z", "enrich.processedAt should be preserved");
    }
    assert.equal(after.enrichedAt, "2026-01-01T00:00:00.000Z", "enrichedAt should be preserved");
  });

  it("warns and exits 0 for nonexistent category", () => {
    ({ tmp } = setupEnrichedProject());

    const proc = spawnSync("node", [CMD, ...CMD_ARGS, "--reset", "nonexistent"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });
    assert.equal(proc.status, 0);
    assert.match(proc.stderr, /nonexistent/, "stderr should mention the unknown category");
  });

  it("exits 0 with message when analysis.json does not exist", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".senti/config.json", {
      lang: "ja",
      type: "sample-node-command",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
    });

    const proc = spawnSync("node", [CMD, ...CMD_ARGS, "--reset"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });
    assert.equal(proc.status, 0);
    assert.match(proc.stderr, /analysis\.json|nothing to reset/i, "stderr should indicate no analysis.json");
  });

  it("re-scan after reset re-parses entries", () => {
    ({ tmp } = setupEnrichedProject());
    const outputPath = join(tmp, ".senti/output/analysis.json");
    const before = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    const originalHash = before.modules.entries[0].hash;

    // Reset
    spawnSync("node", [CMD, ...CMD_ARGS, "--reset"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });

    // Verify hash is null
    const reset = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    assert.equal(reset.modules.entries[0].hash, null);

    // Re-scan
    execFileSync("node", [CMD, ...CMD_ARGS], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });

    // Hash should be restored (re-parsed)
    const after = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    assert.equal(after.modules.entries[0].hash, originalHash, "hash should be restored after re-scan");
    // Enrichment should be gone (entry was re-parsed, replacing the whole object)
    assert.ok(!after.modules.entries[0].summary, "enrichment should be dropped after re-parse");
  });

  it("displays reset counts per category on stderr", () => {
    ({ tmp } = setupEnrichedProject());

    const proc = spawnSync("node", [CMD, ...CMD_ARGS, "--reset"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });
    assert.equal(proc.status, 0);
    assert.match(proc.stderr, /modules/, "stderr should mention category name");
    assert.match(proc.stderr, /total/, "stderr should show total");
  });
});
