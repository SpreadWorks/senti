/**
 * specs/164-flow-metrics-recording/tests/backfill.test.js
 *
 * Spec verification test for the backfill script (P2).
 * Runs the backfill script against known fixtures and verifies output.
 *
 * Run: node specs/164-flow-metrics-recording/tests/backfill.test.js
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKFILL_SCRIPT = path.resolve(__dirname, "../../../.tmp/migrate-metrics.js");

function createTmpProject() {
  const tmp = mkdtempSync(path.join(tmpdir(), "sdd-backfill-"));
  return tmp;
}

function writeJson(dir, relPath, data) {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify(data, null, 2));
}

describe("backfill script (P2)", () => {
  let tmp;

  before(() => {
    tmp = createTmpProject();
  });

  after(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("writes token/cost metrics from prompt logs into flow.json (R2-1)", () => {
    if (!fs.existsSync(BACKFILL_SCRIPT)) {
      // Script not yet implemented — expected to fail at this stage
      assert.fail("backfill script not found: " + BACKFILL_SCRIPT);
    }

    // Setup fixture: prompt log file
    const promptLog = {
      requestId: "req-001",
      ts: "2026-01-01T00:00:00Z",
      context: {
        spec: "001-test",
        sddPhase: "draft",
      },
      agent: { model: "claude-sonnet-4-6" },
      response: { stats: { chars: 1500 } },
      usage: {
        input_tokens: 1000,
        output_tokens: 200,
        cache_read_tokens: 500,
        cache_creation_tokens: 100,
        cost_usd: 0.015,
      },
    };
    writeJson(tmp, ".tmp/logs/prompts/2026-01/req-001.json", promptLog);

    // Setup fixture: flow.json with no token metrics
    const flowState = {
      spec: "specs/001-test/spec.md",
      metrics: { draft: { question: 3 } },
    };
    writeJson(tmp, ".sdd-forge/flows/001-test/flow.json", flowState);

    // Run backfill
    execFileSync("node", [BACKFILL_SCRIPT], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp },
    });

    // Verify flow.json was updated
    const updated = JSON.parse(fs.readFileSync(path.join(tmp, ".sdd-forge/flows/001-test/flow.json"), "utf8"));
    assert.equal(updated.metrics.draft.question, 3, "existing counter should be unchanged (R2-2)");
    assert.equal(updated.metrics.draft.tokens?.input, 1000, "input tokens should be written");
    assert.equal(updated.metrics.draft.tokens?.output, 200, "output tokens should be written");
    assert.ok(Math.abs(updated.metrics.draft.cost - 0.015) < 0.0001, "cost should be written");
    assert.equal(updated.metrics.draft.callCount, 1, "callCount should be written");
    assert.equal(updated.metrics.draft.responseChars, 1500, "responseChars should be written");
  });

  it("skips log entries with null spec context (R2-5)", () => {
    if (!fs.existsSync(BACKFILL_SCRIPT)) {
      assert.fail("backfill script not found: " + BACKFILL_SCRIPT);
    }

    const tmp2 = createTmpProject();
    try {
      const promptLog = {
        requestId: "req-002",
        ts: "2026-01-01T00:01:00Z",
        context: { spec: null, sddPhase: null },
        agent: { model: "claude-sonnet-4-6" },
        response: { stats: { chars: 500 } },
        usage: { input_tokens: 100, output_tokens: 50, cache_read_tokens: 0, cache_creation_tokens: 0, cost_usd: 0.001 },
      };
      writeJson(tmp2, ".tmp/logs/prompts/2026-01/req-002.json", promptLog);

      // Should not throw even without any flow.json
      const result = execFileSync("node", [BACKFILL_SCRIPT], {
        encoding: "utf8",
        env: { ...process.env, SDD_WORK_ROOT: tmp2 },
      });
      // No flow.json to update — should complete without error
      assert.ok(result !== undefined, "backfill should complete without error");
    } finally {
      rmSync(tmp2, { recursive: true, force: true });
    }
  });
});
