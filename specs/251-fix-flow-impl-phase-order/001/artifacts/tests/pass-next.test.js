// spec: R7 R8
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

function readSrc(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

describe("spec 251: PASS_NEXT and impl review next-hint", () => {
  it("R8: run-gate.js PASS_NEXT['integration'] is 'finalize-commit'", () => {
    const src = readSrc("src/flow/lib/run-gate.js");
    const passNextMatch = src.match(/const\s+PASS_NEXT\s*=\s*\{([\s\S]*?)\};/);
    assert.ok(passNextMatch, "PASS_NEXT object exists");
    const body = passNextMatch[1];
    assert.match(body, /"integration"\s*:\s*"finalize-commit"/, "integration → finalize-commit");
  });

  it("R8: run-gate.js PASS_NEXT['task-impl'] is null", () => {
    const src = readSrc("src/flow/lib/run-gate.js");
    const passNextMatch = src.match(/const\s+PASS_NEXT\s*=\s*\{([\s\S]*?)\};/);
    assert.ok(passNextMatch, "PASS_NEXT object exists");
    const body = passNextMatch[1];
    assert.match(body, /"task-impl"\s*:\s*null/, "task-impl → null");
  });

  it("R7: run-review.js impl review clean path returns next='gate-impl'", () => {
    const src = readSrc("src/flow/lib/run-review.js");
    assert.match(
      src,
      /noChanges\s*\|\|\s*noProposals\s*\|\|\s*proposalCount\s*===\s*0\s*\?\s*"gate-impl"\s*:\s*"apply"/,
      "impl review clean → next='gate-impl'",
    );
    assert.doesNotMatch(
      src,
      /noChanges\s*\|\|\s*noProposals\s*\|\|\s*proposalCount\s*===\s*0\s*\?\s*"finalize"/,
      "no longer routes clean impl review to 'finalize'",
    );
  });
});
