import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  CanonicalReviewPromotion,
  canonicalReviewArtifactFilename,
} from "../../../src/flow/lib/canonical-review-artifacts.js";
import {
  REVIEW_WORK_UNIT_CHECKOUT_ENV,
  REVIEW_WORK_UNIT_MANIFEST_ENV,
  ReviewWorkUnit,
  ReviewWorkUnitOutput,
} from "../../../src/flow/lib/review-work-unit.js";
import {
  GIT_REPOSITORY_LOCATION_ENVIRONMENT,
  sanitizeGitRepositoryEnvironment,
} from "../../../src/lib/git-repository-environment.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { commitAll, initGitRepo } from "../../helpers/git-repo.js";
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

function mutateAfterFirstSnapshotRead(mutate) {
  const original = fs.readFileSync;
  let descriptorReads = 0;
  fs.readFileSync = function patchedReadFileSync(file, ...args) {
    const bytes = original.call(this, file, ...args);
    if (typeof file === "number" && descriptorReads++ === 0) mutate();
    return bytes;
  };
  return () => { fs.readFileSync = original; };
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

  it("materializes a bounded git-aware source snapshot without exposing ignored or canonical bytes", () => {
    const executionRoot = root();
    initGitRepo(executionRoot);
    fs.mkdirSync(path.join(executionRoot, "src"), { recursive: true });
    fs.writeFileSync(path.join(executionRoot, ".gitignore"), ".env\n");
    fs.writeFileSync(path.join(executionRoot, "src", "tracked.js"), "export const tracked = 1;\n");
    fs.writeFileSync(path.join(executionRoot, "src", "linked-source.js"), "export const linked = 1;\n");
    fs.symlinkSync("linked-source.js", path.join(executionRoot, "src", "internal-link.js"));
    commitAll(executionRoot, "tracked source");
    fs.writeFileSync(path.join(executionRoot, "notes.txt"), "untracked but reviewable\n");
    fs.writeFileSync(path.join(executionRoot, ".env"), "SECRET=must-not-copy\n");
    const external = path.join(root(), "external.js");
    fs.writeFileSync(external, "outside canonical checkout\n");
    fs.symlinkSync(external, path.join(executionRoot, "src", "outside-link.js"));

    const writer = createWorkUnit(executionRoot, { attemptId: "source-snapshot" });
    const checkout = writer.materializeExecutionCheckout();
    const surface = writer.finalize();
    assert.equal(
      execFileSync("git", ["-C", checkout.directory, "rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim(),
      checkout.directory,
    );
    const canonicalHead = execFileSync("git", ["-C", executionRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    assert.equal(fs.readFileSync(path.join(checkout.directory, "src", "tracked.js"), "utf8"), "export const tracked = 1;\n");
    assert.equal(fs.readFileSync(path.join(checkout.directory, "src", "internal-link.js"), "utf8"), "export const linked = 1;\n");
    assert.equal(fs.existsSync(path.join(checkout.directory, ".env")), false);
    assert.equal(fs.existsSync(path.join(checkout.directory, "src", "outside-link.js")), false);
    assert.equal(fs.readFileSync(path.join(checkout.directory, "notes.txt"), "utf8"), "untracked but reviewable\n");
    fs.writeFileSync(path.join(checkout.directory, "src", "tracked.js"), "provider mutation\n");
    execFileSync("git", ["-C", checkout.directory, "add", "src/tracked.js"]);
    execFileSync("git", ["-C", checkout.directory, "commit", "-q", "-m", "provider snapshot mutation"]);
    assert.equal(fs.readFileSync(path.join(executionRoot, "src", "tracked.js"), "utf8"), "export const tracked = 1;\n");
    assert.equal(execFileSync("git", ["-C", executionRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(), canonicalHead);
    assert.throws(
      () => ReviewWorkUnit.executionCheckoutFromEnvironment({
        [REVIEW_WORK_UNIT_MANIFEST_ENV]: surface.manifestPath,
        [REVIEW_WORK_UNIT_CHECKOUT_ENV]: checkout.directory,
      }),
      /changed after parent snapshot/,
    );
  });

  it("ignores inherited Git repository-location variables for the snapshot and provider surface", () => {
    const executionRoot = root();
    initGitRepo(executionRoot);
    fs.writeFileSync(path.join(executionRoot, "canonical.js"), "export const canonical = true;\n");
    commitAll(executionRoot, "canonical source");
    const foreignRoot = root();
    initGitRepo(foreignRoot);
    fs.writeFileSync(path.join(foreignRoot, "foreign.js"), "export const foreign = true;\n");
    commitAll(foreignRoot, "foreign source");
    const dynamicConfig = ["GIT_CONFIG_KEY_0", "GIT_CONFIG_VALUE_0"];
    const inheritedNames = [...GIT_REPOSITORY_LOCATION_ENVIRONMENT, ...dynamicConfig, "HOME"];
    const prior = Object.fromEntries(inheritedNames.map((name) => [name, process.env[name]]));
    const home = root();
    const globalExcludes = path.join(home, "global-excludes");
    fs.writeFileSync(globalExcludes, "globally-ignored-secret.env\n");
    fs.writeFileSync(path.join(home, ".gitconfig"), [
      "[core]",
      `\texcludesFile = ${globalExcludes}`,
      `\tworktree = ${foreignRoot}`,
      "",
    ].join("\n"));
    fs.writeFileSync(path.join(executionRoot, "globally-ignored-secret.env"), "SECRET=must-not-copy\n");
    const poisoned = {
      GIT_DIR: path.join(foreignRoot, ".git"),
      GIT_WORK_TREE: foreignRoot,
      GIT_INDEX_FILE: path.join(foreignRoot, ".git", "index"),
      GIT_OBJECT_DIRECTORY: path.join(foreignRoot, ".git", "objects"),
      GIT_ALTERNATE_OBJECT_DIRECTORIES: path.join(foreignRoot, ".git", "objects"),
      GIT_COMMON_DIR: path.join(foreignRoot, ".git"),
      GIT_CEILING_DIRECTORIES: foreignRoot,
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "core.worktree",
      GIT_CONFIG_VALUE_0: foreignRoot,
      GIT_CONFIG_PARAMETERS: "core.worktree=foreign",
      HOME: home,
    };
    Object.assign(process.env, poisoned);
    try {
      const checkout = createWorkUnit(executionRoot, { attemptId: "git-environment" })
        .materializeExecutionCheckout();
      const providerEnvironment = sanitizeGitRepositoryEnvironment();
      for (const name of GIT_REPOSITORY_LOCATION_ENVIRONMENT) {
        if (name === "GIT_CONFIG_GLOBAL" || name === "GIT_CONFIG_NOSYSTEM") continue;
        assert.equal(providerEnvironment[name], undefined, `${name} must not reach the review provider`);
      }
      for (const name of dynamicConfig) assert.equal(providerEnvironment[name], undefined, `${name} must not reach the review provider`);
      assert.equal(providerEnvironment.GIT_CONFIG_GLOBAL, os.devNull);
      assert.equal(providerEnvironment.GIT_CONFIG_NOSYSTEM, "1");
      assert.equal(fs.readFileSync(path.join(checkout.directory, "canonical.js"), "utf8"), "export const canonical = true;\n");
      assert.equal(fs.existsSync(path.join(checkout.directory, "foreign.js")), false);
      assert.equal(fs.existsSync(path.join(checkout.directory, "globally-ignored-secret.env")), false);
      assert.equal(
        execFileSync("git", ["-C", checkout.directory, "rev-parse", "--show-toplevel"], {
          encoding: "utf8",
          env: providerEnvironment,
        }).trim(),
        checkout.directory,
      );
      const canonicalHead = execFileSync("git", ["-C", executionRoot, "rev-parse", "HEAD"], {
        encoding: "utf8",
        env: providerEnvironment,
      }).trim();
      fs.writeFileSync(path.join(checkout.directory, "canonical.js"), "provider-only mutation\n");
      execFileSync("git", ["-C", checkout.directory, "add", "canonical.js"], { env: providerEnvironment });
      execFileSync("git", ["-C", checkout.directory, "commit", "-q", "-m", "provider mutation"], { env: providerEnvironment });
      assert.equal(fs.readFileSync(path.join(executionRoot, "canonical.js"), "utf8"), "export const canonical = true;\n");
      assert.equal(
        execFileSync("git", ["-C", executionRoot, "rev-parse", "HEAD"], {
          encoding: "utf8",
          env: providerEnvironment,
        }).trim(),
        canonicalHead,
      );
    } finally {
      for (const [name, value] of Object.entries(prior)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  });

  it("accepts a Git path list larger than Node's default exec buffer within the manifest limit", () => {
    const executionRoot = root();
    initGitRepo(executionRoot);
    const directory = path.join(executionRoot, "sources");
    fs.mkdirSync(directory);
    const padding = "x".repeat(210);
    for (let index = 0; index < 5_000; index += 1) {
      fs.writeFileSync(path.join(directory, `${String(index).padStart(5, "0")}-${padding}.js`), "");
    }
    commitAll(executionRoot, "large source path list");

    const checkout = createWorkUnit(executionRoot, { attemptId: "large-path-list" })
      .materializeExecutionCheckout();
    assert.equal(checkout.snapshot.files.length, 5_000);
  });

  it("fails closed when a source file changes while the parent is capturing one checkout", () => {
    const executionRoot = root();
    initGitRepo(executionRoot);
    const first = path.join(executionRoot, "00-first.js");
    fs.writeFileSync(first, "export const first = 1;\n");
    fs.writeFileSync(path.join(executionRoot, "99-second.js"), "export const second = 1;\n");
    commitAll(executionRoot, "snapshot sources");
    const writer = createWorkUnit(executionRoot, { attemptId: "source-mutation" });
    const restore = mutateAfterFirstSnapshotRead(() => {
      fs.writeFileSync(first, "export const first = 2;\n");
    });
    try {
      assert.throws(
        () => writer.materializeExecutionCheckout(),
        /source 00-first\.js changed during snapshot/,
      );
    } finally {
      restore();
    }
    assert.equal(fs.existsSync(writer.checkoutDirectory), false, "failed materialization removes its own checkout residue");
    assert.ok(writer.materializeExecutionCheckout(), "the same Attempt may materialize again after cleanup");
  });

  it("fails closed when an internal source symlink swaps to an external target during capture", () => {
    const executionRoot = root();
    initGitRepo(executionRoot);
    fs.writeFileSync(path.join(executionRoot, "99-target.js"), "export const target = 1;\n");
    const link = path.join(executionRoot, "00-link.js");
    fs.symlinkSync("99-target.js", link);
    commitAll(executionRoot, "snapshot symlink");
    const external = path.join(root(), "external.js");
    fs.writeFileSync(external, "outside source root\n");
    const restore = mutateAfterFirstSnapshotRead(() => {
      fs.unlinkSync(link);
      fs.symlinkSync(external, link);
    });
    try {
      assert.throws(
        () => createWorkUnit(executionRoot, { attemptId: "symlink-swap" }).materializeExecutionCheckout(),
        /source 00-link\.js changed during snapshot/,
      );
    } finally {
      restore();
    }
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
  });

  it("discards checkout-only crash residue before the same Attempt retries", () => {
    const executionRoot = root();
    const writer = createWorkUnit(executionRoot, { attemptId: "checkout-only-residue" });
    writer.prepare();
    fs.mkdirSync(writer.checkoutDirectory);
    fs.writeFileSync(path.join(writer.checkoutDirectory, "partial"), "incomplete\n");
    assert.equal(writer.recoverSealed(), null);
    assert.equal(fs.existsSync(writer.checkoutDirectory), false);
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
