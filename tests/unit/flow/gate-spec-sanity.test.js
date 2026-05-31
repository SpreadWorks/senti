import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { checkSpecJson, validateSpecRepairAudit } from "../../../src/flow/lib/run-gate.js";

function makeValidSpec() {
  return {
    goal: "Some goal",
    requirements: [{ id: "REQ-1", desc: "Something" }],
    acceptance_criteria: ["Criterion 1"],
    tasks: [{ id: "T-1", parent: null }],
  };
}

describe("checkSpecJson — empty-field sanity checks (spec 228)", () => {
  it("REQ-1: reports issue when goal is empty string", () => {
    const spec = { ...makeValidSpec(), goal: "" };
    const issues = checkSpecJson(spec);
    assert.ok(issues.some((i) => /goal/.test(i) && /empty/.test(i)));
  });

  it("REQ-1: reports issue when goal is whitespace-only", () => {
    const spec = { ...makeValidSpec(), goal: "   " };
    const issues = checkSpecJson(spec);
    assert.ok(issues.some((i) => /goal/.test(i) && /empty/.test(i)));
  });

  it("REQ-2: reports issue when requirements is empty array", () => {
    const spec = { ...makeValidSpec(), requirements: [] };
    const issues = checkSpecJson(spec);
    assert.ok(issues.some((i) => /requirements/.test(i) && /empty/.test(i)));
  });

  it("REQ-3: reports issue when acceptance_criteria is empty array", () => {
    const spec = { ...makeValidSpec(), acceptance_criteria: [] };
    const issues = checkSpecJson(spec);
    assert.ok(issues.some((i) => /acceptance_criteria/.test(i) && /empty/.test(i)));
  });

  it("REQ-4: returns no sanity issues when all fields are non-empty", () => {
    const spec = makeValidSpec();
    const issues = checkSpecJson(spec);
    const sanityIssues = issues.filter(
      (i) => /goal/.test(i) || /requirements.*empty/.test(i) || /acceptance_criteria.*empty/.test(i),
    );
    assert.equal(sanityIssues.length, 0);
  });

  it("reports multiple issues when all three fields are empty", () => {
    const spec = {
      ...makeValidSpec(),
      goal: "",
      requirements: [],
      acceptance_criteria: [],
    };
    const issues = checkSpecJson(spec);
    assert.ok(issues.some((i) => /goal/.test(i)));
    assert.ok(issues.some((i) => /requirements/.test(i)));
    assert.ok(issues.some((i) => /acceptance_criteria/.test(i)));
  });
});

