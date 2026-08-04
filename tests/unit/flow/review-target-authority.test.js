import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { buildRepairFingerprint } from "../../../src/flow/lib/impl-repair-artifacts.js";
import { ReviewTargetAuthority } from "../../../src/flow/lib/review-target-authority.js";
import { makeFlowState } from "../../helpers/flow-setup.js";
import { commitAll, initGitRepo } from "../../helpers/git-repo.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const SPEC_ID = "496-review-authority-unit";
const SPEC_PATH = `specs/${SPEC_ID}/spec.json`;

function writeFile(root, relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function writeJson(root, relativePath, value) {
  writeFile(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

describe("ReviewTargetAuthority", () => {
  let temporaryRoot;

  afterEach(() => {
    if (temporaryRoot) removeTmpDir(temporaryRoot);
    temporaryRoot = null;
  });

  it("keeps capture and revalidation on the same execution/artifact root pair", () => {
    temporaryRoot = createTmpDir("review-target-authority-");
    const artifactRoot = path.join(temporaryRoot, "main");
    const executionRoot = path.join(temporaryRoot, "worktree");
    fs.mkdirSync(artifactRoot, { recursive: true });
    writeJson(artifactRoot, ".senti/config.json", {
      name: "review-target-authority-fixture",
      lang: "en",
      type: "base",
      docs: { languages: ["en"], defaultLanguage: "en" },
    });
    writeFile(artifactRoot, "src/subject.js", "export const subject = 'stable';\n");
    writeJson(artifactRoot, SPEC_PATH, {
      goal: "Keep review identity bound to the execution checkout.",
      requirements: [],
      tasks: [],
    });
    writeJson(artifactRoot, "specs/other-active-flow/spec.json", {
      goal: "Unrelated active Flow.",
      requirements: [],
      tasks: [],
    });
    initGitRepo(artifactRoot);
    commitAll(artifactRoot, "fixture baseline");
    execFileSync("git", ["worktree", "add", "-q", "-b", "feature/review-authority-unit", executionRoot], {
      cwd: artifactRoot,
    });

    const flowState = makeFlowState({
      specId: SPEC_ID,
      runId: "run-review-authority-unit",
      featureBranch: "feature/review-authority-unit",
      createdAt: "2026-08-04T00:00:00.000Z",
    });
    const authority = ReviewTargetAuthority.fromContext({
      root: artifactRoot,
      executionRoot,
      flowState,
    });
    assert.equal(authority.executionRoot, path.resolve(executionRoot));
    assert.equal(authority.artifactRoot, path.resolve(artifactRoot));

    const captured = authority.captureFingerprint();
    writeJson(artifactRoot, `specs/${SPEC_ID}/plugin-artifacts/workflow/prepare.json`, {
      runId: flowState.runId,
    });
    writeJson(artifactRoot, "specs/other-active-flow/plugin-artifacts/workflow/prepare.json", {
      runId: "run-other-active-flow",
    });
    const revalidated = authority.captureFingerprint();
    const expected = buildRepairFingerprint({
      root: executionRoot,
      artifactRoot,
      specPath: SPEC_PATH,
      state: flowState,
    });
    const wrongRoot = buildRepairFingerprint({
      root: artifactRoot,
      specPath: SPEC_PATH,
      state: flowState,
    });

    assert.equal(revalidated.hash, captured.hash);
    assert.deepEqual(revalidated.toJSON(), expected.toJSON());
    assert.notEqual(wrongRoot.hash, revalidated.hash);
    assert.equal(
      revalidated.entries.some((entry) => entry.path.includes("plugin-artifacts")),
      false,
    );
    assert.equal(
      wrongRoot.entries.some((entry) => entry.path.includes("plugin-artifacts")),
      true,
    );
  });
});
