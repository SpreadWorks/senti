// spec: R5 R6 R7 R8 R9
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateSchema } from "../../../src/lib/schema-validate.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SCHEMA_PATH = path.join(ROOT, "src", "flow", "schemas", "acceptance-review.schema.json");
const ARTIFACT_MODULE = path.join(ROOT, "src", "flow", "lib", "acceptance-review-artifacts.js");

function loadSchema() {
  assert.equal(fs.existsSync(SCHEMA_PATH), true, "acceptance-review schema must exist");
  return JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
}

async function loadArtifactModule() {
  assert.equal(fs.existsSync(ARTIFACT_MODULE), true, "acceptance-review artifact helpers must exist");
  return import(pathToFileURL(ARTIFACT_MODULE).href);
}

function validFinding(overrides = {}) {
  return {
    findingId: "F-1",
    summary: "Goal gap requires amendment.",
    severity: "blocking",
    category: "goal_gap",
    mappedRequirementIds: ["R3"],
    linkedRequirementAmendmentProposalIds: ["P-1"],
    evidenceRefs: ["spec:R3", "diff:src/flow/definition.js"],
    confidence: "high",
    shouldReimplement: true,
    reimplementationReason: "The flow order must change after the requirement is amended.",
    requiresUserDecision: false,
    ...overrides,
  };
}

function validProposal(overrides = {}) {
  return {
    proposalId: "P-1",
    proposalType: "modify_requirement",
    targetRequirementIds: ["R3"],
    proposedRequirementSummary: "Require acceptance-review before final-regression.",
    reason: "The original request requires holistic acceptance before final regression.",
    relationToOriginalRequest: "direct",
    linkedFindingIds: ["F-1"],
    shouldReimplementAfterAmendment: true,
    ...overrides,
  };
}

function validArtifact(overrides = {}) {
  return {
    version: 1,
    goalSatisfactionScore: 1,
    requirementAlignmentScore: 1,
    implementationQualityScore: 1,
    acceptanceScore: 1,
    thresholds: {
      goalSatisfactionPass: 0.9,
      requirementAlignmentPass: 0.9,
      implementationQualityPass: 0.8,
    },
    mechanicalBlockers: [],
    hardBlockers: [],
    attempt: 1,
    findings: [validFinding()],
    requirementAmendmentProposals: [validProposal()],
    userDecision: null,
    blockedDecision: null,
    verdict: "pass",
    ...overrides,
  };
}

