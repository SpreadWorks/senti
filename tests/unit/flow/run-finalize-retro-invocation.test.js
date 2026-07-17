// spec: R6
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { commitDurableFinalizeArtifacts } from "../../../src/flow/lib/run-finalize.js";

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

  it("R6: durable artifact commit does not invoke retro or record a retro result", async () => {
    const results = {};
    const ctx = {
      root: process.cwd(),
      flowState: { spec: "nonexistent/spec.md", baseBranch: "main", requirements: [] },
      _results: results,
    };
    await assert.rejects(() => commitDurableFinalizeArtifacts(ctx), /spec missing/);
    assert.equal(
      results.retro,
      undefined,
      "artifact commit must not produce a results.retro entry — retro is a mainline step",
    );
  });
});
