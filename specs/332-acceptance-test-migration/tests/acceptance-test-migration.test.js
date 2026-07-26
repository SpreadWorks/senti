// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9 R10
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import * as acceptance from "../../../src/flow/lib/acceptance-review-artifacts.js";
import { readFlowFindingsArtifact } from "../../../src/flow/lib/flow-findings.js";
import {
  ImplRepairEntry,
  appendImplRepairEntry,
  buildRepairFingerprint,
  isCompletedRepairMigrationCurrent,
} from "../../../src/flow/lib/impl-repair-artifacts.js";
import { commitDurableFinalizeArtifacts } from "../../../src/flow/lib/run-finalize.js";
import { RunReportCommand } from "../../../src/flow/lib/run-report.js";
import { resolveCurrentReviewTreeSha } from "../../../src/flow/lib/review-evidence-store.js";
import { ReviewToolingRecoveryMutation } from "../../../src/flow/lib/review-convergence.js";
import { RepairDeltaArtifact, writeRepairDelta } from "../../../src/flow/lib/repair-state-identity.js";
import { durableTestArtifactPathspecs } from "../../../src/flow/lib/test-artifacts.js";
import { SPEC_CORRECTION_SUPPORTED_STAGES } from "../../../src/flow/lib/plan-rewind.js";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const deletedExport = "buildAcceptanceReviewArtifactFromEvidence";
const targetByRequirement = new Map([
  ["R3", "specs/290-acceptance-review-policy/tests/artifact-verdict-contract.test.js"],
  ["R4", "specs/293-bounded-defer-review/tests/deferred-flow-findings.test.mjs"],
  ["R5", "specs/295-producer-artifact-contract/tests/producer-artifact-contract.test.js"],
  ["R6", "specs/296-review-gate-defer/tests/retry-exhaustion-defer.test.js"],
  ["R7", "specs/301-no-tests-valid-state/tests/no-tests-valid-state.test.js"],
  ["R8", "specs/310-defer-test-review-exhaustion/tests/test-review-post-hook-deferral.test.js"],
]);
const targetFiles = [...targetByRequirement.values()];
const runtimeRepairTestFiles = new Map([
  ["repair migration freshness", "tests/unit/flow/repair-state-identity.test.js"],
  ["tracked worktree review identity", "tests/unit/flow/review-evidence-tree.test.js"],
  ["tooling recovery exhaustion", "tests/unit/flow/retry-recovery-convergence.test.js"],
  ["current review obligations", "tests/unit/flow/finding-gate-readiness.test.js"],
  ["implementation-stage spec correction", "tests/unit/flow/reopen-draft-spec-correction.test.js"],
  ["spec-correction scenario validity", "tests/unit/flow/run-scenario-validity.test.js"],
]);
const minimumScenarioCounts = new Map([
  [targetByRequirement.get("R3"), 10],
  [targetByRequirement.get("R4"), 24],
  [targetByRequirement.get("R5"), 9],
  [targetByRequirement.get("R6"), 10],
  [targetByRequirement.get("R7"), 7],
  [targetByRequirement.get("R8"), 10],
]);
const executionCache = new Map();
const compatibilityBuilderPattern = /^buildAcceptance[A-Za-z]*ArtifactFromEvidence$/;

function standaloneTestEnvironment() {
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  return environment;
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function executeHistoricalFile(relativePath) {
  if (!executionCache.has(relativePath)) {
    executionCache.set(relativePath, spawnSync(process.execPath, ["--test", relativePath], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 20 * 1024 * 1024,
      timeout: 120_000,
      env: standaloneTestEnvironment(),
    }));
  }
  return executionCache.get(relativePath);
}

function productionSourceFiles(relativeDir = "src") {
  const directory = path.join(root, relativeDir);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.posix.join(relativeDir, entry.name);
    if (entry.isDirectory()) return productionSourceFiles(relativePath);
    return entry.isFile() && entry.name.endsWith(".js") ? [relativePath] : [];
  });
}

