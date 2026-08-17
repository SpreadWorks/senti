// spec: R4 R5 R6 R10
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import * as reviewCommand from "../../../src/flow/commands/review.js";
import * as runReview from "../../../src/flow/lib/run-review.js";

const workUnitModuleUrl = new URL("../../../src/flow/lib/work-unit.js", import.meta.url);

async function loadWorkUnitModule() {
  assert.equal(fs.existsSync(workUnitModuleUrl), true, "src/flow/lib/work-unit.js must exist");
  return import(workUnitModuleUrl);
}

const proposalForA = [
  "### Check src/a.js",
  "File: src/a.js",
  "The behavior changed.",
].join("\n");

function group(file) {
  return { representative: file, files: [file], requirements: [] };
}

test("R4: loop review reuses matching success checkpoints and executes missing failed or stale chunks", async () => {
  const {
    createLoopChunkWorkUnitIdentity,
    createMemoryWorkUnitCheckpointStore,
  } = await loadWorkUnitModule();
  const { runLoopReviewWithDependencies } = reviewCommand;
  assert.equal(typeof createLoopChunkWorkUnitIdentity, "function");
  assert.equal(typeof runLoopReviewWithDependencies, "function");

  const checkpointStore = createMemoryWorkUnitCheckpointStore({ namespace: "impl-review" });
  await checkpointStore.saveSuccess({
    identity: createLoopChunkWorkUnitIdentity({
      index: 0,
      parentUnitId: null,
      targetFiles: ["src/a.js"],
      input: "diff for src/a.js",
      commandId: "flow.impl.review.propose",
      providerIdentity: "test-provider",
      promptVersion: "impl-review-loop-v1",
      schemaVersion: "impl-review-proposals-v1",
    }),
    rawResponse: proposalForA,
    success: { proposals: [{ title: "Check src/a.js", file: "src/a.js" }] },
  });
  await checkpointStore.saveFailed({
    identity: createLoopChunkWorkUnitIdentity({
      index: 1,
      parentUnitId: null,
      targetFiles: ["src/b.js"],
      input: "diff for src/b.js",
      commandId: "flow.impl.review.propose",
      providerIdentity: "test-provider",
      promptVersion: "impl-review-loop-v1",
      schemaVersion: "impl-review-proposals-v1",
    }),
    failure: { failureKind: "provider_failure", retryable: true, message: "previous failure" },
  });
  await checkpointStore.saveSuccess({
    identity: createLoopChunkWorkUnitIdentity({
      index: 2,
      parentUnitId: null,
      targetFiles: ["src/c.js"],
      input: "old diff for src/c.js",
      commandId: "flow.impl.review.propose",
      providerIdentity: "test-provider",
      promptVersion: "impl-review-loop-v1",
      schemaVersion: "impl-review-proposals-v1",
    }),
    rawResponse: "NO_PROPOSALS",
    success: { proposals: [] },
  });

  const providerCalls = [];
  await runLoopReviewWithDependencies({
    groups: [group("src/a.js"), group("src/b.js"), group("src/c.js"), group("src/d.js")],
    maxLoopCalls: 8,
    checkpointStore,
    providerIdentity: "test-provider",
    promptVersion: "impl-review-loop-v1",
    schemaVersion: "impl-review-proposals-v1",
    buildChunkInput: (chunk) => `diff for ${chunk[0].representative}`,
    reviewChunk: async (chunk) => {
      providerCalls.push(chunk[0].representative);
      return [
        `### Check ${chunk[0].representative}`,
        `File: ${chunk[0].representative}`,
        "The behavior changed.",
      ].join("\n");
    },
    crossCheck: async () => "NO_PROPOSALS",
  });

  assert.deepEqual(providerCalls, ["src/b.js", "src/c.js", "src/d.js"]);
});

test("R5: later chunk tooling failure preserves earlier success checkpoints without final artifacts", async () => {
  const {
    createMemoryWorkUnitCheckpointStore,
    WorkUnitToolingFailure,
  } = await loadWorkUnitModule();
  const { runLoopReviewWithDependencies } = reviewCommand;
  assert.equal(typeof runLoopReviewWithDependencies, "function");

  const specDir = fs.mkdtempSync(path.join(os.tmpdir(), "senti-workunit-loop-"));
  const checkpointStore = createMemoryWorkUnitCheckpointStore({ specDir, namespace: "impl-review" });
  const finalReviewPath = path.join(specDir, "impl-review.json");
  const finalReviewMdPath = path.join(specDir, "review.md");
  const calls = [];
  let crossCheckCalls = 0;

  const result = await runLoopReviewWithDependencies({
    groups: [group("src/a.js"), group("src/b.js"), group("src/c.js")],
    maxLoopCalls: 4,
    specDir,
    checkpointStore,
    persistFinalArtifacts: true,
    buildChunkInput: (chunk) => `diff for ${chunk[0].representative}`,
    reviewChunk: async (chunk) => {
      calls.push(chunk[0].representative);
      if (chunk[0].representative === "src/b.js") {
        assert.equal(checkpointStore.recordsByStatus("success").length, 1);
        throw new WorkUnitToolingFailure({
          failureKind: "provider_failure",
          message: "provider unavailable",
        });
      }
      return proposalForA;
    },
    crossCheck: async () => {
      crossCheckCalls += 1;
      return "NO_PROPOSALS";
    },
  });

  assert.equal(result.verdict, "TOOLING_FAILURE");
  assert.equal(result.reviewRetryConsumed, false);
  assert.equal(fs.existsSync(finalReviewPath), false);
  assert.equal(fs.existsSync(finalReviewMdPath), false);
  assert.deepEqual(calls, ["src/a.js", "src/b.js"]);
  assert.equal(crossCheckCalls, 0);
  assert.equal(checkpointStore.recordsByStatus("success").length, 1);
  assert.equal(checkpointStore.recordsByStatus("failed").length, 1);
});

