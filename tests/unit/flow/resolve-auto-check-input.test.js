import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import {
  resolveAutoCheckInput,
  isSpecApproved,
} from "../../../src/flow/lib/resolve-auto-check-input.js";

describe("resolve-auto-check-input — phase-aware input construction (spec 220)", () => {
  let tmp;

  beforeEach(() => {
    tmp = createTmpDir("resolve-input-");
  });

  afterEach(() => {
    removeTmpDir(tmp);
  });

  function stepsWith(doneIds = []) {
    return buildInitialSteps().map((s) =>
      doneIds.includes(s.id) ? { ...s, status: "done" } : s,
    );
  }

  // R1 — isSpecApproved detection
  it("isSpecApproved returns true when approval step is done", () => {
    const state = { steps: stepsWith(["approval"]) };
    assert.equal(isSpecApproved(state), true);
  });

  it("isSpecApproved returns false when approval step is pending", () => {
    const state = { steps: stepsWith([]) };
    assert.equal(isSpecApproved(state), false);
  });

  it("isSpecApproved returns false when approval step is done on gate only (not approval)", () => {
    const state = { steps: stepsWith(["gate"]) };
    assert.equal(isSpecApproved(state), false);
  });

  it("isSpecApproved tolerates malformed state (no steps array)", () => {
    assert.equal(isSpecApproved({}), false);
    assert.equal(isSpecApproved(null), false);
  });

  // Phase 1 — set init phase: issue + request only
  it("returns issue+request when no gate-draft, no approval", () => {
    const state = {
      issue: 42,
      request: "add logging",
      steps: stepsWith([]),
    };
    const out = resolveAutoCheckInput(state, { root: tmp, specPath: null });
    assert.equal(out.skip, false);
    assert.ok(out.text.includes("add logging"));
    assert.ok(out.text.includes("42"));
  });

  // Phase 2 — after gate-draft done: issue + request + draft body
  it("returns issue+request+draft body when gate-draft is done and draft exists", () => {
    const specDir = path.join(tmp, "specs/001-test");
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, "draft.md"), "DRAFT_MARKER 内容が続く");

    const state = {
      issue: 10,
      request: "implement X",
      spec: "specs/001-test/spec.md",
      steps: stepsWith(["gate-draft"]),
    };
    const out = resolveAutoCheckInput(state, { root: tmp, specPath: state.spec });
    assert.equal(out.skip, false);
    assert.ok(out.text.includes("DRAFT_MARKER"));
    assert.ok(out.text.includes("implement X"));
  });

  // Phase 2 edge — gate-draft done but no draft file → fall back to issue+request
  it("falls back to issue+request when gate-draft done but draft file missing", () => {
    const state = {
      issue: 10,
      request: "implement X",
      spec: "specs/001-test/spec.md",
      steps: stepsWith(["gate-draft"]),
    };
    const out = resolveAutoCheckInput(state, { root: tmp, specPath: state.spec });
    assert.equal(out.skip, false);
    assert.ok(!out.text.includes("DRAFT_MARKER"));
    assert.ok(out.text.includes("implement X"));
  });

  // Phase 3 — approval done: skip signal
  it("returns skip=true when approval step is done", () => {
    const state = {
      issue: 10,
      request: "implement X",
      steps: stepsWith(["approval"]),
    };
    const out = resolveAutoCheckInput(state, { root: tmp, specPath: null });
    assert.equal(out.skip, true);
    assert.equal(out.reason, "spec approved");
  });

  // Phase 3 dominates — approval wins even if gate-draft is also done
  it("approval takes precedence over gate-draft (spec approved wins)", () => {
    const specDir = path.join(tmp, "specs/001-test");
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, "draft.md"), "ignored-draft");

    const state = {
      issue: 10,
      request: "implement X",
      spec: "specs/001-test/spec.md",
      steps: stepsWith(["gate-draft", "approval"]),
    };
    const out = resolveAutoCheckInput(state, { root: tmp, specPath: state.spec });
    assert.equal(out.skip, true);
  });

  // Preparing mode (no specPath) — draft cannot be loaded
  it("does not attempt draft load when specPath is null (preparing mode)", () => {
    const state = {
      issue: 10,
      request: "implement X",
      steps: stepsWith(["gate-draft"]),
    };
    const out = resolveAutoCheckInput(state, { root: tmp, specPath: null });
    assert.equal(out.skip, false);
    assert.ok(out.text.includes("implement X"));
    assert.ok(out.text.includes("10"));
  });
});
