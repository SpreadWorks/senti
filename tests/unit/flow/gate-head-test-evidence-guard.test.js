import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { checkMissingHeadTestEvidence } from "../../../src/flow/lib/run-gate.js";
import { Envelope } from "../../../src/lib/flow-envelope.js";

// -----------------------------------------------------------------------------
// spec 222: head test evidence pre-check guard for task-impl / integration gate
// -----------------------------------------------------------------------------

describe("checkMissingHeadTestEvidence (REQ-1, REQ-3)", () => {
  it("returns an ok:false envelope when phase is task-impl and state.test.summary is null", () => {
    const env = checkMissingHeadTestEvidence({
      phase: "task-impl",
      flowState: { test: { summary: null } },
    });
    assert.ok(env instanceof Envelope, "expected an Envelope instance");
    assert.equal(env.ok, false);
    assert.equal(env.errors[0].code, "NO_HEAD_TEST_EVIDENCE");
  });

  it("returns an ok:false envelope when phase is task-impl and state has no test field", () => {
    const env = checkMissingHeadTestEvidence({
      phase: "task-impl",
      flowState: {},
    });
    assert.ok(env instanceof Envelope);
    assert.equal(env.ok, false);
    assert.equal(env.errors[0].code, "NO_HEAD_TEST_EVIDENCE");
  });

  it("returns an ok:false envelope when summary has counts but no exitCode (AI-written only)", () => {
    // This is the real-world symptom: spec write-tests phase recorded counts
    // via `flow set test-summary --unit N`, but `flow run tests` was never
    // executed so exitCode is absent.
    const env = checkMissingHeadTestEvidence({
      phase: "task-impl",
      flowState: { test: { summary: { unit: 2 } } },
    });
    assert.ok(env instanceof Envelope);
    assert.equal(env.ok, false);
    assert.equal(env.errors[0].code, "NO_HEAD_TEST_EVIDENCE");
  });

  it("returns an ok:false envelope when phase is integration and exitCode is missing", () => {
    const env = checkMissingHeadTestEvidence({
      phase: "integration",
      flowState: { test: { summary: null } },
    });
    assert.ok(env instanceof Envelope);
    assert.equal(env.ok, false);
    assert.equal(env.errors[0].code, "NO_HEAD_TEST_EVIDENCE");
  });

  it("includes the concrete recovery command `sdd-forge flow run tests` in the messages (REQ-1 / AC-1)", () => {
    const env = checkMissingHeadTestEvidence({
      phase: "task-impl",
      flowState: { test: { summary: null } },
    });
    assert.ok(
      env.errors[0].messages.some((m) => /sdd-forge flow run tests/.test(m)),
      "messages must include the recovery command `sdd-forge flow run tests`",
    );
  });

  it("returns null when state.test.summary has exitCode (tool-recorded)", () => {
    const env = checkMissingHeadTestEvidence({
      phase: "task-impl",
      flowState: { test: { summary: { unit: 10, exitCode: 0 } } },
    });
    assert.equal(env, null);
  });

  it("returns null when exitCode is a non-zero number (still considered tool-recorded)", () => {
    const env = checkMissingHeadTestEvidence({
      phase: "task-impl",
      flowState: { test: { summary: { unit: 10, exitCode: 1 } } },
    });
    assert.equal(env, null);
  });

  it("returns null for phase=draft regardless of summary state (REQ-3)", () => {
    const env = checkMissingHeadTestEvidence({
      phase: "draft",
      flowState: { test: { summary: null } },
    });
    assert.equal(env, null);
  });

  it("returns null for phase=spec regardless of summary state (REQ-3)", () => {
    const env = checkMissingHeadTestEvidence({
      phase: "spec",
      flowState: { test: { summary: null } },
    });
    assert.equal(env, null);
  });

  it("returns null for phase=task-spec regardless of summary state (REQ-3)", () => {
    const env = checkMissingHeadTestEvidence({
      phase: "task-spec",
      flowState: { test: { summary: null } },
    });
    assert.equal(env, null);
  });
});

describe("gate prompt files mention the flow run tests prerequisite (REQ-4, REQ-5, REQ-6)", () => {
  const readPrompt = (rel) => fs.readFileSync(
    path.join(process.cwd(), rel),
    "utf8",
  );

  it("src/flow/prompts/impl/implement.md mentions `sdd-forge flow run tests` (REQ-4)", () => {
    const text = readPrompt("src/flow/prompts/impl/implement.md");
    assert.match(
      text,
      /sdd-forge flow run tests/,
      "implement.md must reference `sdd-forge flow run tests` as the means to record head test evidence for gate-impl",
    );
  });

  it("src/flow/prompts/impl/gate-impl.md mentions head test evidence prerequisite (REQ-5)", () => {
    const text = readPrompt("src/flow/prompts/impl/gate-impl.md");
    assert.match(
      text,
      /(test evidence|flow run tests)/i,
      "gate-impl.md must reference either `test evidence` or `flow run tests` to signal the prerequisite",
    );
  });

  it("src/flow/prompts/plan/test.md does NOT reference the nonexistent `flow get test-result` (REQ-6)", () => {
    const text = readPrompt("src/flow/prompts/plan/test.md");
    assert.doesNotMatch(
      text,
      /sdd-forge flow get test-result/,
      "plan/test.md must not reference the nonexistent subcommand `sdd-forge flow get test-result`",
    );
  });

  it("src/flow/prompts/plan/test.md references `sdd-forge flow run tests` instead (REQ-6)", () => {
    const text = readPrompt("src/flow/prompts/plan/test.md");
    assert.match(
      text,
      /sdd-forge flow run tests/,
      "plan/test.md must reference `sdd-forge flow run tests` as the mechanism recording head test evidence",
    );
  });
});
