// spec: R5 R6 R7 R8 R9
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateSchema } from "../../../src/lib/schema-validate.js";
import { createAcceptanceReviewFixture } from "../../../tests/helpers/acceptance-review-fixture.js";

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

function validRequirementJudgment(overrides = {}) {
  return {
    requirementId: "R3",
    status: "met",
    requestRefs: ["flow.request"],
    requirementRefs: ["spec.json#R3"],
    diffRefs: ["diff:src/demo.js"],
    repairRefs: ["impl-repair.json"],
    testRefs: ["test-execute-result.json#R3", "test-result-review.json"],
    missingEvidence: [],
    ...overrides,
  };
}

function validDeferredFinding(overrides = {}) {
  return {
    findingId: "DF-1",
    sourceStep: "impl-review",
    sourceArtifact: "impl-review.json",
    sourceFindingId: "F-1",
    finalDisposition: "fixed",
    evidenceRefs: ["impl-review.json#F-1"],
    ...overrides,
  };
}

function validArtifact(overrides = {}) {
  return {
    version: 2,
    repairFingerprint: "a".repeat(64),
    mechanicalBlockers: [],
    hardBlockers: [],
    requirementJudgments: [validRequirementJudgment()],
    deferredFindings: [],
    userDecision: null,
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
      "version",
      "repairFingerprint",
      "mechanicalBlockers",
      "hardBlockers",
      "requirementJudgments",
      "deferredFindings",
      "userDecision",
      "verdict",
    ];
    for (const field of requiredTopLevelFields) {
      const broken = validArtifact({ [field]: undefined });

      assert.notDeepEqual(validateSchema(broken, loadSchema()), [], `${field} must be required`);
    }
  });

  it("R5: artifact writer persists schema-valid output and only includes existing report refs", async () => {
    const { writeAcceptanceReviewArtifact } = await loadArtifactModule();
    const fixture = createAcceptanceReviewFixture();
    try {
      const artifact = validArtifact({ repairFingerprint: fixture.fingerprint.hash });

      const withoutReport = writeAcceptanceReviewArtifact({
        specDir: fixture.specDir,
        artifact,
        fingerprint: fixture.fingerprint,
        flowState: fixture.state,
      });
      const first = JSON.parse(fs.readFileSync(withoutReport.path, "utf8"));
      assert.deepEqual(validateSchema(first, loadSchema()), []);
      assert.equal(Object.hasOwn(first, "reportRefs"), false);

      const suppliedReportRefs = writeAcceptanceReviewArtifact({
        specDir: fixture.specDir,
        artifact: { ...artifact, reportRefs: ["report.json"] },
        fingerprint: fixture.fingerprint,
        flowState: fixture.state,
      });
      const supplied = JSON.parse(fs.readFileSync(suppliedReportRefs.path, "utf8"));
      assert.equal(Object.hasOwn(supplied, "reportRefs"), false);

      fs.writeFileSync(path.join(fixture.specDir, "report.json"), JSON.stringify({
        version: 1,
        summary: "Existing finalize report context.",
      }, null, 2));
      const withReport = writeAcceptanceReviewArtifact({
        specDir: fixture.specDir,
        artifact,
        fingerprint: fixture.fingerprint,
        flowState: fixture.state,
      });
      const second = JSON.parse(fs.readFileSync(withReport.path, "utf8"));
      assert.deepEqual(validateSchema(second, loadSchema()), []);
      assert.deepEqual(second.reportRefs, ["report.json"]);
    } finally {
      fixture.cleanup();
    }
  });

  it("R5: artifact writer rejects invalid artifacts before persisting them", async () => {
    const { writeAcceptanceReviewArtifact } = await loadArtifactModule();
    const fixture = createAcceptanceReviewFixture();
    try {
      const invalid = validArtifact({ requirementJudgments: undefined });

      assert.throws(
        () => writeAcceptanceReviewArtifact({
          specDir: fixture.specDir,
          artifact: invalid,
          fingerprint: fixture.fingerprint,
          flowState: fixture.state,
        }),
        /requirementJudgments|schema|validation/i,
      );
      assert.equal(fs.existsSync(path.join(fixture.specDir, "acceptance-review.json")), false);
    } finally {
      fixture.cleanup();
    }
  });

  it("R6: schema rejects requirement judgments missing current evidence bindings", () => {
    const requiredJudgmentFields = [
      "requirementId",
      "status",
      "requestRefs",
      "requirementRefs",
      "diffRefs",
      "repairRefs",
      "testRefs",
      "missingEvidence",
    ];
    for (const field of requiredJudgmentFields) {
      const broken = validArtifact({
        requirementJudgments: [validRequirementJudgment({ [field]: undefined })],
      });

      assert.notDeepEqual(validateSchema(broken, loadSchema()), [], `${field} must be required`);
    }
  });

  it("R7: schema rejects deferred findings missing current source bindings", () => {
    const requiredDeferredFindingFields = [
      "findingId",
      "sourceStep",
      "sourceArtifact",
      "sourceFindingId",
      "finalDisposition",
      "evidenceRefs",
    ];
    for (const field of requiredDeferredFindingFields) {
      const broken = validArtifact({
        deferredFindings: [validDeferredFinding({ [field]: undefined })],
      });

      assert.notDeepEqual(validateSchema(broken, loadSchema()), [], `${field} must be required`);
    }
  });

  it("R8: mechanical blockers force blocked before semantic pass", async () => {
    const { deriveAcceptanceReviewVerdict } = await loadArtifactModule();
    const artifact = validArtifact({
      mechanicalBlockers: [{ blockerId: "M-1", kind: "missing_tests", summary: "Test evidence missing." }],
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

  it("R8: production context derives missing tests and missing required tests from persisted test evidence", async () => {
    const {
      artifactFromAcceptanceJudgments,
      buildAcceptanceReviewContext,
      deriveAcceptanceReviewVerdict,
    } = await loadArtifactModule();
    const missingRequiredFixture = createAcceptanceReviewFixture({
      requirementIds: ["R1", "R2"],
      testSummaryIds: ["R1"],
    });
    const missingTestsFixture = createAcceptanceReviewFixture({
      requirementIds: ["R1", "R2"],
      omitArtifacts: ["test-execute-result.json"],
    });
    try {
      const missingRequiredContext = buildAcceptanceReviewContext({
        root: missingRequiredFixture.root,
        state: missingRequiredFixture.state,
        diff: missingRequiredFixture.diff,
      });
      const artifact = artifactFromAcceptanceJudgments({
        context: missingRequiredContext,
        requirementJudgments: [],
      });
      const missingRequired = missingRequiredContext.mechanicalBlockers.find((blocker) => (
        blocker.kind === "missing_required_tests"
      ));
      const missingTestsContext = buildAcceptanceReviewContext({
        root: missingTestsFixture.root,
        state: missingTestsFixture.state,
        diff: missingTestsFixture.diff,
      });

      assert.ok(missingRequired);
      assert.match(missingRequired.summary, /R2/);
      assert.ok(missingTestsContext.mechanicalBlockers.some((blocker) => blocker.kind === "missing_tests"));
      assert.equal(deriveAcceptanceReviewVerdict(artifact), "blocked");
    } finally {
      missingRequiredFixture.cleanup();
      missingTestsFixture.cleanup();
    }
  });

  it("R9: secondary scores cannot offset current unmet requirements or hard blockers", async () => {
    const { deriveAcceptanceReviewVerdict } = await loadArtifactModule();
    assert.equal(
      deriveAcceptanceReviewVerdict({
        mechanicalBlockers: [],
        hardBlockers: [],
        requirementJudgments: [{ status: "notMet" }],
      }),
      "repair_required",
    );
    assert.equal(
      deriveAcceptanceReviewVerdict({
        mechanicalBlockers: [],
        hardBlockers: [],
        requirementJudgments: [{ status: "notVerifiable" }],
      }),
      "user_decision_required",
    );
    assert.equal(
      deriveAcceptanceReviewVerdict({
        mechanicalBlockers: [],
        hardBlockers: [{ blockerId: "H-1", summary: "Original goal remains unmet." }],
        requirementJudgments: [],
      }),
      "user_decision_required",
    );
    assert.equal(
      deriveAcceptanceReviewVerdict({
        mechanicalBlockers: [],
        hardBlockers: [],
        requirementJudgments: [],
      }),
      "pass",
    );
  });
});