function withSpecRepairArtifacts(files, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spec-repair-audit-"));
  const specDir = path.join(tmp, "specs", "001-test");
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "spec.json"), "{}\n");
  for (const [name, value] of Object.entries(files)) {
    const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    fs.writeFileSync(path.join(specDir, name), `${text}\n`);
  }
  try {
    return fn(tmp, "specs/001-test/spec.json");
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

describe("validateSpecRepairAudit — spec review repair audit", () => {
  const failReview = {
    verdict: "FAIL",
    blockingFindings: [
      {
        title: "Missing implementation target",
        target: "R1",
        issue: "Spec omits the existing helper touched by this behavior.",
        requiredChange: "Name the helper.",
        whyBlocking: "Implementation may skip required code.",
      },
    ],
    nonBlockingImprovements: [],
  };

  function triageArtifact(items) {
    return {
      version: 1,
      phase: "spec-triage",
      sourceReview: "spec-review.json",
      summary: "Triaged blocking review findings.",
      items,
    };
  }

  function applyTriageItem(overrides = {}) {
    return {
      title: "Missing implementation target",
      target: "R1",
      decision: "apply",
      rationale: "The finding is still blocking and can be fixed in spec requirements.",
      evidence: "spec.json requirements[0].desc does not name the helper yet.",
      ...overrides,
    };
  }

  function repairArtifact(items) {
    return {
      version: 1,
      phase: "spec-repair",
      sourceReview: "spec-triage.json",
      summary: "Applied triaged review findings.",
      items,
    };
  }

  function appliedRepairItem(overrides = {}) {
    return {
      title: "Missing implementation target",
      target: "R1",
      decision: "applied",
      rationale: "The referenced helper is in scope and now appears in requirements.",
      evidence: "spec.json requirements[0].desc names the helper required by R1.",
      changedFields: ["requirements[0].desc"],
      ...overrides,
    };
  }

  it("does nothing when spec-review.json is absent", () => {
    const issues = withSpecRepairArtifacts({}, validateSpecRepairAudit);
    assert.deepEqual(issues, []);
  });

  it("requires spec-triage.json when spec-review verdict is FAIL", () => {
    const issues = withSpecRepairArtifacts({ "spec-review.json": failReview }, validateSpecRepairAudit);
    assert.ok(issues.some((issue) => /spec-triage\.json is missing/.test(issue)), issues);
  });

  it("accepts triage decisions plus repair entries for apply items", () => {
    const issues = withSpecRepairArtifacts({
      "spec-review.json": failReview,
      "spec-triage.json": triageArtifact([applyTriageItem()]),
      "spec-repair.json": repairArtifact([appliedRepairItem()]),
    }, validateSpecRepairAudit);
    assert.deepEqual(issues, []);
  });

  it("accepts triage-only drops with an empty repair artifact", () => {
    const issues = withSpecRepairArtifacts({
      "spec-review.json": failReview,
      "spec-triage.json": triageArtifact([applyTriageItem({
        decision: "downgraded_to_non_blocking",
        rationale: "The finding is helpful context but does not block implementation.",
        evidence: "The current requirement already has a testable acceptance path.",
      })]),
      "spec-repair.json": repairArtifact([]),
    }, validateSpecRepairAudit);
    assert.deepEqual(issues, []);
  });

  it("rejects triage entries without evidence", () => {
    const issues = withSpecRepairArtifacts({
      "spec-review.json": failReview,
      "spec-triage.json": triageArtifact([{
        title: "Missing implementation target",
        target: "R1",
        decision: "apply",
        rationale: "Apply this finding.",
      }]),
      "spec-repair.json": repairArtifact([appliedRepairItem()]),
    }, validateSpecRepairAudit);

    assert.ok(issues.some((issue) => /spec-triage: items\[0\]\.evidence must be non-empty/.test(issue)), issues);
  });

  it("rejects unknown triage decisions", () => {
    const issues = withSpecRepairArtifacts({
      "spec-review.json": failReview,
      "spec-triage.json": triageArtifact([applyTriageItem({ decision: "unsupported" })]),
      "spec-repair.json": repairArtifact([]),
    }, validateSpecRepairAudit);

    assert.ok(issues.some((issue) => /spec-triage: items\[0\]\.decision must be one of/.test(issue)), issues);
  });

  it("rejects applied entries without changed fields", () => {
    const issues = withSpecRepairArtifacts({
      "spec-review.json": failReview,
      "spec-triage.json": triageArtifact([applyTriageItem()]),
      "spec-repair.json": repairArtifact([appliedRepairItem({
        rationale: "Applied.",
        evidence: "spec.json requirements[0].desc was intended to cover this finding.",
        changedFields: [],
      })]),
    }, validateSpecRepairAudit);

    assert.ok(issues.some((issue) => /changedFields must be non-empty/.test(issue)), issues);
  });

  it("rejects repair entries without evidence", () => {
    const issues = withSpecRepairArtifacts({
      "spec-review.json": failReview,
      "spec-triage.json": triageArtifact([applyTriageItem()]),
      "spec-repair.json": repairArtifact([appliedRepairItem({
        rationale: "The helper is now named.",
        evidence: "",
      })]),
    }, validateSpecRepairAudit);

    assert.ok(issues.some((issue) => /evidence must be non-empty/.test(issue)), issues);
  });

  it("rejects unknown repair decisions", () => {
    const issues = withSpecRepairArtifacts({
      "spec-review.json": failReview,
      "spec-triage.json": triageArtifact([applyTriageItem()]),
      "spec-repair.json": repairArtifact([appliedRepairItem({
        decision: "unsupported",
        rationale: "This is not a supported decision.",
        evidence: "No valid evidence because the decision is unsupported.",
        changedFields: [],
      })]),
    }, validateSpecRepairAudit);

    assert.ok(issues.some((issue) => /decision must be one of/.test(issue)), issues);
  });

  it("rejects deferred repair decisions because review findings cannot be delegated to gate", () => {
    const issues = withSpecRepairArtifacts({
      "spec-review.json": failReview,
      "spec-triage.json": triageArtifact([applyTriageItem({ decision: "deferred_to_gate" })]),
      "spec-repair.json": repairArtifact([]),
    }, validateSpecRepairAudit);

    assert.ok(issues.some((issue) => /spec-triage: items\[0\]\.decision must be one of/.test(issue)), issues);
  });

  it("rejects triage entries that do not match the source finding", () => {
    const issues = withSpecRepairArtifacts({
      "spec-review.json": failReview,
      "spec-triage.json": triageArtifact([applyTriageItem({
        title: "Different finding",
        decision: "invalid",
      })]),
      "spec-repair.json": repairArtifact([]),
    }, validateSpecRepairAudit);

    assert.ok(issues.some((issue) => /title must match blockingFindings\[0\]\.title/.test(issue)), issues);
  });

  it("rejects triage logs that do not cover every blocking finding", () => {
    const review = {
      ...failReview,
      blockingFindings: [
        ...failReview.blockingFindings,
        { title: "Second finding", target: "R2", issue: "x", requiredChange: "y", whyBlocking: "z" },
      ],
    };
    const issues = withSpecRepairArtifacts({
      "spec-review.json": review,
      "spec-triage.json": triageArtifact([applyTriageItem({
        decision: "invalid",
        rationale: "The target is already covered by existing scope.",
        evidence: "spec.json scope.in already covers the implementation target.",
      })]),
      "spec-repair.json": repairArtifact([]),
    }, validateSpecRepairAudit);

    assert.ok(issues.some((issue) => /spec-triage\.json items length 1 does not match blockingFindings length 2/.test(issue)), issues);
  });

  it("rejects repair logs that do not cover every apply triage item", () => {
    const issues = withSpecRepairArtifacts({
      "spec-review.json": failReview,
      "spec-triage.json": triageArtifact([applyTriageItem()]),
      "spec-repair.json": repairArtifact([]),
    }, validateSpecRepairAudit);

    assert.ok(issues.some((issue) => /does not match spec-triage apply item length 1/.test(issue)), issues);
  });
});
