import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import {
  ImplReviewProposal,
  ImplReviewProposalContract,
} from "../../../src/flow/lib/impl-review-proposal.js";
import {
  createLoopChunkWorkUnitIdentity,
  createMemoryWorkUnitCheckpointStore,
  WorkUnitCheckpoint,
  WorkUnitResumeDecision,
  WorkUnitToolingFailure,
} from "../../../src/flow/lib/work-unit.js";
import { runLoopReviewWithDependencies } from "../../../src/flow/commands/review.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

function proposal(requirementId = "R1", file = "src/example.js") {
  return {
    title: "Remove duplicate branch",
    file,
    issue: "The same branch is implemented twice.",
    suggestion: "Extract the shared branch into one helper.",
    requirementId,
  };
}

function identity(contract, overrides = {}) {
  return createLoopChunkWorkUnitIdentity({
    index: 0,
    targetFiles: ["src/example.js"],
    input: "review input",
    schemaVersion: contract.schemaVersion,
    schemaDigest: contract.schemaDigest,
    allowedRequirementIds: contract.allowedRequirementIds,
    ...overrides,
  });
}

describe("ImplReviewProposalContract", () => {
  it("uses the active spec requirement IDs as the only requirementId enum", () => {
    const contract = new ImplReviewProposalContract(new Set(["R2", "R1"]));
    const itemSchema = contract.jsonSchema.properties.proposals.items;

    assert.deepEqual(itemSchema.properties.requirementId.enum, ["R1", "R2"]);
    assert.equal(itemSchema.properties.requirementId.type, "string");
    assert.equal(itemSchema.required.includes("requirementId"), true);
  });

  it("accepts valid proposals and a successful empty result as typed values", () => {
    const contract = new ImplReviewProposalContract(new Set(["R1"]));
    const populated = contract.parse(JSON.stringify({ proposals: [proposal()] }));
    const empty = contract.parse(JSON.stringify({ proposals: [] }));

    assert.equal(populated.proposals.length, 1);
    assert.ok(populated.proposals[0] instanceof ImplReviewProposal);
    assert.deepEqual(populated.proposals[0].toJSON(), proposal());
    assert.deepEqual(empty.toJSON(), { proposals: [] });
  });

  it("allows only an empty result when the active spec has no requirements", () => {
    const contract = new ImplReviewProposalContract(new Set());

    assert.equal(contract.jsonSchema.properties.proposals.maxItems, 0);
    assert.deepEqual(contract.parse(JSON.stringify({ proposals: [] })).toJSON(), { proposals: [] });
    assert.throws(
      () => contract.parse(JSON.stringify({ proposals: [proposal()] })),
      (error) => error instanceof WorkUnitToolingFailure && error.failureKind === "schema_failure",
    );
  });

  it("rejects guardrails, null, empty strings, placeholders, and unknown IDs", () => {
    const contract = new ImplReviewProposalContract(new Set(["R1"]));
    for (const invalidRequirementId of ["GR-1", null, "", "REQUIREMENT_ID", "R9"]) {
      assert.throws(
        () => contract.parse(JSON.stringify({ proposals: [proposal(invalidRequirementId)] })),
        (error) => error instanceof WorkUnitToolingFailure && error.failureKind === "schema_failure",
        `requirementId=${String(invalidRequirementId)} must fail at the provider boundary`,
      );
    }
  });

  it("enforces proposal text and repository-relative file invariants", () => {
    const requirementIds = new Set(["R1"]);
    for (const invalid of [
      { ...proposal(), title: " " },
      { ...proposal(), issue: "" },
      { ...proposal(), suggestion: "\t" },
      { ...proposal(), file: "/tmp/example.js" },
      { ...proposal(), file: "../example.js" },
      proposal("R2"),
    ]) {
      assert.throws(() => new ImplReviewProposal(invalid, { requirementIds }));
    }
  });

  it("provides the same immutable JSON Schema to per-chunk and cross-check prompts", () => {
    const contract = new ImplReviewProposalContract(new Set(["R1"]));
    const perChunk = contract.prompt({ userPrompt: "chunk", systemPrompt: "review" });
    const crossCheck = contract.prompt({ userPrompt: "summary", systemPrompt: "cross-check" });

    assert.strictEqual(perChunk.jsonSchema, contract.jsonSchema);
    assert.strictEqual(crossCheck.jsonSchema, contract.jsonSchema);
    assert.equal(Object.isFrozen(contract.jsonSchema), true);
  });
});

