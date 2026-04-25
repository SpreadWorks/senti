import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");

describe("spec 230: guardrail false positive fixes", () => {
  describe("REQ-1: draft-scope-boundary body relaxation", () => {
    it("body permits file path and function name mentions", () => {
      const guardrails = JSON.parse(
        fs.readFileSync(path.join(ROOT, "src/presets/base/guardrail.json"), "utf8"),
      );
      const g = guardrails.guardrails.find((g) => g.id === "draft-scope-boundary");
      assert.ok(g, "draft-scope-boundary guardrail exists");
      assert.ok(
        /file\s*path|function\s*name/i.test(g.body),
        "body mentions file paths or function names as permitted",
      );
      assert.ok(
        /algorithm|internal\s*design/i.test(g.body),
        "body prohibits algorithm or internal design detail",
      );
    });
  });

  describe("REQ-2: complete-context body relaxation", () => {
    it("body does not mandate when/if/shall syntax", () => {
      const guardrails = JSON.parse(
        fs.readFileSync(path.join(ROOT, "src/presets/base/guardrail.json"), "utf8"),
      );
      const g = guardrails.guardrails.find((g) => g.id === "complete-context");
      assert.ok(g, "complete-context guardrail exists");
      assert.ok(
        !/shall be.*when.*if/i.test(g.body) || /syntax|form/i.test(g.body),
        "body does not mandate specific syntax patterns or explicitly states form is not required",
      );
    });
  });

  describe("REQ-4: prioritize-requirements wording", () => {
    it("body uses 'more than three' instead of 'exceed three'", () => {
      const guardrails = JSON.parse(
        fs.readFileSync(path.join(ROOT, "src/presets/base/guardrail.json"), "utf8"),
      );
      const g = guardrails.guardrails.find((g) => g.id === "prioritize-requirements");
      assert.ok(g, "prioritize-requirements guardrail exists");
      assert.ok(
        /more than three/i.test(g.body),
        `body should say 'more than three', got: ${g.body}`,
      );
      assert.ok(
        !/exceed three/i.test(g.body),
        "body should not say 'exceed three'",
      );
    });
  });

  describe("REQ-5: exit-code-contract phase restriction", () => {
    it("meta.phase contains only task-impl", () => {
      const guardrails = JSON.parse(
        fs.readFileSync(path.join(ROOT, "src/presets/cli/guardrail.json"), "utf8"),
      );
      const g = guardrails.guardrails.find((g) => g.id === "exit-code-contract");
      assert.ok(g, "exit-code-contract guardrail exists");
      assert.deepStrictEqual(
        g.meta.phase,
        ["task-impl"],
        `phase should be ['task-impl'], got: ${JSON.stringify(g.meta.phase)}`,
      );
    });
  });

  describe("REQ-3: T-pending-spec filtering", () => {
    it("filterPendingSpecPlaceholder removes T-pending-spec from target text", async () => {
      const { filterPendingSpecPlaceholder } = await import(
        "../../../src/flow/lib/run-gate.js"
      );
      const specJson = {
        goal: "test",
        tasks: [
          { id: "T-pending-spec", title: "Pending spec definition" },
          { id: "T-1", title: "Real task" },
        ],
      };
      const text = JSON.stringify(specJson, null, 2);
      const filtered = filterPendingSpecPlaceholder(text);
      assert.ok(!filtered.includes("T-pending-spec"), "T-pending-spec should be removed");
      assert.ok(filtered.includes("T-1"), "Real tasks should be preserved");
    });

    it("filterPendingSpecPlaceholder is a no-op when no placeholder exists", async () => {
      const { filterPendingSpecPlaceholder } = await import(
        "../../../src/flow/lib/run-gate.js"
      );
      const specJson = {
        goal: "test",
        tasks: [{ id: "T-1", title: "Real task" }],
      };
      const text = JSON.stringify(specJson, null, 2);
      const filtered = filterPendingSpecPlaceholder(text);
      assert.ok(filtered.includes("T-1"), "Real tasks should be preserved");
    });
  });
});
