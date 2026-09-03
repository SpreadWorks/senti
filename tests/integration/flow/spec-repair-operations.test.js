import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";

import { validWorkerHandoffTaskSpec } from "../../support/infrastructure/worker-artifact.js";
import { applySpecRepairOperations } from "../../../src/flow/lib/spec-repair-operations.js";

const INPUT_DIGEST = "b".repeat(64);
const IDENTITY = { specId: "001-repair", revision: 1, digest: INPUT_DIGEST, byteLength: 1 };
const valueDigest = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const requirementTarget = { entity: "requirement", id: "R1", field: "desc" };
const rootTarget = { entity: "spec", field: "background" };

function sourceSpec() { return validWorkerHandoffTaskSpec(); }
function permission(target, operationKinds) { return { target, operationKinds }; }
function triage(findings) { return { findings }; }
function applyFinding(findingId, allowedTargets) {
  return { findingId, disposition: "apply", allowedTargets };
}
function repair(operations, scopeExpansions = []) {
  return {
    version: 2,
    stage: "spec-repair",
    identity: IDENTITY,
    baseReviewDigest: "c".repeat(64),
    findings: [],
    operations,
    ...(scopeExpansions.length === 0 ? {} : { scopeExpansions }),
  };
}
function replace(findingIds, target, replacement, expectedDigest) {
  return {
    findingIds,
    kind: target.entity === "spec" ? "replace-field" : "replace-entity-field",
    target,
    expectedDigest,
    replacement,
    reason: "A bounded correction authorised by triage.",
  };
}
function apply(spec, findings, operations, scopeExpansions = []) {
  return applySpecRepairOperations({
    spec,
    triage: triage(findings),
    repair: repair(operations, scopeExpansions),
    inputRevision: INPUT_DIGEST,
  });
}

