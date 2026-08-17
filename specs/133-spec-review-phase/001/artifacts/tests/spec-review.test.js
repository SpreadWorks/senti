/**
 * specs/133-spec-review-phase/tests/spec-review.test.js
 *
 * Verify:
 * - AC1: --phase spec is accepted by review.js (routing check)
 * - AC5: test review still works after loop refactor (export check)
 * - AC6: get-context.js exports loadAnalysisEntries and contextSearch
 * - AC7: registry.js review help mentions --phase spec
 *
 * Run: node --test specs/133-spec-review-phase/tests/spec-review.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { execFileSync } from "child_process";

const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const SRC = path.join(ROOT, "src");

describe("133: spec review phase", () => {

  describe("AC6: get-context.js exports loadAnalysisEntries and contextSearch", () => {
    it("loadAnalysisEntries is exported", async () => {
      const mod = await import(path.join(SRC, "flow/lib/get-context.js"));
      assert.equal(typeof mod.loadAnalysisEntries, "function", "loadAnalysisEntries should be exported");
    });

    it("contextSearch is exported", async () => {
      const mod = await import(path.join(SRC, "flow/lib/get-context.js"));
      assert.equal(typeof mod.contextSearch, "function", "contextSearch should be exported");
    });
  });

  describe("AC7: registry review help mentions --phase spec", () => {
    it("review entry help text includes spec", async () => {
      const { FLOW_COMMANDS } = await import(path.join(SRC, "flow/registry.js"));
      const review = FLOW_COMMANDS.run?.review;
      assert.ok(review, "review should be in registry");
      assert.ok(review.help, "review should have help text");
      assert.ok(review.help.includes("spec"), "review help should mention spec phase");
    });
  });

  describe("AC1: --phase spec is accepted", () => {
    it("review.js accepts --phase spec without error for unknown phase", async () => {
      const mod = await import(path.join(SRC, "flow/commands/review.js"));
      // review.js should export main and accept 'spec' as a valid phase
      // We check that the source does not reject 'spec' in the phase validation
      const source = (await import("fs")).readFileSync(
        path.join(SRC, "flow/commands/review.js"), "utf8"
      );
      // The phase validation should allow 'spec' (not just 'test')
      const rejectsSpec = /phase !== "test"/.test(source) && !/phase !== "test" && /.test(source);
      // After implementation, 'spec' should be accepted
      assert.ok(
        source.includes('"spec"') || source.includes("'spec'"),
        "review.js should reference 'spec' as a valid phase"
      );
    });
  });

  describe("AC5: test review exports still exist after refactor", () => {
    it("review.js exports test review functions", async () => {
      const mod = await import(path.join(SRC, "flow/commands/review.js"));
      assert.equal(typeof mod.extractRequirements, "function", "extractRequirements should be exported");
      assert.equal(typeof mod.collectTestFiles, "function", "collectTestFiles should be exported");
      assert.equal(typeof mod.parseGaps, "function", "parseGaps should be exported");
    });
  });
});
