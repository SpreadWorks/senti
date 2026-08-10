import fs from "node:fs";
import path from "node:path";
import {
  applyAcceptanceReviewResult,
  artifactFromAcceptanceJudgments,
  buildAcceptanceReviewContext,
  writeAcceptanceReviewArtifact,
} from "../../src/flow/lib/acceptance-review-artifacts.js";
import {
  FlowFinding,
  FlowFindingsArtifact,
  readFlowFindingsArtifact,
  writeFlowFindingsArtifact,
} from "../../src/flow/lib/flow-findings.js";
import {
  buildRepairFingerprint,
  stampRepairFingerprint,
  writeRepairEvidenceArtifact,
} from "../../src/flow/lib/impl-repair-artifacts.js";
import { captureRepairBaseline } from "../../src/flow/lib/repair-state-identity.js";
import { flattenSteps } from "../../src/flow/lib/step-tree.js";
import {
  makeFlowState,
  moveFlowToStep,
} from "./flow-setup.js";
import {
  checkoutNewBranch,
  commitAll,
  initGitRepo,
} from "./git-repo.js";
import {
  createTmpDir,
  removeTmpDir,
  writeFile,
  writeJson,
} from "./tmp-dir.js";

const SPEC_PATH = "specs/demo/spec.json";

function deferredSourceEvidence(findings) {
  return findings.map((finding) => ({
    findingId: finding.sourceFindingId,
    fingerprint: finding.fingerprint,
    disposition: "must-fix",
    failureMode: "missing_acceptance_requirement",
    category: "semantic",
    title: `Deferred ${finding.sourceFindingId}`,
    reason: `Deferred source evidence for ${finding.sourceFindingId}.`,
    rationale: "The fixture preserves this finding for acceptance disposition.",
    result: "fail",
  }));
}

class FixtureFlowManager {
  constructor(state) {
    this.state = state;
  }

  load() {
    return this.state;
  }

  mutate(mutator) {
    mutator(this.state);
    return this.state;
  }
}

export class AcceptanceReviewFixture {
  constructor({
    existingRoot = null,
    specPath = SPEC_PATH,
    requirementIds = null,
    testSummaryIds = null,
    omitArtifacts = [],
    deferredFindings = [],
    includeDeferredFinding = false,
    noTests = false,
  } = {}) {
    this.root = existingRoot || createTmpDir("acceptance-review-fixture-");
    this.ownsRoot = existingRoot === null;
    this.specPath = specPath;
    this.specRelativeDir = path.posix.dirname(specPath);
    this.specId = path.posix.basename(this.specRelativeDir);
    this.specDir = path.join(this.root, this.specRelativeDir);
    const existingSpec = fs.existsSync(path.join(this.root, specPath))
      ? JSON.parse(fs.readFileSync(path.join(this.root, specPath), "utf8"))
      : null;
    this.requirementIds = requirementIds
      ?? existingSpec?.requirements?.map((requirement) => requirement.id)
      ?? ["R1"];
    this.testSummaryIds = testSummaryIds ?? this.requirementIds;
    this.omitArtifacts = omitArtifacts;
    this.testFile = `${this.specRelativeDir}/tests/fixture.test.js`;
    this.scenarioRaw = `${this.specRelativeDir}/tests/.raw/scenario-validity.log`;
    this.executionRaw = `${this.specRelativeDir}/tests/.raw/test-execution.log`;
    this.finalRegressionRaw = `${this.specRelativeDir}/tests/.raw/final-regression-attempt-001.log`;
    this.diff = [
      "diff --git a/src/demo.js b/src/demo.js",
      "--- a/src/demo.js",
      "+++ b/src/demo.js",
      "@@ -1 +1 @@",
      "-export const demo = false;",
      "+export const demo = true;",
      "",
    ].join("\n");
    const baseline = this.ownsRoot
      ? this.#createFixtureRepository()
      : this.#adoptProducerRepository();
    this.state = moveFlowToStep(makeFlowState({
      spec: this.specPath,
      runId: "run-acceptance-fixture",
      baseBranch: "main",
      featureBranch: "feature/acceptance-fixture",
      request: "Verify the acceptance fixture requirement.",
      requirements: this.requirementIds.map((id) => ({
        id,
        priority: "must",
        desc: `${id} fixture requirement`,
        status: "pending",
      })),
      tasks: [],
      ...(baseline && { repairBaseline: baseline.toJSON() }),
    }), "acceptance-review");
    this.flowManager = new FixtureFlowManager(this.state);
    this.fingerprint = buildRepairFingerprint({
      root: this.root,
      specPath: this.specPath,
      state: this.state,
    });
    this.#writeMechanicalEvidence({ noTests });
    if (existingRoot) {
      this.deferredFindings = Object.freeze(readFlowFindingsArtifact(this.specDir).entries);
      this.#writeDeferredSourceEvidence(this.deferredFindings);
    } else {
      const requestedFindings = includeDeferredFinding && deferredFindings.length === 0
        ? [{
            findingId: "DF-1",
            sourceStep: "test-review",
            sourceArtifact: "test-review.json",
            sourceFindingId: "fixture-deferred",
          }]
        : deferredFindings;
      this.#writeDeferredEvidence(requestedFindings);
    }
    this.requirementJudgments = this.requirementIds.map((requirementId) => ({
      requirementId,
      status: "met",
      requestRefs: ["flow.request"],
      requirementRefs: [`spec.json#${requirementId}`],
      diffRefs: ["diff:src/demo.js"],
      repairRefs: ["acceptance:no-repair"],
      testRefs: [`test-execute-result.json#${requirementId}`, "test-result-review.json"],
      missingEvidence: [],
    }));
    this.cleaned = false;
  }

