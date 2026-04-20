import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { VALID_GATE_PHASES } from "../../../src/lib/constants.js";
import { validateLevelPhase } from "../../../src/flow/lib/run-gate.js";

// -----------------------------------------------------------------------------
// REQ-1: phase enum は新語彙 5 値のみ
// -----------------------------------------------------------------------------

describe("VALID_GATE_PHASES (REQ-1)", () => {
  it("contains exactly the new phase vocabulary", () => {
    assert.deepEqual(
      [...VALID_GATE_PHASES].sort(),
      ["draft", "integration", "spec", "task-impl", "task-spec"],
    );
  });

  it("does not contain legacy phase names", () => {
    for (const legacy of ["pre", "post", "impl"]) {
      assert.ok(
        !VALID_GATE_PHASES.includes(legacy),
        `legacy phase "${legacy}" should not be in VALID_GATE_PHASES`,
      );
    }
  });
});

// -----------------------------------------------------------------------------
// REQ-2: level / phase の許容組合せ
// -----------------------------------------------------------------------------

describe("validateLevelPhase (REQ-2)", () => {
  const valid = [
    ["parent", "draft"],
    ["parent", "spec"],
    ["task", "task-spec"],
    ["task", "task-impl"],
    ["integration", "integration"],
  ];

  for (const [level, phase] of valid) {
    it(`accepts (${level}, ${phase})`, () => {
      assert.doesNotThrow(() => validateLevelPhase(level, phase));
    });
  }

  const invalid = [
    ["parent", "task-spec"],
    ["parent", "task-impl"],
    ["parent", "integration"],
    ["task", "draft"],
    ["task", "spec"],
    ["task", "integration"],
    ["integration", "draft"],
    ["integration", "spec"],
    ["integration", "task-spec"],
    ["integration", "task-impl"],
  ];

  for (const [level, phase] of invalid) {
    it(`rejects (${level}, ${phase})`, () => {
      assert.throws(() => validateLevelPhase(level, phase), /invalid|combination|level/i);
    });
  }

  it("rejects unknown level", () => {
    assert.throws(() => validateLevelPhase("unknown", "draft"), /level/i);
  });

  it("rejects unknown phase", () => {
    assert.throws(() => validateLevelPhase("parent", "unknown"), /phase/i);
  });
});
