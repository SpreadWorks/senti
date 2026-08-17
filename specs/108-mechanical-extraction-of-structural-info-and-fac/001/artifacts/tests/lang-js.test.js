import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";

const factoryPath = join(process.cwd(), "src/docs/lib/lang-factory.js");

describe("JS language handler", () => {
  it("extractImports extracts ESM imports", async () => {
    const { getLangHandler } = await import(factoryPath);
    const handler = getLangHandler("test.js");
    const code = [
      'import fs from "fs";',
      'import { foo } from "./lib/bar.js";',
      'import path from "path";',
      'import { a, b } from "../utils.js";',
    ].join("\n");
    const imports = handler.extractImports(code);
    assert.ok(imports.includes("fs"));
    assert.ok(imports.includes("./lib/bar.js"));
    assert.ok(imports.includes("path"));
    assert.ok(imports.includes("../utils.js"));
  });

  it("extractImports extracts require calls", async () => {
    const { getLangHandler } = await import(factoryPath);
    const handler = getLangHandler("test.js");
    const code = [
      'const fs = require("fs");',
      'const bar = require("./bar");',
    ].join("\n");
    const imports = handler.extractImports(code);
    assert.ok(imports.includes("fs"));
    assert.ok(imports.includes("./bar"));
  });

  it("extractExports extracts named exports", async () => {
    const { getLangHandler } = await import(factoryPath);
    const handler = getLangHandler("test.js");
    const code = [
      "export function main() {}",
      "export async function init() {}",
      "export class Foo {}",
      "export { bar, baz };",
    ].join("\n");
    const exports = handler.extractExports(code);
    assert.ok(exports.includes("main"));
    assert.ok(exports.includes("init"));
    assert.ok(exports.includes("Foo"));
    assert.ok(exports.includes("bar"));
    assert.ok(exports.includes("baz"));
  });

  it("extractExports extracts default export", async () => {
    const { getLangHandler } = await import(factoryPath);
    const handler = getLangHandler("test.js");
    const code = "export default class MyClass {}";
    const exports = handler.extractExports(code);
    assert.ok(exports.includes("default"));
  });
});
