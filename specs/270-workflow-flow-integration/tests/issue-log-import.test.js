// spec: R3 R7
import { test } from "node:test";
import assert from "node:assert/strict";

const MOD = "../../../src/workflow/lib/commands/issue-log-import.js";

async function tryLoad() {
  try {
    return await import(MOD);
  } catch {
    return null;
  }
}

test("R3: buildCandidates yields one candidate per entry when under the 200 cap (no board writes)", async () => {
  const mod = await tryLoad();
  assert.ok(mod, "issue-log-import.js should exist and load");
  assert.equal(typeof mod.buildCandidates, "function");
  const entries = [{ reason: "a" }, { reason: "b" }, { reason: "c" }];
  const r = mod.buildCandidates(entries, { max: 200 });
  assert.equal(r.candidates.length, 3);
  assert.equal(r.omitted, 0);
});

test("R3: buildCandidates caps candidates at 200 and reports the omitted count", async () => {
  const mod = await tryLoad();
  assert.ok(mod, "issue-log-import.js should exist and load");
  assert.equal(typeof mod.buildCandidates, "function");
  const entries = Array.from({ length: 250 }, (_, i) => ({ reason: "e" + i }));
  const r = mod.buildCandidates(entries, { max: 200 });
  assert.equal(r.candidates.length, 200);
  assert.equal(r.omitted, 50);
});

test("R3: validateSpecPath throws for a non-existent spec path", async () => {
  const mod = await tryLoad();
  assert.ok(mod, "issue-log-import.js should exist and load");
  assert.equal(typeof mod.validateSpecPath, "function");
  assert.throws(() => mod.validateSpecPath("/no/such/spec/path-xyz-270"));
});

test("R7: issue-log-import declares the three workflow.issue-log-import.* commandIds", async () => {
  const mod = await tryLoad();
  assert.ok(mod, "issue-log-import.js should exist and load");
  assert.ok(Array.isArray(mod.ISSUE_LOG_IMPORT_COMMAND_IDS));
  assert.deepEqual(
    [...mod.ISSUE_LOG_IMPORT_COMMAND_IDS].sort(),
    [
      "workflow.issue-log-import.classify",
      "workflow.issue-log-import.compose",
      "workflow.issue-log-import.similarity",
    ],
  );
});
