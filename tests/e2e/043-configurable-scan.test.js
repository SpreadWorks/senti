/**
 * Tests for spec #043: Configurable Scan Directories
 *
 * Tests the include/exclude glob pattern scan system,
 * DataSource.match() dispatch, language auto-detection,
 * and analysis.json structure changes.
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../helpers/tmp-dir.js";

const CMD = join(process.cwd(), "src/senti.js");
const CMD_ARGS = ["docs", "scan"];

// ---------------------------------------------------------------------------
// 1. Language auto-detection from file extension
// ---------------------------------------------------------------------------
describe("parseFile language auto-detection", async () => {
  // Dynamic import to get the latest version
  const { parseFile } = await import("../../src/docs/lib/scanner.js");

  it("auto-detects PHP from .php extension (no lang argument)", () => {
    const tmp = createTmpDir();
    try {
      const phpFile = join(tmp, "Test.php");
      fs.writeFileSync(phpFile, [
        "<?php",
        "class TestController extends AppController {",
        "  public function index() {}",
        "}",
      ].join("\n"));

      // parseFile should detect PHP from extension without lang param
      const result = parseFile(phpFile);
      assert.equal(result.className, "TestController");
      assert.ok(result.methods.includes("index"));
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("auto-detects JS from .js extension (no lang argument)", () => {
    const tmp = createTmpDir();
    try {
      const jsFile = join(tmp, "utils.js");
      fs.writeFileSync(jsFile, 'export function doStuff() { return 1; }\n');

      const result = parseFile(jsFile);
      assert.ok(result.methods.includes("doStuff"));
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("returns basic info for unknown extension", () => {
    const tmp = createTmpDir();
    try {
      const txtFile = join(tmp, "data.yaml");
      fs.writeFileSync(txtFile, "key: value\n");

      const result = parseFile(txtFile);
      assert.equal(result.className, "data.yaml");
      assert.deepEqual(result.methods, []);
    } finally {
      removeTmpDir(tmp);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. DataSource base class no longer has match()
//    match() is now provided by the Scannable mixin (scan-source.js).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 3. Scannable mixin has match() method
// ---------------------------------------------------------------------------
describe("Scannable mixin match()", async () => {
  const { Scannable } = await import("../../src/docs/lib/scan-source.js");
  const { DataSource } = await import("../../src/docs/lib/data-source.js");

  it("Scannable(DataSource) has match() that returns false by default", () => {
    class TestSource extends Scannable(DataSource) {}
    const source = new TestSource();
    assert.equal(typeof source.match, "function");
    assert.equal(source.match({ relPath: "foo.js" }), false);
  });

  it("scan(files) accepts file list (new signature)", () => {
    class TestSource extends Scannable(DataSource) {
      scan(files) {
        return { items: files.length };
      }
    }
    const source = new TestSource();
    const result = source.scan([
      { absPath: "/a.js", relPath: "a.js" },
    ]);
    assert.equal(result.items, 1);
  });
});

// ---------------------------------------------------------------------------
// 4. config.json scan validation
// ---------------------------------------------------------------------------
describe("scan config validation", async () => {
  const { validate } = await import("../../src/lib/config.js");

  const baseConfig = {
    lang: "ja",
    type: "sample-node-command",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
  };

  it("accepts config with valid scan.include and scan.exclude", () => {
    const cfg = {
      ...baseConfig,
      scan: { include: ["src/**/*.js"], exclude: ["src/legacy/**"] },
    };
    const result = validate(cfg);
    assert.deepEqual(result.scan.include, ["src/**/*.js"]);
    assert.deepEqual(result.scan.exclude, ["src/legacy/**"]);
  });

  it("accepts scan without exclude (optional)", () => {
    const cfg = {
      ...baseConfig,
      scan: { include: ["src/**/*.js"] },
    };
    const result = validate(cfg);
    assert.deepEqual(result.scan.include, ["src/**/*.js"]);
  });

  it("rejects scan without include", () => {
    const cfg = {
      ...baseConfig,
      scan: { exclude: ["foo"] },
    };
    assert.throws(() => validate(cfg), /scan\.include/);
  });

  it("rejects scan.include that is not an array", () => {
    const cfg = {
      ...baseConfig,
      scan: { include: "src/**/*.js" },
    };
    assert.throws(() => validate(cfg), /scan\.include/);
  });

  it("rejects scan.include with empty array", () => {
    const cfg = {
      ...baseConfig,
      scan: { include: [] },
    };
    assert.throws(() => validate(cfg), /scan\.include/);
  });

  it("rejects scan.exclude that is not an array", () => {
    const cfg = {
      ...baseConfig,
      scan: { include: ["src/**/*.js"], exclude: "foo" },
    };
    assert.throws(() => validate(cfg), /scan\.exclude/);
  });

  it("config without scan passes validation (uses preset default)", () => {
    const result = validate({ ...baseConfig });
    assert.equal(result.scan, undefined);
  });
});

// ---------------------------------------------------------------------------
// 5. config.json scan overrides preset completely
// ---------------------------------------------------------------------------
describe("scan config override", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("config.json scan replaces preset scan entirely", () => {
    tmp = createTmpDir();
    // config specifies only lib/ — src/ files should NOT appear
    writeJson(tmp, ".senti/config.json", {
      lang: "ja",
      type: "sample-node-command",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["lib/**/*.js"] },
    });
    writeFile(tmp, "src/index.js", 'export function inSrc() {}\n');
    writeFile(tmp, "lib/helper.js", 'export function inLib() {}\n');

    const result = execFileSync("node", [CMD, ...CMD_ARGS, "--stdout"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });
    const analysis = JSON.parse(result);

    // lib/helper.js should be found
    const allFiles = collectAllFiles(analysis);
    assert.ok(
      allFiles.some((f) => f.includes("lib/helper.js")),
      "lib/helper.js should be in analysis",
    );
    // src/index.js should NOT be found (preset default overridden)
    assert.ok(
      !allFiles.some((f) => f.includes("src/index.js")),
      "src/index.js should NOT be in analysis when config overrides preset",
    );
  });
});

