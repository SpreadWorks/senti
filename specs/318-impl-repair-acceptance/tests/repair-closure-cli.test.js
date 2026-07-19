// spec: R4 R5 R6 R7 R8
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { getFlowDefinitionOrder } from "../../../src/flow/definition.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";

const packageRoot = process.cwd();
const cli = path.join(packageRoot, "src/senti.js");
const issue = 413;
const expectedSpec = "specs/001-repair/spec.json";
const allRequirementIds = Array.from({ length: 8 }, (_, index) => `R${index + 1}`);

const failingImplReview = {
  blockingFindings: [{
    title: "Implementation value contradicts R8",
    failureMode: "spec_behavior_contradiction",
    file: "src/service.js",
    requirementId: "R8",
    issue: "The implementation value still represents the pre-repair behavior.",
    suggestion: "Change the implementation value and regenerate downstream evidence.",
    rationale: "R8 requires a review failure to enter the explicit repair lifecycle.",
  }],
  nonBlockingImprovements: [],
};

const passingImplReview = {
  blockingFindings: [],
  nonBlockingImprovements: [],
};

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function runCli(root, args, env = {}) {
  try {
    const stdout = execFileSync(process.execPath, [cli, ...args], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, ...env, SENTI_WORK_ROOT: root },
    });
    return { exitCode: 0, envelope: JSON.parse(stdout) };
  } catch (error) {
    const stdout = error.stdout?.toString() || "";
    return { exitCode: error.status ?? 1, envelope: stdout ? JSON.parse(stdout) : null };
  }
}

function git(root, args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
}

function targetGuards({ runId, spec }) {
  return [
    "--expect-run-id", runId,
    "--expect-issue", String(issue),
    "--expect-spec", spec,
  ];
}

function writeReviewAgent(root, responses) {
  const scriptPath = path.join(root, ".senti/fake-review-agent.cjs");
  const countPath = path.join(root, ".senti/fake-review-count");
  const promptPath = path.join(root, ".senti/fake-agent-prompts.jsonl");
  const source = [
    "const fs = require(\"node:fs\");",
    `const countPath = ${JSON.stringify(countPath)};`,
    `const promptPath = ${JSON.stringify(promptPath)};`,
    `const responses = ${JSON.stringify(responses)};`,
    "const count = fs.existsSync(countPath) ? Number(fs.readFileSync(countPath, \"utf8\")) : 0;",
    "fs.writeFileSync(countPath, String(count + 1));",
    "fs.appendFileSync(promptPath, JSON.stringify(process.argv.at(-1) || \"\") + \"\\n\");",
    "process.stdout.write(JSON.stringify(responses[Math.min(count, responses.length - 1)]));",
    "",
  ].join("\n");
  fs.writeFileSync(scriptPath, source);
  return { scriptPath, promptPath };
}

