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

const GUARDRAIL_ID = "migration-parity";

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

function body() {
  return byId.get(GUARDRAIL_ID).body;
}

describe(`${GUARDRAIL_ID} guardrail`, () => {
  it("is present exactly once in base/guardrail.json", () => {
    assert.equal(
      entries.filter((g) => g.id === GUARDRAIL_ID).length,
      1,
      `expected exactly one guardrail id "${GUARDRAIL_ID}"`,
    );
  });

  it("declares title, phase, and category", () => {
    const g = byId.get(GUARDRAIL_ID);
    assert.ok(g);
    assert.equal(g.title, "Migration Parity");
    assert.deepEqual(g.meta?.phase, ["draft", "spec"]);
    assert.equal(g.meta?.category, "process");
  });

  it("states the migration parity trigger and required evidence", () => {
    const lower = body().toLowerCase();
    for (const term of ["moves", "splits", "extracts", "replaces", "externalizes"]) {
      assert.ok(lower.includes(term), `body should include trigger term "${term}"`);
    }
    for (const term of [
      "inventory",
      "public behavior",
      "user-facing commands",
      "apis",
      "hooks",
      "config entries",
      "generated artifacts",
      "side effects",
      "new owner",
      "explicit decision to remove",
      "acceptance criteria",
      "behavior-level verification",
      "retained public surface",
      "user-visible impact",
      "compatibility expectation",
    ]) {
      assert.ok(lower.includes(term), `body should include parity concept "${term}"`);
    }
  });

  it("states evidence limits and rewrite-rubric sections", () => {
    const text = body();
    const lower = text.toLowerCase();
    for (const term of ["registration", "discovery", "help output", "mock routing", "not sufficient"]) {
      assert.ok(lower.includes(term), `body should mention "${term}"`);
    }
    for (const label of ["Violation:", "Diff-verification conditions:", "Blocking when:", "Advisory when:"]) {
      assert.ok(text.includes(label), `body should include "${label}"`);
    }
  });

  it("does not contain project-specific wording", () => {
    const lower = body().toLowerCase();
    for (const forbidden of ["workflow plugin", "board item", "issue #379", "b443"]) {
      assert.ok(!lower.includes(forbidden), `body must not contain "${forbidden}"`);
    }
  });
});

describe(`${GUARDRAIL_ID} phase filter`, () => {
  it("is included in draft and spec phases", () => {
    assert.ok(hasGuardrailInPhase("draft", GUARDRAIL_ID));
    assert.ok(hasGuardrailInPhase("spec", GUARDRAIL_ID));
  });

  it("is excluded from task-impl phase", () => {
    assert.ok(!hasGuardrailInPhase("task-impl", GUARDRAIL_ID));
  });
});

describe("base guardrail regression for migration-parity addition", () => {
  const PRE_EXISTING_IDS = [
    "single-responsibility",
    "req-diff-verifiability",
    "impact-on-existing-features",
    "spec-test-coverage",
  ];

  for (const id of PRE_EXISTING_IDS) {
    it(`preserves pre-existing guardrail "${id}"`, () => {
      assert.ok(byId.has(id), `pre-existing guardrail "${id}" must remain`);
    });
  }
});
