// spec: R1 R2 R3 R4 R5
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  parseTestReviewFindings,
} from "../../../src/flow/commands/review.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const reviewSourcePath = path.join(repoRoot, "src/flow/commands/review.js");
const sharedReviewTestPath = path.join(repoRoot, "tests/unit/flow/commands/review.test.js");

function parseTestReview(payload) {
  return parseTestReviewFindings(JSON.stringify(payload));
}

test("R1: test-review parser fills omitted top-level findings arrays", () => {
  const empty = parseTestReview({});
  assert.equal(empty.blocking.length, 0);
  assert.equal(empty.advisory.length, 0);

  const blockingOnly = parseTestReview({
    blockingFindings: [{
      title: "Missing coverage",
      target: "R2",
      issue: "R2 has no test.",
      requiredChange: "Add a spec-local test for R2.",
      whyBlocking: "Implementation would proceed without acceptance coverage.",
    }],
  });
  assert.equal(blockingOnly.blocking.length, 1);
  assert.equal(blockingOnly.advisory.length, 0);

  const advisoryOnly = parseTestReview({
    advisoryFindings: [{
      title: "Extra boundary",
      target: "R1",
      improvement: "Add one more boundary case.",
      whyNonBlocking: "Current coverage is adequate for implementation.",
    }],
  });
  assert.equal(advisoryOnly.blocking.length, 0);
  assert.equal(advisoryOnly.advisory.length, 1);
});

test("R2: test-review parser still rejects invalid values and malformed items", () => {
  assert.throws(
    () => parseTestReview({ blockingFindings: "none", advisoryFindings: [] }),
    /test review output failed schema validation/,
  );

  assert.throws(
    () => parseTestReview({
      blockingFindings: [{ title: "Missing required fields" }],
      advisoryFindings: [],
    }),
    /test review output failed schema validation/,
  );
});

test("R3: accepted test-review output keeps artifact-compatible finding counts", () => {
  const parsed = parseTestReview({
    blockingFindings: [{
      title: "Missing coverage",
      target: "R2",
      issue: "R2 has no test.",
      requiredChange: "Add a spec-local test for R2.",
      whyBlocking: "Implementation would proceed without acceptance coverage.",
    }],
    advisoryFindings: [{
      title: "Extra boundary",
      target: "R1",
      improvement: "Add one more boundary case.",
      whyNonBlocking: "Current coverage is adequate for implementation.",
    }],
  });

  assert.equal(parsed.blocking.length, 1);
  assert.equal(parsed.advisory.length, 1);
  assert.equal(parsed.blocking[0].kind, "blocking");
  assert.equal(parsed.advisory[0].kind, "advisory");
});

test("R4: test-review and spec-review use one top-level array normalization helper", () => {
  const source = fs.readFileSync(reviewSourcePath, "utf8");
  assert.match(source, /function normalizeReviewResponseArrays\(/);
  assert.match(source, /parseTestReviewJsonOutput[\s\S]*normalizeReviewResponseArrays\(/);
  assert.match(source, /normalizeSpecReviewResponseShape[\s\S]*normalizeReviewResponseArrays\(/);
});

test("R5: shared unit regression covers missing test-review findings arrays", () => {
  const source = fs.readFileSync(sharedReviewTestPath, "utf8");
  assert.match(source, /missing top-level test review findings arrays/);
  assert.match(source, /parseTestReviewFindings\(JSON\.stringify\(\{\}\)\)/);
});
