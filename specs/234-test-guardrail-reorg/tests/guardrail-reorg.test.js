import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GUARDRAIL_PATH = path.resolve(
  __dirname,
  "../../../src/presets/base/guardrail.json",
);

function loadGuardrails() {
  const content = fs.readFileSync(GUARDRAIL_PATH, "utf8");
  return JSON.parse(content).guardrails;
}

function findById(guardrails, id) {
  return guardrails.find((g) => g.id === id);
}

describe("spec 234: test guardrail reorganization", () => {
  const guardrails = loadGuardrails();

  describe("R1: deleted guardrail entries", () => {
    const deletedIds = [
      "impl-test-preservation",
      "changes-require-test-coverage",
      "test-covers-spec-requirements",
      "impl-flag-obsolete-tests",
    ];

    for (const id of deletedIds) {
      it(`${id} does not exist`, () => {
        assert.equal(findById(guardrails, id), undefined);
      });
    }
  });

  describe("R2: no-disabling-existing-tests enhanced", () => {
    const entry = findById(guardrails, "no-disabling-existing-tests");

    it("entry exists", () => {
      assert.ok(entry);
    });

    it("body mentions legitimate deletion when feature itself is removed", () => {
      assert.ok(
        entry.body.includes("feature") || entry.body.includes("機能"),
        "body should reference feature deletion justification",
      );
    });

    it("body contains MUST-level prohibition", () => {
      const lower = entry.body.toLowerCase();
      assert.ok(
        lower.includes("must") || lower.includes("prohibited"),
        "body should contain MUST-level language",
      );
    });
  });

  describe("R3: impl-test-conflict-escalation renamed", () => {
    it("old ID does not exist", () => {
      assert.equal(findById(guardrails, "impl-test-conflict-escalation"), undefined);
    });

    const entry = findById(guardrails, "pre-existing-test-failure-escalation");

    it("new ID exists", () => {
      assert.ok(entry);
    });

    it("phase is [task-impl]", () => {
      assert.deepEqual(entry.meta.phase, ["task-impl"]);
    });

    it("body references pre-existing test failures", () => {
      assert.ok(
        entry.body.includes("already failing") ||
          entry.body.includes("pre-existing") ||
          entry.body.includes("実装前"),
        "body should reference pre-existing test failures",
      );
    });
  });

  describe("R4: spec-test-coverage added", () => {
    const entry = findById(guardrails, "spec-test-coverage");

    it("entry exists", () => {
      assert.ok(entry);
    });

    it("phase is [spec, task-impl, test]", () => {
      assert.deepEqual(entry.meta.phase.sort(), ["spec", "task-impl", "test"]);
    });

    it("category is testing", () => {
      assert.equal(entry.meta.category, "testing");
    });

    it("body references specs/<specid>/tests/", () => {
      assert.ok(
        entry.body.includes("specs/") && entry.body.includes("tests/"),
        "body should reference spec test directory",
      );
    });
  });

  describe("R5: project-test-integrity added", () => {
    const entry = findById(guardrails, "project-test-integrity");

    it("entry exists", () => {
      assert.ok(entry);
    });

    it("phase is [task-impl]", () => {
      assert.deepEqual(entry.meta.phase, ["task-impl"]);
    });

    it("category is testing", () => {
      assert.equal(entry.meta.category, "testing");
    });
  });

  describe("R6: spec-includes-test-strategy unchanged", () => {
    const entry = findById(guardrails, "spec-includes-test-strategy");

    it("entry exists", () => {
      assert.ok(entry);
    });

    it("phase is [spec]", () => {
      assert.deepEqual(entry.meta.phase, ["spec"]);
    });

    it("category is testing", () => {
      assert.equal(entry.meta.category, "testing");
    });

    it("body matches original", () => {
      assert.equal(
        entry.body,
        "The spec shall include a test strategy (what to test and how).",
      );
    });
  });
});
