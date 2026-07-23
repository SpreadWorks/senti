import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  buildGuardrailTargetTextForPrompt,
  compactDiffForGuardrailPrompt,
  excludeScenarioValidityEvidenceFromTaskGateDiff,
  default as RunGateCommand,
} from "../../../src/flow/lib/run-gate.js";
import { container } from "../../../src/lib/container.js";
import { commitAll, checkoutNewBranch, initGitRepo } from "../../helpers/git-repo.js";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../helpers/tmp-dir.js";

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

describe("task gate scenario-validity evidence", () => {
  it("excludes active-spec pre-fix evidence while retaining implementation and post-fix evidence", () => {
    const specDir = "specs/999-example";
    const preamble = "diagnostic preamble\n";
    const malformed = [
      "diff --git malformed-header",
      "+malformed content remains",
      "",
    ].join("\n");
    const quoted = [
      'diff --git "a/specs/999-example/tests/.raw/scenario-validity.log" "b/specs/999-example/tests/.raw/scenario-validity.log"',
      '--- "a/specs/999-example/tests/.raw/scenario-validity.log"',
      '+++ "b/specs/999-example/tests/.raw/scenario-validity.log"',
      "@@ -0,0 +1 @@",
      "+quoted path remains",
      "",
    ].join("\n");
    const special = modifiedDiff("specs/999-example/証拠-ß.json");
    const scenarioResult = modifiedDiff(`${specDir}/scenario-validity-result.json`);
    const scenarioLog = modifiedDiff(`${specDir}/tests/.raw/scenario-validity.log`);
    const testExecuteResult = modifiedDiff(`${specDir}/test-execute-result.json`);
    const testExecutionLog = modifiedDiff(`${specDir}/tests/.raw/test-execution.log`);
    const otherSpecScenario = modifiedDiff("specs/998-other/scenario-validity-result.json");
    const implementation = modifiedDiff("src/flow/lib/review-convergence.js");
    const diff = [
      preamble,
      scenarioResult,
      malformed,
      scenarioLog,
      quoted,
      testExecuteResult,
      testExecutionLog,
      otherSpecScenario,
      special,
      implementation,
    ].join("");
    const expected = [
      preamble,
      malformed,
      quoted,
      testExecuteResult,
      testExecutionLog,
      otherSpecScenario,
      special,
      implementation,
    ].join("");

    const filtered = excludeScenarioValidityEvidenceFromTaskGateDiff(
      diff,
      `${specDir}/spec.json`,
    );

    assert.equal(filtered, expected);
    assert.match(filtered, new RegExp(`${specDir}/test-execute-result\\.json`));
    assert.match(filtered, new RegExp(`${specDir}/tests/\\.raw/test-execution\\.log`));
    assert.match(filtered, /specs\/998-other\/scenario-validity-result\.json/);
    assert.match(filtered, /src\/flow\/lib\/review-convergence\.js/);
    assert.ok(filtered.startsWith(preamble));
    assert.match(filtered, /diff --git malformed-header\n\+malformed content remains/);
    assert.match(filtered, /diff --git "a\/specs\/999-example\/tests\/\.raw\/scenario-validity\.log"/);
    assert.match(filtered, /\+quoted path remains/);
    assert.match(filtered, /specs\/999-example\/証拠-ß\.json/);
    assert.ok(filtered.indexOf("malformed-header") < filtered.indexOf("quoted path remains"));
    assert.ok(filtered.indexOf("quoted path remains") < filtered.indexOf("test-execute-result.json"));
  });
});

const TASK_GATE_SPEC_ID = "001-task-gate-evidence";
const TASK_GATE_SPEC = `specs/${TASK_GATE_SPEC_ID}/spec.json`;
const TASK_GATE_TASK_SPEC = `specs/${TASK_GATE_SPEC_ID}/tasks/T-1.md`;

function taskGateState() {
  return {
    spec: TASK_GATE_SPEC,
    runId: "run-task-gate-evidence",
    planRewindAt: null,
    baseBranch: "main",
    featureBranch: `feature/${TASK_GATE_SPEC_ID}`,
    metrics: [],
    steps: [],
    requirements: [],
    tasks: [{
      id: "T-1",
      title: "Validate task gate evidence",
      goal: "Evaluate implementation evidence without plan-phase runtime output.",
      spec: TASK_GATE_TASK_SPEC,
      status: "in_progress",
      steps: [
        { id: "task-impl", status: "done" },
        { id: "task-review", status: "done" },
        { id: "task-gate", status: "in_progress" },
      ],
    }],
    currentTaskId: "T-1",
  };
}

