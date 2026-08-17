// spec: R1 R2 R3 R4 R12
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

const workUnitModuleUrl = new URL("../../../src/flow/lib/work-unit.js", import.meta.url);

async function loadWorkUnitModule() {
  assert.equal(fs.existsSync(workUnitModuleUrl), true, "src/flow/lib/work-unit.js must exist");
  return import(workUnitModuleUrl);
}

function identity(WorkUnitIdentity, overrides = {}) {
  return new WorkUnitIdentity({
    phase: "impl-review",
    kind: "loop-chunk",
    stableOrderKey: "chunk-0001",
    parentUnitId: null,
    targetFiles: ["src/a.js"],
    inputHash: "input-a",
    commandId: "flow.impl.review.propose",
    providerIdentity: "test-provider",
    promptVersion: "impl-review-loop-v1",
    schemaVersion: "impl-review-proposals-v1",
    ...overrides,
  });
}

function checkpointRecord({ WorkUnitCheckpoint, WorkUnitIdentity }, overrides = {}) {
  return new WorkUnitCheckpoint({
    identity: identity(WorkUnitIdentity),
    status: "success",
    attemptCount: 1,
    startedAt: "2026-06-17T00:00:00.000Z",
    finishedAt: "2026-06-17T00:00:01.000Z",
    success: { proposals: [{ title: "Keep behavior", file: "src/a.js" }] },
    ...overrides,
  });
}

test("R1: WorkUnit foundation exposes value classes with constructor invariants", async () => {
  const {
    WorkUnitCheckpoint,
    WorkUnitIdentity,
    WorkUnitPlanEntry,
    WorkUnitResumeDecision,
  } = await loadWorkUnitModule();

  assert.equal(typeof WorkUnitIdentity, "function");
  assert.equal(typeof WorkUnitPlanEntry, "function");
  assert.equal(typeof WorkUnitCheckpoint, "function");
  assert.equal(typeof WorkUnitResumeDecision, "function");

  const planEntry = new WorkUnitPlanEntry({
    identity: identity(WorkUnitIdentity),
    input: "diff body",
    groups: [{ representative: "src/a.js", files: ["src/a.js"] }],
  });
  assert.ok(planEntry.identity instanceof WorkUnitIdentity);
  assert.throws(() => identity(WorkUnitIdentity, { phase: "" }), /phase|required/i);
  assert.throws(() => identity(WorkUnitIdentity, { stableOrderKey: "" }), /stableOrderKey|required/i);
  assert.throws(() => identity(WorkUnitIdentity, { targetFiles: [] }), /targetFiles|required/i);
  assert.deepEqual(WorkUnitIdentity.fromJSON(identity(WorkUnitIdentity).toJSON()).toJSON(), identity(WorkUnitIdentity).toJSON());
  assert.throws(() => new WorkUnitResumeDecision({ action: "maybe" }), /action|decision|status/i);
  assert.throws(() => checkpointRecord({ WorkUnitCheckpoint, WorkUnitIdentity }, { status: "unknown" }), /status/i);
});

test("R2: stable unitId is separate from full identity comparison", async () => {
  const { WorkUnitIdentity } = await loadWorkUnitModule();
  const planned = identity(WorkUnitIdentity);
  const changedInput = identity(WorkUnitIdentity, { inputHash: "input-b" });
  const changedProvider = identity(WorkUnitIdentity, { providerIdentity: "other-provider" });
  const changedPrompt = identity(WorkUnitIdentity, { promptVersion: "impl-review-loop-v2" });
  const changedSchema = identity(WorkUnitIdentity, { schemaVersion: "impl-review-proposals-v2" });
  const changedCommand = identity(WorkUnitIdentity, { commandId: "flow.impl.review.propose.v2" });
  const changedTargets = identity(WorkUnitIdentity, { targetFiles: ["src/a.js", "src/extra.js"] });
  const equivalentTargets = identity(WorkUnitIdentity, { targetFiles: ["./src/b.js", "src/a.js"] });
  const normalizedTargets = identity(WorkUnitIdentity, { targetFiles: ["src/a.js", "src/b.js"] });
  const changedPhase = identity(WorkUnitIdentity, { phase: "test-review" });
  const changedKind = identity(WorkUnitIdentity, { kind: "cross-check" });
  const changedOrder = identity(WorkUnitIdentity, { stableOrderKey: "chunk-0002" });
  const changedParent = identity(WorkUnitIdentity, { parentUnitId: "parent-1" });

  assert.equal(changedInput.unitId, planned.unitId);
  assert.equal(changedProvider.unitId, planned.unitId);
  assert.equal(changedPrompt.unitId, planned.unitId);
  assert.equal(changedSchema.unitId, planned.unitId);
  assert.equal(changedCommand.unitId, planned.unitId);
  assert.equal(changedTargets.unitId, planned.unitId);
  assert.equal(planned.matchesFullIdentity(changedInput), false);
  assert.equal(planned.matchesFullIdentity(changedProvider), false);
  assert.equal(planned.matchesFullIdentity(changedPrompt), false);
  assert.equal(planned.matchesFullIdentity(changedSchema), false);
  assert.equal(planned.matchesFullIdentity(changedCommand), false);
  assert.equal(planned.matchesFullIdentity(changedTargets), false);
  assert.equal(normalizedTargets.matchesFullIdentity(equivalentTargets), true);
  assert.notEqual(changedPhase.unitId, planned.unitId);
  assert.notEqual(changedKind.unitId, planned.unitId);
  assert.notEqual(changedOrder.unitId, planned.unitId);
  assert.notEqual(changedParent.unitId, planned.unitId);
  assert.equal(planned.matchesFullIdentity(identity(WorkUnitIdentity)), true);
});

