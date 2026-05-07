// spec: R13 R36 R45
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

describe("TASK_DEFINITION (task subflow) impact (251-ai-test-exec)", () => {
  it("R13: TASK_DEFINITION does not include test-execute or test-result-review steps", async () => {
    const { TASK_DEFINITION } = await import(path.join(REPO_ROOT, "src/flow/definition.js"));
    function hasNode(nodes, id) {
      for (const n of nodes) {
        if (n.id === id) return true;
        if (n.children && hasNode(n.children, id)) return true;
      }
      return false;
    }
    assert.ok(!hasNode(TASK_DEFINITION, "test-execute"), "TASK_DEFINITION must not contain test-execute");
    assert.ok(!hasNode(TASK_DEFINITION, "test-result-review"), "TASK_DEFINITION must not contain test-result-review");
  });

  it("R36: base preset spec-test-coverage guardrail does not require runtime test PASS at task-impl phase", () => {
    const guardrailPath = path.join(REPO_ROOT, "src/presets/base/guardrail.json");
    const data = JSON.parse(fs.readFileSync(guardrailPath, "utf8"));
    const list = Array.isArray(data) ? data : (data?.guardrails || []);
    const stc = list.find((g) => g?.id === "spec-test-coverage" || g?.guardrail_id === "spec-test-coverage");
    if (stc) {
      const phases = stc.phases || stc.phase || [];
      const phaseList = Array.isArray(phases) ? phases : [phases];
      assert.ok(!phaseList.includes("task-impl"), `spec-test-coverage must not include 'task-impl' phase, got ${JSON.stringify(phaseList)}`);
    }
  });

  it("R45: all preset guardrails audited — task-impl phase only declares static checks (no runtime test pass)", () => {
    const presetsDir = path.join(REPO_ROOT, "src/presets");
    if (!fs.existsSync(presetsDir)) return;
    for (const entry of fs.readdirSync(presetsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const gp = path.join(presetsDir, entry.name, "guardrail.json");
      if (!fs.existsSync(gp)) continue;
      const data = JSON.parse(fs.readFileSync(gp, "utf8"));
      const list = Array.isArray(data) ? data : (data?.guardrails || []);
      for (const g of list) {
        const phases = g?.phases || g?.phase || [];
        const phaseList = Array.isArray(phases) ? phases : [phases];
        if (phaseList.includes("task-impl")) {
          const text = String(g?.detail || g?.description || g?.text || "");
          assert.ok(!/run.*test|test.*pass|テスト.*実行|test.*runtime/i.test(text),
            `preset ${entry.name} guardrail '${g?.id || g?.guardrail_id}' has task-impl phase but expects runtime test execution: ${text}`);
        }
      }
    }
  });
});
