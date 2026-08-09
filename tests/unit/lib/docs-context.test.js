import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { Container } from "../../../src/lib/container.js";
import { resolveDocsContext } from "../../../src/docs/lib/docs-context.js";

function buildContainer({ root = "/repo", config = {}, lang = "ja" } = {}) {
  const c = new Container();
  c.register("config", config);
  c.register("lang", lang);
  c.register("paths", {
    root,
    srcRoot: root,
    managedDir: path.join(root, ".senrail"),
    outputDir: path.join(root, ".senrail/output"),
    agentWorkDir: path.join(root, ".tmp"),
    logDir: path.join(root, ".tmp/logs"),
    configPath: path.join(root, ".senrail/config.json"),
  });
  c.register("agent", { resolve: () => null, call: async () => "" });
  c.register("i18n", () => (k) => k);
  return c;
}

describe("resolveDocsContext", () => {
  it("returns a context object with docs-specific derived values", () => {
    const c = buildContainer({
      config: { type: "sample-command/sample-node-command", lang: "ja", docs: { defaultLanguage: "en" } },
    });
    const ctx = resolveDocsContext(c, {});
    assert.equal(ctx.type, "sample-command/sample-node-command");
    assert.equal(ctx.lang, "ja");
    assert.equal(ctx.outputLang, "en");
    assert.equal(path.isAbsolute(ctx.docsDir), true);
    assert.equal(ctx.docsDir.endsWith("docs"), true);
    assert.ok(typeof ctx.t === "function");
    assert.ok(ctx.config);
  });

  it("applies cli.lang override when provided", () => {
    const c = buildContainer({ config: { lang: "ja" } });
    const ctx = resolveDocsContext(c, { lang: "en" });
    assert.equal(ctx.lang, "en");
  });

  it("falls back to root/docs when no cli.docsDir", () => {
    const c = buildContainer({ root: "/repo" });
    const ctx = resolveDocsContext(c, {});
    assert.equal(ctx.docsDir, path.join("/repo", "docs"));
  });

  it("returns defaults when config is empty", () => {
    const c = buildContainer({ config: {} });
    const ctx = resolveDocsContext(c, null);
    assert.equal(ctx.lang, "en");
    assert.equal(ctx.type, "");
    assert.deepEqual(ctx.config, {});
  });

  it("overrides argument takes highest priority over config and cli", () => {
    const c = buildContainer({ config: { lang: "ja" } });
    const ctx = resolveDocsContext(c, { lang: "en" }, { lang: "fr" });
    assert.equal(ctx.lang, "fr");
  });

  it("exposes commandId when passed via overrides", () => {
    const c = buildContainer({ config: { lang: "ja" } });
    const ctx = resolveDocsContext(c, null, { commandId: "docs.enrich" });
    assert.equal(ctx.commandId, "docs.enrich");
  });
});
