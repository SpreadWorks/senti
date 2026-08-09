import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../helpers/tmp-dir.js";
import { initGitRepo, commitAll, checkoutNewBranch } from "../helpers/git-repo.js";
import { setupFlow } from "../helpers/flow-setup.js";
import { writePromptDispatchStubAgentScript } from "../helpers/stub-agent.js";
import { buildInitialSteps, buildInitialTaskSteps } from "../../src/lib/flow-helpers.js";
import { collectFlowLeafIds } from "../../src/flow/definition.js";
import { captureRepairBaseline } from "../../src/flow/lib/repair-state-identity.js";
import { findStepById } from "../../src/flow/lib/step-tree.js";

const CMD = path.resolve("src/senrail.js");
const SPEC_ID = "001-cli-lifecycle";
const SPEC_PATH = `specs/${SPEC_ID}/spec.json`;
const FEATURE_BRANCH = `feature/${SPEC_ID}`;

const PASS_REVIEW = JSON.stringify({
  blockingFindings: [],
  nonBlockingImprovements: [],
});

const PASS_GATE = JSON.stringify({
  evaluations: [{ guardrail_id: "R1", result: "pass", reason: "R1 is implemented." }],
});

const PASS_ACCEPTANCE = JSON.stringify({
  requirementJudgments: [{
    requirementId: "R1",
    status: "met",
    requestRefs: ["flow.request"],
    requirementRefs: ["spec.json#R1"],
    diffRefs: ["diff:src/value.js"],
    repairRefs: ["acceptance:no-repair"],
    testRefs: ["test-execute-result.json#R1"],
    missingEvidence: [],
  }],
  deferredFindingDispositions: [],
});

const FAIL_REVIEW = JSON.stringify({
  blockingFindings: [{
    findingKey: "zero-operands-wrong-sum",
    title: "Zero operands return the wrong sum",
    failureMode: "spec_behavior_contradiction",
    file: "src/value.js",
    requirementId: "R1",
    issue: "The implementation returns zero whenever either operand is zero.",
    suggestion: "Return left + right for every numeric operand.",
    disposition: "must-fix",
    rationale: "R1 requires ordinary addition for all numeric inputs.",
  }],
  nonBlockingImprovements: [],
});

function stepsAtImplement() {
  const steps = buildInitialSteps();
  const order = collectFlowLeafIds();
  const activeIndex = order.indexOf("implement");
  assert.notEqual(activeIndex, -1);
  for (let index = 0; index < order.length; index += 1) {
    findStepById(steps, order[index]).status = index < activeIndex
      ? "done"
      : index === activeIndex
        ? "in_progress"
        : "pending";
  }
  findStepById(steps, "plan").status = "done";
  findStepById(steps, "impl").status = "in_progress";
  findStepById(steps, "finalize").status = "pending";
  return steps;
}

function run(tmp, args) {
  return spawnSync("node", [CMD, ...args], {
    cwd: tmp,
    encoding: "utf8",
    env: {
      ...process.env,
      SENRAIL_WORK_ROOT: tmp,
      SENRAIL_SOURCE_ROOT: tmp,
    },
  });
}

