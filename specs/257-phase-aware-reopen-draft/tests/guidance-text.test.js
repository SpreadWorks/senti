// spec: R6 R7
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("spec 257 reopen-draft guidance text", () => {
  it("R6: spec prompt routes missing draft decisions through reopen-draft", () => {
    const text = read("src/flow/prompts/plan/spec.md");

    assert.match(text, /sdd-forge flow run reopen-draft --reason/);
    assert.match(text, /draft/i);
    assert.match(text, /ad-hoc|その場確認|in-place/i);
  });

  it("R7: flow skill template and generated skills document phase-aware reopen preconditions", () => {
    const template = read("src/templates/skills/sdd-forge.flow/SKILL.md");
    assert.match(template, /phase-aware|phase aware|フェーズ/i);
    assert.match(template, /pre-implementation|implementation 前|実装前/i);
    assert.match(template, /done task|done task precondition|完了済み task/i);
    assert.match(template, /sdd-forge flow run reopen-draft/);

    for (const rel of [
      ".agents/skills/sdd-forge.flow/SKILL.md",
      ".claude/skills/sdd-forge.flow/SKILL.md",
    ]) {
      const text = read(rel);
      assert.match(text, /phase-aware|phase aware|フェーズ/i, rel);
      assert.match(text, /pre-implementation|implementation 前|実装前/i, rel);
      assert.match(text, /sdd-forge flow run reopen-draft/, rel);
    }
  });
});