function setupTaskGateRepository(root) {
  writeJson(root, ".senti/config.json", {
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
  });
  writeJson(root, TASK_GATE_SPEC, {
    goal: "Validate task gate evidence.",
    requirements: [],
  });
  writeFile(root, TASK_GATE_TASK_SPEC, "# Task T-1\n\nValidate implementation evidence.\n");
  writeJson(root, `specs/${TASK_GATE_SPEC_ID}/impl-review.json`, {
    version: 1,
    phase: "impl",
    runId: "run-task-gate-evidence",
    planRewindAt: null,
    taskId: "T-1",
    generatedAt: "2026-07-23T00:00:00.000Z",
    verdict: "PASS",
    summary: { blocking: 0, nonBlocking: 0, total: 0 },
    blockingFindings: [],
    nonBlockingImprovements: [],
  });
  writeJson(root, `specs/${TASK_GATE_SPEC_ID}/issue-log.json`, { entries: [] });
  initGitRepo(root);
  commitAll(root, "initial fixture");
  checkoutNewBranch(root, `feature/${TASK_GATE_SPEC_ID}`);
}

function scenarioResult(padding = "") {
  return `${JSON.stringify({
    version: "1",
    process: { started: true, exitCode: 1 },
    result: "pass",
    padding,
  })}\n`;
}

async function executeTaskGate(root, state, skipGuardrail = true) {
  const command = new RunGateCommand();
  return command.executeTaskImplGate({
    root,
    flowState: state,
    config: {},
  }, root, "task", "task-impl", skipGuardrail);
}

describe("task gate scenario-validity evidence through task scope", () => {
  let tmp;

  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  it("rejects scenario-validity-only changes as no task implementation evidence", async () => {
    tmp = createTmpDir("task-gate-scenario-only-");
    setupTaskGateRepository(tmp);
    writeFile(tmp, `specs/${TASK_GATE_SPEC_ID}/scenario-validity-result.json`, scenarioResult());
    writeFile(
      tmp,
      `specs/${TASK_GATE_SPEC_ID}/tests/.raw/scenario-validity.log`,
      "not ok 1 - expected pre-fix failure\n",
    );
    commitAll(tmp, "record scenario validity");

    const result = await executeTaskGate(tmp, taskGateState());

    assert.equal(result.result, "fail");
    assert.deepEqual(
      result.artifacts.issues,
      ["no changes found (committed or uncommitted) against base branch"],
    );
  });

  it("sizes and evaluates only implementation and post-fix evidence", async () => {
    tmp = createTmpDir("task-gate-filtered-size-");
    setupTaskGateRepository(tmp);
    const scenarioLogPath = `specs/${TASK_GATE_SPEC_ID}/tests/.raw/scenario-validity.log`;
    writeFile(
      tmp,
      `specs/${TASK_GATE_SPEC_ID}/scenario-validity-result.json`,
      scenarioResult("x".repeat(600_000)),
    );
    writeFile(tmp, scenarioLogPath, "");
    writeFile(tmp, "src/task-evidence.js", "export const taskEvidence = true;\n");
    writeJson(tmp, `specs/${TASK_GATE_SPEC_ID}/test-execute-result.json`, {
      version: 2,
      result: "pass",
    });
    writeFile(
      tmp,
      `specs/${TASK_GATE_SPEC_ID}/tests/.raw/test-execution.log`,
      "post-fix tests pass\n",
    );
    commitAll(tmp, "record implementation and test evidence");
    writeFile(tmp, scenarioLogPath, `not ok expected pre-fix failure\n${"y".repeat(600_000)}\n`);
    const preFixEvidenceBytes = fs.statSync(
      path.join(tmp, `specs/${TASK_GATE_SPEC_ID}/scenario-validity-result.json`),
    ).size + fs.statSync(path.join(tmp, scenarioLogPath)).size;
    assert.ok(preFixEvidenceBytes > 1024 * 1024);

    let capturedPrompt = "";
    const originalGet = container.get.bind(container);
    container.get = (key) => {
      if (key !== "agent") return originalGet(key);
      return {
        resolve: (commandId) => commandId === "flow.spec.gate",
        call: async (prompt) => {
          capturedPrompt = prompt;
          return JSON.stringify({ observations: [] });
        },
      };
    };

    let result;
    try {
      result = await executeTaskGate(tmp, taskGateState(), false);
    } finally {
      container.get = originalGet;
    }

    assert.equal(result.result, "pass");
    assert.match(capturedPrompt, /src\/task-evidence\.js/);
    assert.match(capturedPrompt, /test-execute-result\.json/);
    assert.match(capturedPrompt, /tests\/\.raw\/test-execution\.log/);
    assert.doesNotMatch(capturedPrompt, /scenario-validity-result\.json/);
    assert.doesNotMatch(capturedPrompt, /tests\/\.raw\/scenario-validity\.log/);
    assert.doesNotMatch(capturedPrompt, /expected pre-fix failure/);
  });
});