describe("impl review proposal WorkUnit evidence", () => {
  it("invalidates checkpoints when the schema digest or allowed requirement set changes", () => {
    const contract = new ImplReviewProposalContract(new Set(["R1"]));
    const original = identity(contract);
    const checkpoint = new WorkUnitCheckpoint({
      identity: original,
      status: "success",
      success: { proposals: [] },
    });
    const changedSchema = identity(contract, { schemaDigest: "f".repeat(64) });
    const changedRequirements = identity(contract, { allowedRequirementIds: ["R2"] });
    const checkpointStore = createMemoryWorkUnitCheckpointStore();
    checkpointStore.save(checkpoint);

    assert.notEqual(original.unitId, changedSchema.unitId);
    assert.notEqual(original.unitId, changedRequirements.unitId);
    assert.equal(checkpointStore.load(changedSchema), null);
    assert.equal(checkpointStore.load(changedRequirements), null);
    assert.equal(WorkUnitResumeDecision.fromCheckpoint(changedSchema, checkpoint).action, "execute");
    assert.equal(WorkUnitResumeDecision.fromCheckpoint(changedRequirements, checkpoint).action, "execute");
  });

  it("records invalid provider output only as a failed WorkUnit", async () => {
    const specDir = createTmpDir("impl-review-proposal-invalid-");
    try {
      const contract = new ImplReviewProposalContract(new Set(["R1"]));
      const checkpointStore = createMemoryWorkUnitCheckpointStore({ specDir });
      const result = await runLoopReviewWithDependencies({
        groups: [{ files: ["src/example.js"], representative: "src/example.js", diff: "+change" }],
        buildChunkInput: () => "review input",
        reviewChunk: async () => JSON.stringify({ proposals: [proposal("GR-1")] }),
        crossCheck: async () => JSON.stringify({ proposals: [] }),
        checkpointStore,
        proposalContract: contract,
        requirementIds: new Set(["R1"]),
        specDir,
        persistFinalArtifacts: true,
      });

      assert.equal(result.failureKind, "schema_failure");
      assert.deepEqual(checkpointStore.recordsByStatus("success"), []);
      assert.equal(checkpointStore.recordsByStatus("failed").length, 1);
      assert.equal(fs.existsSync(`${specDir}/impl-review.json`), false);
      assert.equal(fs.existsSync(`${specDir}/review.md`), false);
    } finally {
      removeTmpDir(specDir);
    }
  });

  it("persists an empty proposal batch as a successful PASS artifact", async () => {
    const specDir = createTmpDir("impl-review-proposal-empty-");
    try {
      const contract = new ImplReviewProposalContract(new Set(["R1"]));
      const checkpointStore = createMemoryWorkUnitCheckpointStore({ specDir });
      const result = await runLoopReviewWithDependencies({
        groups: [{ files: ["src/example.js"], representative: "src/example.js", diff: "+change" }],
        buildChunkInput: () => "review input",
        reviewChunk: async () => JSON.stringify({ proposals: [] }),
        crossCheck: async () => JSON.stringify({ proposals: [] }),
        checkpointStore,
        proposalContract: contract,
        requirementIds: new Set(["R1"]),
        specDir,
        persistFinalArtifacts: true,
      });

      assert.equal(result.proposals.length, 0);
      assert.equal(checkpointStore.recordsByStatus("success").length, 1);
      const artifact = JSON.parse(fs.readFileSync(`${specDir}/impl-review.json`, "utf8"));
      assert.deepEqual(artifact.blockingFindings, []);
      assert.deepEqual(artifact.nonBlockingImprovements, []);
      assert.equal(fs.existsSync(`${specDir}/review.md`), true);
    } finally {
      removeTmpDir(specDir);
    }
  });
});
