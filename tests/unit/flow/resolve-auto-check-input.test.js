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

  // spec 225 R10 — Issue body integration
  describe("spec 225 R10 — Issue body incorporation", () => {
    it("preparing mode + state.issueBody: input contains issueBody instead of 'Issue #<n>' literal", () => {
      const state = {
        issue: 77,
        request: "implement Y",
        issueBody: "ISSUE_BODY_MARKER 詳細説明がここに入る",
        steps: stepsWith([]),
      };
      const out = resolveAutoCheckInput(state, { root: tmp, specPath: null });
      assert.equal(out.skip, false);
      assert.ok(out.text.includes("ISSUE_BODY_MARKER"));
      assert.ok(out.text.includes("implement Y"));
    });

    it("active mode + issue.md file exists: input includes file contents", () => {
      const specDir = path.join(tmp, "specs/225-test");
      fs.mkdirSync(specDir, { recursive: true });
      fs.writeFileSync(path.join(specDir, "issue.md"), "ISSUE_MD_MARKER 実ファイル内容");

      const state = {
        issue: 88,
        request: "implement Z",
        spec: "specs/225-test/spec.md",
        steps: stepsWith([]),
      };
      const out = resolveAutoCheckInput(state, { root: tmp, specPath: state.spec });
      assert.equal(out.skip, false);
      assert.ok(out.text.includes("ISSUE_MD_MARKER"));
      assert.ok(out.text.includes("implement Z"));
    });

    it("active mode + issue.md absent: falls back to 'Issue #<n>' literal", () => {
      const state = {
        issue: 99,
        request: "implement W",
        spec: "specs/225-test/spec.md",
        steps: stepsWith([]),
      };
      const out = resolveAutoCheckInput(state, { root: tmp, specPath: state.spec });
      assert.equal(out.skip, false);
      assert.ok(out.text.includes("implement W"));
      assert.ok(out.text.includes("99"));
    });

    it("preparing mode without issueBody: falls back to 'Issue #<n>' literal", () => {
      const state = {
        issue: 55,
        request: "implement V",
        steps: stepsWith([]),
      };
      const out = resolveAutoCheckInput(state, { root: tmp, specPath: null });
      assert.equal(out.skip, false);
      assert.ok(out.text.includes("55"));
    });

    it("issueBody empty string is treated as absent", () => {
      const state = {
        issue: 1,
        request: "rq",
        issueBody: "",
        steps: stepsWith([]),
      };
      const out = resolveAutoCheckInput(state, { root: tmp, specPath: null });
      assert.ok(out.text.includes("1"));
    });
  });
});
