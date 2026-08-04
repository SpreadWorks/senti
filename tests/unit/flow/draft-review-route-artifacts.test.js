import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { writeEmptyDraftReviewRouteArtifacts } from "../../../src/flow/definition.js";
import { draftReviewRouteForKey } from "../../../src/flow/lib/draft-review-routes.js";

describe("empty draft review route artifacts", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("reports approval eligibility without mutating the canonical draft", () => {
    tmp = createTmpDir("draft-coverage-pass-");
    const specDir = path.join(tmp, "specs", "demo");
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, "draft.json"), `${JSON.stringify({
      qa: [{ status: "answered" }],
      approval: { approved: false, confirmedAt: "", notes: "" },
    })}\n`);

    const originalBytes = fs.readFileSync(path.join(specDir, "draft.json"));
    const result = writeEmptyDraftReviewRouteArtifacts({
      specDir,
      route: draftReviewRouteForKey("coverage"),
      generatedAt: "2026-07-26T00:00:00.000Z",
    });

    assert.equal(result.approvalEligible, true);
    assert.deepEqual(fs.readFileSync(path.join(specDir, "draft.json")), originalBytes);
    const draft = JSON.parse(fs.readFileSync(path.join(specDir, "draft.json"), "utf8"));
    assert.deepEqual(draft.approval, {
      approved: false,
      confirmedAt: "",
      notes: "",
    });
  });
});