function runOk(tmp, args) {
  const result = run(tmp, args);
  assert.equal(
    result.status,
    0,
    `${args.join(" ")} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  return result;
}

function runEnvelope(tmp, args) {
  const result = runOk(tmp, args);
  const envelope = JSON.parse(result.stdout.trim());
  assert.equal(envelope.ok, true, `${args.join(" ")} returned ${result.stdout}`);
  return envelope;
}

function assertNext(tmp, step, taskId) {
  const envelope = runEnvelope(tmp, ["flow", "get", "next-action"]);
  assert.equal(envelope.data.step, step);
  assert.equal(envelope.data.taskId, taskId);
}

function git(tmp, args) {
  const result = spawnSync("git", args, {
    cwd: tmp,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(
    result.status,
    0,
    `git ${args.join(" ")} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  return result;
}

function setupFixture(tmp) {
  const stubPath = writePromptDispatchStubAgentScript(
    tmp,
    ".stub-agent.js",
    [
      { includes: "if (!left || !right) return 0;", response: FAIL_REVIEW },
      { includes: "guardrail_id MUST be one of the requirement ids", response: PASS_GATE },
      { includes: "## Guardrail Articles", response: JSON.stringify({ observations: [] }) },
      { includes: "semantic acceptance reviewer", response: PASS_ACCEPTANCE },
    ],
    PASS_REVIEW,
  );
  writeJson(tmp, ".senrail/config.json", {
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    flow: { merge: "squash" },
    test: {
      command: "node --test tests/project.test.js",
      testExecuteRegression: "targeted",
      timeout: 30,
    },
    commands: { gh: "disable" },
    agent: {
      timeout: 30,
      retryCount: 1,
      useProfile: "lifecycle-e2e",
      profiles: { "lifecycle-e2e": { flow: "stub-agent" } },
      providers: {
        "stub-agent": {
          name: "stub-agent",
          command: "node",
          args: [stubPath],
        },
      },
    },
  });
  writeJson(tmp, "package.json", {
    name: "cli-lifecycle-fixture",
    version: "0.0.0",
    type: "module",
    scripts: { test: "node --test tests/project.test.js" },
  });
  writeFile(tmp, ".gitignore", [
    ".senrail/*",
    "!.senrail/config.json",
    "!.senrail/output/",
    ".tmp/",
    "",
  ].join("\n"));
  writeFile(tmp, "src/value.js", [
    "export function add() {",
    "  throw new Error(\"not implemented\");",
    "}",
    "",
  ].join("\n"));
  writeFile(tmp, "tests/project.test.js", [
    "import assert from \"node:assert/strict\";",
    "import { test } from \"node:test\";",
    "import { add } from \"../src/value.js\";",
    "test(\"project addition\", () => assert.equal(add(2, 3), 5));",
    "",
  ].join("\n"));

  initGitRepo(tmp);
  commitAll(tmp, "initial fixture");
  checkoutNewBranch(tmp, FEATURE_BRANCH);

  writeJson(tmp, SPEC_PATH, {
    goal: "Implement numeric addition through the complete CLI lifecycle.",
    background: "CLI-only lifecycle fixture.",
    scope: { in: ["src/value.js"], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements: [{
      id: "R1",
      desc: "add returns the arithmetic sum of two numeric operands",
      priority: "must",
      status: "in_progress",
    }],
    acceptance_criteria: ["add(2, 3) returns 5"],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
    user_approval: {
      approved: true,
      confirmed_at: "2026-01-01T00:00:00.000Z",
      notes: "E2E fixture approval",
    },
    tasks: [{
      id: "T-1",
      title: "Implement addition",
      goal: "Implement R1 in src/value.js.",
      acceptance: ["Positive operands are added."],
      test_strategy: "Run the spec-local R1 test.",
      parent: null,
      origin: "plan",
      added_round: 0,
      status: "in_progress",
    }],
  });
  writeFile(tmp, `specs/${SPEC_ID}/spec.md`, [
    "# CLI Lifecycle Fixture",
    "",
    "## Goal",
    "Implement numeric addition.",
    "",
    "## Requirements",
    "**R1** add returns the arithmetic sum of two numeric operands.",
    "",
  ].join("\n"));
  writeFile(tmp, `specs/${SPEC_ID}/tasks/T-1.md`, [
    "# T-1: Implement addition",
    "",
    "## Goal",
    "Implement R1 in src/value.js.",
    "",
    "## Acceptance Criteria",
    "- Positive operands are added.",
    "",
    "## Test Strategy",
    "Run the spec-local R1 test.",
    "",
    "---",
    "Status: in_progress | Parent: (root) | Added Round: 0",
    "",
  ].join("\n"));
  writeFile(tmp, `specs/${SPEC_ID}/tests/r1.test.js`, [
    "// spec: R1",
    "import assert from \"node:assert/strict\";",
    "import { test } from \"node:test\";",
    "import { add } from \"../../../src/value.js\";",
    "test(\"R1: adds two numeric operands\", () => assert.equal(add(2, 3), 5));",
    "",
  ].join("\n"));

  const taskSteps = buildInitialTaskSteps("plan");
  taskSteps[0].status = "in_progress";
  const repairBaseline = captureRepairBaseline({
    root: tmp,
    baseRef: "main",
    runId: `run-${SPEC_ID}`,
  });
  setupFlow(tmp, {
    specId: SPEC_ID,
    runId: `run-${SPEC_ID}`,
    request: "Implement numeric addition through the complete CLI lifecycle.",
    baseBranch: "main",
    featureBranch: FEATURE_BRANCH,
    worktree: false,
    steps: stepsAtImplement(),
    requirements: [{ id: "R1", status: "in_progress" }],
    tasks: [{
      id: "T-1",
      title: "Implement addition",
      goal: "Implement R1 in src/value.js.",
      spec: `specs/${SPEC_ID}/tasks/T-1.md`,
      parent: null,
      origin: "plan",
      added_round: 0,
      status: "in_progress",
      steps: taskSteps,
      requirements: ["R1"],
      summary: null,
    }],
    currentTaskId: "T-1",
    repairBaseline: repairBaseline.toJSON(),
    metrics: [],
    outbox: [],
  });
}

describe("231: CLI-only full lifecycle", { timeout: 180_000 }, () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("stale integration evidence recovery regenerates the acceptance lifecycle", () => {
    tmp = createTmpDir("senrail-cli-lifecycle-");
    setupFixture(tmp);

    // The command creates both scenario-validity artifacts. The test never
    // writes generated flow artifacts or mutates flow.json directly.
    runEnvelope(tmp, ["flow", "run", "scenario-validity"]);

    writeFile(tmp, "src/value.js", [
      "export function add(left, right) {",
      "  if (!left || !right) return 0;",
      "  return left + right;",
      "}",
      "",
    ].join("\n"));
    runEnvelope(tmp, ["flow", "set", "files", "R1", "src/value.js"]);
    runEnvelope(tmp, ["flow", "set", "req", "R1", "done"]);
    runEnvelope(tmp, ["flow", "set", "step", "task-impl", "done"]);
    assertNext(tmp, "task-review", "T-1");

    const failedReview = runEnvelope(tmp, ["flow", "run", "review"]);
    assert.equal(failedReview.data.artifacts.verdict, "REJECTED");
    assert.equal(failedReview.data.artifacts.taskId, "T-1");
    assertNext(tmp, "task-review", "T-1");

    // Repair mutates only the implementation source. Flow state and evidence
    // continue to move exclusively through CLI commands.
    writeFile(tmp, "src/value.js", [
      "export function add(left, right) {",
      "  return left + right;",
      "}",
      "",
    ].join("\n"));
    const failedFinding = JSON.parse(
      fs.readFileSync(path.join(tmp, "specs/001-cli-lifecycle/impl-review.json"), "utf8"),
    ).blockingFindings[0];
    runEnvelope(tmp, [
      "flow", "set", "issue-log",
      "--step", "task-review",
      "--reason", "Removed the invalid zero-value branch reported by task review.",
      "--normalized-finding-id", failedFinding.findingId,
      "--repair-ref-file", "src/value.js",
      "--task-id", "T-1",
    ]);
    const passedTaskReview = runEnvelope(tmp, ["flow", "run", "review"]);
    assert.equal(passedTaskReview.data.artifacts.verdict, "PASS");
    assertNext(tmp, "task-gate", "T-1");

    runEnvelope(tmp, ["flow", "run", "gate", "--phase", "task-impl"]);
    assertNext(tmp, "implement", null);
    runEnvelope(tmp, ["flow", "set", "step", "implement", "done"]);
    assertNext(tmp, "test-execute", null);

    runOk(tmp, ["docs", "scan"]);
    runEnvelope(tmp, ["flow", "run", "test-execute"]);
    assertNext(tmp, "test-result-review", null);
    runEnvelope(tmp, ["flow", "run", "test-result-review"]);
    assertNext(tmp, "impl-review", null);
    const passedFlowReview = runEnvelope(tmp, ["flow", "run", "review"]);
    assert.equal(passedFlowReview.data.artifacts.verdict, "PASS");
    assertNext(tmp, "impl-gate", null);
    const reviewHistoryDir = path.join(tmp, "specs/001-cli-lifecycle/review-history");
    const matchingHistory = fs.readdirSync(reviewHistoryDir)
      .filter((name) => /^impl-attempt-\d{3}\.json$/.test(name))
      .map((name) => JSON.parse(fs.readFileSync(path.join(reviewHistoryDir, name), "utf8")))
      .filter((artifact) => artifact.blockingFindings?.some(
        (finding) => finding.findingId === failedFinding.findingId,
      ));
    assert.ok(matchingHistory.length > 0);
    assert.deepEqual(matchingHistory.map((artifact) => artifact.taskId ?? null), ["T-1"]);

    writeFile(tmp, "src/value.js", [
      "export function add(left, right) {",
      "  // Material implementation change after test evidence was recorded.",
      "  return left + right;",
      "}",
      "",
    ].join("\n"));
    const recoveredGate = runEnvelope(
      tmp,
      ["flow", "run", "gate", "--phase", "integration"],
    );
    assert.equal(recoveredGate.data.result, "recovered");
    assert.equal(recoveredGate.data.next, "test-execute");
    assert.equal(recoveredGate.data.artifacts.evidenceRefresh.recovered, true);
    assertNext(tmp, "test-execute", null);

    runEnvelope(tmp, ["flow", "run", "test-execute"]);
    assertNext(tmp, "test-result-review", null);
    runEnvelope(tmp, ["flow", "run", "test-result-review"]);
    assertNext(tmp, "impl-review", null);
    const regeneratedReview = runEnvelope(tmp, ["flow", "run", "review"]);
    assert.equal(regeneratedReview.data.artifacts.verdict, "PASS");
    assertNext(tmp, "impl-gate", null);
    runEnvelope(tmp, ["flow", "run", "gate", "--phase", "integration"]);
    assertNext(tmp, "retro", null);
    runEnvelope(tmp, ["flow", "run", "retro"]);
    assertNext(tmp, "acceptance-review", null);
    const acceptance = runEnvelope(tmp, ["flow", "run", "acceptance-review"]);
    assert.equal(acceptance.data.verdict, "pass", JSON.stringify(acceptance));
    assertNext(tmp, "final-regression", null);

    const regression = runEnvelope(tmp, ["flow", "run", "final-regression"]);
    assert.equal(regression.data.result, "pass");
    assertNext(tmp, "report", null);
    runEnvelope(tmp, ["flow", "run", "report"]);
    assertNext(tmp, "finalize-commit", null);

    runEnvelope(tmp, [
      "flow", "run", "finalize-commit",
      "--message", "test: complete CLI lifecycle",
    ]);
    assertNext(tmp, "finalize-merge", null);
    runEnvelope(tmp, ["flow", "run", "finalize-merge"]);
    assertNext(tmp, "finalize-sync", null);
    runEnvelope(tmp, ["flow", "run", "finalize-sync"]);
    assertNext(tmp, "finalize-cleanup", null);
    const cleanup = runEnvelope(tmp, ["flow", "run", "finalize-cleanup"]);
    assert.match(cleanup.data.report.text, /Final regression: result=pass/);
    assert.match(cleanup.data.report.text, /T-1 status=done/);

    const status = runEnvelope(tmp, ["flow", "get", "status"]);
    assert.equal(status.data.active, false);
    const report = runOk(tmp, ["flow", "report", "show"]);
    assert.equal(report.stdout.trim(), cleanup.data.report.text.trim());
    assert.equal(fs.existsSync(path.join(tmp, ".senrail", "last-finalized-spec")), true);
    assert.equal(git(tmp, ["branch", "--list", FEATURE_BRANCH]).stdout.trim(), "");
  });
});
