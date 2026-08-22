import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DocumentationSourceSelection,
  isDocumentationScannerExcludedPath,
} from "../../../../src/docs/lib/source-selection.js";
import { resolveDocumentationScanPatterns } from "../../../../src/docs/lib/scan-patterns.js";
import { DocumentationBuildInputSelection } from "../../../../src/check/lib/documentation-build-input-selection.js";
import { createTmpDir, removeTmpDir, writeJson } from "../../../support/builders/tmp-dir.js";

describe("documentation source selection", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("shares scanner exclusions for nested generated dependency directories", () => {
    assert.equal(isDocumentationScannerExcludedPath(".git/objects/pack"), true);
    assert.equal(isDocumentationScannerExcludedPath("src/node_modules/example/index.js"), true);
    assert.equal(isDocumentationScannerExcludedPath("vendor/package/file.php"), true);
    assert.equal(isDocumentationScannerExcludedPath("src/vendor-notes.js"), false);
  });

  it("uses configured scan patterns as the documentation source authority", () => {
    const patterns = resolveDocumentationScanPatterns({
      config: { scan: { include: ["src/**/*.js", "package.json"], exclude: ["src/**/*.test.js"] } },
      type: "base",
      root: process.cwd(),
    });
    const selection = new DocumentationSourceSelection(patterns);

    assert.equal(selection.matchesFile("src/app.js"), true);
    assert.equal(selection.matchesFile("src/app.test.js"), false);
    assert.equal(selection.matchesFile("specs/flow/001/steps/result.js"), false);
    assert.equal(selection.shouldEnterDirectory("src"), true);
    assert.equal(selection.shouldEnterDirectory("specs"), false);
  });

  it("derives scan patterns from the same plugin preset metadata as docs scan", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sennel/config.json", {
      lang: "en",
      type: "example",
      docs: { languages: ["en"], defaultLanguage: "en" },
      plugin: { packages: [{ id: "example-plugin" }] },
    });
    writeJson(tmp, ".sennel/plugins/example-plugin/plugin.json", {
      name: "example-plugin",
      files: ["plugin.json", "presets/"],
      contributions: { presets: [{ key: "example", path: "presets/example" }] },
    });
    writeJson(tmp, ".sennel/plugins/example-plugin/presets/example/preset.json", {
      parent: "base",
      label: "Example",
      scan: { include: ["app/**/*.mjs"], exclude: ["app/generated/**"] },
    });

    assert.deepEqual(resolveDocumentationScanPatterns({
      config: { type: "example" },
      type: "example",
      root: tmp,
    }), {
      include: ["app/**/*.mjs"],
      exclude: ["app/generated/**"],
    });
  });

  it("includes every non-scan input consumed by docs build and excludes runtime output", () => {
    const selection = new DocumentationBuildInputSelection({
      scanSelection: new DocumentationSourceSelection({ include: ["src/**/*.js"] }),
    });

    for (const file of [
      "src/index.js",
      "package.json",
      ".sennel/config.json",
      ".sennel/config.local.json",
      ".sennel/overrides.json",
      ".sennel/templates/en/docs/overview.md",
      ".sennel/presets/example/data/modules.js",
    ]) {
      assert.equal(selection.matchesConservativeFile(file), true, file);
    }
    assert.equal(selection.matchesConservativeFile(".sennel/output/analysis.json"), false);
    assert.equal(selection.matchesConservativeFile("specs/example/001/steps/result.json"), false);
    assert.equal(selection.shouldEnterConservativeDirectory("specs"), false);
    assert.equal(selection.shouldEnterConservativeDirectory(".sennel/templates"), true);
    assert.equal(selection.matchesExplicitOrManagedFile("specs/example/001/steps/result.json"), false);
  });

  it("uses repository-relative Flow roots while preserving nested source roots", () => {
    const selection = new DocumentationBuildInputSelection({
      scanSelection: new DocumentationSourceSelection({ include: ["flow-state/**/*.js"] }),
      flowSpecRoot: "apps/api/flow-state",
      sourceRootRelativePath: "apps/api",
    });

    assert.equal(selection.shouldEnterConservativeDirectory("flow-state"), false);
    assert.equal(selection.matchesConservativeFile("flow-state/001/steps/result.js"), false);
    assert.equal(selection.shouldEnterExplicitOrManagedDirectory("flow-state"), true);
    assert.equal(selection.matchesExplicitOrManagedFile("flow-state/001/steps/result.js"), true);
    assert.deepEqual(selection.conservativeGitPathspec(), [
      ".",
      ":(exclude,literal)flow-state",
    ]);

    const flowOwnedSource = new DocumentationBuildInputSelection({
      scanSelection: new DocumentationSourceSelection({ include: ["**/*.js"] }),
      flowSpecRoot: "specs",
      sourceRootRelativePath: "specs/flow",
    });
    assert.deepEqual(flowOwnedSource.conservativeGitPathspec(), []);

    const specialCharacterRoot = new DocumentationBuildInputSelection({
      scanSelection: new DocumentationSourceSelection({ include: ["src/**/*.js"] }),
      flowSpecRoot: "flow[records]",
    });
    assert.deepEqual(
      specialCharacterRoot.conservativeGitPathspec(),
      [".", ":(exclude,literal)flow[records]", ":(exclude,literal).sennel"],
    );

    const externalSource = new DocumentationBuildInputSelection({
      scanSelection: new DocumentationSourceSelection({ include: ["src/**/*.js"] }),
      flowSpecRoot: null,
      managedRoot: null,
    });
    assert.equal(externalSource.matchesExplicitOrManagedFile(".sennel/plugins/example.js"), false);
    assert.equal(externalSource.shouldEnterExplicitOrManagedDirectory(".sennel/plugins"), false);
  });
});