test("R3: checkpoint store writes under spec-dir review history by unitId", async () => {
  const { WorkUnitCheckpoint, WorkUnitCheckpointStore, WorkUnitIdentity } = await loadWorkUnitModule();
  const specDir = fs.mkdtempSync(path.join(os.tmpdir(), "senti-workunit-"));
  const store = new WorkUnitCheckpointStore({ specDir, namespace: "impl-review" });
  const checkpoint = checkpointRecord({ WorkUnitCheckpoint, WorkUnitIdentity });

  await store.save(checkpoint);

  const checkpointPath = path.join(
    specDir,
    "review-history",
    "work-units",
    "impl-review",
    `${checkpoint.unitId}.json`,
  );
  assert.equal(fs.existsSync(checkpointPath), true);
  const saved = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
  assert.equal(saved.version, 1);
  assert.equal(saved.phase, "impl-review");
  assert.equal(saved.kind, "loop-chunk");
  assert.equal(saved.unitId, checkpoint.unitId);
  assert.deepEqual(saved.targetFiles, ["src/a.js"]);
  assert.equal(saved.inputHash, "input-a");
  assert.equal(saved.providerIdentity, "test-provider");
  assert.equal(saved.promptVersion, "impl-review-loop-v1");
  assert.equal(saved.schemaVersion, "impl-review-proposals-v1");
  assert.equal(saved.identity.inputHash, "input-a");
  assert.equal(saved.status, "success");
  assert.equal(saved.attemptCount, 1);
  assert.equal(saved.startedAt, "2026-06-17T00:00:00.000Z");
  assert.equal(saved.finishedAt, "2026-06-17T00:00:01.000Z");
  assert.deepEqual(saved.success, {
    proposals: [{ title: "Keep behavior", file: "src/a.js" }],
  });
});

test("R4: resume decision reuses only matching success checkpoints", async () => {
  const { WorkUnitCheckpoint, WorkUnitIdentity, WorkUnitResumeDecision } = await loadWorkUnitModule();
  const planned = identity(WorkUnitIdentity);
  const matchingSuccess = checkpointRecord({ WorkUnitCheckpoint, WorkUnitIdentity }, { identity: planned, status: "success" });
  const failed = checkpointRecord({ WorkUnitCheckpoint, WorkUnitIdentity }, {
    identity: planned,
    status: "failed",
    success: null,
    failure: { failureKind: "provider_failure", retryable: true },
  });
  const stale = checkpointRecord(
    { WorkUnitCheckpoint, WorkUnitIdentity },
    { identity: identity(WorkUnitIdentity, { inputHash: "input-b" }), status: "success" },
  );

  assert.equal(WorkUnitResumeDecision.fromCheckpoint(planned, matchingSuccess).action, "reuse");
  assert.equal(WorkUnitResumeDecision.fromCheckpoint(planned, null).action, "execute");
  assert.equal(WorkUnitResumeDecision.fromCheckpoint(planned, failed).action, "execute");
  assert.equal(WorkUnitResumeDecision.fromCheckpoint(planned, stale).action, "execute");
  assert.equal(WorkUnitResumeDecision.fromCheckpoint(planned, stale).reason, "stale");
});

test("R12: raw responses and failure details stay inside spec-dir checkpoint evidence", async () => {
  const { WorkUnitCheckpoint, WorkUnitCheckpointStore, WorkUnitIdentity } = await loadWorkUnitModule();
  const specDir = fs.mkdtempSync(path.join(os.tmpdir(), "senti-workunit-raw-"));
  const store = new WorkUnitCheckpointStore({ specDir, namespace: "impl-review" });
  const failed = checkpointRecord({ WorkUnitCheckpoint, WorkUnitIdentity }, {
    status: "failed",
    success: null,
    rawResponse: "provider returned unexpected text",
    failure: {
      failureKind: "parser_failure",
      retryable: true,
      message: "Could not parse proposals",
    },
  });

  const checkpointPath = await store.save(failed);
  assert.equal(checkpointPath.startsWith(specDir + path.sep), true);
  const saved = JSON.parse(fs.readFileSync(checkpointPath, "utf8"));
  assert.equal(saved.rawResponse, "provider returned unexpected text");
  assert.deepEqual(saved.failure, {
    failureKind: "parser_failure",
    retryable: true,
    message: "Could not parse proposals",
  });
});
