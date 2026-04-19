import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { executeCommitPost } from "../../../src/flow/lib/run-finalize.js";

function readRunFinalizeSource() {
  const file = path.join(process.cwd(), "src/flow/lib/run-finalize.js");
  return fs.readFileSync(file, "utf8");
}

describe("run-finalize retro invocation (regression for issue #179)", () => {
  it("imports the module-level container from src/lib/container.js", () => {
    const source = readRunFinalizeSource();
    assert.match(
      source,
      /import\s*\{\s*container\s*\}\s*from\s*["']\.\.\/\.\.\/lib\/container\.js["']/,
      "run-finalize.js must import the module-level container singleton",
    );
  });

  it("passes the container (not ctx) as the first argument to RetroCommand.run", () => {
    const source = readRunFinalizeSource();
    assert.match(
      source,
      /new\s+RetroCommand\(\)\s*\.run\(\s*container\s*,/,
      "RetroCommand.run must receive the container as its first argument",
    );
    assert.doesNotMatch(
      source,
      /new\s+RetroCommand\(\)\s*\.run\(\s*\{\s*\.\.\.ctx/,
      "RetroCommand.run must not be called with a spread ctx as first argument",
    );
  });

  it("executeCommitPost does not raise 'container.get is not a function' for retro", async () => {
    const results = {};
    const ctx = {
      root: process.cwd(),
      flowState: { spec: "nonexistent/spec.md", baseBranch: "main", requirements: [] },
      _results: results,
    };
    await executeCommitPost(ctx);
    assert.ok(results.retro, "retro result should be recorded");
    if (results.retro.status === "failed") {
      assert.doesNotMatch(
        String(results.retro.message || ""),
        /container\.get is not a function/,
        "retro must not fail with the regression error from issue #179",
      );
    }
  });
});
