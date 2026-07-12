// spec: R5
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const targetsModule = new URL("../../../tests/acceptance/lib/targets.js", import.meta.url);
const reportTestPath = resolve(import.meta.dirname, "..", "..", "..", "tests", "agent", "report.test.js");

test("R5: the real agent report test imports acceptance helpers and resolves the base fixture", async () => {
  let module;
  try {
    module = await import(targetsModule);
  } catch {
    module = null;
  }
  assert.ok(module?.getAcceptanceFixtureDir, "acceptance target helpers must remain importable without credentials");
  const fixture = module.getAcceptanceFixtureDir("base");
  assert.match(fixture, /src[/\\]presets[/\\]base[/\\]tests[/\\]acceptance[/\\]fixtures$/);
  const reportSource = readFileSync(reportTestPath, "utf8");
  assert.match(reportSource, /from\s+["']\.\.\/acceptance\/lib\/.*["']/);
  assert.match(reportSource, /getAcceptanceFixtureDir\(["']base["']\)/);
  assert.doesNotMatch(reportSource, /getAcceptanceFixtureDir\(["']node["']\)/);
  const scripts = JSON.parse(readFileSync(resolve(import.meta.dirname, "..", "..", "..", "package.json"), "utf8")).scripts;
  assert.equal(scripts["test:agent"], "node tests/run.js --agent");
  assert.equal(scripts["test:ci"], "node tests/ci.js");
});
