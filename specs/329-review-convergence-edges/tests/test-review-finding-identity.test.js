// spec: R1 R2
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";

import { parseTestReviewFindings } from "../../../src/flow/commands/review.js";
import {
  ReviewDisposition,
  ReviewFinding,
} from "../../../src/flow/lib/review-convergence.js";

function blockingFinding(overrides = {}) {
  return {
    title: "Missing changed-tree coverage",
    target: "R3",
    issue: "Changed-tree recovery does not reset the tooling attempt.",
    requiredChange: "Reset the tooling attempt in the recovery mutation.",
    whyBlocking: "The exhausted review cannot be revalidated.",
    ...overrides,
  };
}

function parse(items) {
  return parseTestReviewFindings(JSON.stringify({
    blockingFindings: items,
    advisoryFindings: [],
  })).blocking;
}

function parseAdvisory(items) {
  return parseTestReviewFindings(JSON.stringify({
    blockingFindings: [],
    advisoryFindings: items,
  })).advisory;
}

function canonicalFinding(item, index) {
  return new ReviewFinding({
    findingId: item.findingId,
    summary: item.title,
    fingerprint: item.fingerprint,
    evidenceRefs: [`test-review.json#blocking-${index + 1}`],
  });
}

test("R1: same-target findings retain title and issue in distinct canonical identities", () => {
  const [first, second] = parse([
    blockingFinding(),
    blockingFinding({
      title: "Recovery grant is not atomic",
      issue: "The grant and tooling attempt reset are persisted separately.",
    }),
  ]);

  assert.notEqual(first.findingId, second.findingId);
  assert.match(first.findingId, /^[a-f0-9]{64}$/);
  assert.match(second.findingId, /^[a-f0-9]{64}$/);
});

test("R1: target kind failure mode and advisory improvement participate in the canonical tuple", () => {
  const [baseline] = parse([blockingFinding()]);
  const [changedTarget] = parse([blockingFinding({ target: "R4" })]);
  const [changedFailureMode] = parse([blockingFinding({ failureKind: "schema_failure" })]);
  const [firstAdvisory, secondAdvisory] = parseAdvisory([
    {
      title: "Clarify recovery evidence",
      target: "R3",
      improvement: "Assert the recovery grant identifier.",
      whyNonBlocking: "The primary recovery behavior is already covered.",
    },
    {
      title: "Clarify recovery evidence",
      target: "R3",
      improvement: "Assert the recovery grant timestamp.",
      whyNonBlocking: "The primary recovery behavior is already covered.",
    },
  ]);

  assert.notEqual(baseline.findingId, changedTarget.findingId);
  assert.notEqual(baseline.findingId, changedFailureMode.findingId);
  assert.notEqual(firstAdvisory.findingId, secondAdvisory.findingId);

  const expected = crypto
    .createHash("sha256")
    .update(JSON.stringify([
      "R3",
      "blocking",
      "Missing changed-tree coverage",
      "Changed-tree recovery does not reset the tooling attempt.",
    ]))
    .digest("hex");
  assert.equal(baseline.findingId, expected);
});

test("R1: equivalent path target representations normalize to one identity", () => {
  const [posixTarget] = parse([blockingFinding({
    target: "src/flow/lib/set-retry.js",
  })]);
  const [windowsTarget] = parse([blockingFinding({
    target: "src\\flow\\lib\\set-retry.js",
  })]);

  assert.equal(posixTarget.findingId, windowsTarget.findingId);
});

test("R2: reparsing and reordering preserve identity while exact duplicates are rejected", () => {
  const inputs = [
    blockingFinding(),
    blockingFinding({
      title: "Recovery grant is not atomic",
      issue: "The grant and tooling attempt reset are persisted separately.",
    }),
  ];
  const firstParse = parse(inputs);
  const secondParse = parse(inputs);
  const reordered = parse([...inputs].reverse());

  assert.deepEqual(
    firstParse.map(({ title, findingId }) => [title, findingId]),
    secondParse.map(({ title, findingId }) => [title, findingId]),
  );
  assert.deepEqual(
    new Map(reordered.map(({ title, findingId }) => [title, findingId])),
    new Map(firstParse.map(({ title, findingId }) => [title, findingId])),
  );

  const duplicates = parse([inputs[0], inputs[0]]);
  assert.equal(duplicates[0].findingId, duplicates[1].findingId);
  assert.throws(
    () => new ReviewDisposition({
      value: "REJECTED",
      blockingFindings: duplicates.map(canonicalFinding),
    }),
    /duplicate/i,
  );
});
