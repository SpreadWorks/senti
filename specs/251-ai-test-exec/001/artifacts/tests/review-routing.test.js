// spec: R16 R17 R18 R27 R31 R43 R46
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

describe("review / gate routing for new flow order (251-ai-test-exec)", () => {
  it("R16: run-review.js resets test-execute / test-result-review / gate-impl / retro to pending after applying fixes", () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, "src/flow/lib/run-review.js"), "utf8");
    assert.ok(/test-execute[\s\S]*?pending|reset.*downstream|updateStepStatus.*pending/.test(src),
      "run-review.js must reset downstream steps to pending when fix is applied");
  });

  it("R17: gate-impl integration phase consumes test-result-review.json + test-execute-result.json", () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, "src/flow/lib/run-gate.js"), "utf8");
    assert.ok(/test-result-review\.json/.test(src), "run-gate.js must reference test-result-review.json (verdict gate)");
    assert.ok(/test-execute-result\.json/.test(src), "run-gate.js must reference test-execute-result.json (requirement coverage)");
  });

  it("R18: run-review.js no longer routes to 'finalize' / 'apply' as next", () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, "src/flow/lib/run-review.js"), "utf8");
    assert.ok(!/next:\s*["']finalize["']/.test(src), "run-review.js must not return next: 'finalize'");
    assert.ok(!/next:\s*["']apply["']/.test(src), "run-review.js must not return next: 'apply'");
  });

  it("R27: run-gate.js PASS_NEXT / FAIL_NEXT maps reflect new step order", () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, "src/flow/lib/run-gate.js"), "utf8");
    // Either PASS_NEXT/FAIL_NEXT are updated or removed (definition-driven)
    if (/PASS_NEXT|FAIL_NEXT/.test(src)) {
      // If still present, integration gate-impl PASS must transition to retro
      assert.ok(/integration[\s\S]*?retro|retro[\s\S]*?integration/.test(src),
        "PASS_NEXT/FAIL_NEXT for integration gate-impl must reference retro");
    }
  });

  it("R31: gate-impl behavior distinguishes task-impl scope (diff/guardrail) from integration scope (test artifacts)", () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, "src/flow/lib/run-gate.js"), "utf8");
    assert.ok(/task-impl[\s\S]*?integration|integration[\s\S]*?task-impl/.test(src),
      "run-gate.js must distinguish task-impl and integration phase behavior");
  });

  it("R43: impl/gate-impl.md prompt does not hardcode --phase task-impl for flow-level gate", () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, "src/flow/prompts/impl/gate-impl.md"), "utf8");
    // Flow-level gate-impl prompt should NOT exclusively use --phase task-impl
    if (/--phase\s+task-impl/.test(src)) {
      assert.ok(/--phase\s+integration|task subflow|task-level/i.test(src),
        "gate-impl.md must distinguish task-impl from integration phase");
    }
  });

  it("R46: registry.js test-execute / test-result-review / retro entries have post hooks marking step done", async () => {
    const { FLOW_COMMANDS } = await import(path.join(REPO_ROOT, "src/flow/registry.js"));
    for (const id of ["test-execute", "test-result-review", "retro"]) {
      const entry = FLOW_COMMANDS.run?.[id];
      assert.ok(entry, `registry.js missing run.${id}`);
      assert.ok(typeof entry.post === "function" || /done/.test(JSON.stringify(entry).slice(0, 2000)),
        `registry.js run.${id} should declare a post hook for step-done transition`);
    }
  });
});