test("R5: timeout parser and schema failures are checkpointed tooling failures", async () => {
  const {
    createMemoryWorkUnitCheckpointStore,
    WorkUnitToolingFailure,
  } = await loadWorkUnitModule();
  const { runLoopReviewWithDependencies } = reviewCommand;
  assert.equal(typeof runLoopReviewWithDependencies, "function");

  for (const failureKind of ["timeout", "parser_failure", "schema_failure"]) {
    const specDir = fs.mkdtempSync(path.join(os.tmpdir(), `senti-workunit-${failureKind}-`));
    const checkpointStore = createMemoryWorkUnitCheckpointStore({ specDir, namespace: "impl-review" });
    const result = await runLoopReviewWithDependencies({
      groups: [group(`src/${failureKind}.js`)],
      maxLoopCalls: 4,
      specDir,
      checkpointStore,
      persistFinalArtifacts: true,
      buildChunkInput: (chunk) => `diff for ${chunk[0].representative}`,
      reviewChunk: async () => {
        throw new WorkUnitToolingFailure({
          failureKind,
          message: `${failureKind} during WorkUnit execution`,
        });
      },
      crossCheck: async () => "NO_PROPOSALS",
    });

    assert.equal(result.verdict, "TOOLING_FAILURE");
    assert.equal(result.reviewRetryConsumed, false);
    assert.equal(checkpointStore.recordsByStatus("failed").length, 1);
    assert.equal(checkpointStore.recordsByStatus("failed")[0].failure.failureKind, failureKind);
    assert.equal(fs.existsSync(path.join(specDir, "impl-review.json")), false);
    assert.equal(fs.existsSync(path.join(specDir, "review.md")), false);
  }
});

test("R6: final review artifacts are produced only after every planned WorkUnit succeeds", async () => {
  const { createMemoryWorkUnitCheckpointStore } = await loadWorkUnitModule();
  const { loopProposalsToImplReviewJson, parseImplLoopProposals, runLoopReviewWithDependencies } = reviewCommand;
  assert.equal(typeof runLoopReviewWithDependencies, "function");
  assert.equal(typeof loopProposalsToImplReviewJson, "function");

  const specDir = fs.mkdtempSync(path.join(os.tmpdir(), "senti-workunit-success-"));
  const finalReviewPath = path.join(specDir, "impl-review.json");
  const finalReviewMdPath = path.join(specDir, "review.md");
  const checkpointStore = createMemoryWorkUnitCheckpointStore({ specDir, namespace: "impl-review" });
  assert.equal(fs.existsSync(finalReviewPath), false);
  assert.equal(fs.existsSync(finalReviewMdPath), false);

  const result = await runLoopReviewWithDependencies({
    groups: [group("src/a.js"), group("src/b.js")],
    maxLoopCalls: 2,
    specDir,
    checkpointStore,
    persistFinalArtifacts: true,
    requirementIds: new Set(["R1"]),
    parseReviewProposals: (text) => parseImplLoopProposals(text, { requirementIds: new Set(["R1"]) }),
    buildChunkInput: (chunk) => `diff for ${chunk[0].representative}`,
    reviewChunk: async (chunk) => [
      `### Check ${chunk[0].representative}`,
      `**File:** ${chunk[0].representative}`,
      "**Requirement:** R1",
      "The behavior changed.",
    ].join("\n"),
    crossCheck: async () => "NO_PROPOSALS",
  });

  const finalJson = JSON.parse(loopProposalsToImplReviewJson(result.proposals, new Set(["R1"])));
  assert.deepEqual(finalJson.blockingFindings, []);
  assert.equal(finalJson.nonBlockingImprovements.length, 2);
  assert.equal(checkpointStore.recordsByStatus("success").length, 2);
  assert.equal(fs.existsSync(finalReviewPath), true);
  assert.equal(fs.existsSync(finalReviewMdPath), true);
  const writtenJson = JSON.parse(fs.readFileSync(finalReviewPath, "utf8"));
  assert.deepEqual(writtenJson.blockingFindings, []);
  assert.equal(writtenJson.nonBlockingImprovements.length, 2);
});

