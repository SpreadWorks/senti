// spec: R11
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { validateLintGuardrails } from "../../../src/lib/lint.js";

describe("R11: lint validation skips phase=[] guardrails", () => {
  test("R11: validateLintGuardrails does not warn for phase=[] guardrails with lint pattern", () => {
    const guardrails = [
      {
        id: "disabled-with-lint",
        title: "Disabled With Lint",
        meta: {
          phase: [],
          category: "code-quality",
          lint: /forbidden/,
        },
      },
    ];
    const warnings = validateLintGuardrails(guardrails);
    assert.deepEqual(
      warnings,
      [],
      "validateLintGuardrails must skip phase=[] guardrails (treat as disabled, not misconfigured)",
    );
  });

  test("R11: validateLintGuardrails still warns for misconfigured guardrails (lint pattern + non-empty phase without lint)", () => {
    const guardrails = [
      {
        id: "misconfigured",
        title: "Misconfigured",
        meta: {
          phase: ["spec"],
          category: "code-quality",
          lint: /forbidden/,
        },
      },
    ];
    const warnings = validateLintGuardrails(guardrails);
    assert.equal(
      warnings.length,
      1,
      "validateLintGuardrails must still warn for genuinely misconfigured guardrails",
    );
  });
});
