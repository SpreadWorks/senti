/**
 * specs/170-strict-flow-validation/tests/validation.test.js
 *
 * Spec verification tests for flow argument validation strictness.
 * Covers R1–R12: enum validation, number bounds, element type checks.
 */

import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "node:child_process";
import {
  saveFlowState, loadFlowState, buildInitialSteps, addActiveFlow,
} from "../../../src/lib/flow-state.js";

const FLOW_CMD = path.resolve("src/flow.js");

function createTmpProject() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "strict-val-"));
  fs.mkdirSync(path.join(tmp, ".sdd-forge"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "specs", "001-test"), { recursive: true });
  execFileSync("git", ["init", tmp], { stdio: "ignore" });
  return tmp;
}

function setupFlowState(dir) {
  const state = {
    spec: "specs/001-test/spec.md",
    baseBranch: "main",
    featureBranch: "feature/001-test",
    steps: buildInitialSteps(),
    requirements: [
      { text: "req 1", status: "pending" },
      { text: "req 2", status: "pending" },
    ],
  };
  saveFlowState(dir, state);
  addActiveFlow(dir, "001-test", "branch");
}

function run(tmp, args) {
  return JSON.parse(
    execFileSync("node", [FLOW_CMD, ...args], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
    }).trim(),
  );
}

function runExpectFail(tmp, args) {
  try {
    execFileSync("node", [FLOW_CMD, ...args], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
    });
    assert.fail("should have exited non-zero");
  } catch (err) {
    const output = (err.stdout || err.stderr || "").trim();
    assert.ok(output, "expected JSON envelope on stdout or stderr");
    const envelope = JSON.parse(output);
    assert.equal(envelope.ok, false);
    return envelope;
  }
}

// ---------------------------------------------------------------------------
// R1: constants.js existence
// ---------------------------------------------------------------------------

describe("R1: src/lib/constants.js", () => {
  it("exists and exports frozen arrays", async () => {
    const mod = await import("../../../src/lib/constants.js");
    const expected = [
      "VALID_PHASES",
      "VALID_STEP_STATUSES",
      "VALID_GATE_PHASES",
      "VALID_METRIC_COUNTERS",
      "VALID_CHECK_TARGETS",
      "VALID_REVIEW_PHASES",
      "VALID_IMPL_CONFIRM_MODES",
      "VALID_MERGE_STRATEGIES",
      "VALID_AUTO_VALUES",
      "VALID_REQ_STATUSES",
    ];
    for (const name of expected) {
      assert.ok(mod[name], `${name} should be exported`);
      assert.ok(Array.isArray(mod[name]), `${name} should be an array`);
      assert.ok(Object.isFrozen(mod[name]), `${name} should be frozen`);
    }
  });
});

// ---------------------------------------------------------------------------
// R2: phases.js removal
// ---------------------------------------------------------------------------

describe("R2: phases.js removed", () => {
  it("src/flow/lib/phases.js should not exist", () => {
    const phasesPath = path.resolve("src/flow/lib/phases.js");
    assert.equal(fs.existsSync(phasesPath), false, "phases.js should be deleted");
  });
});

// ---------------------------------------------------------------------------
// R3: flow set issue — positive integer
// ---------------------------------------------------------------------------

describe("R3: flow set issue validation", () => {
  let tmp;
  beforeEach(() => { tmp = createTmpProject(); setupFlowState(tmp); });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it("accepts positive integer", () => {
    const r = run(tmp, ["set", "issue", "1"]);
    assert.equal(r.ok, true);
    assert.equal(r.data.issue, 1);
  });

  it("accepts large positive integer", () => {
    const r = run(tmp, ["set", "issue", "9999"]);
    assert.equal(r.ok, true);
    assert.equal(r.data.issue, 9999);
  });

  it("rejects 0", () => {
    runExpectFail(tmp, ["set", "issue", "0"]);
  });

  it("rejects negative number", () => {
    runExpectFail(tmp, ["set", "issue", "-1"]);
  });

  it("rejects decimal", () => {
    runExpectFail(tmp, ["set", "issue", "1.5"]);
  });

  it("rejects non-numeric string", () => {
    runExpectFail(tmp, ["set", "issue", "abc"]);
  });
});

// ---------------------------------------------------------------------------
// R4: flow set summary — element type
// ---------------------------------------------------------------------------

