import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { checkExpectedTests } from "../../../src/flow/lib/run-gate.js";

function mkRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "gate-expected-tests-"));
}

// ---------------------------------------------------------------------------
// REQ-4: skip when expected_tests is undefined / null / empty
// ---------------------------------------------------------------------------

describe("checkExpectedTests — REQ-4: skip when empty/undefined", () => {
  it("returns empty issues when expected_tests is undefined", async () => {
    const root = mkRoot();
    const { issues } = await checkExpectedTests(root, undefined);
    assert.deepEqual(issues, []);
  });

  it("returns empty issues when expected_tests is null", async () => {
    const root = mkRoot();
    const { issues } = await checkExpectedTests(root, null);
    assert.deepEqual(issues, []);
  });

  it("returns empty issues when expected_tests is empty array", async () => {
    const root = mkRoot();
    const { issues } = await checkExpectedTests(root, []);
    assert.deepEqual(issues, []);
  });
});

// ---------------------------------------------------------------------------
// REQ-2 / REQ-3: verify file existence, FAIL with path on missing
// ---------------------------------------------------------------------------

describe("checkExpectedTests — REQ-2/REQ-3: file existence", () => {
  it("returns empty issues when all declared files exist", async () => {
    const root = mkRoot();
    const testFile = "tests/foo.test.js";
    fs.mkdirSync(path.join(root, "tests"), { recursive: true });
    fs.writeFileSync(path.join(root, testFile), "// test");
    const { issues } = await checkExpectedTests(root, [testFile]);
    assert.deepEqual(issues, []);
  });

  it("returns FAIL with path when a declared file does not exist", async () => {
    const root = mkRoot();
    const { issues } = await checkExpectedTests(root, ["tests/missing.test.js"]);
    assert.equal(issues.length, 1);
    assert.match(issues[0], /tests\/missing\.test\.js/);
  });

  it("reports each missing file separately", async () => {
    const root = mkRoot();
    const { issues } = await checkExpectedTests(root, [
      "tests/a.test.js",
      "tests/b.test.js",
    ]);
    assert.equal(issues.length, 2);
    assert.match(issues[0], /a\.test\.js/);
    assert.match(issues[1], /b\.test\.js/);
  });

  it("passes existing files and fails only missing ones", async () => {
    const root = mkRoot();
    fs.mkdirSync(path.join(root, "tests"), { recursive: true });
    fs.writeFileSync(path.join(root, "tests/exists.test.js"), "// test");
    const { issues } = await checkExpectedTests(root, [
      "tests/exists.test.js",
      "tests/missing.test.js",
    ]);
    assert.equal(issues.length, 1);
    assert.match(issues[0], /missing\.test\.js/);
  });
});

// ---------------------------------------------------------------------------
// REQ-5: glob pattern expansion
// ---------------------------------------------------------------------------

describe("checkExpectedTests — REQ-5: glob patterns", () => {
  it("passes when glob matches at least one file", async () => {
    const root = mkRoot();
    fs.mkdirSync(path.join(root, "tests", "unit"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "tests", "unit", "foo.test.js"),
      "// test",
    );
    const { issues } = await checkExpectedTests(root, ["tests/unit/*.test.js"]);
    assert.deepEqual(issues, []);
  });

  it("fails when glob matches zero files", async () => {
    const root = mkRoot();
    fs.mkdirSync(path.join(root, "tests"), { recursive: true });
    const { issues } = await checkExpectedTests(root, ["tests/unit/*.test.js"]);
    assert.equal(issues.length, 1);
    assert.match(issues[0], /tests\/unit\/\*\.test\.js/);
  });

  it("supports ** glob for recursive matching", async () => {
    const root = mkRoot();
    fs.mkdirSync(path.join(root, "tests", "deep", "nested"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(root, "tests", "deep", "nested", "bar.test.js"),
      "// test",
    );
    const { issues } = await checkExpectedTests(root, ["tests/**/*.test.js"]);
    assert.deepEqual(issues, []);
  });
});

// ---------------------------------------------------------------------------
// REQ-6: pure mechanical check (async, no AI)
// ---------------------------------------------------------------------------

describe("checkExpectedTests — REQ-6: mechanical check", () => {
  it("returns a promise that resolves to an object with issues array", async () => {
    const root = mkRoot();
    const result = checkExpectedTests(root, ["nonexistent.js"]);
    assert.ok(result instanceof Promise);
    const resolved = await result;
    assert.equal(typeof resolved, "object");
    assert.ok(Array.isArray(resolved.issues));
  });
});

// ---------------------------------------------------------------------------
// REQ-8: bounded resource usage
// ---------------------------------------------------------------------------

describe("checkExpectedTests — REQ-8: bounds", () => {
  it("throws when expected_tests exceeds 50 entries", async () => {
    const root = mkRoot();
    const entries = Array.from({ length: 51 }, (_, i) => `tests/t${i}.test.js`);
    await assert.rejects(
      () => checkExpectedTests(root, entries),
      /exceed/i,
    );
  });
});
