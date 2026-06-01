// spec: R2
import { test } from "node:test";
import assert from "node:assert/strict";

const MOD = "../../../src/workflow/lib/commands/issue-start.js";

async function tryLoad() {
  try {
    return await import(MOD);
  } catch {
    return null;
  }
}

test("R2: validateIssueNumber accepts positive integers (string or number)", async () => {
  const mod = await tryLoad();
  assert.ok(mod, "issue-start.js should exist and load");
  assert.equal(typeof mod.validateIssueNumber, "function");
  assert.equal(mod.validateIssueNumber("349"), 349);
  assert.equal(mod.validateIssueNumber(349), 349);
});

test("R2: validateIssueNumber rejects non-positive-integer input", async () => {
  const mod = await tryLoad();
  assert.ok(mod, "issue-start.js should exist and load");
  assert.equal(typeof mod.validateIssueNumber, "function");
  assert.throws(() => mod.validateIssueNumber("abc"));
  assert.throws(() => mod.validateIssueNumber("0"));
  assert.throws(() => mod.validateIssueNumber("-3"));
  assert.throws(() => mod.validateIssueNumber("3.5"));
  assert.throws(() => mod.validateIssueNumber(""));
});
