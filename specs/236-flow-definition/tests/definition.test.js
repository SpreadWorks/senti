import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, "..", "..", "..", "src");

describe("R1: definition.js exists and exports FLOW_DEFINITION / TASK_DEFINITION", () => {
  const defPath = join(srcRoot, "flow", "definition.js");

  it("src/flow/definition.js exists", () => {
    assert.ok(existsSync(defPath), "src/flow/definition.js must exist");
  });

  it("exports FLOW_DEFINITION as a non-empty array", async () => {
    const mod = await import(defPath);
    assert.ok(Array.isArray(mod.FLOW_DEFINITION), "FLOW_DEFINITION must be an array");
    assert.ok(mod.FLOW_DEFINITION.length > 0, "FLOW_DEFINITION must not be empty");
  });

  it("exports TASK_DEFINITION as a non-empty array", async () => {
    const mod = await import(defPath);
    assert.ok(Array.isArray(mod.TASK_DEFINITION), "TASK_DEFINITION must be an array");
    assert.ok(mod.TASK_DEFINITION.length > 0, "TASK_DEFINITION must not be empty");
  });

  it("each flow leaf node has required attributes (id, action, instructionsKey)", async () => {
    const mod = await import(defPath);
    function collectLeaves(nodes) {
      const leaves = [];
      for (const n of nodes) {
        if (n.children) {
          leaves.push(...collectLeaves(n.children));
        } else {
          leaves.push(n);
        }
      }
      return leaves;
    }
    const leaves = collectLeaves(mod.FLOW_DEFINITION);
    for (const leaf of leaves) {
      assert.ok(leaf.id, `leaf must have id`);
      assert.ok(leaf.action, `leaf ${leaf.id} must have action`);
      assert.ok(leaf.instructionsKey, `leaf ${leaf.id} must have instructionsKey`);
    }
  });

  it("exports helper functions: findActiveNode, deriveNextAction", async () => {
    const mod = await import(defPath);
    assert.equal(typeof mod.findActiveNode, "function");
    assert.equal(typeof mod.deriveNextAction, "function");
  });
});

describe("R2: context-rules.json is removed", () => {
  it("src/flow/schemas/context-rules.json does not exist", () => {
    const p = join(srcRoot, "flow", "schemas", "context-rules.json");
    assert.ok(!existsSync(p), "context-rules.json must be removed");
  });
});

describe("R6: maxAttempts in definition", () => {
  it("gate-draft maxAttempts is 10", async () => {
    const mod = await import(join(srcRoot, "flow", "definition.js"));
    const node = findNode(mod.FLOW_DEFINITION, "gate-draft");
    assert.ok(node, "gate-draft node must exist");
    assert.equal(node.maxAttempts, 10);
  });

  it("gate maxAttempts is 20", async () => {
    const mod = await import(join(srcRoot, "flow", "definition.js"));
    const node = findNode(mod.FLOW_DEFINITION, "gate");
    assert.ok(node, "gate node must exist");
    assert.equal(node.maxAttempts, 20);
  });

  it("gate-impl maxAttempts is 5", async () => {
    const mod = await import(join(srcRoot, "flow", "definition.js"));
    const node = findNode(mod.FLOW_DEFINITION, "gate-impl");
    assert.ok(node, "gate-impl node must exist");
    assert.equal(node.maxAttempts, 5);
  });

  it("review maxAttempts is 3", async () => {
    const mod = await import(join(srcRoot, "flow", "definition.js"));
    const node = findNode(mod.FLOW_DEFINITION, "review");
    assert.ok(node, "review node must exist");
    assert.equal(node.maxAttempts, 3);
  });
});

describe("R8: stale steps removed from FLOW_STEPS", () => {
  it("FLOW_STEPS does not contain integration-write-tests", async () => {
    const { FLOW_STEPS } = await import(join(srcRoot, "lib", "flow-helpers.js"));
    assert.ok(!FLOW_STEPS.includes("integration-write-tests"));
  });

  it("FLOW_STEPS does not contain integration-run-tests", async () => {
    const { FLOW_STEPS } = await import(join(srcRoot, "lib", "flow-helpers.js"));
    assert.ok(!FLOW_STEPS.includes("integration-run-tests"));
  });

  it("FLOW_STEPS does not contain integration-run-all-tests", async () => {
    const { FLOW_STEPS } = await import(join(srcRoot, "lib", "flow-helpers.js"));
    assert.ok(!FLOW_STEPS.includes("integration-run-all-tests"));
  });

  it("FLOW_STEPS does not contain integration-evaluate", async () => {
    const { FLOW_STEPS } = await import(join(srcRoot, "lib", "flow-helpers.js"));
    assert.ok(!FLOW_STEPS.includes("integration-evaluate"));
  });

  it("FLOW_STEPS does not contain show-report", async () => {
    const { FLOW_STEPS } = await import(join(srcRoot, "lib", "flow-helpers.js"));
    assert.ok(!FLOW_STEPS.includes("show-report"));
  });
});

describe("R12: test step in definition between approval and implement", () => {
  it("test node exists in FLOW_DEFINITION", async () => {
    const mod = await import(join(srcRoot, "flow", "definition.js"));
    const node = findNode(mod.FLOW_DEFINITION, "test");
    assert.ok(node, "test node must exist in definition");
  });

  it("test node has instructionsKey plan.test", async () => {
    const mod = await import(join(srcRoot, "flow", "definition.js"));
    const node = findNode(mod.FLOW_DEFINITION, "test");
    assert.equal(node.instructionsKey, "plan.test");
  });
});

function findNode(nodes, id) {
  for (const n of nodes) {
    if (n.id === id) return n;
    if (n.children) {
      const found = findNode(n.children, id);
      if (found) return found;
    }
  }
  return null;
}