function setupProject(root, {
  reviewResponses = [failingImplReview, passingImplReview],
} = {}) {
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "src/service.js"), "export const value = 1;\n");
  writeJson(path.join(root, "package.json"), { type: "module" });
  fs.mkdirSync(path.join(root, ".senti"), { recursive: true });
  const configPath = path.join(root, ".senti/config.json");
  const reviewAgent = writeReviewAgent(root, reviewResponses);
  const config = {
    name: "repair-closure-fixture",
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    scan: { include: ["src/**/*.js", "package.json"] },
    test: {
      command: "node --test specs/001-repair/tests/closure.test.js",
      testExecuteRegression: "targeted",
    },
    agent: {
      default: "fake-review",
      workDir: ".tmp",
      timeout: 30,
      retryCount: 1,
      providers: {
        "fake-review": {
          command: process.execPath,
          args: [reviewAgent.scriptPath],
        },
      },
    },
  };
  writeJson(configPath, config);

  git(root, ["init", "-b", "main"]);
  git(root, ["config", "user.name", "Senti Test"]);
  git(root, ["config", "user.email", "senti-test@example.invalid"]);
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "baseline"]);

  const init = runCli(root, [
    "flow", "set", "init",
    "--issue", String(issue),
    "--request", "Repair the implementation and verify every requirement.",
  ]);
  assert.equal(init.exitCode, 0);
  assert.equal(init.envelope.ok, true);
  const runId = init.envelope.data.runId;
  const prepared = runCli(root, [
    "flow", "prepare",
    "--title", "repair",
    "--base", "main",
    "--no-branch",
    "--run-id", runId,
  ]);
  assert.equal(prepared.exitCode, 0);
  assert.equal(prepared.envelope.ok, true);
  const spec = prepared.envelope.data.spec;
  assert.equal(spec, expectedSpec);
  const specDir = path.dirname(path.join(root, spec));
  fs.mkdirSync(path.join(specDir, "tests"), { recursive: true });
  const requirementIds = [...allRequirementIds];
  const specJson = readJson(path.join(root, spec));
  writeJson(path.join(root, spec), {
    ...specJson,
    goal: "Repair closure fixture.",
    requirements: requirementIds.map((id) => ({ id, priority: "must", desc: `${id} behavior.`, status: "done" })),
  });
  fs.writeFileSync(
    path.join(specDir, "tests/closure.test.js"),
    nestedSpecTestSource(requirementIds, root),
  );

  const guards = targetGuards({ runId, spec });
  for (const requirementId of requirementIds) {
    const mapped = runCli(root, ["flow", "set", "files", requirementId, "src/service.js", ...guards]);
    assert.equal(mapped.exitCode, 0, `public file-map write failed for ${requirementId}`);
    assert.equal(mapped.envelope.ok, true, `public file-map envelope failed for ${requirementId}`);
  }
  const order = getFlowDefinitionOrder();
  for (const stepId of order.slice(order.indexOf("draft"), order.indexOf("test-execute"))) {
    if (stepId === "scenario-validity") {
      const validity = runCli(root, ["flow", "run", "scenario-validity", ...guards]);
      assert.equal(validity.exitCode, 0);
      assert.equal(validity.envelope.data.result, "pass");
      continue;
    }
    const status = stepId === "approval" ? "done" : "skipped";
    const progressed = runCli(root, ["flow", "set", "step", stepId, status, ...guards]);
    assert.equal(progressed.exitCode, 0, `public CLI progression failed for ${stepId}`);
    assert.equal(progressed.envelope.ok, true, `public CLI progression envelope failed for ${stepId}`);
    if (stepId === "approval") {
      const auto = runCli(root, ["flow", "set", "auto", "on", ...guards]);
      assert.equal(auto.exitCode, 0);
      assert.equal(auto.envelope.data.autoApprove, true);
    }
  }
  const next = runCli(root, ["flow", "get", "next-action", ...guards]);
  assert.equal(next.exitCode, 0);
  assert.equal(next.envelope.data.step, "test-execute");
  return { specDir, requirementIds, promptPath: reviewAgent.promptPath, runId, spec, guards };
}

function nestedSpecTestSource(requirementIds, projectRoot) {
  const definitionUrl = pathToFileURL(path.join(packageRoot, "src/flow/definition.js")).href;
  const repairUrl = pathToFileURL(path.join(packageRoot, "src/flow/lib/impl-repair-artifacts.js")).href;
  const serviceUrl = pathToFileURL(path.join(projectRoot, "src/service.js")).href;
  const header = `// spec: ${requirementIds.join(" ")}`;
  const tests = requirementIds.map((id, index) => {
    if (index === 0) {
      return `test("${id}: repair states are defined", () => { assert.ok(definition.getFlowNode("impl-repair")); assert.equal(value, 2); });`;
    }
    return `test("${id}: repaired domain remains loadable", () => { assert.equal(typeof repair.buildRepairFingerprint, "function"); assert.equal(value, 2); });`;
  });
  return [
    header,
    "import assert from \"node:assert/strict\";",
    "import { test } from \"node:test\";",
    `import * as definition from ${JSON.stringify(definitionUrl)};`,
    `import * as repair from ${JSON.stringify(repairUrl)};`,
    `import { value } from ${JSON.stringify(serviceUrl)};`,
    ...tests,
    "",
  ].join("\n");
}

