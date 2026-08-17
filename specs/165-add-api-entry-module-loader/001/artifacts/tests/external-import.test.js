/**
 * specs/165-add-api-entry-module-loader/tests/external-import.test.js
 *
 * Spec verification: an external file located outside the package can
 * import classes from 'sdd-forge/api' when running inside a sdd-forge process
 * (i.e., after the module loader hook has been registered).
 *
 * Strategy: spawn a subprocess that registers the loader hook via
 * module.register(), then dynamically imports an external script that does
 * `import { DataSource } from 'sdd-forge/api'`.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const PKG_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const TMP = join(tmpdir(), `sdd-forge-api-test-${Date.now()}`);

describe("external file import of sdd-forge/api via loader hook (spec verification)", () => {
  before(() => mkdirSync(TMP, { recursive: true }));
  after(() => rmSync(TMP, { recursive: true, force: true }));

  it("external file can instantiate DataSource imported from sdd-forge/api", () => {
    // External "preset" file — lives outside the sdd-forge package directory
    const externalFile = join(TMP, "external-preset.mjs");
    writeFileSync(
      externalFile,
      [
        `import { DataSource, Scannable, AnalysisEntry } from 'sdd-forge/api';`,
        `const ds = new DataSource();`,
        `if (!(ds instanceof DataSource)) throw new Error("DataSource failed");`,
        `const Mixed = Scannable(DataSource);`,
        `const m = new Mixed();`,
        `if (typeof m.scan !== "function") throw new Error("Scannable failed");`,
        `const ae = new AnalysisEntry();`,
        `if (!(ae instanceof AnalysisEntry)) throw new Error("AnalysisEntry failed");`,
        `console.log("OK");`,
      ].join("\n"),
    );

    // Runner: registers the loader hook, then imports the external file
    const runnerFile = join(TMP, "run.mjs");
    const loaderPath = join(PKG_ROOT, "src", "loader.js");
    writeFileSync(
      runnerFile,
      [
        `import { register } from "node:module";`,
        `import { pathToFileURL } from "node:url";`,
        `register(pathToFileURL(${JSON.stringify(loaderPath)}).href, import.meta.url);`,
        `await import(pathToFileURL(${JSON.stringify(externalFile)}).href);`,
      ].join("\n"),
    );

    const output = execFileSync("node", [runnerFile], {
      encoding: "utf8",
      cwd: PKG_ROOT,
    });
    assert.match(output, /OK/);
  });
});
