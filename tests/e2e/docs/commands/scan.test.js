import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { execFileSync, spawnSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../../helpers/tmp-dir.js";

const CMD = join(process.cwd(), "src/senti.js");
const CMD_ARGS = ["docs", "scan"];

describe("scan CLI", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("generates analysis.json with --stdout including modules", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".senti/config.json", {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["src/**/*.js"], exclude: [] },
    });
    writeFile(tmp, "src/index.js", 'export function hello() { return "hi"; }\n');

    const result = execFileSync("node", [CMD, ...CMD_ARGS, "--stdout"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });
    const analysis = JSON.parse(result);
    assert.ok(analysis.analyzedAt);
    assert.ok(analysis.modules, "modules category should be in analysis");
    assert.equal(analysis.modules.summary.total, 1);
  });

  it("does not emit WARN or legacy prefix on stderr for node-cli type", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".senti/config.json", {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["src/**/*.js"], exclude: [] },
    });
    writeFile(tmp, "src/index.js", 'export function hello() { return "hi"; }\n');

    const proc = spawnSync("node", [CMD, ...CMD_ARGS, "--stdout"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });
    assert.equal(proc.status, 0);
    assert.ok(!proc.stderr.includes("WARN"), `unexpected WARN in stderr: ${proc.stderr}`);
    assert.ok(!proc.stderr.includes("[analyze]"), `legacy [analyze] prefix found in stderr: ${proc.stderr}`);
  });

  it("writes analysis.json with modules to output dir", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".senti/config.json", {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["src/**/*.js"], exclude: [] },
    });
    fs.mkdirSync(join(tmp, ".senti/output"), { recursive: true });
    writeFile(tmp, "src/main.js", "function main() {}\n");

    execFileSync("node", [CMD, ...CMD_ARGS], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });

    const outputPath = join(tmp, ".senti/output/analysis.json");
    assert.ok(fs.existsSync(outputPath));
    const analysis = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    assert.ok(analysis.analyzedAt);
    assert.ok(analysis.modules, "modules should be in analysis.json");

    // summary.json should no longer be generated
    const summaryPath = join(tmp, ".senti/output/summary.json");
    assert.ok(!fs.existsSync(summaryPath), "summary.json should not be generated");
  });

  it("--dry-run outputs summary to stdout without writing file", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".senti/config.json", {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["src/**/*.js"], exclude: [] },
    });
    writeFile(tmp, "src/index.js", 'export function hello() { return "hi"; }\n');
    fs.mkdirSync(join(tmp, ".senti/output"), { recursive: true });

    const result = execFileSync("node", [CMD, ...CMD_ARGS, "--dry-run"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });
    const summary = JSON.parse(result);
    // spec 185: --dry-run emits a category-name → entry-count summary, not full analysis
    assert.equal(summary.analyzedAt, undefined);
    assert.equal(summary.modules, 1);
    // File should NOT be written
    assert.ok(!fs.existsSync(join(tmp, ".senti/output/analysis.json")));
  });

  it("shows help with --help", () => {
    const result = execFileSync("node", [CMD, ...CMD_ARGS, "--help"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: "/tmp" },
    });
    assert.match(result, /--stdout/);
  });

  it("scans cakephp2 with parent-child DataSource inheritance", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".senti/config.json", {
      lang: "ja",
      type: "cakephp2",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
    });
    writeFile(tmp, "app/Controller/UsersController.php", [
      "<?php",
      "class UsersController extends AppController {",
      "  public $uses = array('User');",
      "  public function index() {}",
      "  public function view() {}",
      "}",
    ].join("\n"));

    const result = execFileSync("node", [CMD, ...CMD_ARGS, "--stdout"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });
    const analysis = JSON.parse(result);
    assert.ok(analysis.analyzedAt);
    // CakePHP controllers DataSource overrides webapp parent
    assert.ok(analysis.controllers, "controllers category should exist");
    assert.equal(analysis.controllers.summary.total, 1);
    assert.equal(analysis.controllers.entries[0].className, "UsersController");
  });

  it("preserves enrichment for unchanged entries on re-scan", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".senti/config.json", {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["src/**/*.js"], exclude: [] },
    });
    writeFile(tmp, "src/index.js", 'export function hello() { return "hi"; }\n');

    // 1st scan
    execFileSync("node", [CMD, ...CMD_ARGS], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });

    const outputPath = join(tmp, ".senti/output/analysis.json");
    const first = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    const hash = first.modules.entries[0].hash;
    assert.ok(hash, "scan should produce hash");

    // Simulate enrichment (as enrich.js would do)
    first.modules.entries[0].summary = "A greeting function";
    first.modules.entries[0].detail = "Returns hi";
    first.modules.entries[0].chapter = "overview";
    first.modules.entries[0].role = "lib";
    first.enrichedAt = "2026-01-01T00:00:00.000Z";
    fs.writeFileSync(outputPath, JSON.stringify(first) + "\n");

    // 2nd scan (same source, no changes)
    execFileSync("node", [CMD, ...CMD_ARGS], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });

    const second = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    const item = second.modules.entries[0];
    assert.equal(item.hash, hash, "hash should be the same");
    assert.equal(item.summary, "A greeting function", "summary should be preserved");
    assert.equal(item.detail, "Returns hi", "detail should be preserved");
    assert.equal(item.chapter, "overview", "chapter should be preserved");
    assert.equal(item.role, "lib", "role should be preserved");
    assert.equal(second.enrichedAt, "2026-01-01T00:00:00.000Z", "enrichedAt should be preserved");
  });

  it("drops enrichment when file content changes", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".senti/config.json", {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["src/**/*.js"], exclude: [] },
    });
    writeFile(tmp, "src/index.js", 'export function hello() { return "hi"; }\n');

    // 1st scan
    execFileSync("node", [CMD, ...CMD_ARGS], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });

    const outputPath = join(tmp, ".senti/output/analysis.json");
    const first = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    first.modules.entries[0].summary = "Old summary";
    first.modules.entries[0].detail = "Old detail";
    first.enrichedAt = "2026-01-01T00:00:00.000Z";
    fs.writeFileSync(outputPath, JSON.stringify(first) + "\n");

    // Change the source file → different hash
    writeFile(tmp, "src/index.js", 'export function goodbye() { return "bye"; }\n');

    // 2nd scan
    execFileSync("node", [CMD, ...CMD_ARGS], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });

    const second = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    const item = second.modules.entries[0];
    assert.ok(!item.summary, "summary should NOT be preserved for changed file");
    assert.ok(!item.detail, "detail should NOT be preserved for changed file");
  });

  it("includes package data from PackageSource at top level", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".senti/config.json", {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["src/**/*.js", "package.json"] },
    });
    writeJson(tmp, "package.json", {
      dependencies: { "express": "^4.0.0" },
    });

    const result = execFileSync("node", [CMD, ...CMD_ARGS, "--stdout"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });
    const analysis = JSON.parse(result);
    assert.ok(analysis.package, "package should be at top level");
    const pkgEntry = analysis.package.entries?.find((e) => e.packageDeps);
    assert.ok(pkgEntry, "package should have an entry with packageDeps");
    assert.deepEqual(pkgEntry.packageDeps.dependencies, { "express": "^4.0.0" });
    assert.equal(analysis.extras, undefined, "extras should not exist");
  });
});
