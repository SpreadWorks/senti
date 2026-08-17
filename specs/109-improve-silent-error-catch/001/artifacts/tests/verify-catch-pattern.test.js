/**
 * Verify that the 8 catch sites no longer use `catch (_) {}`.
 * Instead they should use `catch (err) { if (err.code !== "ENOENT") console.error(err); }`.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "../../..");

const TARGETS = [
  { file: "src/setup.js", minLine: 220, maxLine: 235 },
  { file: "src/flow/run/impl-confirm.js", minLine: 100, maxLine: 115 },
  { file: "src/lib/agent.js", minLine: 360, maxLine: 380 },
  { file: "src/lib/flow-state.js", minLine: 145, maxLine: 160 },
  { file: "src/lib/flow-state.js", minLine: 218, maxLine: 235 },
  { file: "src/lib/skills.js", minLine: 20, maxLine: 35 },
  { file: "src/lib/skills.js", minLine: 70, maxLine: 85 },
  { file: "src/docs/commands/changelog.js", minLine: 128, maxLine: 145 },
];

describe("catch pattern improvement", () => {
  for (const target of TARGETS) {
    it(`${target.file}:${target.minLine}-${target.maxLine} uses ENOENT check instead of silent catch`, () => {
      const filePath = path.join(ROOT, target.file);
      const content = fs.readFileSync(filePath, "utf8");
      const lines = content.split("\n");
      const region = lines.slice(target.minLine - 1, target.maxLine).join("\n");

      // Should NOT contain `catch (_) {}`
      assert.ok(
        !(/catch\s*\(_\)\s*\{\s*\}/.test(region)),
        `${target.file}:${target.minLine}-${target.maxLine} still has catch (_) {}`
      );

      // Should contain ENOENT check pattern
      assert.ok(
        region.includes("ENOENT") || region.includes("console.error"),
        `${target.file}:${target.minLine}-${target.maxLine} missing ENOENT check or console.error`
      );
    });
  }
});