function exportedNames(source) {
  const names = new Set();
  for (const match of source.matchAll(/\bexport\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/\bexport\s+\*\s+as\s+([A-Za-z_$][\w$]*)/g)) {
    names.add(match[1]);
  }
  for (const match of source.matchAll(/\bexport\s*\{([^}]*)\}/g)) {
    for (const item of match[1].split(",")) {
      const alias = item.trim().split(/\s+as\s+/).at(-1)?.trim();
      if (alias) names.add(alias);
    }
  }
  return names;
}

function assertionExpressions(source) {
  const expressions = [];
  const call = /\bassert\.(?:equal|deepEqual|ok|match|doesNotThrow|notEqual|throws)\s*\(/g;
  let match;
  while ((match = call.exec(source)) !== null) {
    let depth = 1;
    let quote = null;
    let escaped = false;
    let cursor = call.lastIndex;
    for (; cursor < source.length && depth > 0; cursor += 1) {
      const character = source[cursor];
      if (quote !== null) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = null;
        continue;
      }
      if (["'", '"', "`"].includes(character)) {
        quote = character;
      } else if (character === "(") {
        depth += 1;
      } else if (character === ")") {
        depth -= 1;
      }
    }
    if (depth === 0) expressions.push(source.slice(match.index, cursor));
    call.lastIndex = cursor;
  }
  return expressions;
}

function assertPreservedAssertionContracts(relativePath, contracts) {
  const expressions = assertionExpressions(read(relativePath));
  for (const terms of contracts) {
    assert.ok(
      expressions.some((expression) => terms.every((term) => expression.includes(term))),
      `${relativePath} must retain an assertion for ${terms.join(" + ")}`,
    );
  }
}

async function loadFixtureHelper() {
  return import("../../../tests/helpers/acceptance-review-fixture.js");
}

