/**
 * tests/integration/flow/get-step-instructions.test.js
 *
 * Contract tests for getStepInstructions(instructionsKey) loader (spec 203 / cac6/T6).
 *
 * The loader resolves a registered instructions_key (from
 * src/flow/schemas/context-rules.json) to the markdown content stored at
 * src/flow/prompts/<phase>/<step>.md.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { getStepInstructions } from "../../../src/flow/lib/get-step-instructions.js";

const PKG_DIR = path.resolve(fileURLToPath(import.meta.url), "../../../../src");
const PROMPTS_DIR = path.join(PKG_DIR, "flow", "prompts");
const INCLUDE_DIRECTIVE_PATTERN = /<!--\s*include\("[^"]+"\)\s*-->/;

describe("getStepInstructions (loader contract)", () => {
  describe("happy path", () => {
    it("returns non-empty string content for a known key", () => {
      // plan.draft is a registered instructions_key in context-rules.json.
      const content = getStepInstructions("plan.draft");
      assert.equal(typeof content, "string");
      assert.ok(content.length > 0, "content is non-empty");
    });

    it("returns content for keys in both flow and task scopes", () => {
      const flowContent = getStepInstructions("plan.spec");
      assert.ok(flowContent.length > 0, "flow-scope key resolves");

      const taskContent = getStepInstructions("task.task-impl");
      assert.ok(taskContent.length > 0, "task-scope key resolves");
    });

    it("returns expanded prompt content (not just a placeholder)", () => {
      const expandedPrompt = getStepInstructions("plan.draft");
      const filePath = path.join(PROMPTS_DIR, "plan", "draft.md");
      const rawPrompt = fs.readFileSync(filePath, "utf8");
      assert.match(rawPrompt, INCLUDE_DIRECTIVE_PATTERN);
      assert.match(expandedPrompt, /## Draft QA Rules/);
      assert.doesNotMatch(expandedPrompt, INCLUDE_DIRECTIVE_PATTERN);
    });

    it("keeps dispatcher-owned plan workers on immutable handoff inputs and parent completion", () => {
      const keys = [
        "plan.draft",
        "plan.draft-questions-triage",
        "plan.draft-questions-repair",
        "plan.draft-refine",
        "plan.draft-coverage-triage",
        "plan.draft-coverage-repair",
        "plan.spec",
        "plan.spec-triage",
        "plan.spec-repair",
        "plan.test",
      ];
      for (const key of keys) {
        const content = getStepInstructions(key);
        assert.match(content, /worker artifact handoff contract as the complete authority/, key);
        assert.match(content, /exact `payloads\[\]\.payloadPath`/, key);
        assert.match(content, /exact (?:handoff )?`sealCommand` once/, key);
        assert.doesNotMatch(content, /sennel flow set step .* done/, key);
      }
    });

    it("spec-triage records apply/drop decisions and evidence for every blocking finding", () => {
      const content = getStepInstructions("plan.spec-triage");

      assert.match(content, /handoff `inputs\[\]\.document` snapshots/);
      assert.match(content, /Write `spec-triage\.json` only to its exact handoff `payloadPath`/);
      assert.doesNotMatch(content, /specs\/<spec-id>/);
      assert.doesNotMatch(content, /active Flow's configured spec directory/);
      assert.doesNotMatch(content, /sennel flow set step spec-triage done/);
      assert.match(content, /run the exact handoff `sealCommand` once/);
      assert.match(content, /Do not edit `spec\.json`/);
      assert.match(content, /For every `blockingFindings\[\]` entry/);
      assert.match(content, /`decision`: one of `apply`, `invalid`, `already_resolved`, or `downgraded_to_non_blocking`/);
      assert.match(content, /Use `apply` only when the finding is still blocking/);
      assert.match(content, /Do not defer review findings to gate/);
      assert.match(content, /"phase": "spec-triage"/);
    });

    it("spec-repair applies only triaged apply items", () => {
      const content = getStepInstructions("plan.spec-repair");

      assert.match(content, /handoff `inputs\[\]\.document` snapshots/);
      assert.match(content, /Write `spec-repair\.json` and the complete resulting `spec\.json` only to their exact handoff `payloadPath` values/);
      assert.doesNotMatch(content, /specs\/<spec-id>/);
      assert.doesNotMatch(content, /active Flow's configured spec directory/);
      assert.doesNotMatch(content, /sennel flow set step spec-repair done/);
      assert.match(content, /run the exact handoff `sealCommand` once/);
      assert.match(content, /Treat only triage `items\[\]` entries with `decision: "apply"` as the repair input/);
      assert.match(content, /Do not re-triage review findings in this step/);
      assert.match(content, /For every triage item with `decision: "apply"`/);
      assert.match(content, /`decision`: `applied`/);
      assert.match(content, /`changedFields`/);
      assert.match(content, /must be small, auditable, and limited to triage `apply` items/);
    });

    it("spec gate instructions keep gate fixes separate from design review", () => {
      const content = getStepInstructions("plan.spec-gate");

      assert.match(content, /readiness gate, not a design review/);
      assert.match(content, /Fix only schema\/static issues, spec-triage \/ spec-repair audit issues, and explicit guardrail article violations/);
      assert.match(content, /Do not use gate FAIL as a reason to search for new design gaps/);
      assert.match(content, /Codebase-context design gaps belong to `spec-review` \/ `spec-triage` \/ `spec-repair`/);
    });

    it("requires typed finding disposition policy in flow and task implementation review", () => {
      for (const key of ["impl.impl-review", "task.task-review"]) {
        const content = getStepInstructions(key);

        assert.match(content, /typed disposition/i, key);
        assert.match(content, /rationale/i, key);
        assert.match(content, /must[- ]fix/i, key);
        assert.match(content, /requirement.*guardrail|guardrail.*requirement/i, key);
        assert.match(content, /fingerprint/i, key);
        assert.match(content, /findingKey/, key);
        assert.match(content, /informational.*deferred|deferred.*informational/i, key);
        assert.doesNotMatch(
          content,
          /project-rule violations, naming proposals, refactor proposals, DRY proposals[^\n]+non-blocking or out of scope/i,
          key,
        );
      }
    });

    it("flow skill source documents runtime log options instead of env prefixes", () => {
      const content = fs.readFileSync(path.join(PKG_DIR, "skills", "sennel.flow", "SKILL.md"), "utf8");
      const removedLogOption = `--log-${"file"}`;
      assert.match(content, /--agent-work-dir/);
      assert.match(content, /flow get runtime-log/);
      assert.ok(!content.includes(removedLogOption));
      assert.doesNotMatch(content, /SENNEL_WORK_DIR/);
      assert.doesNotMatch(content, />\s*\S+\s+2>&1/);
    });
  });

  describe("error path: unknown key", () => {
    it("throws Error when key has no <phase>.<step> shape", () => {
      assert.throws(
        () => getStepInstructions("not-a-valid-key"),
        (err) => err instanceof Error && /not-a-valid-key/.test(err.message),
      );
    });

    it("throws Error when phase exists but step file missing", () => {
      // plan.__nonexistent__ — well-formed key but no file.
      assert.throws(
        () => getStepInstructions("plan.__nonexistent__"),
        (err) => err instanceof Error && /__nonexistent__/.test(err.message),
      );
    });

    it("throws Error when phase directory does not exist", () => {
      assert.throws(
        () => getStepInstructions("__no_such_phase__.draft"),
        (err) => err instanceof Error && /__no_such_phase__/.test(err.message),
      );
    });

    it("error message identifies the offending key", () => {
      try {
        getStepInstructions("plan.__missing__");
        assert.fail("should have thrown");
      } catch (err) {
        assert.ok(/plan.__missing__|plan\/__missing__/.test(err.message),
          `error message should reference the offending key/path: ${err.message}`);
      }
    });
  });

  describe("input validation", () => {
    it("throws when called with empty string", () => {
      assert.throws(() => getStepInstructions(""));
    });

    it("throws when called with non-string", () => {
      assert.throws(() => getStepInstructions(null));
      assert.throws(() => getStepInstructions(undefined));
      assert.throws(() => getStepInstructions(42));
    });
  });
});