function acceptanceJudgment(requirementId, status = "met", repairRef = "acceptance:no-repair") {
  return {
    requirementId,
    status,
    requestRefs: ["flow.request"],
    requirementRefs: [`spec.json#${requirementId}`],
    diffRefs: ["diff:src/service.js"],
    repairRefs: [repairRef],
    testRefs: [`test-execute-result.json#${requirementId}`],
    missingEvidence: status === "notVerifiable" ? ["External proof is unavailable."] : [],
  };
}

function acceptanceAgentResponse(requirementIds, statusById = {}, { repairRef } = {}) {
  return {
    requirementJudgments: requirementIds.map((id) => acceptanceJudgment(
      id,
      statusById[id] || "met",
      repairRef,
    )),
  };
}

function passingGateResponse(requirementIds) {
  return {
    evaluations: requirementIds.map((requirementId) => ({
      guardrail_id: requirementId,
      result: "pass",
      reason: `${requirementId} is implemented by src/service.js.`,
    })),
  };
}

function driveToImplReview(root, specDir, requirementIds, guards, value = 2) {
  assert.equal(fs.existsSync(path.join(specDir, "tests/closure.test.js")), true);
  fs.writeFileSync(path.join(root, "src/service.js"), `export const value = ${value};\n`);

  const execute = runCli(root, ["flow", "run", "test-execute", ...guards]);
  assert.equal(execute.exitCode, 0);
  assert.equal(execute.envelope.ok, true);
  const result = readJson(path.join(specDir, "test-execute-result.json"));
  assert.match(result.repairFingerprint, /^[a-f0-9]{64}$/);
  assert.equal(runCli(root, ["flow", "get", "next-action", ...guards]).envelope.data.step, "test-result-review");

  const review = runCli(root, ["flow", "run", "test-result-review", ...guards]);
  assert.equal(review.exitCode, 0);
  assert.equal(review.envelope.ok, true);
  assert.equal(readJson(path.join(specDir, "test-result-review.json")).repairFingerprint, result.repairFingerprint);
  assert.equal(runCli(root, ["flow", "get", "next-action", ...guards]).envelope.data.step, "impl-review");
  return result.repairFingerprint;
}

function driveToAcceptanceReview(root, specDir, requirementIds, guards) {
  const fingerprint = driveToImplReview(root, specDir, requirementIds, guards);
  const review = runCli(root, ["flow", "run", "review", "--phase", "impl", ...guards]);
  assert.equal(review.exitCode, 0);
  assert.equal(review.envelope.ok, true);
  assert.equal(readJson(path.join(specDir, "impl-review.json")).repairFingerprint, fingerprint);
  assert.equal(runCli(root, ["flow", "get", "next-action", ...guards]).envelope.data.step, "impl-gate");

  driveImplGateAndRetro(root, specDir, fingerprint, guards);
  return fingerprint;
}

function driveImplGateAndRetro(root, specDir, fingerprint, guards) {
  const gate = runCli(root, ["flow", "run", "gate", "--phase", "integration", "--skip-guardrail", ...guards]);
  assert.equal(gate.exitCode, 0);
  assert.equal(gate.envelope.ok, true);
  assert.equal(readJson(path.join(specDir, "impl-gate-result.json")).repairFingerprint, fingerprint);
  assert.equal(runCli(root, ["flow", "get", "next-action", ...guards]).envelope.data.step, "retro");

  const retro = runCli(root, ["flow", "run", "retro", ...guards]);
  assert.equal(retro.exitCode, 0);
  assert.equal(retro.envelope.ok, true);
  assert.equal(readJson(path.join(specDir, "retro.json")).repairFingerprint, fingerprint);
  assert.equal(runCli(root, ["flow", "get", "next-action", ...guards]).envelope.data.step, "acceptance-review");
}

