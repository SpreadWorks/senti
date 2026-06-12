import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildGuardrailTargetTextForPrompt,
  compactDiffForGuardrailPrompt,
} from "../../../src/flow/lib/run-gate.js";

function deletionOnlyDiff(file, removedBody) {
  return [
    `diff --git a/${file} b/${file}`,
    "deleted file mode 100644",
    "index 1111111..0000000",
    `--- a/${file}`,
    "+++ /dev/null",
    "@@ -1,3 +0,0 @@",
    ...removedBody.split("\n").map((line) => `-${line}`),
    "",
  ].join("\n");
}

function modifiedDiff(file) {
  return [
    `diff --git a/${file} b/${file}`,
    "index 1111111..2222222 100644",
    `--- a/${file}`,
    `+++ b/${file}`,
    "@@ -1,3 +1,4 @@",
    " const existing = true;",
    "+const addedGuardrailRelevantLine = true;",
    "",
  ].join("\n");
}

describe("guardrail diff prompt compaction", () => {
  it("keeps added-line diffs and summarizes deletion-only file bodies", () => {
    const removedBody = Array.from({ length: 200 }, (_, i) => `removed line ${i}`).join("\n");
    const diff = deletionOnlyDiff("src/removed-plugin/large-template.md", removedBody)
      + modifiedDiff("src/flow/lib/run-gate.js");

    const compacted = compactDiffForGuardrailPrompt(diff, 1200);

    assert.ok(compacted.length <= 1200);
    assert.match(compacted, /diff compacted for guardrail prompt/);
    assert.match(compacted, /src\/removed-plugin\/large-template\.md: \+0 -200/);
    assert.match(compacted, /\+const addedGuardrailRelevantLine = true;/);
    assert.doesNotMatch(compacted, /removed line 199/);
  });

  it("bounds spec plus diff target text for integration guardrail calls", () => {
    const diff = deletionOnlyDiff(
      "src/removed-plugin/large-template.md",
      Array.from({ length: 300 }, (_, i) => `removed line ${i}`).join("\n"),
    ) + modifiedDiff("src/lib/include.js");

    const targetText = buildGuardrailTargetTextForPrompt("## Spec\n- R1: test", diff, 1400);

    assert.ok(targetText.length <= 1400);
    assert.match(targetText, /## Spec/);
    assert.match(targetText, /## Git Diff/);
    assert.match(targetText, /\+const addedGuardrailRelevantLine = true;/);
  });
});
