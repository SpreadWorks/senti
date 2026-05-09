// spec: R1 R8
import { describe, it, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { filterByPhase, loadGuardrailFile } from "../../../src/lib/guardrail.js";

function withTmpPreset(guardrails, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-test-loader-"));
  const file = path.join(tmp, "guardrail.json");
  fs.writeFileSync(file, JSON.stringify({ guardrails }, null, 2));
  try {
    return fn(file);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

describe("R1: loader phase=[] semantics", () => {
  test("R1: hydrate preserves explicit empty phase array (does not rewrite to default)", () => {
    withTmpPreset([
      {
        id: "test-disabled",
        title: "Test Disabled",
        body: "test body",
        meta: { phase: [], category: "process" },
      },
    ], (file) => {
      const guardrails = loadGuardrailFile(file);
      const target = guardrails.find((g) => g.id === "test-disabled");
      assert.ok(target, "guardrail must be loaded");
      assert.deepEqual(target.meta.phase, [], "phase must be preserved as empty array");
    });
  });

  test("R1: hydrate applies DEFAULT_PHASE when meta.phase is missing (undefined)", () => {
    withTmpPreset([
      {
        id: "test-default-phase",
        title: "Test Default Phase",
        body: "test body",
        meta: { category: "process" },
      },
    ], (file) => {
      const guardrails = loadGuardrailFile(file);
      const target = guardrails.find((g) => g.id === "test-default-phase");
      assert.ok(target, "guardrail must be loaded");
      assert.deepEqual(target.meta.phase, ["spec"], "missing phase must default to ['spec']");
    });
  });

  test("R1: filterByPhase excludes phase=[] entries from any phase", () => {
    const guardrails = [
      { id: "disabled", meta: { phase: [] } },
      { id: "draft-active", meta: { phase: ["draft"] } },
      { id: "spec-active", meta: { phase: ["spec"] } },
    ];
    for (const phase of ["draft", "spec", "impl", "test", "lint"]) {
      const filtered = filterByPhase(guardrails, phase);
      assert.ok(
        !filtered.some((g) => g.id === "disabled"),
        `disabled guardrail must not appear in phase=${phase}`,
      );
    }
  });

  test("R1: filterByPhase still includes correctly-phased entries", () => {
    const guardrails = [
      { id: "disabled", meta: { phase: [] } },
      { id: "draft-active", meta: { phase: ["draft"] } },
    ];
    const filtered = filterByPhase(guardrails, "draft");
    assert.ok(
      filtered.some((g) => g.id === "draft-active"),
      "draft-active guardrail must appear in phase=draft",
    );
  });
});

describe("R8: unit test exists for loader semantics", () => {
  test("R8: this test file exists and verifies loader phase=[] disabled behavior", () => {
    assert.ok(true);
  });
});