  #createFixtureRepository() {
    const existingSpecPath = path.join(this.root, this.specPath);
    const existingSpec = fs.existsSync(existingSpecPath)
      ? JSON.parse(fs.readFileSync(existingSpecPath, "utf8"))
      : {};
    writeJson(this.root, ".sennel/config.json", {
      name: "acceptance-review-fixture",
      lang: "en",
      type: "base",
      docs: { languages: ["en"], defaultLanguage: "en" },
    });
    writeJson(this.root, this.specPath, {
      ...existingSpec,
      goal: "verify acceptance fixture",
      background: existingSpec.background || "",
      scope: existingSpec.scope || { in: [], out: [] },
      constraints: existingSpec.constraints || [],
      design_principles: existingSpec.design_principles || [],
      overview: existingSpec.overview || { modules: [], data_flow: [], decisions: [] },
      requirements: this.requirementIds.map((id) => ({
        id,
        desc: existingSpec.requirements?.find((requirement) => requirement.id === id)?.desc
          || `${id} fixture requirement`,
        priority: existingSpec.requirements?.find((requirement) => requirement.id === id)?.priority
          || "must",
        status: existingSpec.requirements?.find((requirement) => requirement.id === id)?.status
          || "pending",
      })),
      acceptance_criteria: existingSpec.acceptance_criteria || [],
      clarifications: existingSpec.clarifications || [],
      alternatives_considered: existingSpec.alternatives_considered || [],
      open_questions: existingSpec.open_questions || [],
    });
    writeFile(this.root, `${this.specRelativeDir}/spec.md`, "# Fixture spec\n");
    writeFile(this.root, "src/demo.js", "export const demo = false;\n");
    writeFile(this.root, this.testFile, [
      `// spec: ${this.requirementIds.join(" ")}`,
      "import { test } from 'node:test';",
      ...this.requirementIds.map((id) => `test('${id}: fixture requirement', () => {});`),
      "",
    ].join("\n"));
    writeFile(this.root, this.scenarioRaw, this.requirementIds.map((id) => `${id} expected failure`).join("\n") + "\n");
    writeFile(this.root, this.executionRaw, this.requirementIds.map((id) => `${id} pass`).join("\n") + "\n");
    initGitRepo(this.root);
    commitAll(this.root, "Create fixture baseline");
    checkoutNewBranch(this.root, "feature/acceptance-fixture");
    writeFile(this.root, "src/demo.js", "export const demo = true;\n");
    return captureRepairBaseline({
      root: this.root,
      baseRef: "main",
      runId: "run-acceptance-fixture",
      useMergeBase: true,
    });
  }

  #adoptProducerRepository() {
    this.testFile = this.#existingTestFile() || this.testFile;
    return null;
  }

  #existingTestFile() {
    const testsDir = path.join(this.specDir, "tests");
    if (!fs.existsSync(testsDir)) return null;
    const files = fs.readdirSync(testsDir, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.test\.(?:js|mjs)$/.test(entry.name))
      .map((entry) => path.relative(this.root, path.join(entry.parentPath, entry.name)).replaceAll(path.sep, "/"))
      .sort();
    return files[0] || null;
  }

  #writeFileIfMissing(relativePath, content) {
    if (!fs.existsSync(path.join(this.root, relativePath))) writeFile(this.root, relativePath, content);
  }

  #writeJsonIfMissing(relativePath, value) {
    if (!fs.existsSync(path.join(this.specDir, relativePath))) writeJson(this.specDir, relativePath, value);
  }

  #writeRepairEvidenceIfMissing({ stepId, artifact }) {
    const file = {
      "test-execute": "test-execute-result.json",
      "test-result-review": "test-result-review.json",
      "impl-review": "impl-review.json",
      "impl-gate": "impl-gate-result.json",
      retro: "retro.json",
    }[stepId];
    if (!fs.existsSync(path.join(this.specDir, file))) {
      if (fs.existsSync(path.join(this.specDir, "repair-fingerprint.json"))) {
        writeJson(this.specDir, file, stampRepairFingerprint({ artifact, fingerprint: this.fingerprint }));
        return;
      }
      writeRepairEvidenceArtifact({
        specDir: this.specDir,
        stepId,
        fingerprint: this.fingerprint,
        artifact,
      });
    }
  }

  #writeMechanicalEvidence({ noTests }) {
    const rawEndLine = Math.max(1, this.requirementIds.length);
    this.#writeFileIfMissing(this.testFile, [
      `// spec: ${this.requirementIds.join(" ")}`,
      "import { test } from 'node:test';",
      ...this.requirementIds.map((id) => `test('${id}: fixture requirement', () => {});`),
      "",
    ].join("\n"));
    this.#writeFileIfMissing(this.scenarioRaw, this.requirementIds.map((id) => `${id} expected failure`).join("\n") + "\n");
    this.#writeFileIfMissing(this.executionRaw, this.requirementIds.map((id) => `${id} pass`).join("\n") + "\n");
    this.#writeJsonIfMissing("scenario-validity-result.json", {
      version: "1",
      raw_output_path: this.scenarioRaw,
      command: `node --test ${this.testFile}`,
      process: { started: true, exitCode: 1, signal: null, timedOut: false, spawnError: null },
      result: "pass",
      summary: this.requirementIds.map((id, index) => ({
        id,
        classification: "expected_fail",
        evidence: {
          test_file: this.testFile,
          test_name: `${id}: fixture requirement`,
          command: `node --test ${this.testFile}`,
          raw_output_lines: { start_line: index + 1, end_line: index + 1 },
        },
      })),
    });
    if (!this.omitArtifacts.includes("test-execute-result.json")) {
      this.#writeRepairEvidenceIfMissing({
        stepId: "test-execute",
        artifact: {
          version: "2",
          raw_output_path: this.executionRaw,
          summary: this.testSummaryIds.map((id, index) => ({
            id,
            result: noTests ? "not_applicable" : "pass",
            ...(noTests && { reason: "no_tests_declared" }),
            evidence: {
              test_file: this.testFile,
              test_name: `${id}: fixture requirement`,
              command: `node --test ${this.testFile}`,
              raw_output_lines: { start_line: index + 1, end_line: index + 1 },
            },
          })),
          regression: {
            required: false,
            result: "skipped",
            mode: "none",
            category: noTests ? "project-regression-skipped" : "spec-artifact-only",
            reason: noTests ? "full project regression deferred to final-regression" : "fixture regression not required",
            classified_paths: [],
            changed_files: [],
            trigger_relevant_changed_files: [],
          },
        },
      });
    }
    if (!this.omitArtifacts.includes("test-result-review.json")) {
      this.#writeRepairEvidenceIfMissing({
        stepId: "test-result-review",
        artifact: {
          verdict: "pass",
          checked_items: [
            { check: "summary_evidence", result: "pass", detail: "fixture summary is valid" },
            { check: "project_regression_verification", result: "pass", detail: "fixture regression is valid" },
          ],
          result_file_path: `${this.specRelativeDir}/test-execute-result.json`,
          raw_output_path: this.executionRaw,
        },
      });
    }
    if (!this.omitArtifacts.includes("impl-review.json")) {
      this.#writeRepairEvidenceIfMissing({
        stepId: "impl-review",
        artifact: {
          version: 1,
          phase: "impl",
          generatedAt: new Date().toISOString(),
          verdict: "PASS",
          summary: { blocking: 0, nonBlocking: 0, total: 0 },
          blockingFindings: [],
          nonBlockingImprovements: [],
          excluded: { missingFile: 0, outOfScope: 0 },
        },
      });
    }
    if (!this.omitArtifacts.includes("impl-gate-result.json")) {
      this.#writeRepairEvidenceIfMissing({
        stepId: "impl-gate",
        artifact: {
          verdict: "pass",
          issues: [],
          nextAction: "retro",
          level: "integration",
          phase: "integration",
          evaluations: [],
          reasons: [],
        },
      });
    }
    if (!this.omitArtifacts.includes("retro.json")) {
      this.#writeRepairEvidenceIfMissing({
        stepId: "retro",
        artifact: {
          spec: this.specPath,
          date: new Date().toISOString(),
          mode: "result-file",
          requirements: this.requirementIds.map((id) => ({
            desc: `${id} fixture requirement`,
            status: noTests ? "not_applicable" : "done",
            note: noTests ? "no_tests_declared" : `${id}: fixture requirement`,
          })),
          unplanned: [],
          summary: {
            total: this.requirementIds.length,
            done: noTests ? 0 : this.requirementIds.length,
            partial: 0,
            not_done: 0,
            not_applicable_count: noTests ? this.requirementIds.length : 0,
            na_count: 0,
            not_testable_count: 0,
            rate: 1,
            notes: "acceptance fixture",
          },
        },
      });
    }
    if (noTests) {
      this.#writeFileIfMissing(this.finalRegressionRaw, [
        "[sennel] final regression skipped",
        "reason: skipped_by_project_policy",
        "",
      ].join("\n"));
      this.#writeJsonIfMissing("final-regression-result.json", {
        version: "1",
        completed: true,
        result: "skipped",
        failureKind: null,
        skipKind: "skipped_by_project_policy",
        reason: "no supported project regression command source was found",
        command: null,
        commandSource: null,
        rawOutputPath: this.finalRegressionRaw,
        rawOutputLines: { start: 1, end: 2 },
        process: {
          started: false,
          exitCode: null,
          signal: null,
          timedOut: false,
          spawnError: null,
        },
        childProcesses: [],
        changedFiles: [],
        changedFileFingerprints: [],
        retryable: false,
        nextAction: "report",
        proof: {
          kind: "skipped_by_project_policy",
          commandDiscovery: {
            checkedSources: [
              "config.test.command",
              "package.json scripts.test",
              "composer.json scripts.test",
              "Makefile test",
            ],
            supportedCommandFound: false,
            invalidConfiguredCommand: false,
            reason: "no supported project regression command source was found",
          },
        },
      });
      this.#writeJsonIfMissing("file-map.json", Object.fromEntries(
        this.requirementIds.map((id) => [id, [this.specPath]]),
      ));
    }
    if (rawEndLine < 1) throw new Error("fixture raw evidence must not be empty");
  }

  #writeDeferredEvidence(input) {
    const entries = input.map((finding, index) => {
      const normalized = {
        findingId: finding.findingId || `DF-${index + 1}`,
        sourceStep: finding.sourceStep || "test-review",
        sourceArtifact: finding.sourceArtifact || `${finding.sourceStep || "test-review"}.json`,
        sourceFindingId: finding.sourceFindingId || `source-${index + 1}`,
        fingerprint: String(index + 1).padStart(64, "0"),
      };
      return new FlowFinding({
        findingId: normalized.findingId,
        sourceStep: normalized.sourceStep,
        sourceArtifact: normalized.sourceArtifact,
        sourceFindingId: normalized.sourceFindingId,
        runId: this.state.runId,
        fingerprint: normalized.fingerprint,
        disposition: "deferred",
        rationale: "Fixture retry exhaustion deferred this finding.",
        retryExhausted: true,
        attempts: 10,
        round: 10,
        completionKind: "deferred",
        finalDisposition: null,
      });
    });
    this.deferredFindings = Object.freeze(entries);
    this.#writeDeferredSourceEvidence(entries);
    writeFlowFindingsArtifact(this.specDir, new FlowFindingsArtifact({ entries }));
  }

  #writeDeferredSourceEvidence(entries) {
    const grouped = new Map();
    for (const finding of entries) {
      const key = `${finding.sourceStep}:${finding.sourceArtifact}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(finding);
    }
    for (const findings of grouped.values()) {
      const { sourceArtifact: file } = findings[0];
      const sourcePath = path.join(this.specDir, file);
      const existing = fs.existsSync(sourcePath)
        ? JSON.parse(fs.readFileSync(sourcePath, "utf8"))
        : {};
      const existingFindings = Array.isArray(existing.advisoryFindings)
        ? existing.advisoryFindings
        : [];
      const additions = deferredSourceEvidence(findings).filter((candidate) => !existingFindings.some((entry) => (
        entry.findingId === candidate.findingId && entry.fingerprint === candidate.fingerprint
      )));
      if (fs.existsSync(sourcePath) && additions.length === 0) continue;
      writeJson(this.specDir, file, {
        ...existing,
        advisoryFindings: [
          ...existingFindings,
          ...additions,
        ],
      });
    }
  }

  dispositionJudgments(finalDispositions) {
    const dispositions = Array.isArray(finalDispositions)
      ? finalDispositions
      : this.deferredFindings.map(() => finalDispositions);
    if (dispositions.length !== this.deferredFindings.length) {
      throw new Error("fixture disposition count must match deferred findings");
    }
    return this.deferredFindings.map((finding, index) => ({
      findingId: finding.findingId,
      finalDisposition: dispositions[index],
      evidenceRefs: [`${finding.sourceArtifact}#${finding.sourceFindingId}`],
    }));
  }

  activeStep() {
    return flattenSteps(this.state.steps).find((step) => step.status === "in_progress")?.id || null;
  }

  cleanup() {
    if (this.cleaned) return;
    if (this.ownsRoot) removeTmpDir(this.root);
    this.cleaned = true;
  }
}

export function createAcceptanceReviewFixture(options = {}) {
  return new AcceptanceReviewFixture(options);
}

export function adoptAcceptanceReviewFixture({ root, specPath }) {
  return new AcceptanceReviewFixture({ existingRoot: root, specPath });
}

export function runAcceptanceReviewFixture({
  root,
  state,
  diff,
  requirementJudgments,
  deferredFindingDispositions = [],
  persist = false,
  apply = false,
  flowManager = null,
}) {
  const context = buildAcceptanceReviewContext({ root, state, diff });
  const artifact = artifactFromAcceptanceJudgments({
    context,
    requirementJudgments,
    deferredFindingDispositions,
  });
  const written = persist
    ? writeAcceptanceReviewArtifact({
        specDir: context.specDir,
        artifact,
        requirementIds: context.requirementIds,
        fingerprint: context.fingerprint,
        flowState: state,
      })
    : null;
  const applied = apply
    ? applyAcceptanceReviewResult({ root, flowManager, artifact })
    : null;
  return Object.freeze({ context, artifact, written, applied });
}
