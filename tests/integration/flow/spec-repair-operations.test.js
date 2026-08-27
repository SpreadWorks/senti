import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";

import { validWorkerHandoffSpec } from "../../support/infrastructure/worker-artifact.js";
import {
  applySpecRepairOperations,
  SpecRepairArrayAdd,
  SpecRepairArrayDelete,
  SpecRepairArrayReplace,
  SpecRepairCorrectionHistory,
  SpecRepairFieldReplace,
  SpecRepairIdEntityFieldReplace,
  SpecRepairOperationBatch,
  SpecRepairRequiredTargetsError,
} from "../../../src/flow/lib/spec-repair-operations.js";

const INPUT_REVISION = "b".repeat(64);
const BASE_REVISION = `sha256:${INPUT_REVISION}`;

function digest(value) { return crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
function sourceSpec() {
  return {
    ...validWorkerHandoffSpec(),
    tasks: [{
      id: "T1", title: "Keep task contract", goal: "Keep the approved task stable.",
      acceptance: ["The task stays stable."], implementation_notes: "No change.",
      test_strategy: "Run the focused test.", origin: "plan", added_round: 0, status: "pending", parent: null,
    }],
  };
}
function root(field) { return { entity: "spec", field }; }
function requirement(id, field) { return { entity: "requirement", id, field }; }
function array(collection, position = undefined) { return position === undefined ? { collection } : { collection, position }; }
function permission(target, operationKinds) { return { target, operationKinds }; }
function triage(allowedTargets, requiredTargets) {
  return { items: [{ findingId: "F", decision: "apply", allowedTargets, requiredTargets }] };
}
function repair(operations, baseRevision = BASE_REVISION) { return { version: 1, baseRevision, operations, scopeExpansions: [] }; }
function operation(kind, target, replacement, expectedDigest, extra = {}) {
  return { findingId: "F", kind, target, expectedDigest, replacement, reason: "Apply a bounded, authorized correction.", ...extra };
}
function deleteOperation(target, expectedDigest, extra = {}) {
  return { findingId: "F", kind: "delete-array-element", target, expectedDigest, reason: "Delete the exact obsolete element.", ...extra };
}
function apply(spec, allowedTargets, requiredTargets, operations) {
  return applySpecRepairOperations({ spec, triage: triage(allowedTargets, requiredTargets), repair: repair(operations), inputRevision: INPUT_REVISION });
}

describe("command-owned spec repair operations", () => {
  it("accepts only the board v1 operation envelope and exact immutable revision identity", () => {
    const valid = repair([]);
    assert.ok(new SpecRepairOperationBatch(valid));
    assert.throws(() => new SpecRepairOperationBatch({ ...valid, version: 2 }));
    assert.throws(() => new SpecRepairOperationBatch({ ...valid, baseRevision: INPUT_REVISION }));
    assert.throws(() => applySpecRepairOperations({
      spec: sourceSpec(), triage: triage([permission(requirement("R1", "desc"), ["replace-entity-field"])], [requirement("R1", "desc")]),
      repair: repair([], `sha256:${"c".repeat(64)}`), inputRevision: INPUT_REVISION,
    }), (error) => error.code === "FLOW_SPEC_REPAIR_BASE_REVISION_MISMATCH");
  });

  it("constructs every bounded operation class with structured targets and per-kind shapes", () => {
    const reason = "A concrete bounded reason.";
    assert.ok(new SpecRepairFieldReplace(operation("replace-field", root("goal"), "A replacement goal.", digest("old"), { reason }), 0));
    assert.ok(new SpecRepairIdEntityFieldReplace(operation("replace-entity-field", requirement("R1", "desc"), "A replacement description.", digest("old"), { reason }), 0));
    assert.ok(new SpecRepairArrayAdd(operation("add-array-element", array("constraints"), "A new constraint.", null, { reason }), 0));
    assert.ok(new SpecRepairArrayReplace(operation("replace-array-element", array("constraints", 0), "A replacement constraint.", digest("old"), { reason }), 0));
    assert.ok(new SpecRepairArrayDelete(deleteOperation(array("constraints", 0), digest("old"), { reason }), 0));
    assert.throws(() => new SpecRepairFieldReplace(operation("replace-field", root("goal"), "x", null), 0));
    assert.throws(() => new SpecRepairArrayAdd(operation("add-array-element", array("constraints", 0), "x", null), 0));
    assert.throws(() => new SpecRepairArrayDelete({ ...deleteOperation(array("constraints"), digest("old")), replacement: null }, 0));
  });

  it("uses operation capabilities, so collection permission does not authorize deletion", () => {
    const spec = sourceSpec();
    spec.constraints = ["approved constraint"];
    const description = spec.requirements[0].desc;
    const result = apply(
      spec,
      [
        permission(array("constraints"), ["replace-array-element"]),
        permission(requirement("R1", "desc"), ["replace-entity-field"]),
      ],
      [requirement("R1", "desc")],
      [
        deleteOperation(array("constraints"), digest("approved constraint")),
        operation("replace-entity-field", requirement("R1", "desc"), `${description} Clarified.`, digest(description)),
      ],
    );
    assert.deepEqual(result.spec.constraints, ["approved constraint"]);
    assert.equal(result.spec.requirements[0].desc, `${description} Clarified.`);
    assert.equal(result.audit.discardedOperations[0].reason, "unauthorized operation");
  });

  it("does not let an unauthorized same-target proposal create a conflict for an allowed operation", () => {
    const spec = sourceSpec();
    const description = spec.requirements[0].desc;
    const target = requirement("R1", "desc");
    const result = apply(
      spec,
      [permission(target, ["replace-entity-field"])], [target],
      [
        { ...operation("replace-entity-field", target, "Unauthorized correction.", digest(description)), findingId: "unknown-finding" },
        operation("replace-entity-field", target, "Authorized correction.", digest(description)),
      ],
    );
    assert.equal(result.spec.requirements[0].desc, "Authorized correction.");
    assert.equal(result.audit.discardedOperations.length, 1);
    assert.equal(result.audit.discardedOperations[0].reason, "unauthorized operation");
  });

  it("discards every same-attempt conflict while retaining independent staged work for correction", () => {
    const spec = sourceSpec();
    const description = spec.requirements[0].desc;
    assert.throws(() => apply(
      spec,
      [
        permission(requirement("R1", "desc"), ["replace-entity-field"]),
        permission(root("background"), ["replace-field"]),
      ],
      [requirement("R1", "desc"), root("background")],
      [
        operation("replace-entity-field", requirement("R1", "desc"), "First correction.", digest(description)),
        operation("replace-entity-field", requirement("R1", "desc"), "Conflicting correction.", digest(description)),
        operation("replace-field", root("background"), "Updated bounded background.", digest(spec.background)),
      ],
    ), (error) => {
      assert.equal(error.code, "FLOW_SPEC_REPAIR_OPERATION_CONFLICT");
      assert.equal(error.audit.acceptedOperations.length, 1);
      assert.equal(error.audit.acceptedOperations[0].target.field, "background");
      assert.equal(error.audit.discardedOperations.filter((entry) => entry.reason === "conflicting operation").length, 2);
      return true;
    });
  });

  it("uses immutable-base positions to select duplicate no-ID array values after prior edits", () => {
    const spec = sourceSpec();
    spec.constraints = ["remove", "same", "same"];
    const allowed = [permission(array("constraints"), ["delete-array-element", "replace-array-element"])];
    const result = apply(spec, allowed, [array("constraints")], [
      deleteOperation(array("constraints", 0), digest("remove")),
      operation("replace-array-element", array("constraints", 2), "last only", digest("same")),
    ]);
    assert.deepEqual(result.spec.constraints, ["same", "last only"]);
  });

  it("does not guess among duplicate array values without a base position", () => {
    const spec = sourceSpec();
    spec.constraints = ["same", "same"];
    assert.throws(() => apply(
      spec,
      [permission(array("constraints"), ["delete-array-element"])], [array("constraints")],
      [deleteOperation(array("constraints"), digest("same"))],
    ), (error) => (
      error instanceof SpecRepairRequiredTargetsError
      && error.audit.discardedOperations[0].reason === "conflicting target resolution"
      && error.message.includes('F:{"collection":"constraints"}')
    ));
  });

  it("does not let a conflicting correction group erase previously accepted staging work", () => {
    const spec = sourceSpec();
    const description = spec.requirements[0].desc;
    const allowed = [
      permission(requirement("R1", "desc"), ["replace-entity-field"]),
      permission(root("background"), ["replace-field"]),
    ];
    const required = [requirement("R1", "desc"), root("background")];
    let first;
    try {
      apply(spec, allowed, required, [operation("replace-entity-field", requirement("R1", "desc"), "Historical correction.", digest(description))]);
    } catch (error) { first = error; }
    assert.equal(first.code, "FLOW_SPEC_REPAIR_REQUIRED_TARGETS_MISSING");
    let conflict;
    try {
      applySpecRepairOperations({
        spec, triage: triage(allowed, required), inputRevision: INPUT_REVISION,
        repair: repair([
          operation("replace-entity-field", requirement("R1", "desc"), "Conflict one.", digest(description)),
          operation("replace-entity-field", requirement("R1", "desc"), "Conflict two.", digest(description)),
          operation("replace-field", root("background"), "Historical background.", digest(spec.background)),
        ]),
        correctionHistory: new SpecRepairCorrectionHistory().appendFailure(first),
      });
    } catch (error) { conflict = error; }
    assert.equal(conflict.code, "FLOW_SPEC_REPAIR_OPERATION_CONFLICT");
    const finalResult = applySpecRepairOperations({
      spec, triage: triage(allowed, required), inputRevision: INPUT_REVISION, repair: repair([]),
      correctionHistory: new SpecRepairCorrectionHistory().appendFailure(first).appendFailure(conflict),
    });
    assert.equal(finalResult.spec.requirements[0].desc, "Historical correction.");
    assert.equal(finalResult.spec.background, "Historical background.");
  });

  it("preserves bounded schema and Gate validation diagnostics in correction history", () => {
    const target = root("goal");
    const allowed = [permission(target, ["replace-field"])];
    const required = [target];
    const scenarios = [
      {
        invalidReplacement: [],
        code: "FLOW_SPEC_REPAIR_RESULT_SCHEMA_INVALID",
        expectedMessage: /schema validation/i,
      },
      {
        invalidReplacement: "   ",
        code: "FLOW_SPEC_REPAIR_GATE_READY_INVALID",
        expectedMessage: /non-empty goal/i,
      },
    ];
    for (const scenario of scenarios) {
      const spec = sourceSpec();
      let rejected;
      try {
        apply(spec, allowed, required, [
          operation("replace-field", target, scenario.invalidReplacement, digest(spec.goal)),
        ]);
      } catch (error) { rejected = error; }
      assert.equal(rejected.code, scenario.code);
      const result = applySpecRepairOperations({
        spec, triage: triage(allowed, required), inputRevision: INPUT_REVISION,
        repair: repair([operation("replace-field", target, "Corrected bounded goal.", digest(spec.goal))]),
        correctionHistory: new SpecRepairCorrectionHistory().appendFailure(rejected),
      });
      const attempt = result.audit.attempts[0];
      assert.equal(attempt.code, scenario.code);
      assert.equal(attempt.error.code, scenario.code);
      assert.match(attempt.error.message, scenario.expectedMessage);
      assert.equal(attempt.validationSummary, attempt.error.message);
      assert.ok(Buffer.byteLength(attempt.error.message) <= 1024);
    }
  });

  it("projects every repair rejection class into bounded command-owned attempt diagnostics", () => {
    const spec = sourceSpec();
    const target = root("goal");
    const allowed = [permission(target, ["replace-field"])];
    const required = [target];
    const valid = operation("replace-field", target, "Valid goal.", digest(spec.goal));
    const capture = (run) => {
      try { run(); } catch (error) { return error; }
      assert.fail("expected a rejected repair attempt");
    };
    const errors = [
      capture(() => new SpecRepairOperationBatch({ version: 2, baseRevision: BASE_REVISION, operations: [], scopeExpansions: [] })),
      capture(() => applySpecRepairOperations({ spec, triage: triage(allowed, required), repair: repair([], `sha256:${"c".repeat(64)}`), inputRevision: INPUT_REVISION })),
      capture(() => apply(spec, allowed, required, [])),
      capture(() => applySpecRepairOperations({
        spec, triage: triage(allowed, required), inputRevision: INPUT_REVISION,
        repair: { ...repair([valid]), scopeExpansions: ["Broader scope needs approval."] },
      })),
      capture(() => apply(spec, allowed, required, [valid, operation("replace-field", target, "Competing goal.", digest(spec.goal))])),
    ];
    for (const error of errors) {
      assert.equal(error.audit.audit.error.code, error.code);
      assert.ok(Buffer.byteLength(error.audit.audit.error.message) <= 1024);
      const attempt = new SpecRepairCorrectionHistory().appendFailure(error).aggregate().attempts[0];
      assert.equal(attempt.code, error.code);
      assert.deepEqual(attempt.error, error.audit.audit.error);
    }
  });

  it("normalizes discarded operations without retaining raw worker replacement text", () => {
    const spec = sourceSpec();
    const description = spec.requirements[0].desc;
    const secret = "raw worker payload must never be retained";
    const result = apply(
      spec,
      [permission(requirement("R1", "desc"), ["replace-entity-field"])], [requirement("R1", "desc")],
      [
        { findingId: "F", kind: "not-a-kind", target: requirement("R1", "desc"), expectedDigest: null, replacement: secret, reason: "Malformed worker proposal." },
        operation("replace-entity-field", requirement("R1", "desc"), "Valid correction.", digest(description)),
      ],
    );
    assert.equal(result.spec.requirements[0].desc, "Valid correction.");
    assert.equal(JSON.stringify(result.audit).includes(secret), false);
    assert.deepEqual(Object.keys(result.audit.discardedOperations[0]).sort(), ["attempt", "findingId", "kind", "operationDigest", "reason", "target"]);
  });
});