describe("revision-scoped spec repair operations", () => {
  it("partially adopts valid operations while auditing malformed and unauthorized proposals", () => {
    const spec = sourceSpec();
    const original = spec.requirements[0].desc;
    const result = apply(spec, [applyFinding("F-valid", [permission(requirementTarget, ["replace-entity-field"])])], [
      { findingIds: ["F-valid"], kind: "unknown-kind", target: requirementTarget, expectedDigest: null, replacement: "ignored", reason: "Malformed." },
      replace(["F-unknown"], requirementTarget, "unauthorised", valueDigest(original)),
      replace(["F-valid"], requirementTarget, "Corrected description.", valueDigest(original)),
    ]);
    assert.equal(result.spec.requirements[0].desc, "Corrected description.");
    assert.deepEqual(result.audit.appliedFindings, ["F-valid"]);
    assert.deepEqual(result.audit.discardedOperations.map((entry) => entry.reason).sort(), ["spec-repair.operations[0] kind is invalid", "unauthorized operation"].sort());
  });

  it("requires every finding in a multi-finding operation to permit its target and kind", () => {
    const spec = sourceSpec();
    const original = spec.requirements[0].desc;
    const operation = replace(["F-one", "F-two"], requirementTarget, "Joint correction.", valueDigest(original));
    const permitted = [
      applyFinding("F-one", [permission(requirementTarget, ["replace-entity-field"])]),
      applyFinding("F-two", [permission(requirementTarget, ["replace-entity-field"])]),
    ];
    const accepted = apply(spec, permitted, [operation]);
    assert.equal(accepted.spec.requirements[0].desc, "Joint correction.");
    assert.deepEqual(accepted.audit.appliedFindings, ["F-one", "F-two"]);

    const rejected = apply(sourceSpec(), [
      permitted[0],
      applyFinding("F-two", [permission(rootTarget, ["replace-field"])]),
    ], [operation]);
    assert.equal(rejected.spec.requirements[0].desc, original);
    assert.equal(rejected.audit.discardedOperations[0].reason, "unauthorized operation");
  });

  it("deduplicates identical operations and discards only conflicting targets", () => {
    const spec = sourceSpec();
    const description = spec.requirements[0].desc;
    const background = spec.background;
    const same = replace(["F-description"], requirementTarget, "One correction.", valueDigest(description));
    const result = apply(spec, [
      applyFinding("F-description", [permission(requirementTarget, ["replace-entity-field"])]),
      applyFinding("F-background", [permission(rootTarget, ["replace-field"])]),
    ], [
      same,
      structuredClone(same),
      replace(["F-description"], requirementTarget, "Competing correction.", valueDigest(description)),
      replace(["F-background"], rootTarget, "Independent correction.", valueDigest(background)),
    ]);
    assert.equal(result.spec.requirements[0].desc, description);
    assert.equal(result.spec.background, "Independent correction.");
    assert.deepEqual(result.audit.appliedFindings, ["F-background"]);
    assert.ok(!result.audit.discardedOperations.some((entry) => entry.reason === "duplicate operation"));
    assert.equal(result.audit.discardedOperations.filter((entry) => entry.reason === "conflicting operation").length, 2);
  });

  it("treats partial, empty, and scope-only repair deltas as successful no-ops", () => {
    const spec = sourceSpec();
    const partial = apply(spec, [applyFinding("F", [permission(requirementTarget, ["replace-entity-field"])])], [
      replace(["F"], requirementTarget, "stale", "0".repeat(64)),
    ]);
    assert.deepEqual(partial.spec, spec);
    assert.equal(partial.audit.discardedOperations[0].reason, "stale target digest");

    const empty = apply(spec, [], []);
    assert.deepEqual(empty.spec, spec);
    assert.deepEqual(empty.audit.appliedFindings, []);
    assert.deepEqual(empty.audit.audit, {});
    assert.equal(Object.hasOwn(empty.audit.audit, "missingRequiredTargets"), false);

    const scoped = apply(spec, [], [], [{ requestedScope: "needs a separate product decision" }]);
    assert.deepEqual(scoped.spec, spec);
    assert.deepEqual(scoped.audit.scopeExpansions.map((entry) => entry.proposal), [{ requestedScope: "needs a separate product decision" }]);
  });

  it("discards only an oversized scope proposal while applying an independent valid operation", () => {
    const spec = sourceSpec();
    const original = spec.requirements[0].desc;
    const result = apply(
      spec,
      [applyFinding("F-valid", [permission(requirementTarget, ["replace-entity-field"])])],
      [replace(["F-valid"], requirementTarget, "The valid sibling survives.", valueDigest(original))],
      [{ requestedScope: "x".repeat(33 * 1024) }],
    );
    assert.equal(result.spec.requirements[0].desc, "The valid sibling survives.");
    assert.deepEqual(result.audit.appliedFindings, ["F-valid"]);
    assert.ok(result.audit.discardedOperations.some((entry) => /scope expansion 0 is oversized/.test(entry.reason)));
    assert.deepEqual(result.audit.scopeExpansions, []);
  });

  it("fails closed for a stale immutable revision before mutating the candidate", () => {
    const spec = sourceSpec();
    assert.throws(() => applySpecRepairOperations({
      spec,
      triage: triage([]),
      repair: { ...repair([]), identity: { ...IDENTITY, digest: "d".repeat(64) } },
      inputRevision: INPUT_DIGEST,
    }), (error) => error.code === "FLOW_SPEC_REPAIR_BASE_REVISION_MISMATCH");
    assert.deepEqual(spec, sourceSpec());
  });

  it("preserves array add, replacement, deletion, immutable-base positions, and expected digests", () => {
    const spec = sourceSpec();
    spec.constraints = ["remove", "same", "same"];
    const arrayTarget = { collection: "constraints" };
    const deleteFirst = {
      findingIds: ["F-array"], kind: "delete-array-element", target: { collection: "constraints", position: 0 },
      expectedDigest: valueDigest("remove"), reason: "Delete the exact immutable-base item.",
    };
    const replaceLast = {
      findingIds: ["F-array"], kind: "replace-array-element", target: { collection: "constraints", position: 2 },
      expectedDigest: valueDigest("same"), replacement: "last only", reason: "Replace the exact immutable-base duplicate.",
    };
    const append = {
      findingIds: ["F-array"], kind: "add-array-element", target: arrayTarget,
      expectedDigest: null, replacement: "new bounded constraint", reason: "Append an independently permitted value.",
    };
    const result = apply(spec, [applyFinding("F-array", [permission(arrayTarget, ["delete-array-element", "replace-array-element", "add-array-element"])])], [deleteFirst, replaceLast, append]);
    assert.deepEqual(result.spec.constraints, ["same", "last only", "new bounded constraint"]);
    const duplicateSpec = sourceSpec();
    duplicateSpec.constraints = ["same", "same"];
    const ambiguous = apply(duplicateSpec, [applyFinding("F-array", [permission(arrayTarget, ["delete-array-element"])])], [{ ...deleteFirst, target: arrayTarget, expectedDigest: valueDigest("same") }]);
    assert.equal(ambiguous.audit.discardedOperations[0].reason, "conflicting target resolution");
  });

  it("coalesces same-content edits across finding IDs only after every permission is proven", () => {
    const spec = sourceSpec();
    const original = spec.requirements[0].desc;
    const one = replace(["F-one"], requirementTarget, "One canonical correction.", valueDigest(original));
    const two = { ...replace(["F-two"], requirementTarget, "One canonical correction.", valueDigest(original)), reason: "Different worker prose." };
    const result = apply(spec, [
      applyFinding("F-one", [permission(requirementTarget, ["replace-entity-field"])]),
      applyFinding("F-two", [permission(requirementTarget, ["replace-entity-field"])]),
    ], [one, two]);
    assert.equal(result.spec.requirements[0].desc, "One canonical correction.");
    assert.deepEqual(result.audit.appliedFindings, ["F-one", "F-two"]);
    assert.equal(result.audit.acceptedOperations.length, 1);
  });

  it("replays immutable-base array lineage after an invalid operation rollback", () => {
    const spec = sourceSpec();
    spec.constraints = ["remove", "same", "same"];
    const arrayTarget = { collection: "constraints" };
    const operations = [
      { findingIds: ["F-array"], kind: "delete-array-element", target: { collection: "constraints", position: 0 }, expectedDigest: valueDigest("remove"), reason: "Delete first immutable-base value." },
      { findingIds: ["F-goal"], kind: "replace-field", target: { entity: "spec", field: "goal" }, expectedDigest: valueDigest(spec.goal), replacement: [], reason: "This proposal intentionally violates the Spec schema." },
      { findingIds: ["F-array"], kind: "replace-array-element", target: { collection: "constraints", position: 2 }, expectedDigest: valueDigest("same"), replacement: "last only", reason: "Address immutable-base duplicate position two." },
    ];
    const result = apply(spec, [
      applyFinding("F-array", [permission(arrayTarget, ["delete-array-element", "replace-array-element"])]),
      applyFinding("F-goal", [permission({ entity: "spec", field: "goal" }, ["replace-field"])]),
    ], operations);
    assert.deepEqual(result.spec.constraints, ["same", "last only"]);
    assert.ok(result.audit.discardedOperations.some((entry) => entry.reason === "operation produces an invalid Spec schema"));
  });
});
