import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(__dirname, "../../../src");

describe("spec-235: flow test management removal", () => {

  describe("R1/R2: deleted modules", () => {
    const deletedFiles = [
      "flow/lib/run-tests.js",
      "flow/lib/summarize-test-log.js",
      "flow/lib/set-test-summary.js",
    ];
    for (const file of deletedFiles) {
      it(`${file} does not exist`, () => {
        assert.ok(!fs.existsSync(path.join(srcRoot, file)), `${file} should be deleted`);
      });
    }
  });

  describe("R3/R4: TASK_STEPS_PLAN and TASK_PHASE_MAP", () => {
    it("TASK_STEPS_PLAN is [impl, review, gate-impl]", async () => {
      const { TASK_STEPS_PLAN } = await import(path.join(srcRoot, "lib/flow-helpers.js"));
      assert.deepStrictEqual(TASK_STEPS_PLAN, ["impl", "review", "gate-impl"]);
    });

    it("TASK_PHASE_MAP does not contain write-tests or run-tests", async () => {
      const { TASK_PHASE_MAP } = await import(path.join(srcRoot, "lib/flow-helpers.js"));
      assert.ok(!("write-tests" in TASK_PHASE_MAP), "write-tests should not be in TASK_PHASE_MAP");
      assert.ok(!("run-tests" in TASK_PHASE_MAP), "run-tests should not be in TASK_PHASE_MAP");
    });

    it("buildInitialTaskSteps returns 3 steps", async () => {
      const { buildInitialTaskSteps } = await import(path.join(srcRoot, "lib/flow-helpers.js"));
      const steps = buildInitialTaskSteps("plan");
      assert.strictEqual(steps.length, 3);
      assert.deepStrictEqual(steps.map(s => s.id), ["impl", "review", "gate-impl"]);
    });
  });

  describe("R5: gate-impl test evidence functions removed", () => {
    it("run-gate.js does not export test evidence functions", async () => {
      const runGate = await import(path.join(srcRoot, "flow/lib/run-gate.js"));
      const removedExports = [
        "checkMissingHeadTestEvidence",
        "checkTestChanges",
        "checkExpectedTests",
        "parseAuthorizedTestModificationsFromJson",
        "parseAuthorizedTestModifications",
      ];
      for (const name of removedExports) {
        assert.ok(!(name in runGate), `${name} should not be exported from run-gate.js`);
      }
    });
  });

  describe("R6: buildImplCheckPrompt has no testEvidence param", () => {
    it("buildImplCheckPrompt does not accept testEvidence", async () => {
      const { buildImplCheckPrompt } = await import(path.join(srcRoot, "flow/lib/run-gate.js"));
      assert.ok(typeof buildImplCheckPrompt === "function", "buildImplCheckPrompt should be exported");
      assert.ok(buildImplCheckPrompt.length <= 3, "buildImplCheckPrompt should have at most 3 params (no testEvidence)");
    });
  });

  describe("R7: context-rules.json entries removed", () => {
    it("context-rules.json does not contain write-tests or run-tests step entries", () => {
      const rulesPath = path.join(srcRoot, "flow/schemas/context-rules.json");
      const rules = JSON.parse(fs.readFileSync(rulesPath, "utf-8"));
      const allStepKeys = [];
      for (const phase of Object.values(rules)) {
        if (typeof phase === "object" && phase !== null) {
          allStepKeys.push(...Object.keys(phase));
        }
      }
      const removed = ["write-tests", "run-tests", "integration-write-tests", "integration-run-tests"];
      for (const key of removed) {
        assert.ok(!allStepKeys.includes(key), `${key} should not be in context-rules.json`);
      }
    });
  });

  describe("R8/R11: deleted prompt and schema files", () => {
    const deletedFiles = [
      "flow/prompts/task/write-tests.md",
      "flow/prompts/task/run-tests.md",
      "flow/schemas/next-action/test.schema.json",
      "flow/schemas/next-action/run-tests.schema.json",
    ];
    for (const file of deletedFiles) {
      it(`${file} does not exist`, () => {
        assert.ok(!fs.existsSync(path.join(srcRoot, file)), `${file} should be deleted`);
      });
    }
  });

  describe("R10: spec.schema.json fields removed", () => {
    it("spec.schema.json has no authorized_test_modifications", () => {
      const schema = JSON.parse(fs.readFileSync(path.join(srcRoot, "flow/schemas/spec.schema.json"), "utf-8"));
      assert.ok(!("authorized_test_modifications" in schema.properties), "authorized_test_modifications should be removed");
    });

    it("spec.schema.json tasks has no expected_tests", () => {
      const schema = JSON.parse(fs.readFileSync(path.join(srcRoot, "flow/schemas/spec.schema.json"), "utf-8"));
      const taskProps = schema.properties.tasks?.items?.properties || {};
      assert.ok(!("expected_tests" in taskProps), "expected_tests should be removed from tasks");
    });
  });

  describe("R1: registry entries removed", () => {
    it("registry run does not have tests entry", async () => {
      const { FLOW_COMMANDS } = await import(path.join(srcRoot, "flow/registry.js"));
      assert.ok(!("tests" in (FLOW_COMMANDS.run || {})), "run.tests should not be in registry");
    });

    it("registry set does not have test-summary entry", async () => {
      const { FLOW_COMMANDS } = await import(path.join(srcRoot, "flow/registry.js"));
      assert.ok(!("test-summary" in (FLOW_COMMANDS.set || {})), "set.test-summary should not be in registry");
    });
  });
});
