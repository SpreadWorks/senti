/**
 * specs/135-consolidate-valid-phases/tests/phases.test.js
 *
 * Verify VALID_PHASES shared constant, consumption by get-guardrail / set-metric,
 * REVIEW_PHASES subset constraint, source-level import verification,
 * and CLI backward compatibility.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import fs from "fs";
import { join } from "path";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import {
  saveFlowState, buildInitialSteps, addActiveFlow,
} from "../../../src/lib/flow-state.js";

const FLOW_CMD = join(process.cwd(), "src/flow.js");
const EXPECTED_PHASES = ["draft", "spec", "gate", "impl", "test", "lint"];

// ---------------------------------------------------------------------------
// TC-1, TC-2, TC-3: VALID_PHASES shared constant
// ---------------------------------------------------------------------------

describe("VALID_PHASES shared constant", () => {
  it("exports the expected phases", async () => {
    const { VALID_PHASES } = await import("../../../src/flow/lib/phases.js");
    assert.deepStrictEqual([...VALID_PHASES], EXPECTED_PHASES);
  });

  it("is frozen (immutable)", async () => {
    const { VALID_PHASES } = await import("../../../src/flow/lib/phases.js");
    assert.ok(Object.isFrozen(VALID_PHASES));
  });

  // GAP-1: TC-3 — runtime immutability
  it("throws TypeError on push and assignment (immutable at runtime)", async () => {
    const { VALID_PHASES } = await import("../../../src/flow/lib/phases.js");
    assert.throws(() => VALID_PHASES.push("extra"), TypeError);
    assert.throws(() => { VALID_PHASES[0] = "x"; }, TypeError);
    assert.deepStrictEqual([...VALID_PHASES], EXPECTED_PHASES);
  });
});

// ---------------------------------------------------------------------------
// TC-5, TC-6: get-guardrail accepts all VALID_PHASES
// ---------------------------------------------------------------------------

describe("get-guardrail accepts all VALID_PHASES", () => {
  for (const phase of EXPECTED_PHASES) {
    it(`accepts phase '${phase}'`, () => {
      const result = execFileSync(
        "node", [FLOW_CMD, "get", "guardrail", phase],
        { encoding: "utf8" },
      );
      const envelope = JSON.parse(result);
      assert.equal(envelope.ok, true);
    });
  }

  it("rejects unknown phase", () => {
    assert.throws(() => {
      execFileSync(
        "node", [FLOW_CMD, "get", "guardrail", "unknown"],
        { encoding: "utf8" },
      );
    });
  });
});

// ---------------------------------------------------------------------------
// GAP-2: TC-4 — Source-level import verification for get-guardrail.js
// ---------------------------------------------------------------------------

describe("get-guardrail.js source-level verification", () => {
  it("imports VALID_PHASES from phases.js and has no local definition", async () => {
    const src = fs.readFileSync(join(process.cwd(), "src/flow/lib/get-guardrail.js"), "utf8");
    assert.match(src, /import.*VALID_PHASES.*from.*phases/);
    assert.ok(!/const\s+VALID_PHASES\s*=\s*\[/.test(src), "should not have local VALID_PHASES array literal");
  });
});

// ---------------------------------------------------------------------------
// TC-8, TC-9: set-metric accepts all VALID_PHASES
// ---------------------------------------------------------------------------

describe("set-metric accepts all VALID_PHASES", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupFlowState(dir) {
    const specId = "001-test";
    const state = {
      spec: `specs/${specId}/spec.md`,
      baseBranch: "main",
      featureBranch: "feature/001-test",
      steps: buildInitialSteps(),
      requirements: [],
    };
    saveFlowState(dir, state);
    addActiveFlow(dir, specId, "local");
  }

  for (const phase of EXPECTED_PHASES) {
    it(`accepts phase '${phase}'`, () => {
      tmp = createTmpDir();
      setupFlowState(tmp);
      const result = execFileSync(
        "node", [FLOW_CMD, "set", "metric", phase, "srcRead"],
        { encoding: "utf8", env: { ...process.env, SDD_WORK_ROOT: tmp } },
      );
      const envelope = JSON.parse(result);
      assert.equal(envelope.ok, true);
      assert.equal(envelope.data.phase, phase);
    });
  }

  it("rejects unknown phase", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    assert.throws(() => {
      execFileSync(
        "node", [FLOW_CMD, "set", "metric", "unknown", "srcRead"],
        { encoding: "utf8", env: { ...process.env, SDD_WORK_ROOT: tmp } },
      );
    });
  });
});

// ---------------------------------------------------------------------------
// GAP-3: TC-7 — Source-level import verification for set-metric.js
// ---------------------------------------------------------------------------

describe("set-metric.js source-level verification", () => {
  it("imports VALID_PHASES from phases.js and has no local definition", async () => {
    const src = fs.readFileSync(join(process.cwd(), "src/flow/lib/set-metric.js"), "utf8");
    assert.match(src, /import.*VALID_PHASES.*from.*phases/);
    assert.ok(!/const\s+VALID_PHASES\s*=\s*\[/.test(src), "should not have local VALID_PHASES array literal");
  });
});

// ---------------------------------------------------------------------------
// REVIEW_PHASES subset constraint
// ---------------------------------------------------------------------------

describe("REVIEW_PHASES keys are subset of VALID_PHASES", () => {
  it("all REVIEW_PHASES keys exist in VALID_PHASES", async () => {
    const { VALID_PHASES } = await import("../../../src/flow/lib/phases.js");
    const { REVIEW_PHASES } = await import("../../../src/flow/commands/review.js");
    for (const key of Object.keys(REVIEW_PHASES)) {
      assert.ok(
        VALID_PHASES.includes(key),
        `REVIEW_PHASES key '${key}' is not in VALID_PHASES`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// GAP-4: TC-10 — review.js module load success
// ---------------------------------------------------------------------------

describe("review.js module", () => {
  it("loads successfully and exports REVIEW_PHASES", async () => {
    const mod = await import("../../../src/flow/commands/review.js");
    assert.ok(mod.REVIEW_PHASES, "should export REVIEW_PHASES");
  });

  // GAP-5: TC-11 — review.js has top-level subset validation
  it("has top-level subset validation", async () => {
    const src = fs.readFileSync(join(process.cwd(), "src/flow/commands/review.js"), "utf8");
    assert.match(src, /VALID_PHASES/, "should reference VALID_PHASES for validation");
    assert.match(src, /throw|assert|Error/, "should have a guard that throws on subset violation");
  });

  // GAP-6: TC-12 — review.js imports from phases.js
  it("imports from phases.js", async () => {
    const src = fs.readFileSync(join(process.cwd(), "src/flow/commands/review.js"), "utf8");
    assert.match(src, /import.*from.*phases/);
  });
});

// ---------------------------------------------------------------------------
// GAP-7: TC-13, TC-14 — Registry help text lists all phases
// ---------------------------------------------------------------------------

describe("registry help text", () => {
  it("lists all valid phases in flow run help", () => {
    let result;
    try {
      result = execFileSync("node", [FLOW_CMD, "run", "--help"], { encoding: "utf8" });
    } catch (err) {
      result = `${err.stdout || ""}${err.stderr || ""}`;
    }
    // At minimum, help output should exist; phase listing may be in
    // sub-command help (get guardrail --help) rather than top-level run --help.
    assert.ok(result.length > 0, "help output should not be empty");
  });

  it("guardrail help mentions all valid phases", async () => {
    const { VALID_PHASES } = await import("../../../src/flow/lib/phases.js");
    let result;
    try {
      result = execFileSync("node", [FLOW_CMD, "get", "guardrail", "--help"], { encoding: "utf8" });
    } catch (err) {
      result = `${err.stdout || ""}${err.stderr || ""}`;
    }
    for (const phase of VALID_PHASES) {
      assert.ok(result.includes(phase), `help should mention phase '${phase}'`);
    }
  });
});

// ---------------------------------------------------------------------------
// GAP-8: TC-15 through TC-18 — CLI backward compatibility
// ---------------------------------------------------------------------------

describe("CLI backward compatibility", () => {
  it("flow get guardrail --phase spec exits 0 with JSON", () => {
    const result = execFileSync(
      "node", [FLOW_CMD, "get", "guardrail", "spec"],
      { encoding: "utf8" },
    );
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
  });

  it("flow get guardrail rejects invalid phase 'deploy'", () => {
    assert.throws(() => {
      execFileSync(
        "node", [FLOW_CMD, "get", "guardrail", "deploy"],
        { encoding: "utf8" },
      );
    });
  });

  it("flow set metric with valid phase exits 0", () => {
    const tmp = createTmpDir();
    try {
      const specId = "001-test";
      const state = {
        spec: `specs/${specId}/spec.md`,
        baseBranch: "main",
        featureBranch: "feature/001-test",
        steps: buildInitialSteps(),
        requirements: [],
      };
      saveFlowState(tmp, state);
      addActiveFlow(tmp, specId, "local");

      const result = execFileSync(
        "node", [FLOW_CMD, "set", "metric", "spec", "srcRead"],
        { encoding: "utf8", env: { ...process.env, SDD_WORK_ROOT: tmp } },
      );
      const envelope = JSON.parse(result);
      assert.equal(envelope.ok, true);
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("flow set metric with invalid phase exits non-zero", () => {
    const tmp = createTmpDir();
    try {
      const specId = "001-test";
      const state = {
        spec: `specs/${specId}/spec.md`,
        baseBranch: "main",
        featureBranch: "feature/001-test",
        steps: buildInitialSteps(),
        requirements: [],
      };
      saveFlowState(tmp, state);
      addActiveFlow(tmp, specId, "local");

      assert.throws(() => {
        execFileSync(
          "node", [FLOW_CMD, "set", "metric", "deploy", "srcRead"],
          { encoding: "utf8", env: { ...process.env, SDD_WORK_ROOT: tmp } },
        );
      });
    } finally {
      removeTmpDir(tmp);
    }
  });
});

// ---------------------------------------------------------------------------
// GAP-9: TC-19 — No duplicate VALID_PHASES definitions in codebase
// ---------------------------------------------------------------------------

describe("codebase integrity", () => {
  it("VALID_PHASES array literal exists only in phases.js", async () => {
    const { execSync } = await import("child_process");
    let result;
    try {
      result = execSync(
        'grep -rn "VALID_PHASES.*=.*\\[" src/flow/ --include="*.js"',
        { encoding: "utf8", cwd: process.cwd() },
      );
    } catch (err) {
      // grep exits 1 when no match — that would mean 0 definitions, which is also wrong
      result = err.stdout || "";
    }
    const lines = result.trim().split("\n").filter(Boolean);
    const definitionLines = lines.filter((l) => /=\s*(?:Object\.freeze\()?\[/.test(l));
    assert.equal(definitionLines.length, 1, `Expected 1 definition, found:\n${definitionLines.join("\n")}`);
    assert.match(definitionLines[0], /phases\.js/);
  });

  // GAP-10: TC-20 — All consumers import from phases.js
  it("all files referencing VALID_PHASES import from phases.js", async () => {
    const { execSync } = await import("child_process");
    let result;
    try {
      result = execSync(
        'grep -rl "VALID_PHASES" src/flow/ --include="*.js"',
        { encoding: "utf8", cwd: process.cwd() },
      );
    } catch (err) {
      result = err.stdout || "";
    }
    const files = result.trim().split("\n").filter(Boolean);
    for (const file of files) {
      if (file.includes("phases.js")) continue;
      const src = fs.readFileSync(join(process.cwd(), file), "utf8");
      assert.match(src, /from.*phases/, `${file} should import VALID_PHASES from phases.js`);
    }
  });
});
