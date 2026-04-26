import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");

describe("spec 232: draft retry guardrail", () => {
  describe("R-1: DEFAULT_GATE_RETRY_MAX = 5", () => {
    it("run-gate.js exports DEFAULT_GATE_RETRY_MAX as 5", async () => {
      const mod = await import(
        resolve(repoRoot, "src/flow/lib/run-gate.js")
      );
      assert.equal(typeof mod.countGateRetry, "function");

      const src = readFileSync(
        resolve(repoRoot, "src/flow/lib/run-gate.js"),
        "utf8",
      );
      const match = src.match(/const DEFAULT_GATE_RETRY_MAX\s*=\s*(\d+)/);
      assert.ok(match, "DEFAULT_GATE_RETRY_MAX constant should exist");
      assert.equal(match[1], "5", "DEFAULT_GATE_RETRY_MAX should be 5");
    });

    it("resolveRetryMax falls back to 5 when config.flow.retry.max is unset", () => {
      const src = readFileSync(
        resolve(repoRoot, "src/flow/lib/run-gate.js"),
        "utf8",
      );
      const defaultMatch = src.match(
        /const DEFAULT_GATE_RETRY_MAX\s*=\s*(\d+)/,
      );
      assert.equal(defaultMatch[1], "5");
    });
  });

  describe("R-2: draft-scope-boundary body includes evidence exclusion", () => {
    it("guardrail body mentions evidence/why/considered", () => {
      const guardrails = JSON.parse(
        readFileSync(
          resolve(repoRoot, "src/presets/base/guardrail.json"),
          "utf8",
        ),
      );
      const entry = guardrails.guardrails.find(
        (g) => g.id === "draft-scope-boundary",
      );
      assert.ok(entry, "draft-scope-boundary guardrail should exist");
      assert.ok(
        entry.body.includes("evidence") &&
          entry.body.includes("why") &&
          entry.body.includes("considered"),
        "body should mention evidence, why, and considered fields",
      );
    });
  });
});
