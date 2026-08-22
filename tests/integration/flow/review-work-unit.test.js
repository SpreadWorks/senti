import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  CanonicalReviewPromotion,
  canonicalReviewArtifactFilename,
} from "../../../src/flow/lib/canonical-review-artifacts.js";
import {
  REVIEW_WORK_UNIT_MANIFEST_ENV,
  ReviewWorkUnit,
  ReviewWorkUnitOutput,
} from "../../../src/flow/lib/review-work-unit.js";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";
import { initGitRepo } from "../../support/infrastructure/git-repo.js";
import {
  parseImplReviewOutput,
  parseProposalReviewOutput,
  parseSpecReviewOutput,
  parseTestReviewOutput,
} from "../../../src/flow/lib/run-review.js";

const roots = [];

function root() {
  const value = createTmpDir("review-work-unit-");
  roots.push(value);
  return value;
}

function createWorkUnit(executionRoot, overrides = {}) {
  return new ReviewWorkUnit({
    executionRoot,
    runId: "review-run",
    specId: "001-review-work-unit",
    phase: "draft-questions",
    nodeId: "draft-questions-review",
    attemptId: "attempt-1",
    target: { treeSha: "a".repeat(40), targetStateDigest: "b".repeat(64) },
    output: new ReviewWorkUnitOutput({
      logicalKey: "draft.questions.review",
      basename: "draft-review-questions.json",
      mediaType: "application/json",
    }),
    ...overrides,
  });
}

afterEach(() => {
  while (roots.length > 0) removeTmpDir(roots.pop());
});

