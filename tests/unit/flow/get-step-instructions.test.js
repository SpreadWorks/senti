/**
 * tests/unit/flow/get-step-instructions.test.js
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

      const taskContent = getStepInstructions("task.impl");
      assert.ok(taskContent.length > 0, "task-scope key resolves");
    });

    it("returns the actual file content (not just a placeholder)", () => {
      const content = getStepInstructions("plan.draft");
      const filePath = path.join(PROMPTS_DIR, "plan", "draft.md");
      const raw = fs.readFileSync(filePath, "utf8");
      assert.equal(content, raw, "loader returns exact file content");
    });

    it("spec-repair records apply/drop decisions and evidence for every blocking finding", () => {
      const content = getStepInstructions("plan.spec-repair");

      assert.match(content, /Always write `specs\/<spec-id>\/spec-repair\.json`/);
      assert.match(content, /audit log for the AI's apply\/drop decisions/);
      assert.match(content, /For every `blockingFindings\[\]` entry/);
      assert.match(content, /Keep repair strictly limited to resolving `blockingFindings\[\]`/);
      assert.match(content, /smallest direct correction required by that finding's `requiredChange`/);
      assert.match(content, /broader redesign, new product scope, or a decision/);
      assert.match(content, /`decision`: one of `applied`, `invalid`, `already_resolved`, or `downgraded_to_non_blocking`/);
      assert.match(content, /`evidence`: concrete evidence for the decision/);
      assert.match(content, /`changedFields`/);
      assert.match(content, /Do not defer review findings to gate/);
      assert.match(content, /must be small, auditable, and limited to the reviewed findings/);
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