// ---------------------------------------------------------------------------
// 6. analysis.json structure: no extras, top-level grouping
// ---------------------------------------------------------------------------
describe("analysis.json top-level structure (no extras)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("package data is at top level, not under extras", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".senti/config.json", {
      lang: "ja",
      type: "sample-node-command",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["src/**/*.js", "package.json"] },
    });
    writeFile(tmp, "src/index.js", 'export function hello() {}\n');
    writeJson(tmp, "package.json", {
      dependencies: { express: "^4.0.0" },
      scripts: { test: "node --test" },
    });

    const result = execFileSync("node", [CMD, ...CMD_ARGS, "--stdout"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });
    const analysis = JSON.parse(result);

    // No extras key
    assert.equal(analysis.extras, undefined, "extras key should not exist");
    // Package data should be at top level
    assert.ok(analysis.package, "package should be at top level");
  });
});

// ---------------------------------------------------------------------------
// 7. preserveEnrichment with recursive hash search
// ---------------------------------------------------------------------------
describe("preserveEnrichment recursive hash search", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("preserves enrichment for entries nested at arbitrary depth", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".senti/config.json", {
      lang: "ja",
      type: "sample-node-command",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["src/**/*.js", "package.json"] },
    });
    writeFile(tmp, "src/index.js", 'export function hello() { return "hi"; }\n');
    writeJson(tmp, "package.json", {
      dependencies: { lodash: "^4.0.0" },
    });

    // 1st scan
    execFileSync("node", [CMD, ...CMD_ARGS], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });

    const outputPath = join(tmp, ".senti/output/analysis.json");
    const first = JSON.parse(fs.readFileSync(outputPath, "utf8"));

    // Find any entry with a hash and add enrichment
    const enriched = addEnrichmentToFirstHash(first, {
      summary: "Test summary",
      detail: "Test detail",
      chapter: "overview",
      role: "util",
    });
    assert.ok(enriched, "should find at least one entry with hash to enrich");
    first.enrichedAt = "2026-01-01T00:00:00.000Z";
    fs.writeFileSync(outputPath, JSON.stringify(first) + "\n");

    // 2nd scan (same source)
    execFileSync("node", [CMD, ...CMD_ARGS], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });

    const second = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    const found = findEntryByHash(second, enriched.hash);
    assert.ok(found, "should find entry with same hash after re-scan");
    assert.equal(found.summary, "Test summary", "summary should be preserved");
    assert.equal(found.detail, "Test detail", "detail should be preserved");
  });
});

// ---------------------------------------------------------------------------
// 8. All matching DataSources receive the file
// ---------------------------------------------------------------------------
describe("multiple DataSource matches", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("a file is assigned to every matching DataSource", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".senti/config.json", {
      lang: "ja",
      type: "child-preset",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: {
        include: [
          "app/Controller/**/*Controller.php",
          "app/Config/**/*.php",
        ],
      },
    });
    // AppController.php matches config DataSource first (it explicitly claims AppController.php),
    // so it does NOT appear in controllers.
    writeFile(tmp, "app/Controller/AppController.php", [
      "<?php",
      "class AppController extends Controller {",
      "  public $components = array('Session');",
      "  public function beforeFilter() {}",
      "}",
    ].join("\n"));

    const result = execFileSync("node", [CMD, ...CMD_ARGS, "--stdout"], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });
    const analysis = JSON.parse(result);
    assert.ok(analysis.config, "config category should exist");
    assert.equal(analysis.config.entries.length, 1, "should have one config entry");
    assert.ok(analysis.controllers, "controllers category should exist");
    assert.equal(analysis.controllers.entries.length, 1, "should have one controller entry");
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Collect all file paths from analysis (works with new top-level structure) */
function collectAllFiles(analysis) {
  const files = [];
  for (const [key, value] of Object.entries(analysis)) {
    if (key === "analyzedAt" || key === "enrichedAt") continue;
    if (value && typeof value === "object") {
      collectFilesRecursive(value, files);
    }
  }
  return files;
}

function collectFilesRecursive(obj, files) {
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item?.file) files.push(item.file);
      if (item?.absPath) files.push(item.absPath);
    }
  } else if (typeof obj === "object" && obj !== null) {
    for (const val of Object.values(obj)) {
      collectFilesRecursive(val, files);
    }
  }
}

/** Add enrichment fields to first entry with a hash found recursively */
function addEnrichmentToFirstHash(obj, enrichment) {
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item?.hash) {
        Object.assign(item, enrichment);
        return item;
      }
    }
  } else if (typeof obj === "object" && obj !== null) {
    for (const val of Object.values(obj)) {
      const found = addEnrichmentToFirstHash(val, enrichment);
      if (found) return found;
    }
  }
  return null;
}

/** Find entry by hash recursively */
function findEntryByHash(obj, hash) {
  if (Array.isArray(obj)) {
    for (const item of obj) {
      if (item?.hash === hash) return item;
    }
  } else if (typeof obj === "object" && obj !== null) {
    for (const val of Object.values(obj)) {
      const found = findEntryByHash(val, hash);
      if (found) return found;
    }
  }
  return null;
}
