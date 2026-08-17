/**
 * Integration tests for project-local preset support (spec 165).
 *
 * Tests verify:
 * 1. DataSources in .sdd-forge/presets/<name>/data/ are loaded by createResolver()
 * 2. .sdd-forge/data/ DataSources are NOT loaded (deprecated)
 * 3. .sdd-forge/data/ presence emits a deprecation warning to stderr
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createResolver } from "../../../src/docs/lib/resolver-factory.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../../tests/helpers/tmp-dir.js";

// Minimal DataSource (no inheritance needed — loadDataSources just calls new Source())
const TEST_SOURCE_CONTENT = `
export default class TestProjectSource {
  init(ctx) {}
  projectData(analysis) { return "project-local-loaded"; }
}
`;

describe("project-local DataSource loading via createResolver", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("loads DataSource from .sdd-forge/presets/<name>/data/", async () => {
    tmp = createTmpDir();
    writeFile(tmp, ".sdd-forge/presets/base/data/test-project.js", TEST_SOURCE_CONTENT);

    const resolver = await createResolver("base", tmp, {});
    const result = resolver.resolve("base", "test-project", "projectData", {}, []);
    assert.equal(result, "project-local-loaded",
      "DataSource from .sdd-forge/presets/base/data/ should be resolved");
  });
});

describe(".sdd-forge/data/ deprecation", () => {
  let tmp;
  let originalWrite;
  let stderrCapture;

  afterEach(() => {
    if (originalWrite) {
      process.stderr.write = originalWrite;
      originalWrite = null;
    }
    if (tmp) {
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("does NOT load DataSources from .sdd-forge/data/", async () => {
    tmp = createTmpDir();
    writeFile(tmp, ".sdd-forge/data/deprecated-source.js", TEST_SOURCE_CONTENT);

    const resolver = await createResolver("base", tmp, {});
    const result = resolver.resolve("base", "deprecated-source", "projectData", {}, []);
    assert.equal(result, null,
      ".sdd-forge/data/ DataSources should NOT be loaded after deprecation");
  });

  it("emits a deprecation warning to stderr when .sdd-forge/data/ exists", async () => {
    tmp = createTmpDir();
    fs.mkdirSync(path.join(tmp, ".sdd-forge", "data"), { recursive: true });

    stderrCapture = "";
    originalWrite = process.stderr.write.bind(process.stderr);
    process.stderr.write = (chunk, ...args) => {
      stderrCapture += chunk.toString();
      return true;
    };

    await createResolver("base", tmp, {});

    process.stderr.write = originalWrite;
    originalWrite = null;

    assert.ok(
      stderrCapture.includes("[sdd-forge]") && stderrCapture.includes("data"),
      `Expected deprecation warning in stderr, got: ${stderrCapture}`,
    );
  });
});
