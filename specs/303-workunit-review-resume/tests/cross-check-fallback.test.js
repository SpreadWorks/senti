// spec: R7 R8
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import * as reviewCommand from "../../../src/flow/commands/review.js";

const workUnitModuleUrl = new URL("../../../src/flow/lib/work-unit.js", import.meta.url);

async function loadWorkUnitModule() {
  assert.equal(fs.existsSync(workUnitModuleUrl), true, "src/flow/lib/work-unit.js must exist");
  return import(workUnitModuleUrl);
}

function group(file) {
  return { representative: file, files: [file], requirements: [] };
}

test("R7: loop cross-check is checkpointed and reused by summary hashes", async () => {
  const { createMemoryWorkUnitCheckpointStore } = await loadWorkUnitModule();
  const { runLoopReviewWithDependencies } = reviewCommand;
  assert.equal(typeof runLoopReviewWithDependencies, "function");

  const checkpointStore = createMemoryWorkUnitCheckpointStore({ namespace: "impl-review" });
  let crossCheckCalls = 0;
  let summaryVersion = "v1";
  let reviewChunkCalls = 0;
  const options = {
    groups: [group("src/a.js"), group("src/b.js")],
    maxLoopCalls: 4,
    checkpointStore,
    buildChunkInput: (chunk) => `diff ${summaryVersion} for ${chunk[0].representative}`,
    reviewChunk: async (chunk) => {
      reviewChunkCalls += 1;
      return [
        `### Check ${chunk[0].representative}`,
        `File: ${chunk[0].representative}`,
        `The behavior changed ${summaryVersion}.`,
      ].join("\n");
    },
    crossCheck: async () => {
      crossCheckCalls += 1;
      return "NO_PROPOSALS";
    },
  };

  await runLoopReviewWithDependencies(options);
  await runLoopReviewWithDependencies(options);

  assert.equal(crossCheckCalls, 1);
  assert.equal(reviewChunkCalls, 2);
  assert.equal(checkpointStore.recordsByKind("cross-check").length, 1);

  await runLoopReviewWithDependencies({
    ...options,
    groups: [group("src/a.js")],
  });
  assert.equal(crossCheckCalls, 1);

  await runLoopReviewWithDependencies({
    ...options,
    maxLoopCalls: 2,
  });
  assert.equal(crossCheckCalls, 1);

  summaryVersion = "v2";
  await runLoopReviewWithDependencies(options);
  assert.equal(crossCheckCalls, 2);
  assert.equal(reviewChunkCalls, 4);
  assert.equal(checkpointStore.recordsByKind("cross-check").length, 2);
});

test("R8: two retryable parent failures split only that parent into one-level bounded children", async () => {
  const {
    createMemoryWorkUnitCheckpointStore,
    planFallbackChildWorkUnits,
    runFallbackChildWorkUnits,
    shouldFallbackSplit,
  } = await loadWorkUnitModule();
  assert.equal(typeof planFallbackChildWorkUnits, "function");
  assert.equal(typeof shouldFallbackSplit, "function");

  const parentChunk = [group("src/a.js"), group("src/b.js"), group("src/c.js")];
  const positiveFailures = [
    { unitId: "loop-chunk-parent", failureKind: "provider_failure", retryable: true },
    { unitId: "loop-chunk-parent", failureKind: "timeout", retryable: true },
  ];
  assert.equal(shouldFallbackSplit(positiveFailures), true);
  assert.equal(shouldFallbackSplit([
    { unitId: "loop-chunk-parent", failureKind: "provider_failure", retryable: true },
  ]), false);
  assert.equal(shouldFallbackSplit([
    { unitId: "loop-chunk-parent", failureKind: "provider_failure", retryable: true },
    { unitId: "other-parent", failureKind: "timeout", retryable: true },
  ]), false);
  assert.equal(shouldFallbackSplit([
    { unitId: "loop-chunk-parent", failureKind: "checkpoint_io_failure", retryable: false },
    { unitId: "loop-chunk-parent", failureKind: "invariant_violation", retryable: false },
  ]), false);

  const children = planFallbackChildWorkUnits({
    parentUnitId: "loop-chunk-parent",
    parentStableOrderKey: "chunk-0003",
    parentChunk,
    priorFailures: [
      { failureKind: "provider_failure", retryable: true },
      { failureKind: "timeout", retryable: true },
    ],
  });

  assert.equal(children.length, parentChunk.length);
  assert.deepEqual(children.map((child) => child.identity.parentUnitId), [
    "loop-chunk-parent",
    "loop-chunk-parent",
    "loop-chunk-parent",
  ]);
  assert.deepEqual(children.map((child) => child.identity.kind), [
    "loop-chunk-child",
    "loop-chunk-child",
    "loop-chunk-child",
  ]);
  assert.equal(children.some((child) => child.canSplitAgain()), false);

  const checkpointStore = createMemoryWorkUnitCheckpointStore({ namespace: "impl-review" });
  await checkpointStore.saveFailed({ unitId: "loop-chunk-parent", failure: positiveFailures[0] });
  await checkpointStore.saveFailed({ unitId: "loop-chunk-parent", failure: positiveFailures[1] });
  assert.equal(shouldFallbackSplit(checkpointStore.failuresForUnit("loop-chunk-parent")), true);

  const childResult = await runFallbackChildWorkUnits({
    checkpointStore,
    parentUnitId: "loop-chunk-parent",
    parentChunk,
    children,
    buildChunkInput: (chunk) => `diff for ${chunk[0].representative}`,
    reviewChunk: async (chunk) => [
      `### Check ${chunk[0].representative}`,
      `File: ${chunk[0].representative}`,
      "The behavior changed.",
    ].join("\n"),
  });

  assert.deepEqual(childResult.proposals.map((proposal) => proposal.file), ["src/a.js", "src/b.js", "src/c.js"]);
  assert.equal(checkpointStore.recordsByKind("loop-chunk-child").length, 3);
  assert.equal(checkpointStore.recordsByUnitId("loop-chunk-parent").some((record) => record.status === "success"), false);
});