test("R7: guarded CLI envelopes retain target checks during repair", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "senti-repair-guards-"));
  try {
    const { runId, spec, guards } = setupProject(root);
    const matched = runCli(root, ["flow", "get", "status", runId, ...guards]);
    assert.equal(matched.exitCode, 0);
    assert.equal(matched.envelope.ok, true);
    assert.equal(matched.envelope.type, "get");
    assert.equal(matched.envelope.key, "status");
    assert.ok(matched.envelope.data);
    assert.deepEqual(matched.envelope.errors, []);

    const mismatched = runCli(root, [
      "flow", "get", "status", runId,
      "--expect-run-id", runId,
      "--expect-issue", "999",
      "--expect-spec", spec,
    ]);
    assert.notEqual(mismatched.exitCode, 0);
    assert.equal(mismatched.envelope.ok, false);
    assert.equal(mismatched.envelope.errors[0].code, "ACTIVE_FLOW_MISMATCH");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("R5: repaired CLI acceptance consumes the repair audit while preserving R8 closure", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "senti-repair-closure-"));
  try {
    const repairRef = "impl-repair.json#entries[0]";
    const { specDir, requirementIds, promptPath, runId, guards } = setupProject(root, {
      reviewResponses: [
        failingImplReview,
        passingImplReview,
        passingGateResponse(allRequirementIds),
        acceptanceAgentResponse(allRequirementIds, {}, { repairRef }),
      ],
    });
    const beforeHash = driveToImplReview(root, specDir, requirementIds, guards);

    const failedReview = runCli(root, ["flow", "run", "review", "--phase", "impl", ...guards]);
    assert.equal(failedReview.exitCode, 0);
    assert.equal(failedReview.envelope.ok, true);
    const failedArtifact = readJson(path.join(specDir, "impl-review.json"));
    assert.equal(failedArtifact.verdict, "FAIL");
    assert.equal(failedArtifact.repairFingerprint, beforeHash);
    assert.equal(failedArtifact.blockingFindings.length, 1);
    assert.match(failedArtifact.blockingFindings[0].findingId, /^F-/);
    assert.equal(runCli(root, ["flow", "get", "next-action", ...guards]).envelope.data.step, "impl-triage");

    const triage = readJson(path.join(specDir, "impl-triage.json"));
    assert.deepEqual(
      triage.items.map((item) => item.findingId),
      failedArtifact.blockingFindings.map((item) => item.findingId),
    );
    assert.equal(triage.items[0].decision, "apply");

    const triageDone = runCli(root, ["flow", "set", "step", "impl-triage", "done", ...guards]);
    assert.equal(triageDone.exitCode, 0);
    assert.equal(runCli(root, ["flow", "get", "next-action", ...guards]).envelope.data.step, "impl-repair");

    fs.writeFileSync(
      path.join(root, "src/service.js"),
      "export const value = 2;\n// Repair applied after implementation review.\n",
    );
    const repairDone = runCli(root, ["flow", "set", "step", "impl-repair", "done", ...guards]);
    assert.equal(repairDone.exitCode, 0);
    assert.equal(repairDone.envelope.ok, true);
    assert.equal(runCli(root, ["flow", "get", "next-action", ...guards]).envelope.data.step, "test-execute");
    const resetStatus = runCli(root, ["flow", "get", "status", runId, ...guards]);
    assert.equal(resetStatus.exitCode, 0);
    const flowOrder = getFlowDefinitionOrder();
    const resetRange = flowOrder.slice(
      flowOrder.indexOf("test-execute"),
      flowOrder.indexOf("finalize-cleanup") + 1,
    );
    assert.equal(resetRange.at(-1), "finalize-cleanup");
    for (const stepId of resetRange) {
      const expected = stepId === "test-execute" ? "in_progress" : "pending";
      assert.equal(findStepById(resetStatus.envelope.data.steps, stepId).status, expected, `${stepId} reset status`);
    }
    assert.equal(fs.existsSync(path.join(specDir, "test-execute-result.json")), false);
    assert.equal(fs.existsSync(path.join(specDir, "acceptance-review.json")), false);
    const ledger = JSON.parse(fs.readFileSync(path.join(specDir, "impl-repair.json"), "utf8"));
    assert.equal(ledger.entries.length, 1);
    assert.deepEqual(ledger.entries[0].sourceFindingIds, [failedArtifact.blockingFindings[0].findingId]);
    assert.ok(ledger.entries[0].changedPaths.includes("src/service.js"));
    assert.match(ledger.entries[0].reason, /repair|finding/i);
    assert.equal(ledger.entries[0].previousFingerprint.hash, beforeHash);
    assert.notEqual(ledger.entries[0].currentFingerprint.hash, beforeHash);
    assert.ok(ledger.entries[0].invalidatedArtifacts.includes("test-execute-result.json"));
    assert.ok(ledger.entries[0].invalidatedArtifacts.includes("test-result-review.json"));
    assert.ok(ledger.entries[0].invalidatedArtifacts.includes("impl-review.json"));
    assert.deepEqual(
      ledger.entries[0].invalidations.map((record) => record.path),
      ledger.entries[0].invalidatedArtifacts,
    );
    for (const invalidation of ledger.entries[0].invalidations) {
      assert.match(invalidation.reason, /repair|finding/i);
      assert.equal(invalidation.previousFingerprint, beforeHash);
    }
    assert.equal(Number.isNaN(Date.parse(ledger.entries[0].createdAt)), false);

    const retest = runCli(root, ["flow", "run", "test-execute", ...guards]);
    assert.equal(retest.exitCode, 0);
    assert.equal(retest.envelope.ok, true);
    const result = JSON.parse(fs.readFileSync(path.join(specDir, "test-execute-result.json"), "utf8"));
    assert.equal(result.version, "2");
    assert.equal(result.summary.every((entry) => entry.result === "pass"), true);
    assert.equal(result.repairFingerprint, ledger.entries[0].currentFingerprint.hash);

    const resultReview = runCli(root, ["flow", "run", "test-result-review", ...guards]);
    assert.equal(resultReview.exitCode, 0);
    assert.equal(readJson(path.join(specDir, "test-result-review.json")).repairFingerprint, result.repairFingerprint);
    const passedReview = runCli(root, ["flow", "run", "review", "--phase", "impl", ...guards]);
    assert.equal(passedReview.exitCode, 0);
    const passedArtifact = readJson(path.join(specDir, "impl-review.json"));
    assert.equal(passedArtifact.verdict, "PASS");
    assert.equal(passedArtifact.repairFingerprint, result.repairFingerprint);
    assert.equal(runCli(root, ["flow", "get", "next-action", ...guards]).envelope.data.step, "impl-gate");
    assert.equal(readJson(path.join(specDir, "impl-repair.json")).entries.length, 1, "PASS does not add a repair round");

    driveImplGateAndRetro(root, specDir, result.repairFingerprint, guards);
    const acceptance = runCli(root, ["flow", "run", "acceptance-review", ...guards]);
    assert.equal(acceptance.exitCode, 0);
    assert.equal(acceptance.envelope.ok, true);
    const acceptanceEvidence = readJson(path.join(specDir, "acceptance-review.json"));
    assert.equal(acceptanceEvidence.repairFingerprint, result.repairFingerprint);
    assert.equal(
      acceptanceEvidence.requirementJudgments.every((entry) => entry.repairRefs.includes(repairRef)),
      true,
    );
    const acceptancePrompt = fs.readFileSync(promptPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
      .at(-1);
    assert.match(acceptancePrompt, /impl-repair\.json/);
    assert.match(acceptancePrompt, new RegExp(failedArtifact.blockingFindings[0].findingId));
    assert.match(acceptancePrompt, new RegExp(beforeHash));
    assert.match(acceptancePrompt, new RegExp(result.repairFingerprint));
    assert.equal(runCli(root, ["flow", "get", "next-action", ...guards]).envelope.data.step, "final-regression");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("R4: CLI no-repair PASS path stamps gate, retro, and acceptance artifacts for R8", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "senti-repair-pass-"));
  try {
    const { specDir, requirementIds, promptPath, guards } = setupProject(root, {
      reviewResponses: [
        passingImplReview,
        passingGateResponse(allRequirementIds),
        acceptanceAgentResponse(allRequirementIds),
      ],
    });
    const fingerprint = driveToAcceptanceReview(root, specDir, requirementIds, guards);
    const artifact = readJson(path.join(specDir, "impl-review.json"));
    assert.equal(artifact.verdict, "PASS");
    assert.equal(fs.existsSync(path.join(specDir, "impl-triage.json")), false);
    assert.equal(fs.existsSync(path.join(specDir, "impl-repair.json")), false);

    const acceptance = runCli(root, ["flow", "run", "acceptance-review", ...guards]);
    assert.equal(acceptance.exitCode, 0);
    assert.equal(acceptance.envelope.ok, true);
    const acceptanceEvidence = readJson(path.join(specDir, "acceptance-review.json"));
    assert.equal(acceptanceEvidence.repairFingerprint, fingerprint);
    assert.equal(acceptanceEvidence.requirementJudgments.length, requirementIds.length);
    const acceptancePrompt = fs.readFileSync(promptPath, "utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
      .at(-1);
    assert.match(acceptancePrompt, /Repair the implementation and verify every requirement/);
    assert.match(acceptancePrompt, /R1 behavior/);
    assert.match(acceptancePrompt, /src\/service\.js/);
    assert.match(acceptancePrompt, /test-execute-result\.json/);
    assert.match(acceptancePrompt, /no.?repair/i);
    assert.match(acceptancePrompt, new RegExp(fingerprint));
    assert.equal(runCli(root, ["flow", "get", "next-action", ...guards]).envelope.data.step, "final-regression");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("R6: guarded acceptance-review CLI emits exhaustive judgments and routes notMet to triage for R8", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "senti-acceptance-not-met-"));
  try {
    const { specDir, requirementIds, guards } = setupProject(root, {
      reviewResponses: [
        passingImplReview,
        passingGateResponse(allRequirementIds),
        acceptanceAgentResponse(allRequirementIds, { R3: "notMet" }),
      ],
    });
    const fingerprint = driveToAcceptanceReview(root, specDir, requirementIds, guards);

    const review = runCli(root, ["flow", "run", "acceptance-review", ...guards]);
    assert.equal(review.exitCode, 0);
    assert.equal(review.envelope.ok, true);
    const evidence = readJson(path.join(specDir, "acceptance-review.json"));
    assert.equal(evidence.verdict, "repair_required");
    assert.equal(evidence.repairFingerprint, fingerprint);
    assert.deepEqual(
      evidence.requirementJudgments.map((entry) => entry.requirementId).sort(),
      [...requirementIds].sort(),
    );
    assert.equal(evidence.requirementJudgments.find((entry) => entry.requirementId === "R3").status, "notMet");
    assert.equal(runCli(root, ["flow", "get", "next-action", ...guards]).envelope.data.step, "impl-triage");
    const triage = readJson(path.join(specDir, "impl-triage.json"));
    assert.equal(triage.items.length, 1);
    assert.equal(triage.items[0].sourceStep, "acceptance-review");
    assert.match(triage.items[0].findingId, /R3/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("R8: guarded notVerifiable CLI remains at an explicit approval decision", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "senti-acceptance-unverifiable-"));
  try {
    const { specDir, requirementIds, runId, guards } = setupProject(root, {
      reviewResponses: [
        passingImplReview,
        passingGateResponse(allRequirementIds),
        acceptanceAgentResponse(allRequirementIds, { R4: "notVerifiable" }),
      ],
    });
    const fingerprint = driveToAcceptanceReview(root, specDir, requirementIds, guards);

    const review = runCli(root, ["flow", "run", "acceptance-review", ...guards]);
    assert.equal(review.exitCode, 0);
    assert.equal(review.envelope.ok, true);
    assert.equal(readJson(path.join(specDir, "acceptance-review.json")).repairFingerprint, fingerprint);
    const pending = runCli(root, ["flow", "get", "next-action", ...guards]);
    assert.equal(pending.envelope.data.step, "acceptance-decision");
    assert.equal(pending.envelope.data.requires_approval, true);
    assert.equal(runCli(root, ["flow", "get", "status", runId, ...guards]).envelope.data.autoApprove, true);

    const omitted = runCli(root, ["flow", "set", "acceptance-decision", ...guards]);
    assert.notEqual(omitted.exitCode, 0);
    assert.equal(runCli(root, ["flow", "get", "next-action", ...guards]).envelope.data.step, "acceptance-decision");

    const accepted = runCli(root, [
      "flow", "set", "acceptance-decision",
      "--choice", "accept_risk_and_continue",
      ...guards,
    ]);
    assert.equal(accepted.exitCode, 0);
    assert.equal(accepted.envelope.ok, true);
    assert.equal(readJson(path.join(specDir, "acceptance-review.json")).userDecision.choice, "accept_risk_and_continue");
    assert.equal(runCli(root, ["flow", "get", "next-action", ...guards]).envelope.data.step, "final-regression");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