describe("ReviewWorkUnit", () => {
  it("derives every review output basename from its one typed descriptor route", () => {
    for (const [phase, taskId, basename] of [
      ["draft-questions", null, "draft-review-questions.json"],
      ["draft-coverage", null, "draft-review-coverage.json"],
      ["spec", null, "spec-review.json"],
      ["test", null, "test-review.json"],
      ["impl", null, "impl-review.json"],
      ["impl", "task-1", "impl-review.json"],
    ]) {
      assert.equal(canonicalReviewArtifactFilename({ phase, taskId }), basename);
    }
  });

  it("seals only an execution-checkout work unit and recovers only an exact parent contract", () => {
    const mainRoot = root();
    const executionRoot = path.join(root(), "execution");
    fs.mkdirSync(executionRoot, { recursive: true });
    initGitRepo(mainRoot);
    initGitRepo(executionRoot);
    const writer = createWorkUnit(executionRoot);
    writer.writeInput({
      logicalKey: "draft",
      logicalPath: "draft.json",
      bytes: Buffer.from('{"qa":[]}\n', "utf8"),
      mediaType: "application/json",
      root: true,
    });
    const surface = writer.finalize();
    assert.equal(surface.directory.startsWith(path.join(executionRoot, ".sennel", "review-work-units")), true);
    assert.equal(surface.directory.startsWith(mainRoot), false);
    fs.writeFileSync(surface.outputPath, '{"verdict":"PASS","blockingFindings":[],"advisoryFindings":[]}\n');
    ReviewWorkUnit.fromEnvironment({ [REVIEW_WORK_UNIT_MANIFEST_ENV]: surface.manifestPath }).seal();

    const recovered = createWorkUnit(executionRoot);
    recovered.declareInput({
      logicalKey: "draft",
      logicalPath: "draft.json",
      bytes: Buffer.from('{"qa":[]}\n', "utf8"),
      mediaType: "application/json",
      root: true,
    });
    assert.ok(recovered.recoverSealed());

    const mismatched = createWorkUnit(executionRoot, {
      target: { treeSha: "c".repeat(40), targetStateDigest: "b".repeat(64) },
    });
    mismatched.declareInput({
      logicalKey: "draft",
      logicalPath: "draft.json",
      bytes: Buffer.from('{"qa":[]}\n', "utf8"),
      mediaType: "application/json",
      root: true,
    });
    assert.throws(() => mismatched.recoverSealed(), /parent Attempt contract/);
  });

  it("fails closed for unsealed residue and every tampered worker boundary", () => {
    const executionRoot = root();
    const unsealed = createWorkUnit(executionRoot);
    unsealed.writeInput({ logicalKey: "draft", logicalPath: "draft.json", bytes: "{}\n", root: true });
    const partial = unsealed.finalize();
    assert.equal(unsealed.recoverSealed(), null);
    assert.equal(fs.existsSync(partial.directory), false, "unsealed residue is safely discarded");

    const writer = createWorkUnit(executionRoot, { attemptId: "attempt-tampered" });
    writer.writeInput({ logicalKey: "draft", logicalPath: "draft.json", bytes: "{}\n", root: true });
    const surface = writer.finalize();
    fs.writeFileSync(surface.outputPath, '{"verdict":"PASS","blockingFindings":[],"advisoryFindings":[]}\n');
    ReviewWorkUnit.fromEnvironment({ [REVIEW_WORK_UNIT_MANIFEST_ENV]: surface.manifestPath }).seal();
    fs.writeFileSync(path.join(surface.directory, "seal.json"), '{"version":1}\n');
    assert.throws(
      () => ReviewWorkUnit.fromEnvironment({ [REVIEW_WORK_UNIT_MANIFEST_ENV]: surface.manifestPath }).readSealedOutput(),
      /seal is invalid|seal has invalid fields/,
    );

    const symlink = createWorkUnit(executionRoot, { attemptId: "attempt-symlink" });
    const symlinkSurface = symlink.finalize();
    const outside = path.join(executionRoot, "outside.json");
    fs.writeFileSync(outside, "{}\n");
    fs.symlinkSync(outside, symlinkSurface.outputPath);
    assert.throws(
      () => ReviewWorkUnit.fromEnvironment({ [REVIEW_WORK_UNIT_MANIFEST_ENV]: symlinkSurface.manifestPath }).seal(),
      /regular (file|real)|symbolic/i,
    );

    const directorySymlink = createWorkUnit(executionRoot, { attemptId: "attempt-directory-symlink" });
    const directorySymlinkSurface = directorySymlink.finalize();
    const manifestBytes = fs.readFileSync(directorySymlinkSurface.manifestPath);
    fs.rmSync(directorySymlinkSurface.directory, { recursive: true });
    const outsideDirectory = path.join(executionRoot, "outside-work-unit");
    fs.mkdirSync(outsideDirectory);
    fs.writeFileSync(path.join(outsideDirectory, "manifest.json"), manifestBytes);
    fs.symlinkSync(outsideDirectory, directorySymlinkSurface.directory);
    assert.throws(
      () => ReviewWorkUnit.fromEnvironment({ [REVIEW_WORK_UNIT_MANIFEST_ENV]: directorySymlinkSurface.manifestPath }),
      /manifest directory must be a real directory/i,
    );

    const oversizedInput = createWorkUnit(executionRoot, { attemptId: "attempt-oversized-input" });
    oversizedInput.writeInput({ logicalKey: "draft", logicalPath: "draft.json", bytes: "{}\n", root: true });
    const oversizedInputSurface = oversizedInput.finalize();
    fs.writeFileSync(path.join(oversizedInputSurface.directory, "draft.json"), Buffer.alloc(1024, "x"));
    fs.writeFileSync(oversizedInputSurface.outputPath, '{"verdict":"PASS"}\n');
    assert.throws(
      () => ReviewWorkUnit.fromEnvironment({
        [REVIEW_WORK_UNIT_MANIFEST_ENV]: oversizedInputSurface.manifestPath,
      }).seal(),
      /review work unit input draft is unavailable or invalid:.*up to 3 bytes/,
    );
  });

  it("accepts parent-declared inputs larger than the worker output limit", () => {
    const executionRoot = root();
    const writer = createWorkUnit(executionRoot, { attemptId: "large-parent-input" });
    const input = Buffer.alloc((2 * 1024 * 1024) + 1, "x");
    writer.writeInput({ logicalKey: "spec.record", logicalPath: "spec.json", bytes: input, root: true });
    const surface = writer.finalize();
    fs.writeFileSync(surface.outputPath, '{"verdict":"PASS"}\n');
    assert.doesNotThrow(() => ReviewWorkUnit.fromEnvironment({
      [REVIEW_WORK_UNIT_MANIFEST_ENV]: surface.manifestPath,
    }).seal());

    const recovered = createWorkUnit(executionRoot, { attemptId: "large-parent-input" });
    recovered.declareInput({ logicalKey: "spec.record", logicalPath: "spec.json", bytes: input, root: true });
    assert.ok(recovered.recoverSealed());
  });

  it("rejects an oversized worker output", () => {
    const executionRoot = root();
    const writer = createWorkUnit(executionRoot, { attemptId: "large-worker-output" });
    const surface = writer.finalize();
    fs.writeFileSync(surface.outputPath, Buffer.alloc((2 * 1024 * 1024) + 1, "x"));
    assert.throws(
      () => ReviewWorkUnit.fromEnvironment({ [REVIEW_WORK_UNIT_MANIFEST_ENV]: surface.manifestPath }).seal(),
      /review work unit output is unavailable or invalid:.*2097152 bytes/,
    );
  });

  it("reconstructs phase lifecycle results from sealed artifacts equivalently to the subprocess parser", () => {
    const executionRoot = root();
    const outcomes = ["PASS", "ADVISORY", "REJECTED"];
    const phases = [
      ["draft-questions", null],
      ["draft-coverage", null],
      ["spec", null],
      ["test", null],
      ["impl", null],
      ["impl", "task-1"],
    ];
    for (const [phase, taskId] of phases) {
      for (const verdict of outcomes) {
        const output = canonicalReviewArtifactFilename({ phase, taskId });
        const workUnit = createWorkUnit(executionRoot, {
          phase,
          taskId,
          nodeId: phase === "impl" ? (taskId === null ? "impl-review" : "task-1-review") : `${phase}-review`,
          attemptId: `${phase}-${taskId || "flow"}-${verdict}`,
          output: new ReviewWorkUnitOutput({ logicalKey: `${phase}.review`, basename: output, mediaType: "application/json" }),
        });
        const surface = workUnit.finalize();
        const blockingFindings = verdict === "REJECTED" ? [{ id: "blocked", summary: "Must fix." }] : [];
        const advisoryFindings = verdict === "ADVISORY" ? [{ id: "advice", summary: "Optional." }] : [];
        fs.writeFileSync(surface.outputPath, `${JSON.stringify({ verdict, blockingFindings, advisoryFindings, nonBlockingImprovements: advisoryFindings }, null, 2)}\n`);
        ReviewWorkUnit.fromEnvironment({ [REVIEW_WORK_UNIT_MANIFEST_ENV]: surface.manifestPath }).seal();
        const promotion = new CanonicalReviewPromotion({
          workUnit: ReviewWorkUnit.fromEnvironment({ [REVIEW_WORK_UNIT_MANIFEST_ENV]: surface.manifestPath }),
          phase,
          taskId,
          treeSha: "a".repeat(40),
          targetStateDigest: "b".repeat(64),
        });
        const recovered = promotion.resultFromSealedArtifact();
        const count = verdict === "PASS" ? 0 : 1;
        const response = { ok: true, status: 0 };
        const stderr = phase.startsWith("draft-")
          ? `verdict=${verdict} questions=${count} retryPhase=${phase}`
          : phase === "spec"
            ? `verdict=${verdict} proposalCount=${count}`
            : phase === "test"
              ? `verdict=${verdict} blocking=${verdict === "REJECTED" ? 1 : 0} advisory=${verdict === "ADVISORY" ? 1 : 0}`
              : `verdict=${verdict} blocking=${verdict === "REJECTED" ? 1 : 0} nonBlocking=${verdict === "ADVISORY" ? 1 : 0}${taskId === null ? "" : ` taskId=${taskId}`}`;
        const parsed = phase.startsWith("draft-")
          ? parseProposalReviewOutput(response, "", stderr)
          : phase === "spec"
            ? parseSpecReviewOutput(response, "", stderr)
            : phase === "test"
              ? parseTestReviewOutput(response, "", stderr)
              : parseImplReviewOutput(response, "", stderr);
        parsed.artifacts.phase = phase;
        if (taskId !== null) parsed.artifacts.taskId = taskId;
        assert.equal(recovered.next, parsed.next, `${phase}/${verdict} next`);
        assert.equal(recovered.artifacts.verdict, parsed.artifacts.verdict, `${phase}/${verdict} verdict`);
        assert.equal(recovered.artifacts.taskId || null, parsed.artifacts.taskId || null, `${phase}/${verdict} task`);
        if (phase.startsWith("draft-")) assert.equal(recovered.artifacts.issueCount, parsed.artifacts.issueCount);
        if (phase === "spec") assert.equal(recovered.artifacts.proposalCount, parsed.artifacts.proposalCount);
        if (phase === "test") {
          assert.equal(recovered.artifacts.blockingCount, parsed.artifacts.blockingCount);
          assert.equal(recovered.artifacts.advisoryCount, parsed.artifacts.advisoryCount);
        }
        if (phase === "impl") {
          assert.equal(recovered.artifacts.blockingCount, parsed.artifacts.blockingCount);
          assert.equal(recovered.artifacts.nonBlockingCount, parsed.artifacts.nonBlockingCount);
        }
      }
    }
  });

  it("does not promote a tooling-shaped or verdict-less worker artifact", () => {
    const executionRoot = root();
    const workUnit = createWorkUnit(executionRoot, { attemptId: "tooling-failure" });
    const surface = workUnit.finalize();
    fs.writeFileSync(surface.outputPath, '{"toolingOutcome":{"reason":"permission"}}\n');
    ReviewWorkUnit.fromEnvironment({ [REVIEW_WORK_UNIT_MANIFEST_ENV]: surface.manifestPath }).seal();
    const promotion = new CanonicalReviewPromotion({
      workUnit: ReviewWorkUnit.fromEnvironment({ [REVIEW_WORK_UNIT_MANIFEST_ENV]: surface.manifestPath }),
      phase: "draft-questions",
      treeSha: "a".repeat(40),
      targetStateDigest: "b".repeat(64),
    });
    assert.throws(() => promotion.resultFromSealedArtifact(), /verdict is required/);
  });
});
