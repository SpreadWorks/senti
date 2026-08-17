import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("guardrail exemption removal", () => {
  it("extractExemptions is not exported", async () => {
    const mod = await import("../../../src/flow/run/gate.js");
    assert.equal(mod.extractExemptions, undefined, "extractExemptions should be removed");
  });

  it("buildGuardrailPrompt includes all spec-phase guardrails without exemption filtering", async () => {
    const { buildGuardrailPrompt } = await import("../../../src/flow/run/gate.js");
    const guardrails = [
      { title: "Rule A", body: "Description A", meta: { phase: ["spec"] } },
      { title: "Rule B", body: "Description B", meta: { phase: ["spec"] } },
      { title: "Rule C", body: "Description C", meta: { phase: ["spec"] } },
    ];
    // Spec with exemptions section — should be ignored after removal
    const spec = "## Guardrail Exemptions\n- Rule B — reason\n\n## Requirements\n- R1\n";
    const prompt = buildGuardrailPrompt(spec, guardrails);
    // All three rules should be present (Rule B is NOT exempted)
    assert.ok(prompt.includes("Rule A"), "should include Rule A");
    assert.ok(prompt.includes("Rule B"), "should include Rule B (not exempted)");
    assert.ok(prompt.includes("Rule C"), "should include Rule C");
    // No exempted articles section
    assert.ok(!prompt.includes("Exempted Articles"), "should not have Exempted Articles section");
  });

  it("buildGuardrailPrompt includes inapplicable-PASS instruction", async () => {
    const { buildGuardrailPrompt } = await import("../../../src/flow/run/gate.js");
    const guardrails = [
      { title: "Rule A", body: "Description A", meta: { phase: ["spec"] } },
    ];
    const prompt = buildGuardrailPrompt("## Requirements\n- R1\n", guardrails);
    assert.ok(prompt.includes("inapplicable") || prompt.includes("PASS"), "should include inapplicable-PASS instruction");
  });
});
