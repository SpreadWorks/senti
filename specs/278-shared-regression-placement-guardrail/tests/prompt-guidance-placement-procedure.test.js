// spec: R1 R2 R3 R4 R5
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const FLOW_SKILL_SOURCE = path.join(ROOT, "src/skills/sdd-forge.flow/SKILL.md");
const GENERATED_FLOW_SKILL = path.join(ROOT, ".agents/skills/sdd-forge.flow/SKILL.md");

function readPromptGuidancePlacementContract(filePath) {
  const skill = fs.readFileSync(filePath, "utf8");
  const match = skill.match(
    /(?:^|\n)### Prompt guidance placement contract\n([\s\S]*?)(?=\n### |\n## |$)/,
  );

  assert.ok(match, "expected a Prompt guidance placement contract section");

  return match[1];
}

function assertPromptGuidancePlacementContract(contract) {
  assert.match(contract, /prompt guidance movement/i);
  assert.match(contract, /flow skill files?/i);
  assert.match(contract, /flow prompt files?/i);
  assert.match(contract, /related shared regression tests?/i);
  assert.match(contract, /placement-contract assertions?/i);
  assert.match(contract, /old-placement removal assertions?/i);
  assert.match(contract, /new-placement presence assertions?/i);
  assert.match(contract, /general prompt guidance movement/i);
  assert.doesNotMatch(contract, /only.*workflow board|workflow board.*only/i);
}

describe("prompt guidance placement procedure", () => {
  it("R1: requires checking related shared regression tests when prompt guidance moves", () => {
    const contract = readPromptGuidancePlacementContract(FLOW_SKILL_SOURCE);

    assert.match(contract, /prompt guidance movement/i);
    assert.match(contract, /related shared regression tests?/i);
    assert.match(contract, /placement-contract assertions?/i);
  });

  it("R2: requires both old-placement removal and new-placement presence assertions", () => {
    const contract = readPromptGuidancePlacementContract(FLOW_SKILL_SOURCE);

    assert.match(contract, /old-placement removal assertions?/i);
    assert.match(contract, /new-placement presence assertions?/i);
  });

  it("R3: applies to prompt guidance moves in general", () => {
    const contract = readPromptGuidancePlacementContract(FLOW_SKILL_SOURCE);

    assert.match(contract, /flow skill files?/i);
    assert.match(contract, /flow prompt files?/i);
    assert.match(contract, /general prompt guidance movement/i);
    assert.doesNotMatch(contract, /only.*workflow board|workflow board.*only/i);
  });

  it("R4: verifies the SDD flow skill source contains the full instruction contract", () => {
    const contract = readPromptGuidancePlacementContract(FLOW_SKILL_SOURCE);

    assertPromptGuidancePlacementContract(contract);
  });

  it("R5: verifies generated agent skill contains the same instruction contract", () => {
    const contract = readPromptGuidancePlacementContract(GENERATED_FLOW_SKILL);

    assertPromptGuidancePlacementContract(contract);
  });
});
