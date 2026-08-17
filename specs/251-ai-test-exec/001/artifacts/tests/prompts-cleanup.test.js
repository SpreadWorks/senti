// spec: R7 R29 R30 R35 R38 R39 R40
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

function read(p) {
  return fs.readFileSync(path.join(REPO_ROOT, p), "utf8");
}

describe("prompt cleanup for single-execution-point (251-ai-test-exec)", () => {
  it("R7: implement.md does not instruct test execution", () => {
    const src = read("src/flow/prompts/impl/implement.md");
    assert.ok(!/npm\s+test|node\s+--test/.test(src), "implement.md must not instruct test execution");
  });

  it("R29: impl/review.md does not instruct test re-run", () => {
    const src = read("src/flow/prompts/impl/review.md");
    assert.ok(!/Re-run.*tests|node\s+--test/i.test(src), "review.md must not instruct re-running tests");
  });

  it("R30: plan/test.md does not instruct node --test execution", () => {
    const src = read("src/flow/prompts/plan/test.md");
    assert.ok(!/node\s+--test/.test(src), "plan/test.md must not instruct node --test");
  });

  it("R35: task/impl.md and task/review.md do not instruct test execution", () => {
    const implSrc = read("src/flow/prompts/task/impl.md");
    const reviewSrc = read("src/flow/prompts/task/review.md");
    assert.ok(!/node\s+--test|npm\s+test|tests\/run\.js/.test(implSrc), "task/impl.md must not instruct test execution");
    assert.ok(!/Re-run.*tests|node\s+--test|npm\s+test/i.test(reviewSrc), "task/review.md must not instruct test re-run");
  });

  it("R38: finalize-commit.md prompt does not describe retro post-hook", () => {
    const src = read("src/flow/prompts/impl/finalize-commit.md");
    assert.ok(!/post-hook.*retro|retro.*post-hook/i.test(src), "finalize-commit.md must not describe retro in post-hook");
  });

  it("R39: finalize-cleanup.md still references flow report show", () => {
    const src = read("src/flow/prompts/impl/finalize-cleanup.md");
    assert.ok(/flow report show|report show/i.test(src), "finalize-cleanup.md must still reference report show command");
  });

  it("R40: get-prompt.js finalize choices do not include retro as a finalize-step choice", () => {
    const src = read("src/flow/lib/get-prompt.js");
    assert.ok(!/Retrospective\s*\(retro\)/.test(src), "get-prompt.js must not present retro as a finalize choice");
  });
});
