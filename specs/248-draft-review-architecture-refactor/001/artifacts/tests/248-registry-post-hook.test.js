import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const registryPath = path.resolve(__dirname, "../../../src/flow/registry.js");
const registrySource = fs.readFileSync(registryPath, "utf8");

describe("spec 248: registry.js review post hook (R6)", () => {
  it("R6: review post hook does not auto-done plan review steps", () => {
    const postFn = extractReviewPostHook(registrySource);
    assert.ok(postFn, "review post hook function not found in registry.js");

    const planPhases = ["review-draft", "review-spec", "review-test"];
    for (const stepId of planPhases) {
      const setsDone = postFn.includes(`"${stepId}"`) && postFn.includes("done");
      assert.ok(
        !setsDone || postFn.includes("impl") || postFn.includes("task"),
        `review post hook should not auto-done ${stepId} — plan review steps are prompt-managed`,
      );
    }
  });

  it("R6: review post hook still handles impl/task review auto-done", () => {
    const postFn = extractReviewPostHook(registrySource);
    assert.ok(postFn, "review post hook function not found in registry.js");
    assert.ok(
      postFn.includes("review") && postFn.includes("done"),
      "review post hook should still set done for non-plan review steps",
    );
  });
});

function extractReviewPostHook(source) {
  const reviewBlock = source.indexOf("review: {");
  if (reviewBlock === -1) return null;
  const postIdx = source.indexOf("post(", reviewBlock);
  if (postIdx === -1) return null;
  let depth = 0;
  let inBody = false;
  for (let i = postIdx; i < source.length; i++) {
    if (source[i] === "{") { depth++; inBody = true; }
    if (source[i] === "}") { depth--; }
    if (inBody && depth === 0) return source.slice(postIdx, i + 1);
  }
  return null;
}