test("R5: malformed provider output becomes parser or schema checkpoint failure", async () => {
  const {
    createMemoryWorkUnitCheckpointStore,
  } = await loadWorkUnitModule();
  const { runLoopReviewWithDependencies } = reviewCommand;
  assert.equal(typeof runLoopReviewWithDependencies, "function");

  for (const { failureKind, providerOutput } of [
    { failureKind: "parser_failure", providerOutput: "this is not a proposal document" },
    { failureKind: "schema_failure", providerOutput: JSON.stringify({ proposals: [{ title: "", file: 42 }] }) },
  ]) {
    const specDir = fs.mkdtempSync(path.join(os.tmpdir(), `senti-workunit-${failureKind}-provider-`));
    const checkpointStore = createMemoryWorkUnitCheckpointStore({ specDir, namespace: "impl-review" });
    const result = await runLoopReviewWithDependencies({
      groups: [group(`src/${failureKind}-provider.js`)],
      maxLoopCalls: 4,
      specDir,
      checkpointStore,
      persistFinalArtifacts: true,
      validateProviderOutput: true,
      buildChunkInput: (chunk) => `diff for ${chunk[0].representative}`,
      reviewChunk: async () => providerOutput,
      crossCheck: async () => "NO_PROPOSALS",
    });

    assert.equal(result.verdict, "TOOLING_FAILURE");
    assert.equal(result.reviewRetryConsumed, false);
    assert.equal(checkpointStore.recordsByStatus("failed").length, 1);
    assert.equal(checkpointStore.recordsByStatus("failed")[0].failure.failureKind, failureKind);
    assert.equal(fs.existsSync(path.join(specDir, "impl-review.json")), false);
    assert.equal(fs.existsSync(path.join(specDir, "review.md")), false);
  }
});

test("R10: WorkUnit tooling failures normalize without semantic reviewRetry consumption", async () => {
  const {
    classifyWorkUnitFailure,
    createMemoryWorkUnitCheckpointStore,
    shouldFallbackSplit,
    WorkUnitInvariantError,
  } = await loadWorkUnitModule();
  assert.equal(typeof classifyWorkUnitFailure, "function");
  assert.equal(typeof shouldFallbackSplit, "function");

  const checkpointStore = createMemoryWorkUnitCheckpointStore({ namespace: "impl-review" });
  for (const failureKind of ["provider_failure", "timeout", "parser_failure", "schema_failure"]) {
    const classified = classifyWorkUnitFailure(new Error(failureKind), { failureKind });
    assert.equal(classified.retryable, true);
    assert.equal(classified.toolingFailure, true);
  }
  const ioFailure = classifyWorkUnitFailure(new Error("EACCES"), { failureKind: "checkpoint_io_failure" });
  const invariantFailure = classifyWorkUnitFailure(new WorkUnitInvariantError("bad identity"));
  assert.equal(ioFailure.retryable, false);
  assert.equal(ioFailure.commandFailure, true);
  assert.equal(ioFailure.toolingFailure, false);
  assert.equal(invariantFailure.retryable, false);
  assert.equal(invariantFailure.commandFailure, true);
  assert.equal(invariantFailure.toolingFailure, false);
  await checkpointStore.saveFailed({ unitId: "parent", failure: { failureKind: "checkpoint_io_failure", retryable: false } });
  await checkpointStore.saveFailed({ unitId: "parent", failure: { failureKind: "invariant_violation", retryable: false } });
  assert.equal(shouldFallbackSplit(checkpointStore.failuresForUnit("parent")), false);

  assert.equal(typeof runReview.normalizeImplReviewSubprocessResult, "function");
  const commandFailure = runReview.normalizeImplReviewSubprocessResult({
    verdict: "COMMAND_FAILURE",
    failureKind: "checkpoint_io_failure",
    retryable: false,
    message: "checkpoint store write failed",
    artifacts: [],
  });
  assert.equal(commandFailure.verdict, "COMMAND_FAILURE");
  assert.equal(commandFailure.reviewRetryConsumed, false);
  assert.notEqual(commandFailure.verdict, "TOOLING_FAILURE");

  const normalized = runReview.normalizeImplReviewSubprocessResult({
    verdict: "TOOLING_FAILURE",
    failureKind: "schema_failure",
    retryable: true,
    message: "checkpointed schema failure",
    artifacts: [],
  });

  assert.equal(normalized.verdict, "TOOLING_FAILURE");
  assert.equal(normalized.reviewRetryConsumed, false);
  assert.equal(normalized.failureKind, "schema_failure");
  assert.deepEqual(normalized.artifacts, []);
});
