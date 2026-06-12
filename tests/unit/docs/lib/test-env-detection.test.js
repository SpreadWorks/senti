import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Test environment detection will be implemented in a lib module
// For now, test the scan extension for scripts extraction

describe("scan scripts extraction", () => {
  it("includes scripts.test in analysis when package.json has test script", async () => {
    const { execFileSync } = await import("child_process");
    const { join } = await import("path");
    const { createTmpDir, removeTmpDir, writeJson, writeFile } = await import("../../../helpers/tmp-dir.js");

    const tmp = createTmpDir();
    try {
      writeJson(tmp, ".senti/config.json", {
        lang: "en",
        type: "base",
        docs: { languages: ["en"], defaultLanguage: "en" },
        scan: { include: ["src/**/*.js", "package.json"], exclude: [] },
      });
      writeJson(tmp, "package.json", {
        name: "test-project",
        scripts: { test: "node --test", build: "tsc" },
        devDependencies: { jest: "^29.0.0" },
      });
      writeFile(tmp, "src/index.js", 'export function hello() {}\n');

      const CMD = join(process.cwd(), "src/senti.js");
      const result = execFileSync("node", [CMD, "docs", "scan", "--stdout"], {
        encoding: "utf8",
        env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
      });
      const analysis = JSON.parse(result);

      const pkgEntry = analysis.package?.entries?.find(e => e.packageScripts);
      assert.ok(pkgEntry?.packageScripts, "packageScripts should be in analysis.package.entries[]");
      assert.equal(pkgEntry.packageScripts.test, "node --test");
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("packageScripts is absent when package.json has no scripts", async () => {
    const { execFileSync } = await import("child_process");
    const { join } = await import("path");
    const { createTmpDir, removeTmpDir, writeJson, writeFile } = await import("../../../helpers/tmp-dir.js");

    const tmp = createTmpDir();
    try {
      writeJson(tmp, ".senti/config.json", {
        lang: "en",
        type: "base",
        docs: { languages: ["en"], defaultLanguage: "en" },
        scan: { include: ["src/**/*.js"], exclude: [] },
      });
      writeJson(tmp, "package.json", {
        name: "test-project",
      });
      writeFile(tmp, "src/index.js", 'export function hello() {}\n');

      const CMD = join(process.cwd(), "src/senti.js");
      const result = execFileSync("node", [CMD, "docs", "scan", "--stdout"], {
        encoding: "utf8",
        env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
      });
      const analysis = JSON.parse(result);

      // packageScripts should not exist in any entry or be empty
      const pkgEntry = analysis.package?.entries?.find(e => e.packageScripts);
      assert.ok(!pkgEntry?.packageScripts || Object.keys(pkgEntry.packageScripts).length === 0);
    } finally {
      removeTmpDir(tmp);
    }
  });
});

describe("test environment detection", () => {
  it("detects test environment from devDependencies", async () => {
    const { detectTestEnvironment } = await import("../../../../src/docs/lib/test-env-detection.js");

    const analysis = {
      package: {
        entries: [{
          packageDeps: {
            dependencies: {},
            devDependencies: { jest: "^29.0.0" },
          },
          packageScripts: { test: "jest" },
        }],
      },
    };

    const result = detectTestEnvironment(analysis);
    assert.equal(result.hasTestEnv, true);
    assert.ok(result.frameworks.includes("jest"));
    assert.equal(result.testCommand, "npm test --");
  });

  it("detects no test environment when no frameworks or scripts", async () => {
    const { detectTestEnvironment } = await import("../../../../src/docs/lib/test-env-detection.js");

    const analysis = {
      package: {
        entries: [{
          packageDeps: {
            dependencies: {},
            devDependencies: {},
          },
        }],
      },
    };

    const result = detectTestEnvironment(analysis);
    assert.equal(result.hasTestEnv, false);
    assert.equal(result.frameworks.length, 0);
  });
});