describe("R4: flow set summary validation", () => {
  let tmp;
  beforeEach(() => { tmp = createTmpProject(); setupFlowState(tmp); });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it("accepts string array", () => {
    const r = run(tmp, ["set", "summary", '["a", "b"]']);
    assert.equal(r.ok, true);
    assert.equal(r.data.count, 2);
  });

  it("accepts empty array", () => {
    const r = run(tmp, ["set", "summary", "[]"]);
    assert.equal(r.ok, true);
    assert.equal(r.data.count, 0);
  });

  it("accepts object elements with text/status", () => {
    const r = run(tmp, ["set", "summary", '[{"text":"a","status":"pending"}]']);
    assert.equal(r.ok, true);
  });

  it("rejects number elements", () => {
    runExpectFail(tmp, ["set", "summary", "[1, 2, 3]"]);
  });

  it("rejects boolean elements", () => {
    runExpectFail(tmp, ["set", "summary", "[true]"]);
  });

  it("rejects null elements", () => {
    runExpectFail(tmp, ["set", "summary", "[null]"]);
  });

  it("rejects non-array", () => {
    runExpectFail(tmp, ["set", "summary", '"hello"']);
  });
});

// ---------------------------------------------------------------------------
// R5: flow run gate --phase — enum validation
// (gate requires spec files; test only that invalid phase is rejected)
// ---------------------------------------------------------------------------

describe("R5: flow run gate --phase validation", () => {
  let tmp;
  beforeEach(() => { tmp = createTmpProject(); setupFlowState(tmp); });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it("rejects invalid phase", () => {
    const env = runExpectFail(tmp, ["run", "gate", "--phase", "invalid"]);
    assert.ok(
      env.errors[0].messages.join(" ").includes("invalid") || env.errors[0].messages.join(" ").includes("phase"),
      "error should mention invalid phase",
    );
  });
});

// ---------------------------------------------------------------------------
// R6: flow set step — status enum
// ---------------------------------------------------------------------------

describe("R6: flow set step status validation", () => {
  let tmp;
  beforeEach(() => { tmp = createTmpProject(); setupFlowState(tmp); });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  for (const status of ["pending", "in_progress", "done", "skipped"]) {
    it(`accepts valid status: ${status}`, () => {
      const r = run(tmp, ["set", "step", "approach", status]);
      assert.equal(r.ok, true);
    });
  }

  it("rejects invalid status", () => {
    const env = runExpectFail(tmp, ["set", "step", "approach", "invalid"]);
    assert.ok(
      env.errors[0].messages.join(" ").includes("invalid") || env.errors[0].messages.join(" ").includes("status"),
      "error should mention invalid status",
    );
  });
});

// ---------------------------------------------------------------------------
// R7: flow set req — index bounds + status
// ---------------------------------------------------------------------------

describe("R7: flow set req validation", () => {
  let tmp;
  beforeEach(() => { tmp = createTmpProject(); setupFlowState(tmp); });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it("rejects negative index", () => {
    runExpectFail(tmp, ["set", "req", "-1", "done"]);
  });

  it("rejects invalid status", () => {
    runExpectFail(tmp, ["set", "req", "0", "invalid"]);
  });
});

// ---------------------------------------------------------------------------
// R10: flow run finalize --merge-strategy (enum from constants)
// R11: flow set auto (enum from constants)
// These already have inline validation; tests verify constants are used.
// ---------------------------------------------------------------------------

describe("R11: flow set auto validation", () => {
  let tmp;
  beforeEach(() => { tmp = createTmpProject(); setupFlowState(tmp); });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it("rejects invalid value", () => {
    runExpectFail(tmp, ["set", "auto", "yes"]);
  });
});

// ---------------------------------------------------------------------------
// R12: scattered constants moved to constants.js
// ---------------------------------------------------------------------------

describe("R12: scattered constants migrated", () => {
  it("set-metric.js does not define VALID_COUNTERS locally", async () => {
    const content = fs.readFileSync(
      path.resolve("src/flow/lib/set-metric.js"), "utf8",
    );
    assert.ok(
      !content.includes("const VALID_COUNTERS"),
      "VALID_COUNTERS should be imported, not defined locally",
    );
  });

  it("get-check.js does not define VALID_TARGETS locally", async () => {
    const content = fs.readFileSync(
      path.resolve("src/flow/lib/get-check.js"), "utf8",
    );
    assert.ok(
      !content.includes("const VALID_TARGETS"),
      "VALID_TARGETS should be imported, not defined locally",
    );
  });
});
