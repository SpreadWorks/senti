// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9 R10
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const specDir = path.resolve("specs/305-reduce-flow-ai-calls");
const researchDir = path.join(specDir, "research");

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(researchDir, name), "utf8"));

const requiredCandidateTopics = [
  "skill-slimming",
  "spec-review",
  "impl-review",
  "test-review",
  "impl-gate",
  "context.search",
  "auto-check",
  "finalize-sync-docs-build",
  "docs-staticization",
  "ai-json-repair",
  "findings-aggregation",
  "triage-repair-artifacts",
  "requirement-compliance-precheck",
];

const primaryMeasurementSamples = [
  "specs/293-bounded-defer-review",
  "specs/294-setup-preset-options",
  "specs/295-producer-artifact-contract",
  "specs/296-review-gate-defer",
  "specs/297-setup-official-presets",
  "specs/298-fix-presets-list-tree",
  "specs/299-agent-config-setup",
  "specs/299-worktree-config-preflight",
];

const minimumPublicSurfaces = [
  "flow skill dispatch procedure",
  "senti flow get next-action envelope",
  "senti flow run review --phase draft",
  "senti flow run review --phase spec",
  "senti flow run review --phase test",
  "implementation review command path",
  "senti flow run gate",
  "senti flow get context --search",
  "senti flow run auto-check",
  "senti flow run finalize-sync",
  "senti docs build pipeline",
  "AI JSON repair behavior",
  "flow-findings artifact",
  "issue-log artifact",
  "acceptance-review evidence artifact",
];

function assertNonEmptyString(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.ok(value.trim().length > 0, `${label} must be non-empty`);
}

function assertNonEmptyArray(value, label) {
  assert.ok(Array.isArray(value), `${label} must be an array`);
  assert.ok(value.length > 0, `${label} must not be empty`);
}

function assertArrayIncludesAll(actual, expected, label) {
  assert.ok(Array.isArray(actual), `${label} must be an array`);
  for (const item of expected) {
    assert.ok(actual.includes(item), `${label} must include ${item}`);
  }
}

function assertCandidateFields(candidate, label) {
  for (const field of [
    "topic",
    "currentAiSurface",
    "deterministicCandidate",
    "expectedEffect",
    "qualityRisk",
    "fallbackCondition",
    "relatedCode",
    "behaviorVerification",
  ]) {
    if (field === "relatedCode") {
      assert.ok(Array.isArray(candidate[field]), `${label}.${field} must be an array`);
      assert.ok(candidate[field].length > 0, `${label}.${field} must not be empty`);
    } else {
      assertNonEmptyString(candidate[field], `${label}.${field}`);
    }
  }
}

test("R1: phase-candidates.json covers every required AI reduction topic", () => {
  const artifact = readJson("phase-candidates.json");
  assert.ok(Array.isArray(artifact.candidates), "candidates must be an array");
  const topics = artifact.candidates.map((candidate) => candidate.topic);
  assertArrayIncludesAll(topics, requiredCandidateTopics, "candidate topics");
  for (const topic of requiredCandidateTopics) {
    const candidate = artifact.candidates.find((item) => item.topic === topic);
    assertCandidateFields(candidate, `candidate ${topic}`);
  }
});

test("R2: skill responsibility split separates retained skill and CLI envelope responsibilities", () => {
  const artifact = readJson("skill-responsibility-split.json");
  assertArrayIncludesAll(artifact.retainedSkillResponsibilities, [
    "user approval boundaries",
    "autoApprove exceptions",
    "worktree boundary",
    "destructive recovery prompts",
  ], "retainedSkillResponsibilities");
  assertArrayIncludesAll(artifact.cliEnvelopeResponsibilities, [
    "normal step branching",
    "retry metadata",
    "context instructions",
    "output schema",
    "post-hook guidance",
  ], "cliEnvelopeResponsibilities");
});

test("R3: review-manifest-prototype.json defines spec and implementation review contracts", () => {
  const artifact = readJson("review-manifest-prototype.json");
  for (const sectionName of ["specReview", "implReview"]) {
    const section = artifact[sectionName];
    assert.ok(section, `${sectionName} must exist`);
    assertNonEmptyArray(section.producerInputs, `${sectionName}.producerInputs`);
    assertNonEmptyArray(section.fields, `${sectionName}.fields`);
    assertNonEmptyArray(section.auditFields, `${sectionName}.auditFields`);
    assertNonEmptyString(section.consumerPhase, `${sectionName}.consumerPhase`);
    assertNonEmptyString(section.fallbackCondition, `${sectionName}.fallbackCondition`);
    assertNonEmptyString(section.behaviorVerification, `${sectionName}.behaviorVerification`);
  }
});

test("R4: test-coverage-matrix-prototype.json defines requirement-to-test evidence fields", () => {
  const artifact = readJson("test-coverage-matrix-prototype.json");
  assertArrayIncludesAll(artifact.fields, [
    "requirementId",
    "testFile",
    "testName",
    "assertionOrBlockCount",
    "skipMarker",
    "helperOnly",
    "scenarioValidityRef",
    "testExecuteRef",
  ], "coverage matrix fields");
  assertNonEmptyString(artifact.fallbackCondition, "fallbackCondition");
  assertNonEmptyArray(artifact.auditFields, "auditFields");
  assertNonEmptyString(artifact.behaviorVerification, "behaviorVerification");
});

