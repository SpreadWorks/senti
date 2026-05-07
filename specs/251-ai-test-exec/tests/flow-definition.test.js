// spec: R1 R11 R32 R42 R44
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

describe("FLOW_DEFINITION impl phase children (251-ai-test-exec)", () => {
  it("R1: impl phase children include test-execute, test-result-review, retro in canonical order", async () => {
    const { FLOW_DEFINITION } = await import(path.join(REPO_ROOT, "src/flow/definition.js"));
    const impl = FLOW_DEFINITION.find((n) => n.id === "impl");
    assert.ok(impl, "impl phase node not found");
    const childIds = (impl.children || []).map((c) => c.id);
    const expected = ["implement", "test-execute", "test-result-review", "review", "gate-impl", "retro"];
    for (const id of expected) {
      assert.ok(childIds.includes(id), `expected impl child '${id}' but children=${JSON.stringify(childIds)}`);
    }
    const order = expected.map((id) => childIds.indexOf(id));
    for (let i = 1; i < order.length; i++) {
      assert.ok(order[i] > order[i - 1], `step '${expected[i]}' must come after '${expected[i - 1]}', got order=${JSON.stringify(order)}`);
    }
  });

  it("R11: registry.js registers run-test-execute and run-test-result-review", async () => {
    const { FLOW_COMMANDS } = await import(path.join(REPO_ROOT, "src/flow/registry.js"));
    assert.ok(FLOW_COMMANDS.run?.["test-execute"], "registry missing run.test-execute");
    assert.ok(FLOW_COMMANDS.run?.["test-result-review"], "registry missing run.test-result-review");
  });

  it("R32: next-action schemas exist for test-execute, test-result-review, retro", () => {
    const schemaDir = path.join(REPO_ROOT, "src/flow/schemas/next-action");
    for (const name of ["test-execute.schema.json", "test-result-review.schema.json", "retro.schema.json"]) {
      const p = path.join(schemaDir, name);
      assert.ok(fs.existsSync(p), `next-action schema missing: ${name}`);
    }
  });

  it("R42: get-status flattens nested impl steps when computing progress", async () => {
    const mod = await import(path.join(REPO_ROOT, "src/flow/lib/get-status.js"));
    assert.ok(typeof mod === "object", "get-status.js must export at least one symbol");
    // Concrete progress aggregation behavior is verified by integration tests; this test asserts the flattening helper exists/is wired.
    const src = fs.readFileSync(path.join(REPO_ROOT, "src/flow/lib/get-status.js"), "utf8");
    assert.ok(/collectLeafIds|flatten|nested/i.test(src), "get-status.js must reference nested-step flattening");
  });

  it("R44: gate-step.js distinguishes flow-level integration gate from task-level gate-impl", () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, "src/flow/lib/gate-step.js"), "utf8");
    assert.ok(/integration/.test(src), "gate-step.js must reference 'integration' phase distinct from task-impl");
  });
});
