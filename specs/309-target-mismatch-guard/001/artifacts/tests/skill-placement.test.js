// spec: R6 R7
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function read(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), "utf8");
}

describe("senti.flow target guard guidance", () => {
  it("R6: source skill guidance requires explicit target status guards for issue, spec, and runId", () => {
    const source = read("src/skills/senti.flow/SKILL.md");
    const entryIndex = source.indexOf("### A. Entry");
    const dispatcherIndex = source.indexOf("### C. Dispatcher loop");
    const entryBlock = source.slice(entryIndex, dispatcherIndex);

    assert.notEqual(entryIndex, -1);
    assert.notEqual(dispatcherIndex, -1);
    assert.match(entryBlock, /explicit target[\s\S]*Issue[\s\S]*senti flow get status[\s\S]*--expect-issue/);
    assert.match(entryBlock, /explicit target[\s\S]*spec[\s\S]*senti flow get status[\s\S]*--expect-spec/);
    assert.match(entryBlock, /explicit target[\s\S]*runId[\s\S]*senti flow get status[\s\S]*--expect-run-id/);
    assert.match(entryBlock, /ACTIVE_FLOW_MISMATCH[\s\S]*stop/i);
  });

  it("R7: target mismatch guidance appears before dispatcher and blocks next-action, repair, run, finalize, and cleanup", () => {
    const source = read("src/skills/senti.flow/SKILL.md");
    const entryIndex = source.indexOf("### A. Entry");
    const guardIndex = source.indexOf("ACTIVE_FLOW_MISMATCH", entryIndex);
    const dispatcherIndex = source.indexOf("### C. Dispatcher loop");
    const guardBlock = source.slice(Math.max(0, guardIndex - 1000), guardIndex + 2000);

    assert.notEqual(entryIndex, -1);
    assert.notEqual(guardIndex, -1);
    assert.notEqual(dispatcherIndex, -1);
    assert.ok(entryIndex < guardIndex && guardIndex < dispatcherIndex);
    assert.match(guardBlock, /next-action/);
    assert.match(guardBlock, /repair/);
    assert.match(guardBlock, /run/);
    assert.match(guardBlock, /finalize/);
    assert.match(guardBlock, /cleanup/);
  });
});
