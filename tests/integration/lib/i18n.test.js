import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { createI18n, deepMerge } from "../../../src/lib/i18n.js";
import { createTmpDir, removeTmpDir, writeJson } from "../../support/builders/tmp-dir.js";

describe("createI18n", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupLocale(lang, messages) {
    tmp = createTmpDir();
    writeJson(tmp, `${lang}/ui.json`, messages);
    return tmp;
  }

  it("translates a simple key", () => {
    const dir = setupLocale("ja", { greeting: "こんにちは" });
    const t = createI18n("ja", { localeDir: dir });
    assert.equal(t("greeting"), "こんにちは");
  });

  it("translates nested keys", () => {
    const dir = setupLocale("ja", { setup: { title: "セットアップ" } });
    const t = createI18n("ja", { localeDir: dir });
    assert.equal(t("setup.title"), "セットアップ");
  });

  it("interpolates params", () => {
    const dir = setupLocale("ja", { greet: "Hello {{name}}!" });
    const t = createI18n("ja", { localeDir: dir });
    assert.equal(t("greet", { name: "World" }), "Hello World!");
  });

  it("returns key when not found", () => {
    const dir = setupLocale("ja", {});
    const t = createI18n("ja", { localeDir: dir });
    assert.equal(t("missing.key"), "missing.key");
  });

  it("falls back to fallback language", () => {
    tmp = createTmpDir();
    writeJson(tmp, "ja/ui.json", {});
    writeJson(tmp, "en/ui.json", { hello: "Hello" });
    const t = createI18n("ja", { localeDir: tmp, fallbackLang: "en" });
    assert.equal(t("hello"), "Hello");
  });

  it("t.raw returns raw value", () => {
    const dir = setupLocale("ja", { items: ["a", "b"] });
    const t = createI18n("ja", { localeDir: dir });
    assert.deepEqual(t.raw("items"), ["a", "b"]);
  });

  it("t.lang returns language code", () => {
    const dir = setupLocale("ja", {});
    const t = createI18n("ja", { localeDir: dir });
    assert.equal(t.lang, "ja");
  });

  it("preserves unmatched placeholders", () => {
    const dir = setupLocale("ja", { msg: "Hello {{name}} and {{other}}" });
    const t = createI18n("ja", { localeDir: dir });
    assert.equal(t("msg", { name: "A" }), "Hello A and {{other}}");
  });
});

describe("createI18n with localeDirs (multi-directory merge)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("merges messages from multiple directories (later wins)", () => {
    tmp = createTmpDir();
    const base = join(tmp, "base");
    const override = join(tmp, "override");
    writeJson(base, "ja/ui.json", { a: "base-a", b: "base-b" });
    writeJson(override, "ja/ui.json", { b: "override-b", c: "override-c" });
    const t = createI18n("ja", { localeDirs: [base, override] });
    assert.equal(t("a"), "base-a");
    assert.equal(t("b"), "override-b");
    assert.equal(t("c"), "override-c");
  });

  it("deep merges nested keys", () => {
    tmp = createTmpDir();
    const base = join(tmp, "base");
    const override = join(tmp, "override");
    writeJson(base, "ja/ui.json", { setup: { title: "Base", desc: "BaseDesc" } });
    writeJson(override, "ja/ui.json", { setup: { title: "Override" } });
    const t = createI18n("ja", { localeDirs: [base, override] });
    assert.equal(t("setup.title"), "Override");
    assert.equal(t("setup.desc"), "BaseDesc");
  });

  it("skips missing directories gracefully", () => {
    tmp = createTmpDir();
    const base = join(tmp, "base");
    writeJson(base, "ja/ui.json", { key: "value" });
    const t = createI18n("ja", { localeDirs: [base, join(tmp, "nonexistent")] });
    assert.equal(t("key"), "value");
  });

  it("applies multi-dir merge to fallback language too", () => {
    tmp = createTmpDir();
    const base = join(tmp, "base");
    const override = join(tmp, "override");
    writeJson(base, "ja/ui.json", {});
    writeJson(base, "en/ui.json", { hello: "Hello" });
    writeJson(override, "ja/ui.json", {});
    writeJson(override, "en/ui.json", { hello: "Hi" });
    const t = createI18n("ja", { localeDirs: [base, override], fallbackLang: "en" });
    assert.equal(t("hello"), "Hi");
  });
});

describe("deepMerge", () => {
  it("merges flat objects", () => {
    assert.deepEqual(deepMerge({ a: 1 }, { b: 2 }), { a: 1, b: 2 });
  });

  it("override wins for same key", () => {
    assert.deepEqual(deepMerge({ a: 1 }, { a: 2 }), { a: 2 });
  });

  it("deep merges nested objects", () => {
    const base = { x: { a: 1, b: 2 } };
    const override = { x: { b: 3, c: 4 } };
    assert.deepEqual(deepMerge(base, override), { x: { a: 1, b: 3, c: 4 } });
  });

  it("replaces arrays (no merge)", () => {
    assert.deepEqual(deepMerge({ a: [1, 2] }, { a: [3] }), { a: [3] });
  });

  it("handles null/undefined gracefully", () => {
    assert.deepEqual(deepMerge(null, { a: 1 }), { a: 1 });
    assert.deepEqual(deepMerge({ a: 1 }, null), { a: 1 });
  });
});
