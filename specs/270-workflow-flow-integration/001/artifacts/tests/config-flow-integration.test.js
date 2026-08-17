// spec: R1 R6
import { test } from "node:test";
import assert from "node:assert/strict";

const CONFIG = "../../../src/lib/config.js";

test("R1: isFlowIntegrationEnabled is true only when workflow.flowIntegration === 'enable'", async () => {
  const mod = await import(CONFIG);
  assert.equal(typeof mod.isFlowIntegrationEnabled, "function");
  assert.equal(mod.isFlowIntegrationEnabled({ workflow: { flowIntegration: "enable" } }), true);
  assert.equal(mod.isFlowIntegrationEnabled({ workflow: { flowIntegration: "disable" } }), false);
});

test("R6: integration is off (helper false) when flowIntegration is unset or workflow/config is missing", async () => {
  const mod = await import(CONFIG);
  assert.equal(typeof mod.isFlowIntegrationEnabled, "function");
  assert.equal(mod.isFlowIntegrationEnabled({}), false);
  assert.equal(mod.isFlowIntegrationEnabled({ workflow: {} }), false);
  assert.equal(mod.isFlowIntegrationEnabled(undefined), false);
});
