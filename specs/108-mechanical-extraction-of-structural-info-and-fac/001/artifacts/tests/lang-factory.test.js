import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";

const factoryPath = join(process.cwd(), "src/docs/lib/lang-factory.js");

describe("lang-factory", () => {
  it("returns JS handler for .js files", async () => {
    const { getLangHandler } = await import(factoryPath);
    const handler = getLangHandler("src/index.js");
    assert.ok(handler);
    assert.equal(typeof handler.parse, "function");
    assert.equal(typeof handler.minify, "function");
    assert.equal(typeof handler.extractImports, "function");
    assert.equal(typeof handler.extractExports, "function");
  });

  it("returns JS handler for .ts files", async () => {
    const { getLangHandler } = await import(factoryPath);
    const handler = getLangHandler("src/app.ts");
    assert.ok(handler);
    assert.equal(typeof handler.extractImports, "function");
  });

  it("returns PHP handler for .php files", async () => {
    const { getLangHandler } = await import(factoryPath);
    const handler = getLangHandler("app/Controller.php");
    assert.ok(handler);
    assert.equal(typeof handler.parse, "function");
    assert.equal(typeof handler.minify, "function");
    assert.equal(typeof handler.extractImports, "function");
    assert.equal(typeof handler.extractExports, "function");
  });

  it("returns handler with minify only for .py files", async () => {
    const { getLangHandler } = await import(factoryPath);
    const handler = getLangHandler("script.py");
    assert.ok(handler);
    assert.equal(typeof handler.minify, "function");
    assert.equal(handler.extractImports, undefined);
  });

  it("returns null for unsupported extensions", async () => {
    const { getLangHandler } = await import(factoryPath);
    const handler = getLangHandler("data.txt");
    assert.equal(handler, null);
  });
});
