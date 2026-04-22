import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../../helpers/tmp-dir.js";

/**
 * DocsSource.langSwitcher() tests.
 *
 * These tests create a minimal project structure and invoke the DataSource
 * directly via the resolver factory.
 */

/** Helper: create a minimal project with given output config */
function setupProject(tmp, docsConfig, repoUrl) {
  const config = {
    lang: docsConfig.defaultLanguage,
    type: "node-cli",
    docs: docsConfig,
    scan: { include: ["src/**/*.js"], exclude: [] },
  };
  writeJson(tmp, ".sdd-forge/config.json", config);

  const pkg = { name: "test-project", version: "1.0.0" };
  if (repoUrl) {
    pkg.repository = { type: "git", url: `git+${repoUrl}.git` };
  }
  writeJson(tmp, "package.json", pkg);

  // Create minimal docs
  fs.mkdirSync(path.join(tmp, "docs"), { recursive: true });
  writeFile(tmp, "docs/overview.md", "# Overview\n\nHello\n");
}

describe("docs.langSwitcher", () => {
  let tmp;

  beforeEach(() => {
    tmp = createTmpDir();
  });

  it("returns null when single language is configured", async () => {
    setupProject(tmp, { languages: ["en"], defaultLanguage: "en" });

    const { createResolver } = await import("../../../../src/docs/lib/resolver-factory.js");
    const resolver = await createResolver("node-cli", tmp, {});
    const result = resolver.resolve("node-cli", "docs", "langSwitcher", {}, ["relative", "docs/overview.md"]);

    assert.equal(result, null);
    removeTmpDir(tmp);
  });

  it("returns lang switcher with bold current lang and linked other lang (relative)", async () => {
    setupProject(tmp, { languages: ["en", "ja"], defaultLanguage: "en" });

    const { createResolver } = await import("../../../../src/docs/lib/resolver-factory.js");
    const resolver = await createResolver("node-cli", tmp, {});
    const result = resolver.resolve("node-cli", "docs", "langSwitcher", {}, ["relative", "docs/overview.md"]);

    assert.ok(result, "should return a non-null string");
    // Current lang (en) should be bold
    assert.ok(result.toMarkdown().includes("**English**"), `should contain bold English, got: ${result}`);
    // Other lang (ja) should be a link
    assert.ok(result.toMarkdown().includes("[日本語]"), `should contain link to Japanese, got: ${result}`);
    // Relative path from docs/overview.md to docs/ja/overview.md
    assert.ok(result.toMarkdown().includes("ja/overview.md"), `should contain relative path, got: ${result}`);
    removeTmpDir(tmp);
  });

  it("computes correct relative path from non-default lang to default", async () => {
    setupProject(tmp, { languages: ["en", "ja"], defaultLanguage: "en" });

    const { createResolver } = await import("../../../../src/docs/lib/resolver-factory.js");
    const resolver = await createResolver("node-cli", tmp, {});
    // File is in docs/ja/ (non-default lang)
    const result = resolver.resolve("node-cli", "docs", "langSwitcher", {}, ["relative", "docs/ja/overview.md"]);

    assert.ok(result, "should return a non-null string");
    // Current lang (ja) should be bold
    assert.ok(result.toMarkdown().includes("**日本語**"), `should contain bold Japanese, got: ${result}`);
    // Other lang (en) should link to parent dir
    assert.ok(result.toMarkdown().includes("../overview.md"), `should contain ../ relative path, got: ${result}`);
    removeTmpDir(tmp);
  });

  it("computes correct relative path for README at root", async () => {
    setupProject(tmp, { languages: ["en", "ja"], defaultLanguage: "en" });

    const { createResolver } = await import("../../../../src/docs/lib/resolver-factory.js");
    const resolver = await createResolver("node-cli", tmp, {});
    const result = resolver.resolve("node-cli", "docs", "langSwitcher", {}, ["relative", "README.md"]);

    assert.ok(result, "should return a non-null string");
    assert.ok(result.toMarkdown().includes("**English**"), `should contain bold English, got: ${result}`);
    // From README.md to docs/ja/README.md
    assert.ok(result.toMarkdown().includes("docs/ja/README.md"), `should contain docs/ja/README.md, got: ${result}`);
    removeTmpDir(tmp);
  });

  it("computes correct relative path for non-default lang README", async () => {
    setupProject(tmp, { languages: ["en", "ja"], defaultLanguage: "en" });

    const { createResolver } = await import("../../../../src/docs/lib/resolver-factory.js");
    const resolver = await createResolver("node-cli", tmp, {});
    const result = resolver.resolve("node-cli", "docs", "langSwitcher", {}, ["relative", "docs/ja/README.md"]);

    assert.ok(result, "should return a non-null string");
    assert.ok(result.toMarkdown().includes("**日本語**"), `should contain bold Japanese, got: ${result}`);
    // From docs/ja/README.md to ../../README.md
    assert.ok(result.toMarkdown().includes("../../README.md"), `should contain ../../README.md, got: ${result}`);
    removeTmpDir(tmp);
  });

  it("generates absolute URLs when mode is 'absolute'", async () => {
    const repoUrl = "https://github.com/TestOrg/test-project";
    setupProject(tmp, { languages: ["en", "ja"], defaultLanguage: "en" }, repoUrl);

    const { createResolver } = await import("../../../../src/docs/lib/resolver-factory.js");
    const resolver = await createResolver("node-cli", tmp, {});
    const result = resolver.resolve("node-cli", "docs", "langSwitcher", {}, ["absolute", "README.md"]);

    assert.ok(result, "should return a non-null string");
    assert.ok(result.toMarkdown().includes("**English**"), `should contain bold English, got: ${result}`);
    // Absolute URL to ja README
    assert.ok(
      result.toMarkdown().includes("https://github.com/TestOrg/test-project/blob/main/docs/ja/README.md"),
      `should contain absolute GitHub URL, got: ${result}`,
    );
    removeTmpDir(tmp);
  });

  it("generates absolute URLs for docs chapter files", async () => {
    const repoUrl = "https://github.com/TestOrg/test-project";
    setupProject(tmp, { languages: ["en", "ja"], defaultLanguage: "en" }, repoUrl);

    const { createResolver } = await import("../../../../src/docs/lib/resolver-factory.js");
    const resolver = await createResolver("node-cli", tmp, {});
    const result = resolver.resolve("node-cli", "docs", "langSwitcher", {}, ["absolute", "docs/overview.md"]);

    assert.ok(result, "should return a non-null string");
    assert.ok(
      result.toMarkdown().includes("https://github.com/TestOrg/test-project/blob/main/docs/ja/overview.md"),
      `should contain absolute URL to ja chapter, got: ${result}`,
    );
    removeTmpDir(tmp);
  });
});
