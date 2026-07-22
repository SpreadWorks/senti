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

function specTestDiff(file, header, testNames) {
  return [
    `diff --git a/${file} b/${file}`,
    "new file mode 100644",
    "index 0000000..2222222",
    "--- /dev/null",
    `+++ b/${file}`,
    `@@ -0,0 +1,${testNames.length + 1} @@`,
    `+${header}`,
    ...testNames.map((name) => `+test(\"${name}\", () => {});`),
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

  it("reserves bounded spec-local header and test declaration evidence", () => {
    const largeDiff = deletionOnlyDiff(
      "src/removed-plugin/large-template.md",
      Array.from({ length: 400 }, (_, i) => `removed line ${i}`).join("\n"),
    );
    const diff = largeDiff + specTestDiff(
      "specs/999-example/tests/review-regression.test.js",
      "// spec: R2 R9",
      [
        "R2: rejects stale target evidence",
        "R9: keeps advisory evidence after projection failure",
      ],
    );

    const targetText = buildGuardrailTargetTextForPrompt("## Spec\n- R2\n- R9", diff, 2_000);

    assert.ok(targetText.length <= 2_000);
    assert.match(targetText, /## Spec Test Header And Declaration Evidence/);
    assert.match(targetText, /review-regression\.test\.js: \/\/ spec: R2 R9/);
    assert.match(targetText, /R2: rejects stale target evidence/);
    assert.match(targetText, /R9: keeps advisory evidence after projection failure/);
  });
});
