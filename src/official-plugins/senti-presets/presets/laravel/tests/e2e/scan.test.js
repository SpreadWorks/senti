import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const presetPath = path.resolve(__dirname, "../../preset.json");

describe("Laravel preset.json scan config", () => {
  const preset = JSON.parse(fs.readFileSync(presetPath, "utf8"));
  const scan = preset.scan;

  it("has include array with PHP source globs", () => {
    assert.ok(Array.isArray(scan.include));
    assert.ok(scan.include.length > 0);
    assert.ok(scan.include.some((g) => g.includes("app/**/*.php")));
  });

  it("includes route files", () => {
    assert.ok(scan.include.some((g) => g.includes("routes")));
  });

  it("includes migration files", () => {
    assert.ok(scan.include.some((g) => g.includes("database/migrations")));
  });

  it("includes composer.json", () => {
    assert.ok(scan.include.includes("composer.json"));
  });

  it("has exclude array", () => {
    assert.ok(Array.isArray(scan.exclude));
  });
});