test("R5: fallback policy covers context.search and auto-check AI boundary cases", () => {
  const artifact = readJson("fallback-policy.json");
  for (const key of ["contextSearch", "autoCheck"]) {
    const policy = artifact[key];
    assert.ok(policy, `${key} must exist`);
    assert.ok(Array.isArray(policy.deterministicPassConditions), `${key}.deterministicPassConditions must be an array`);
    assert.ok(Array.isArray(policy.deterministicFailConditions), `${key}.deterministicFailConditions must be an array`);
    assert.ok(Array.isArray(policy.boundaryAiConditions), `${key}.boundaryAiConditions must be an array`);
    assertNonEmptyString(policy.aiFallbackCondition, `${key}.aiFallbackCondition`);
  }
  assert.match(
    artifact.contextSearch.aiFallbackCondition,
    /deterministic[^.]*insufficient|insufficient[^.]*deterministic/i,
    "contextSearch.aiFallbackCondition must require deterministic search insufficiency",
  );
  assert.match(
    artifact.contextSearch.aiFallbackCondition,
    /explicit|opt[- ]?in|allowed/i,
    "contextSearch.aiFallbackCondition must require explicit AI fallback allowance",
  );
});

test("R6: docs policy separates deterministic docs build from AI-capable docs steps", () => {
  const artifact = readJson("docs-staticization-policy.json");
  assertArrayIncludesAll(artifact.deterministicSteps, ["scan", "init", "data"], "deterministicSteps");
  assertArrayIncludesAll(artifact.aiCapableSteps, ["enrich", "text", "readme", "agents", "translate"], "aiCapableSteps");
  assertNonEmptyString(artifact.finalizeSyncSeparationPolicy, "finalizeSyncSeparationPolicy");
  assertNonEmptyString(artifact.docsQualityVerification, "docsQualityVerification");
  assertNonEmptyArray(artifact.warningOrFollowUpArtifactOptions, "warningOrFollowUpArtifactOptions");
  assertNonEmptyArray(artifact.differentialRunConditions, "differentialRunConditions");
});

test("R7: normalization and aggregation policy defines keys, merge rules, and fallback boundaries", () => {
  const artifact = readJson("normalization-aggregation-policy.json");
  assertNonEmptyArray(artifact.jsonNormalizerRules, "jsonNormalizerRules");
  assertNonEmptyArray(artifact.findingDeduplicationKeys, "findingDeduplicationKeys");
  assertNonEmptyArray(artifact.severityMergeRules, "severityMergeRules");
  assertNonEmptyString(artifact.groupedAuditRepresentation, "groupedAuditRepresentation");
  assertNonEmptyString(artifact.generatedTriageRepairBoundary, "generatedTriageRepairBoundary");
  assertNonEmptyString(artifact.requirementCompliancePrecheckFallback, "requirementCompliancePrecheckFallback");
  assert.ok(artifact.aiFallbackOrHardFailBoundaries, "aiFallbackOrHardFailBoundaries must exist");
  for (const key of ["jsonNormalizer", "findingsAggregation", "requirementCompliancePrecheck"]) {
    assertNonEmptyString(artifact.aiFallbackOrHardFailBoundaries[key], `aiFallbackOrHardFailBoundaries.${key}`);
  }
});

test("R8: migration-parity-map.json covers every minimum retained public surface", () => {
  const artifact = readJson("migration-parity-map.json");
  assert.ok(Array.isArray(artifact.surfaces), "surfaces must be an array");
  const names = artifact.surfaces.map((surface) => surface.name);
  assertArrayIncludesAll(names, minimumPublicSurfaces, "migration surfaces");
  for (const surfaceName of minimumPublicSurfaces) {
    const surface = artifact.surfaces.find((item) => item.name === surfaceName);
    assertNonEmptyString(surface.currentOwner, `${surfaceName}.currentOwner`);
    assertNonEmptyString(surface.proposedOwnerOrRemovalDecision, `${surfaceName}.proposedOwnerOrRemovalDecision`);
    assertNonEmptyString(surface.fallbackOwner, `${surfaceName}.fallbackOwner`);
    assert.ok(Array.isArray(surface.behaviorVerifications), `${surfaceName}.behaviorVerifications must be an array`);
    assert.ok(surface.behaviorVerifications.length > 0, `${surfaceName}.behaviorVerifications must not be empty`);
  }
});

test("R9: measurement-results.json includes all primary samples and required metrics", () => {
  const artifact = readJson("measurement-results.json");
  assert.ok(Array.isArray(artifact.samples), "samples must be an array");
  const sampleNames = artifact.samples.map((sample) => sample.specDir);
  assertArrayIncludesAll(sampleNames, primaryMeasurementSamples, "measurement samples");
  for (const sampleName of primaryMeasurementSamples) {
    const sample = artifact.samples.find((item) => item.specDir === sampleName);
    for (const metric of [
      "agentCallCount",
      "durationMs",
      "inputTokens",
      "retryCount",
      "finalizeSyncTimeMs",
      "completionRate",
      "findingDetectionRisk",
      "docsQualityRisk",
      "issueLogImpact",
      "acceptanceLoopImpact",
    ]) {
      assert.ok(Object.hasOwn(sample.beforeBaseline, metric), `${sampleName}.beforeBaseline.${metric} missing`);
      assert.ok(Object.hasOwn(sample.projectedAfterModel, metric), `${sampleName}.projectedAfterModel.${metric} missing`);
    }
  }
});

test("R10: research artifact test suite validates every required artifact contract", () => {
  const expectedFiles = [
    "phase-candidates.json",
    "skill-responsibility-split.json",
    "review-manifest-prototype.json",
    "test-coverage-matrix-prototype.json",
    "fallback-policy.json",
    "docs-staticization-policy.json",
    "normalization-aggregation-policy.json",
    "migration-parity-map.json",
    "measurement-results.json",
  ];
  for (const file of expectedFiles) {
    assert.ok(fs.existsSync(path.join(researchDir, file)), `${file} must exist`);
  }
});
