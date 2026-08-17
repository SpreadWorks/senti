import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../../tests/helpers/tmp-dir.js";

const CMD = join(process.cwd(), "src/docs/commands/scan.js");

describe("entry id assignment", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("assigns id to every entry on first scan", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sdd-forge/config.json", {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["src/**/*.js"], exclude: [] },
    });
    writeFile(tmp, "src/index.js", 'export function hello() { return "hi"; }\n');
    writeFile(tmp, "src/util.js", 'export function add(a, b) { return a + b; }\n');

    const result = execFileSync("node", [CMD, "--stdout"], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
    });
    const analysis = JSON.parse(result);

    for (const entry of analysis.modules.entries) {
      assert.ok(entry.id, `entry for ${entry.file} should have an id`);
      assert.ok(typeof entry.id === "string", "id should be a string");
      assert.ok(entry.id.length > 0, "id should not be empty");
    }
  });

  it("preserves ids on re-scan when files are unchanged", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sdd-forge/config.json", {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["src/**/*.js"], exclude: [] },
    });
    writeFile(tmp, "src/index.js", 'export function hello() { return "hi"; }\n');

    // 1st scan
    execFileSync("node", [CMD], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
    });
    const outputPath = join(tmp, ".sdd-forge/output/analysis.json");
    const first = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    const firstId = first.modules.entries[0].id;
    assert.ok(firstId, "first scan should assign id");

    // 2nd scan (no changes)
    execFileSync("node", [CMD], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
    });
    const second = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    assert.equal(second.modules.entries[0].id, firstId, "id should be preserved on unchanged re-scan");
  });

  it("preserves id when file content changes (same file, same category)", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sdd-forge/config.json", {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["src/**/*.js"], exclude: [] },
    });
    writeFile(tmp, "src/index.js", 'export function hello() { return "hi"; }\n');

    // 1st scan
    execFileSync("node", [CMD], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
    });
    const outputPath = join(tmp, ".sdd-forge/output/analysis.json");
    const first = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    const firstId = first.modules.entries[0].id;

    // Change file content
    writeFile(tmp, "src/index.js", 'export function goodbye() { return "bye"; }\n');

    // 2nd scan
    execFileSync("node", [CMD], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
    });
    const second = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    assert.equal(second.modules.entries[0].id, firstId, "id should be preserved even when content changes");
  });

  it("assigns new id for newly added files", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sdd-forge/config.json", {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["src/**/*.js"], exclude: [] },
    });
    writeFile(tmp, "src/index.js", 'export function hello() { return "hi"; }\n');

    // 1st scan
    execFileSync("node", [CMD], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
    });
    const outputPath = join(tmp, ".sdd-forge/output/analysis.json");
    const first = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    const existingId = first.modules.entries[0].id;

    // Add a new file
    writeFile(tmp, "src/util.js", 'export function add(a, b) { return a + b; }\n');

    // 2nd scan
    execFileSync("node", [CMD], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
    });
    const second = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    assert.equal(second.modules.entries.length, 2, "should have 2 entries");

    const oldEntry = second.modules.entries.find(e => e.file === "src/index.js");
    const newEntry = second.modules.entries.find(e => e.file === "src/util.js");
    assert.equal(oldEntry.id, existingId, "existing entry id should be preserved");
    assert.ok(newEntry.id, "new entry should have an id");
    assert.notEqual(newEntry.id, existingId, "new entry id should differ from existing");
  });

  it("generates unique ids across entries", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sdd-forge/config.json", {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["src/**/*.js"], exclude: [] },
    });
    writeFile(tmp, "src/a.js", 'export function a() {}\n');
    writeFile(tmp, "src/b.js", 'export function b() {}\n');
    writeFile(tmp, "src/c.js", 'export function c() {}\n');

    const result = execFileSync("node", [CMD, "--stdout"], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
    });
    const analysis = JSON.parse(result);
    const ids = analysis.modules.entries.map(e => e.id);
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, ids.length, "all ids should be unique");
  });
});
