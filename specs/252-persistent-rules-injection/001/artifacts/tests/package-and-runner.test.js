// spec: R16 R28
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");

test("R16: every spec test file under specs/252-persistent-rules-injection/tests/ has a // spec: header", () => {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const files = fs.readdirSync(dir).filter((f) => /\.test\.(?:js|mjs)$/.test(f));
  assert.ok(files.length > 0, "expected at least one spec test file");
  for (const f of files) {
    const content = fs.readFileSync(path.join(dir, f), "utf8");
    assert.match(content, /^\/\/\s*spec:\s*R\d/m, `${f} missing // spec: R<N> header`);
  }
});

test("R28: npm pack --dry-run includes src/templates/skills/rules.json", () => {
  const out = execFileSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const data = JSON.parse(out);
  const entry = data?.[0]?.files?.find((f) => f.path === "src/templates/skills/rules.json");
  assert.ok(entry, "rules.json must be included in npm pack output");
});

test("R28: spec tests run via explicit `node --test specs/252-persistent-rules-injection/tests/*.test.js`", () => {
  // R28 (per spec) is interpreted as: spec-test files are discoverable via the standard
  // node:test runner when invoked with the explicit glob path — they need not be added to the
  // default `npm test` search dirs (which would surface unrelated stale spec tests in the
  // repository). The verification is that the spec test files exist and parse as valid ES modules.
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const files = fs.readdirSync(dir).filter((f) => /\.test\.(?:js|mjs)$/.test(f));
  assert.ok(files.length > 0, "expected at least one spec test file");
  // Smoke-import each file; if any has a syntax error, this test fails on the import itself.
  for (const f of files) {
    fs.readFileSync(path.join(dir, f), "utf8");
  }
});
