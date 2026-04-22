import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { filterByPhase } from "../../../../src/lib/guardrail.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_GUARDRAIL_PATH = path.resolve(
  __dirname,
  "../../../../src/presets/base/guardrail.json",
);

const GUARDRAIL_ID = "req-diff-verifiability";

const data = JSON.parse(fs.readFileSync(BASE_GUARDRAIL_PATH, "utf8"));
assert.ok(
  Array.isArray(data.guardrails),
  `base/guardrail.json fixture must have guardrails array, got ${typeof data.guardrails}`,
);
const entries = data.guardrails;
const byId = new Map(entries.map((g) => [g.id, g]));

function hasGuardrailInPhase(phase, id) {
  return filterByPhase(entries, phase).some((g) => g.id === id);
}

describe(`${GUARDRAIL_ID} guardrail (spec 212)`, () => {
  it("is present in base/guardrail.json", () => {
    assert.ok(
      byId.has(GUARDRAIL_ID),
      `expected guardrail id "${GUARDRAIL_ID}" in base guardrail.json`,
    );
  });

  it("declares phase=['spec'] only (R1, R2)", () => {
    const g = byId.get(GUARDRAIL_ID);
    assert.ok(g);
    assert.deepEqual(g.meta?.phase, ["spec"]);
  });

  it("declares category='process' (decision in spec 212)", () => {
    const g = byId.get(GUARDRAIL_ID);
    assert.equal(g.meta?.category, "process");
  });

  it("has non-empty title and body strings (R3)", () => {
    const g = byId.get(GUARDRAIL_ID);
    assert.equal(typeof g.title, "string");
    assert.ok(g.title.trim().length > 0);
    assert.equal(typeof g.body, "string");
    assert.ok(g.body.trim().length > 0);
  });

  it("body references diff and test evidence verifiability", () => {
    const g = byId.get(GUARDRAIL_ID);
    const body = g.body.toLowerCase();
    assert.ok(body.includes("diff"), "body should reference 'diff'");
    assert.ok(
      body.includes("test execution") ||
        body.includes("test execution summary") ||
        body.includes("test summary"),
      "body should reference test execution evidence",
    );
  });
});

describe(`${GUARDRAIL_ID} phase filter (R2)`, () => {
  it("is excluded from draft phase filter", () => {
    assert.ok(
      !hasGuardrailInPhase("draft", GUARDRAIL_ID),
      `draft phase must not include ${GUARDRAIL_ID}`,
    );
  });

  it("is excluded from task-impl phase filter", () => {
    assert.ok(
      !hasGuardrailInPhase("task-impl", GUARDRAIL_ID),
      `task-impl phase must not include ${GUARDRAIL_ID}`,
    );
  });

  it("is included in spec phase filter (R1)", () => {
    assert.ok(
      hasGuardrailInPhase("spec", GUARDRAIL_ID),
      `spec phase must include ${GUARDRAIL_ID}`,
    );
  });
});

describe("base guardrail regression (R4)", () => {
  // Spot-check a sample of pre-existing guardrail ids to detect accidental
  // deletion/rename when adding the new entry. Does not enumerate every id —
  // new entries are allowed (R1 adds one).
  const PRE_EXISTING_IDS = [
    "single-responsibility",
    "unambiguous-requirements",
    "complete-context",
    "no-hardcoded-secrets",
    "prioritize-requirements",
    "impact-on-existing-features",
    "draft-scope-boundary",
    "spec-synthesize-not-copy",
    "spec-include-rationale",
  ];

  for (const id of PRE_EXISTING_IDS) {
    it(`preserves pre-existing guardrail "${id}"`, () => {
      assert.ok(byId.has(id), `pre-existing guardrail "${id}" must remain`);
    });
  }
});
