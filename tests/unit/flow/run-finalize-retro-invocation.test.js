// spec: R6
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { executeCommitPost } from "../../../src/flow/lib/run-finalize.js";

function readRunFinalizeSource() {
  const file = path.join(process.cwd(), "src/flow/lib/run-finalize.js");
  return fs.readFileSync(file, "utf8");
}

describe("run-finalize retro invocation (spec 251: retro is mainline, not finalize post-hook)", () => {
  it("R6: run-finalize.js does not import or invoke RetroCommand", () => {
    const source = readRunFinalizeSource();
    assert.doesNotMatch(
      source,
      /RetroCommand|RunRetroCommand/,
      "run-finalize.js must not reference RetroCommand — retro runs as a mainline impl-phase step",
    );
  });

  it("R6: executeCommitPost runs without invoking retro and does not record a retro result", async () => {
    const results = {};
    const ctx = {
      root: process.cwd(),
      flowState: { spec: "nonexistent/spec.md", baseBranch: "main", requirements: [] },
      _results: results,
    };
    await executeCommitPost(ctx);
    assert.equal(
      results.retro,
      undefined,
      "executeCommitPost must not produce a results.retro entry — retro is no longer a finalize post-hook responsibility",
    );
  });
});
