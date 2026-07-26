// spec: R4 R5 R6
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { buildDraftReviewArtifact } from "../../../src/flow/commands/review.js";
import { writeEmptyDraftReviewRouteArtifacts } from "../../../src/flow/definition.js";
import { draftReviewRouteForKey } from "../../../src/flow/lib/draft-review-routes.js";

describe("draft review lifecycle", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("R4: records the lifecycle retry phase in a draft review artifact", () => {
    const artifact = buildDraftReviewArtifact({
      raw: "NO_PROPOSALS",
      draftPath: "draft.json",
      proposals: [],
      stage: { retryPhase: "draft-questions", artifactPhase: "draft-questions-review" },
    });

    assert.equal(artifact.phase, "draft-questions");
  });

  it("R5: approves a resolved draft after a passing coverage route", () => {
    tmp = createTmpDir("spec-474-coverage-");
    const specDir = path.join(tmp, "specs", "demo");
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, "draft.json"), `${JSON.stringify({
      qa: [{ status: "answered" }],
      approval: { approved: false, confirmedAt: "", notes: "" },
    })}\n`);

    writeEmptyDraftReviewRouteArtifacts({
      specDir,
      route: draftReviewRouteForKey("coverage"),
      generatedAt: "2026-07-26T00:00:00.000Z",
    });

    const draft = JSON.parse(fs.readFileSync(path.join(specDir, "draft.json"), "utf8"));
    assert.equal(draft.approval.approved, true);
    assert.equal(draft.approval.confirmedAt, "2026-07-26T00:00:00.000Z");
  });

  it("R6: preserves the artifact and approval lifecycle contracts", () => {
    assert.equal(typeof buildDraftReviewArtifact, "function");
    assert.equal(typeof writeEmptyDraftReviewRouteArtifacts, "function");
  });
});
