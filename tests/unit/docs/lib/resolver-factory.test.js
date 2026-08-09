import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import fs from "fs";
import { createResolver } from "../../../../src/docs/lib/resolver-factory.js";
import { createTmpDir, removeTmpDir, writeJson } from "../../../helpers/tmp-dir.js";

describe("createResolver", () => {
  let tmp;

  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  function setupTmp(name) {
    tmp = createTmpDir(name);
    fs.mkdirSync(path.join(tmp, ".senrail"), { recursive: true });
    return tmp;
  }

  it("returns an object with resolve method", async () => {
    setupTmp("resolver-basic");
    const resolver = await createResolver("sample-node-command", tmp);
    assert.equal(typeof resolver.resolve, "function");
  });

  it("resolves project.name from common data sources", async () => {
    setupTmp("resolver-project");
    writeJson(tmp, "package.json", { name: "test-pkg", version: "1.0.0" });
    const resolver = await createResolver("sample-node-command", tmp);
    const result = resolver.resolve("sample-node-command", "project", "name", {}, [""]);
    assert.equal(result.toMarkdown(), "test-pkg");
  });

  it("resolves project.version", async () => {
    setupTmp("resolver-version");
    writeJson(tmp, "package.json", { name: "pkg", version: "2.5.0" });
    const resolver = await createResolver("sample-node-command", tmp);
    const result = resolver.resolve("sample-node-command", "project", "version", {}, [""]);
    assert.equal(result.toMarkdown(), "2.5.0");
  });

  it("returns null for unknown preset", async () => {
    setupTmp("resolver-unknown-preset");
    const resolver = await createResolver("sample-node-command", tmp);
    const result = resolver.resolve("nonexistent", "project", "name", {}, []);
    assert.equal(result, null);
  });

  it("returns null for unknown source.method", async () => {
    setupTmp("resolver-unknown");
    const resolver = await createResolver("sample-node-command", tmp);
    const result = resolver.resolve("sample-node-command", "nonexistent", "method", {}, []);
    assert.equal(result, null);
  });

  it("returns null for known source but unknown method", async () => {
    setupTmp("resolver-badmethod");
    writeJson(tmp, "package.json", { name: "pkg", version: "1.0.0" });
    const resolver = await createResolver("sample-node-command", tmp);
    const result = resolver.resolve("sample-node-command", "project", "nonExistentMethod", {}, []);
    assert.equal(result, null);
  });

  it("propagates errors thrown by DataSource methods", async () => {
    setupTmp("resolver-error");
    const resolver = await createResolver("sample-node-command", tmp);
    assert.throws(
      () => resolver.resolve("sample-node-command", "skills", "rule", {}, [], {}),
      /missing skill rule id/,
    );
  });

  it("loads overrides.json when present", async () => {
    setupTmp("resolver-overrides");
    writeJson(tmp, ".senrail/overrides.json", {
      project: { summary: "Custom override" },
    });
    writeJson(tmp, "package.json", { name: "test-pkg", version: "1.0.0" });
    const resolver = await createResolver("sample-node-command", tmp);
    // Verify resolver still resolves normally with overrides loaded
    assert.equal(resolver.resolve("sample-node-command", "project", "name", {}, [""]).toMarkdown(), "test-pkg");
  });

  it("works without overrides.json", async () => {
    setupTmp("resolver-no-overrides");
    writeJson(tmp, "package.json", { name: "pkg", version: "1.0.0" });
    const resolver = await createResolver("sample-node-command", tmp);
    const result = resolver.resolve("sample-node-command", "project", "name", {}, [""]);
    assert.equal(result.toMarkdown(), "pkg");
  });

  it("accepts docsDir option and resolves data", async () => {
    setupTmp("resolver-docsdir");
    writeJson(tmp, "package.json", { name: "docsdir-pkg", version: "1.0.0" });
    const docsDir = path.join(tmp, "docs", "ja");
    fs.mkdirSync(docsDir, { recursive: true });
    const resolver = await createResolver("sample-node-command", tmp, { docsDir });
    assert.equal(resolver.resolve("sample-node-command", "project", "name", {}, [""]).toMarkdown(), "docsdir-pkg");
  });

  it("resolves data from parent chain presets", async () => {
    setupTmp("resolver-chain");
    writeJson(tmp, "package.json", { name: "chain-pkg", version: "1.0.0" });
    // sample-node-command resolves through base -> sample-command -> sample-node-command chain
    const resolver = await createResolver("sample-node-command", tmp);
    // project source is from common, should be available through chain
    const name = resolver.resolve("sample-node-command", "project", "name", {}, [""]);
    assert.equal(name.toMarkdown(), "chain-pkg");
  });

  it("works with single-segment type (no parent)", async () => {
    setupTmp("resolver-single");
    writeJson(tmp, "package.json", { name: "single", version: "0.1.0" });
    const resolver = await createResolver("sample-command", tmp);
    const result = resolver.resolve("sample-command", "project", "name", {}, [""]);
    assert.equal(result.toMarkdown(), "single");
  });

  it("works with base type", async () => {
    setupTmp("resolver-base");
    writeJson(tmp, "package.json", { name: "base-pkg", version: "1.0.0" });
    const resolver = await createResolver("base", tmp);
    assert.equal(resolver.resolve("base", "project", "name", {}, [""]).toMarkdown(), "base-pkg");
  });

  it("loads project-specific DataSources from .senrail/data/", async () => {
    setupTmp("resolver-projds");
    writeJson(tmp, "package.json", { name: "projds", version: "1.0.0" });
    // Project data dir exists but is empty — should not break
    fs.mkdirSync(path.join(tmp, ".senrail", "data"), { recursive: true });
    const resolver = await createResolver("sample-node-command", tmp);
    assert.equal(resolver.resolve("sample-node-command", "project", "name", {}, [""]).toMarkdown(), "projds");
  });

  it("accepts configChapters option", async () => {
    setupTmp("resolver-chapters");
    writeJson(tmp, "package.json", { name: "ch-pkg", version: "1.0.0" });
    const resolver = await createResolver("sample-node-command", tmp, {
      configChapters: ["overview", "cli_commands"],
    });
    assert.equal(resolver.resolve("sample-node-command", "project", "name", {}, [""]).toMarkdown(), "ch-pkg");
  });

  it("accepts array of presets and resolves each independently", async () => {
    setupTmp("resolver-multi");
    writeJson(tmp, "package.json", { name: "multi-pkg", version: "1.0.0" });
    const resolver = await createResolver(["sample-node-command", "sample-db"], tmp);
    // Both presets should be resolvable
    assert.equal(resolver.resolve("sample-node-command", "project", "name", {}, [""]).toMarkdown(), "multi-pkg");
    assert.equal(resolver.resolve("sample-db", "project", "name", {}, [""]).toMarkdown(), "multi-pkg");
  });

  it("exposes presetKeys() listing all leaf keys", async () => {
    setupTmp("resolver-keys");
    const resolver = await createResolver(["sample-node-command", "sample-db"], tmp);
    const keys = resolver.presetKeys();
    assert.ok(keys.includes("sample-node-command"));
    assert.ok(keys.includes("sample-db"));
  });
});