function assertHistoricalFilePasses(relativePath, { minPassingScenarios = null } = {}) {
  const result = executeHistoricalFile(relativePath);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.equal(
    result.status,
    0,
    `${relativePath} exited with status ${result.status}`,
  );
  assert.match(output, /^# skipped 0$/m, `${relativePath} contains skipped scenarios`);
  assert.match(output, /^# todo 0$/m, `${relativePath} contains todo scenarios`);
  if (minPassingScenarios !== null) {
    const match = output.match(/^# pass (\d+)$/m);
    assert.ok(match, `${relativePath} did not report passed scenario count`);
    assert.ok(
      Number(match[1]) >= minPassingScenarios,
      `${relativePath} ran fewer than ${minPassingScenarios} passing scenarios`,
    );
  }
  return result;
}

test("R1: six historical consumers and production exports omit exact or equivalent compatibility contracts", () => {
  for (const relativePath of targetFiles) {
    const source = read(relativePath);
    assert.ok(!source.includes(deletedExport), `${relativePath} still references ${deletedExport}`);
    assert.doesNotMatch(
      source,
      /buildAcceptance[A-Za-z]*ArtifactFromEvidence/,
      `${relativePath} contains an equivalent compatibility builder`,
    );
  }
  assert.ok(!read("src/flow/lib/acceptance-review-artifacts.js").includes(deletedExport));
  assert.equal(Object.hasOwn(acceptance, deletedExport), false);
  assert.equal(
    Object.keys(acceptance).some((name) => compatibilityBuilderPattern.test(name)),
    false,
  );
  for (const relativePath of productionSourceFiles()) {
    for (const name of exportedNames(read(relativePath))) {
      assert.ok(
        !compatibilityBuilderPattern.test(name),
        `${relativePath} exports an equivalent compatibility builder: ${name}`,
      );
    }
  }
  assert.equal(typeof acceptance.buildAcceptanceReviewContext, "function");
  assert.equal(typeof acceptance.artifactFromAcceptanceJudgments, "function");
  assert.equal(typeof acceptance.writeAcceptanceReviewArtifact, "function");
  assert.equal(typeof acceptance.applyAcceptanceReviewResult, "function");
});

test("R2: shared fixture executes complete current context, writer, and flow application inputs", async () => {
  const {
    adoptAcceptanceReviewFixture,
    createAcceptanceReviewFixture,
    runAcceptanceReviewFixture,
  } = await loadFixtureHelper();
  const fixture = createAcceptanceReviewFixture({ includeDeferredFinding: true });
  try {
    const deferredFinding = fixture.deferredFindings[0];
    const result = runAcceptanceReviewFixture({
      root: fixture.root,
      state: fixture.state,
      diff: fixture.diff,
      requirementJudgments: fixture.requirementJudgments,
      deferredFindingDispositions: [{
        findingId: deferredFinding.findingId,
        finalDisposition: "fixed",
        evidenceRefs: [
          `${deferredFinding.sourceArtifact}#${deferredFinding.sourceFindingId}`,
        ],
      }],
      persist: true,
      apply: true,
      flowManager: fixture.flowManager,
    });
    assert.equal(result.context.mechanicalBlockers.length, 0);
    assert.equal(result.context.evidence.deferredFindingEvidence.length, 1);
    assert.equal(result.context.fingerprint.hash, fixture.fingerprint.hash);
    assert.equal(result.artifact.verdict, "pass");
    assert.equal(result.written.artifact.verdict, "pass");
    assert.ok(fs.existsSync(result.written.path));
    assert.equal(result.applied.verdict, "pass");
    assert.equal(fixture.activeStep(), "final-regression");
  } finally {
    fixture.cleanup();
  }
  const producerFixture = createAcceptanceReviewFixture({ includeDeferredFinding: true });
  try {
    const preservedPaths = [
      ".senti/config.json",
      producerFixture.specPath,
      "src/demo.js",
      producerFixture.testFile,
      `${producerFixture.specRelativeDir}/test-review.json`,
      `${producerFixture.specRelativeDir}/flow-findings.json`,
      `${producerFixture.specRelativeDir}/repair-fingerprint.json`,
    ];
    const before = new Map(preservedPaths.map((relativePath) => [
      relativePath,
      fs.readFileSync(path.join(producerFixture.root, relativePath), "utf8"),
    ]));
    const git = (args) => spawnSync("git", args, {
      cwd: producerFixture.root,
      encoding: "utf8",
    }).stdout.trim();
    const beforeHead = git(["rev-parse", "HEAD"]);
    const beforeBranch = git(["branch", "--show-current"]);
    const adopted = adoptAcceptanceReviewFixture({
      root: producerFixture.root,
      specPath: producerFixture.specPath,
    });
    try {
      assert.equal(adopted.testFile, producerFixture.testFile);
      assert.equal(git(["rev-parse", "HEAD"]), beforeHead);
      assert.equal(git(["branch", "--show-current"]), beforeBranch);
      for (const [relativePath, expected] of before) {
        assert.equal(
          fs.readFileSync(path.join(producerFixture.root, relativePath), "utf8"),
          expected,
          `adoption must preserve producer artifact ${relativePath}`,
        );
      }
    } finally {
      adopted.cleanup();
    }
  } finally {
    producerFixture.cleanup();
  }
  for (const relativePath of targetFiles) assertHistoricalFilePasses(relativePath);
});

test("R3: persisted evidence derives missing and missing-required test blockers", async () => {
  const relativePath = targetByRequirement.get("R3");
  const { createAcceptanceReviewFixture } = await loadFixtureHelper();
  const missingFixture = createAcceptanceReviewFixture({
    omitArtifacts: ["test-execute-result.json"],
  });
  try {
    const context = acceptance.buildAcceptanceReviewContext({
      root: missingFixture.root,
      state: missingFixture.state,
      diff: missingFixture.diff,
    });
    assert.ok(context.mechanicalBlockers.some((blocker) => blocker.kind === "missing_tests"));
  } finally {
    missingFixture.cleanup();
  }
  const partialFixture = createAcceptanceReviewFixture({
    requirementIds: ["R1", "R2"],
    testSummaryIds: ["R1"],
  });
  try {
    const context = acceptance.buildAcceptanceReviewContext({
      root: partialFixture.root,
      state: partialFixture.state,
      diff: partialFixture.diff,
    });
    assert.ok(context.mechanicalBlockers.some((blocker) => (
      blocker.kind === "missing_required_tests" && blocker.summary.includes("R2")
    )));
  } finally {
    partialFixture.cleanup();
  }
  assert.equal(acceptance.deriveAcceptanceReviewVerdict({
    mechanicalBlockers: [{ kind: "missing_tests" }],
    requirementJudgments: [],
    hardBlockers: [],
  }), "blocked");
  assert.equal(acceptance.deriveAcceptanceReviewVerdict({
    mechanicalBlockers: [],
    requirementJudgments: [{ status: "notMet" }],
    hardBlockers: [],
  }), "repair_required");
  assert.equal(acceptance.deriveAcceptanceReviewVerdict({
    mechanicalBlockers: [],
    requirementJudgments: [{ status: "notVerifiable" }],
    hardBlockers: [],
  }), "user_decision_required");
  assert.equal(acceptance.deriveAcceptanceReviewVerdict({
    mechanicalBlockers: [],
    requirementJudgments: [{ status: "met" }],
    hardBlockers: [],
  }), "pass");
  assertHistoricalFilePasses(relativePath);
});

test("R4: spec 293 complete regression passes through the current lifecycle", async () => {
  const relativePath = targetByRequirement.get("R4");
  const { createAcceptanceReviewFixture } = await loadFixtureHelper();
  const dispositions = ["fixed", "not_needed", "false_positive", "pre_existing", "still_open", "blocking"];
  const fixture = createAcceptanceReviewFixture({
    deferredFindings: dispositions.map((disposition, index) => ({
      findingId: `DF-${index + 1}`,
      sourceStep: "test-review",
      sourceArtifact: "test-review.json",
      sourceFindingId: `source-${disposition}`,
    })),
  });
  try {
    const context = acceptance.buildAcceptanceReviewContext({
      root: fixture.root,
      state: fixture.state,
      diff: fixture.diff,
    });
    assert.equal(context.evidence.deferredFindingEvidence.length, 6);
    const artifact = acceptance.artifactFromAcceptanceJudgments({
      context,
      requirementJudgments: fixture.requirementJudgments,
      deferredFindingDispositions: context.deferredFindings.map((finding, index) => ({
        findingId: finding.findingId,
        finalDisposition: dispositions[index],
        evidenceRefs: [`${finding.sourceArtifact}#${finding.sourceFindingId}`],
      })),
    });
    assert.deepEqual(artifact.deferredFindings.map((finding) => finding.finalDisposition), dispositions);
    assert.deepEqual(
      artifact.deferredFindings.map((finding) => finding.sourceFindingId),
      dispositions.map((disposition) => `source-${disposition}`),
    );
    assert.equal(artifact.verdict, "user_decision_required");
    assert.deepEqual(
      artifact.hardBlockers.map((blocker) => blocker.kind),
      ["unresolved_deferred_finding", "blocking_deferred_finding"],
    );
  } finally {
    fixture.cleanup();
  }
  assertHistoricalFilePasses(relativePath);
});

test("R5: producer findings aggregate into persisted and mirrored acceptance artifacts", async () => {
  const relativePath = targetByRequirement.get("R5");
  const { createAcceptanceReviewFixture } = await loadFixtureHelper();
  const producerSteps = ["draft-gate", "spec-review", "spec-gate", "test-review", "impl-review", "impl-gate"];
  const fixture = createAcceptanceReviewFixture({
    deferredFindings: producerSteps.map((sourceStep, index) => ({
      findingId: `DF-${index + 1}`,
      sourceStep,
      sourceArtifact: `review-evidence/${sourceStep}.json`,
      sourceFindingId: `${sourceStep}-finding`,
    })),
  });
  try {
    const context = acceptance.buildAcceptanceReviewContext({
      root: fixture.root,
      state: fixture.state,
      diff: fixture.diff,
    });
    assert.deepEqual(context.deferredFindings.map((finding) => finding.sourceStep), producerSteps);
    assert.equal(context.evidence.deferredFindingEvidence.length, producerSteps.length);
    const artifact = acceptance.artifactFromAcceptanceJudgments({
      context,
      requirementJudgments: fixture.requirementJudgments,
      deferredFindingDispositions: context.deferredFindings.map((finding) => ({
        findingId: finding.findingId,
        finalDisposition: "not_needed",
        evidenceRefs: [`${finding.sourceArtifact}#${finding.sourceFindingId}`],
      })),
    });
    const written = acceptance.writeAcceptanceReviewArtifact({
      specDir: fixture.specDir,
      artifact,
      requirementIds: fixture.requirementIds,
      fingerprint: fixture.fingerprint,
      flowState: fixture.state,
    });
    assert.equal(written.artifact.deferredFindings.length, producerSteps.length);
    assert.deepEqual(
      readFlowFindingsArtifact(fixture.specDir).entries.map((finding) => finding.finalDisposition),
      producerSteps.map(() => "not_needed"),
    );
  } finally {
    fixture.cleanup();
  }
  assertHistoricalFilePasses(relativePath);
});

test("R6: retry findings persist, mirror, block on missing source, and route current flow state", async () => {
  const relativePath = targetByRequirement.get("R6");
  const { createAcceptanceReviewFixture } = await loadFixtureHelper();
  const fixture = createAcceptanceReviewFixture({
    deferredFindings: [{
      findingId: "DF-1",
      sourceStep: "spec-review",
      sourceArtifact: "spec-review.json",
      sourceFindingId: "retry-exhausted",
    }],
  });
  try {
    const context = acceptance.buildAcceptanceReviewContext({
      root: fixture.root,
      state: fixture.state,
      diff: fixture.diff,
    });
    const finding = context.deferredFindings[0];
    const artifact = acceptance.artifactFromAcceptanceJudgments({
      context,
      requirementJudgments: fixture.requirementJudgments,
      deferredFindingDispositions: [{
        findingId: finding.findingId,
        finalDisposition: "still_open",
        evidenceRefs: [`${finding.sourceArtifact}#${finding.sourceFindingId}`],
      }],
    });
    assert.equal(artifact.verdict, "user_decision_required");
    acceptance.writeAcceptanceReviewArtifact({
      specDir: fixture.specDir,
      artifact,
      requirementIds: fixture.requirementIds,
      fingerprint: fixture.fingerprint,
      flowState: fixture.state,
    });
    assert.equal(readFlowFindingsArtifact(fixture.specDir).entries[0].finalDisposition, "still_open");
    acceptance.applyAcceptanceReviewResult({
      root: fixture.root,
      flowManager: fixture.flowManager,
      artifact,
    });
    assert.equal(fixture.activeStep(), "acceptance-decision");
    fs.renameSync(
      path.join(fixture.specDir, finding.sourceArtifact),
      path.join(fixture.specDir, `${finding.sourceArtifact}.bak`),
    );
    const missingContext = acceptance.buildAcceptanceReviewContext({
      root: fixture.root,
      state: fixture.state,
      diff: fixture.diff,
    });
    const blocked = acceptance.artifactFromAcceptanceJudgments({
      context: missingContext,
      requirementJudgments: [],
    });
    assert.equal(blocked.verdict, "blocked");
    assert.ok(blocked.mechanicalBlockers.some((entry) => entry.kind === "missing_deferred_source"));
  } finally {
    fixture.cleanup();
  }
  assertHistoricalFilePasses(relativePath);
});

test("R7: no-tests evidence remains a valid acceptance, report, finalize, and durable-artifact state", async () => {
  const relativePath = targetByRequirement.get("R7");
  const { createAcceptanceReviewFixture } = await loadFixtureHelper();
  const fixture = createAcceptanceReviewFixture({ noTests: true });
  try {
    const context = acceptance.buildAcceptanceReviewContext({
      root: fixture.root,
      state: fixture.state,
      diff: fixture.diff,
    });
    assert.equal(context.mechanicalBlockers.length, 0);
    const artifact = acceptance.artifactFromAcceptanceJudgments({
      context,
      requirementJudgments: fixture.requirementJudgments,
    });
    assert.equal(artifact.verdict, "pass");
    assert.doesNotThrow(() => acceptance.validateAcceptanceReviewArtifact(artifact, {
      requirementIds: fixture.requirementIds,
    }));
    const report = await new RunReportCommand().execute({
      root: fixture.root,
      flowState: fixture.state,
      dryRun: true,
    });
    assert.equal(report.result, "dry-run");
    const finalizeContext = {
      root: fixture.root,
      flowState: { ...fixture.state, issue: null },
      _results: {},
    };
    await commitDurableFinalizeArtifacts(finalizeContext);
    assert.equal(finalizeContext._results.artifactCommit.status, "done");
    const durable = durableTestArtifactPathspecs(fixture.specId);
    assert.ok(durable.some((entry) => entry.endsWith("test-execute-result.json")));
    assert.ok(durable.some((entry) => entry.endsWith("final-regression-result.json")));
  } finally {
    fixture.cleanup();
  }
  assertHistoricalFilePasses(relativePath);
});

test("R8: test-review handoff preserves source identity, disposition verdict, and routing", async () => {
  const relativePath = targetByRequirement.get("R8");
  const { createAcceptanceReviewFixture } = await loadFixtureHelper();
  for (const finalDisposition of ["fixed", "still_open", "blocking"]) {
    const fixture = createAcceptanceReviewFixture({
      deferredFindings: [{
        findingId: "DF-1",
        sourceStep: "test-review",
        sourceArtifact: "test-review.json",
        sourceFindingId: "post-hook-deferred",
      }],
    });
    try {
      const context = acceptance.buildAcceptanceReviewContext({
        root: fixture.root,
        state: fixture.state,
        diff: fixture.diff,
      });
      assert.equal(context.deferredFindings[0].sourceStep, "test-review");
      assert.equal(context.deferredFindings[0].sourceFindingId, "post-hook-deferred");
      const finding = context.deferredFindings[0];
      const artifact = acceptance.artifactFromAcceptanceJudgments({
        context,
        requirementJudgments: fixture.requirementJudgments,
        deferredFindingDispositions: [{
          findingId: finding.findingId,
          finalDisposition,
          evidenceRefs: [`${finding.sourceArtifact}#${finding.sourceFindingId}`],
        }],
      });
      assert.equal(
        artifact.verdict,
        finalDisposition === "fixed" ? "pass" : "user_decision_required",
      );
      acceptance.applyAcceptanceReviewResult({
        root: fixture.root,
        flowManager: fixture.flowManager,
        artifact,
      });
      assert.equal(
        fixture.activeStep(),
        finalDisposition === "fixed" ? "final-regression" : "acceptance-decision",
      );
    } finally {
      fixture.cleanup();
    }
  }
  assertHistoricalFilePasses(relativePath);
});

test("R9: all complete target files retain scenario counts and pass without disabled tests", () => {
  const assertionContracts = new Map([
    [targetByRequirement.get("R3"), [
      ["deriveAcceptanceReviewVerdict", '"blocked"'],
      ["missing_required_tests", "missing_tests"],
    ]],
    [targetByRequirement.get("R4"), [
      ["artifact.deferredFindings.length", "6"],
      ["artifact.deferredFindings[5].finalDisposition", '"blocking"'],
      ["artifact.verdict", '"user_decision_required"'],
    ]],
    [targetByRequirement.get("R5"), [
      ["acceptanceArtifact.deferredFindings.length", "10"],
      ["acceptanceArtifact.deferredFindings.map", "sourceStep", "sourceArtifact", "sourceFindingId"],
      ["readFlowFindingsArtifact(acceptanceFixture.specDir).entries.every", 'finalDisposition === "still_open"'],
      ["JSON.parse(fs.readFileSync(written.path", "deferredFindings.length", "10"],
    ]],
    [targetByRequirement.get("R6"), [
      ["fixed.artifact.deferredFindings[0].finalDisposition", '"fixed"'],
      ["stillOpen.artifact.verdict", '"user_decision_required"'],
      ["missingSource.artifact.verdict", '"blocked"'],
    ]],
    [targetByRequirement.get("R7"), [
      ["results.testExecute.summary[0].result", '"not_applicable"'],
      ["results.finalRegression.skipKind", '"skipped_by_project_policy"'],
      ["acceptance.verdict", '"pass"'],
    ]],
    [targetByRequirement.get("R8"), [
      ["artifact.deferredFindings[0].sourceStep", '"test-review"'],
      ["artifact.deferredFindings[0].finalDisposition", '"fixed"'],
      ["acceptanceFixture.activeStep()", '"final-regression"'],
    ]],
  ]);
  for (const relativePath of targetFiles) {
    const result = assertHistoricalFilePasses(relativePath, {
      minPassingScenarios: minimumScenarioCounts.get(relativePath),
    });
    assertPreservedAssertionContracts(relativePath, assertionContracts.get(relativePath));
    console.log(`[acceptance-migration] target regression passed: ${relativePath} (exit ${result.status})`);
  }
  const retryRegression = read(targetByRequirement.get("R6"));
  for (const requiredCurrentSurface of [
    "checkReviewRetryBelowMax",
    "checkGateRetryBelowMax",
    "reviewCases",
    "gateCases",
    "missing_deferred_source",
    "readFlowFindingsArtifact",
  ]) {
    assert.match(
      retryRegression,
      new RegExp(requiredCurrentSurface),
      `R6 must retain current retry-exhaustion coverage for ${requiredCurrentSurface}`,
    );
  }
});

test("R10: flow-runtime repairs preserve their bounded behavior contracts", async () => {
  assert.deepEqual(SPEC_CORRECTION_SUPPORTED_STAGES, [
    "implement",
    "impl-review",
    "impl-gate",
    "retro",
    "acceptance-review",
    "final-regression",
  ]);
  const { createAcceptanceReviewFixture } = await loadFixtureHelper();
  const fixture = createAcceptanceReviewFixture();
  try {
    const before = resolveCurrentReviewTreeSha(fixture.root);
    const tracked = spawnSync("git", ["ls-files", "--error-unmatch", "src/demo.js"], {
      cwd: fixture.root,
      encoding: "utf8",
    });
    assert.equal(tracked.status, 0, "review identity fixture must mutate a tracked source file");
    fs.writeFileSync(path.join(fixture.root, "src/demo.js"), "export const demo = 'changed review bytes';\n");
    const after = resolveCurrentReviewTreeSha(fixture.root);
    assert.notEqual(after, before);
    const currentFingerprint = buildRepairFingerprint({
      root: fixture.root,
      specPath: fixture.state.spec,
      state: fixture.state,
    });

    const delta = new RepairDeltaArtifact({
      version: 1,
      id: "repair-001",
      previousHash: "0".repeat(64),
      currentHash: currentFingerprint.hash,
      changedPaths: ["src/demo.js"],
    });
    const changedPathsRef = writeRepairDelta(fixture.specDir, delta);
    appendImplRepairEntry({
      specDir: fixture.specDir,
      entry: new ImplRepairEntry({
        id: delta.id,
        sourceFindingIds: ["migration-current-evidence"],
        reason: "Bind completed migration evidence to the current repair fingerprint.",
        previousHash: delta.previousHash,
        currentHash: delta.currentHash,
        changedPathCount: 1,
        changedPathsRef,
        changedPathsDigest: delta.digest,
        changedPathsPreview: ["src/demo.js"],
        changedPathGroups: [{ prefix: "src/", count: 1 }],
        invalidations: [{
          path: "test-execute-result.json",
          reason: "migration test evidence",
          previousFingerprint: delta.previousHash,
        }],
        createdAt: "2026-07-25T00:00:00.000Z",
      }),
    });
    const migration = { baseline: fixture.state.repairBaseline, invalidations: [] };
    const testResultPath = path.join(fixture.specDir, "test-execute-result.json");
    const testResult = JSON.parse(fs.readFileSync(testResultPath, "utf8"));
    const currentTestResult = { ...testResult, repairFingerprint: currentFingerprint.hash };
    fs.writeFileSync(testResultPath, `${JSON.stringify(currentTestResult)}\n`);
    assert.equal(
      isCompletedRepairMigrationCurrent(fixture.state, fixture.specDir, migration, currentFingerprint),
      true,
    );
    fs.writeFileSync(testResultPath, `${JSON.stringify({
      ...currentTestResult,
      repairFingerprint: "f".repeat(64),
    })}\n`);
    assert.equal(
      isCompletedRepairMigrationCurrent(fixture.state, fixture.specDir, migration, currentFingerprint),
      false,
    );
    fs.writeFileSync(testResultPath, `${JSON.stringify(currentTestResult)}\n`);
    fs.writeFileSync(testResultPath, `${JSON.stringify({ ...currentTestResult, version: "1" })}\n`);
    assert.equal(
      isCompletedRepairMigrationCurrent(fixture.state, fixture.specDir, migration, currentFingerprint),
      false,
    );
    fs.writeFileSync(testResultPath, `${JSON.stringify(currentTestResult)}\n`);
    fs.rmSync(path.join(fixture.specDir, "tests/.raw/test-execution.log"));
    assert.equal(
      isCompletedRepairMigrationCurrent(fixture.state, fixture.specDir, migration, currentFingerprint),
      false,
    );
    fs.writeFileSync(path.join(fixture.specDir, "tests/.raw/test-execution.log"), "current raw evidence\n");
    const deltaPath = path.join(fixture.specDir, changedPathsRef);
    const { digest, ...staleDeltaInput } = delta.toJSON();
    const staleDelta = new RepairDeltaArtifact({
      ...staleDeltaInput,
      currentHash: currentFingerprint.hash === "f".repeat(64) ? "e".repeat(64) : "f".repeat(64),
    });
    fs.writeFileSync(deltaPath, `${JSON.stringify(staleDelta.toJSON())}\n`);
    assert.equal(
      isCompletedRepairMigrationCurrent(fixture.state, fixture.specDir, migration, currentFingerprint),
      false,
    );
    fs.writeFileSync(deltaPath, `${JSON.stringify({ ...delta.toJSON(), digest: "f".repeat(64) })}\n`);
    assert.equal(
      isCompletedRepairMigrationCurrent(fixture.state, fixture.specDir, migration, currentFingerprint),
      false,
    );
    fs.writeFileSync(deltaPath, `${JSON.stringify(delta.toJSON())}\n`);
    fs.rmSync(path.join(fixture.specDir, changedPathsRef));
    assert.equal(
      isCompletedRepairMigrationCurrent(fixture.state, fixture.specDir, migration, currentFingerprint),
      false,
    );
  } finally {
    fixture.cleanup();
  }

  const recoveryInput = {
    phase: "spec",
    taskId: null,
    flowState: { runId: "run-r10", spec: "specs/demo/spec.json" },
    nextTreeSha: "b".repeat(40),
  };
  let treeResolutionAttempts = 0;
  assert.equal(ReviewToolingRecoveryMutation.forExhaustedAttempt({
    ...recoveryInput,
    reviewRecord: { toolingAttempts: 0, toolingMaxAttempts: 1, treeSha: "a".repeat(40) },
    resolveNextTreeSha: () => {
      treeResolutionAttempts++;
      return "b".repeat(40);
    },
  }), null);
  assert.equal(treeResolutionAttempts, 0);
  assert.notEqual(ReviewToolingRecoveryMutation.forExhaustedAttempt({
    ...recoveryInput,
    reviewRecord: { toolingAttempts: 1, toolingMaxAttempts: 1, treeSha: "a".repeat(40) },
  }), null);
  assert.equal(ReviewToolingRecoveryMutation.forExhaustedAttempt({
    ...recoveryInput,
    reviewRecord: { toolingAttempts: 1, toolingMaxAttempts: 2, treeSha: "a".repeat(40) },
  }), null);

  for (const relativePath of runtimeRepairTestFiles.values()) {
    assertHistoricalFilePasses(relativePath);
  }
});