describe("acceptance-review artifact and verdict contract", () => {
  it("R5: schema validates the complete acceptance-review artifact shape", () => {
    const errors = validateSchema(validArtifact(), loadSchema());

    assert.deepEqual(errors, []);
  });

  it("R5: schema rejects artifacts missing any required top-level field", () => {
    const requiredTopLevelFields = [
      "goalSatisfactionScore",
      "requirementAlignmentScore",
      "implementationQualityScore",
      "acceptanceScore",
      "thresholds",
      "mechanicalBlockers",
      "hardBlockers",
      "attempt",
      "findings",
      "requirementAmendmentProposals",
      "userDecision",
      "blockedDecision",
      "verdict",
    ];
    for (const field of requiredTopLevelFields) {
      const broken = validArtifact({ [field]: undefined });

      assert.notDeepEqual(validateSchema(broken, loadSchema()), [], `${field} must be required`);
    }
  });

  it("R5: artifact writer persists schema-valid output and only includes existing report refs", async () => {
    const { writeAcceptanceReviewArtifact } = await loadArtifactModule();
    const tmp = fs.mkdtempSync(path.join(process.cwd(), ".tmp-acceptance-review-"));
    try {
      const specDir = path.join(tmp, "specs", "001-test");
      fs.mkdirSync(specDir, { recursive: true });

      const withoutReport = writeAcceptanceReviewArtifact({
        specDir,
        artifact: validArtifact({ reportRefs: undefined }),
      });
      const first = JSON.parse(fs.readFileSync(withoutReport.path, "utf8"));
      assert.deepEqual(validateSchema(first, loadSchema()), []);
      assert.equal(Object.hasOwn(first, "reportRefs"), false);

      const suppliedReportRefs = writeAcceptanceReviewArtifact({
        specDir,
        artifact: validArtifact({ reportRefs: ["report.json"] }),
      });
      const supplied = JSON.parse(fs.readFileSync(suppliedReportRefs.path, "utf8"));
      assert.equal(Object.hasOwn(supplied, "reportRefs"), false);

      fs.writeFileSync(path.join(specDir, "report.json"), JSON.stringify({
        version: 1,
        summary: "Existing finalize report context.",
      }, null, 2));
      const withReport = writeAcceptanceReviewArtifact({
        specDir,
        artifact: validArtifact({ reportRefs: undefined }),
      });
      const second = JSON.parse(fs.readFileSync(withReport.path, "utf8"));
      assert.deepEqual(validateSchema(second, loadSchema()), []);
      assert.deepEqual(second.reportRefs, ["report.json"]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("R5: artifact writer rejects invalid artifacts before persisting them", async () => {
    const { writeAcceptanceReviewArtifact } = await loadArtifactModule();
    const tmp = fs.mkdtempSync(path.join(process.cwd(), ".tmp-acceptance-review-"));
    try {
      const specDir = path.join(tmp, "specs", "001-test");
      fs.mkdirSync(specDir, { recursive: true });
      const invalid = validArtifact({ goalSatisfactionScore: undefined });

      assert.throws(
        () => writeAcceptanceReviewArtifact({ specDir, artifact: invalid }),
        /goalSatisfactionScore|schema|validation/i,
      );
      assert.equal(fs.existsSync(path.join(specDir, "acceptance-review.json")), false);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("R6: schema rejects findings missing required evidence and mapping fields", () => {
    const requiredFindingFields = [
      "findingId",
      "summary",
      "severity",
      "category",
      "mappedRequirementIds",
      "linkedRequirementAmendmentProposalIds",
      "evidenceRefs",
      "confidence",
      "shouldReimplement",
      "reimplementationReason",
      "requiresUserDecision",
    ];
    for (const field of requiredFindingFields) {
      const broken = validArtifact({
        findings: [validFinding({ [field]: undefined })],
      });

      assert.notDeepEqual(validateSchema(broken, loadSchema()), [], `${field} must be required`);
    }
  });

  it("R7: schema rejects requirementAmendmentProposals missing handoff fields", () => {
    const requiredProposalFields = [
      "proposalId",
      "proposalType",
      "targetRequirementIds",
      "proposedRequirementSummary",
      "reason",
      "relationToOriginalRequest",
      "linkedFindingIds",
      "shouldReimplementAfterAmendment",
    ];
    for (const field of requiredProposalFields) {
      const broken = validArtifact({
        requirementAmendmentProposals: [validProposal({ [field]: undefined })],
      });

      assert.notDeepEqual(validateSchema(broken, loadSchema()), [], `${field} must be required`);
    }
  });

  it("R8: mechanical blockers force blocked before semantic pass", async () => {
    const { deriveAcceptanceReviewVerdict } = await loadArtifactModule();
    const artifact = validArtifact({
      mechanicalBlockers: [{ blockerId: "M-1", kind: "missing_tests", summary: "Test evidence missing." }],
      goalSatisfactionScore: 1,
      requirementAlignmentScore: 1,
      implementationQualityScore: 1,
      acceptanceScore: 1,
      verdict: "pass",
    });

    assert.equal(deriveAcceptanceReviewVerdict(artifact), "blocked");
  });

  it("R8: mechanical blocker classifier covers all required blocker categories", async () => {
    const { classifyMechanicalBlockers, deriveAcceptanceReviewVerdict } = await loadArtifactModule();
    const blockers = classifyMechanicalBlockers({
      tests: { missing: true, failed: true, missingRequired: ["R3"] },
      artifacts: { missing: ["test-execute-result.json"], invalidSchemas: ["retro.json"] },
    });

    assert.deepEqual(
      blockers.map((blocker) => blocker.kind).sort(),
      [
        "failed_tests",
        "invalid_schema",
        "missing_artifact",
        "missing_required_tests",
        "missing_tests",
      ],
    );
    assert.equal(deriveAcceptanceReviewVerdict(validArtifact({ mechanicalBlockers: blockers })), "blocked");
  });

  it("R8: evidence builder derives missing tests and missing required tests from persisted test evidence", async () => {
    const { buildAcceptanceReviewArtifactFromEvidence } = await loadArtifactModule();
    const tmp = fs.mkdtempSync(path.join(process.cwd(), ".tmp-acceptance-review-"));
    try {
      const specDir = path.join(tmp, "specs", "001-test");
      fs.mkdirSync(specDir, { recursive: true });
      fs.writeFileSync(path.join(specDir, "spec.json"), JSON.stringify({
        requirements: [
          { id: "R1", desc: "Covered requirement." },
          { id: "R2", desc: "Missing required test." },
          { id: "R3", desc: "Not testable.", testable: false },
        ],
      }, null, 2));
      for (const file of ["scenario-validity-result.json", "test-result-review.json", "retro.json"]) {
        fs.writeFileSync(path.join(specDir, file), JSON.stringify({ result: "pass", verdict: "pass" }, null, 2));
      }
      fs.writeFileSync(path.join(specDir, "test-execute-result.json"), JSON.stringify({
        version: "2",
        summary: [{ id: "R1", result: "pass" }],
        regression: { result: "pass" },
      }, null, 2));

      const artifact = buildAcceptanceReviewArtifactFromEvidence({ specDir });
      const kinds = artifact.mechanicalBlockers.map((blocker) => blocker.kind).sort();

      assert.deepEqual(kinds, ["missing_required_tests", "missing_tests"]);
      assert.match(
        artifact.mechanicalBlockers.find((blocker) => blocker.kind === "missing_required_tests").summary,
        /R2/,
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("R9: secondary scores cannot offset unmet goal satisfaction", async () => {
    const { deriveAcceptanceReviewVerdict } = await loadArtifactModule();
    const artifact = validArtifact({
      goalSatisfactionScore: 0.2,
      requirementAlignmentScore: 1,
      implementationQualityScore: 1,
      acceptanceScore: 0.95,
      findings: [validFinding({ shouldReimplement: true })],
      hardBlockers: [],
      verdict: "pass",
    });

    assert.notEqual(deriveAcceptanceReviewVerdict(artifact), "pass");

    assert.notEqual(
      deriveAcceptanceReviewVerdict(validArtifact({
        hardBlockers: [{ blockerId: "H-1", summary: "Original goal remains unmet." }],
      })),
      "pass",
    );
  });
});
