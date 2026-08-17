/**
 * specs/133-restore-flow-resume/tests/resume-command.test.js
 *
 * Spec verification tests for the flow resume command.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { join } from "path";
import { mkdirSync, writeFileSync } from "fs";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import {
  saveFlowState, buildInitialSteps, addActiveFlow,
  updateStepStatus,
} from "../../../src/lib/flow-state.js";

const FLOW_CMD = join(process.cwd(), "src/flow.js");

describe("sdd-forge flow resume", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupFlow(dir, specId = "001-test", opts = {}) {
    const state = {
      spec: `specs/${specId}/spec.md`,
      baseBranch: "main",
      featureBranch: `feature/${specId}`,
      steps: buildInitialSteps(),
      requirements: opts.requirements || [],
      request: opts.request || "test request",
      notes: opts.notes || ["note1"],
    };
    saveFlowState(dir, state);
    addActiveFlow(dir, specId, "local");

    // Create spec.md with Goal and Scope sections
    const specDir = join(dir, "specs", specId);
    mkdirSync(specDir, { recursive: true });
    writeFileSync(join(specDir, "spec.md"), [
      "# Spec",
      "",
      "## Goal",
      "Test goal content",
      "",
      "## Scope",
      "Test scope content",
      "",
    ].join("\n"));

    return state;
  }

  it("returns JSON envelope with flow context when flow exists", () => {
    tmp = createTmpDir();
    setupFlow(tmp);
    const result = execFileSync(
      "node", [FLOW_CMD, "resume"],
      { encoding: "utf8", env: { ...process.env, SDD_WORK_ROOT: tmp } },
    );
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.type, "run");
    assert.equal(envelope.key, "resume");
    assert.ok(envelope.data.request, "should have request");
    assert.ok(envelope.data.phase, "should have phase");
    assert.ok(envelope.data.progress, "should have progress");
    assert.ok(envelope.data.recommendedSkill, "should have recommendedSkill");
  });

  it("returns goal and scope extracted from spec.md", () => {
    tmp = createTmpDir();
    setupFlow(tmp);
    const result = execFileSync(
      "node", [FLOW_CMD, "resume"],
      { encoding: "utf8", env: { ...process.env, SDD_WORK_ROOT: tmp } },
    );
    const envelope = JSON.parse(result);
    assert.equal(envelope.data.goal, "Test goal content");
    assert.equal(envelope.data.scope, "Test scope content");
  });

  it("returns notes and requirements from flow state", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "001-test", {
      notes: ["decision A", "decision B"],
      requirements: [{ desc: "req 1", status: "pending" }],
    });
    const result = execFileSync(
      "node", [FLOW_CMD, "resume"],
      { encoding: "utf8", env: { ...process.env, SDD_WORK_ROOT: tmp } },
    );
    const envelope = JSON.parse(result);
    assert.deepEqual(envelope.data.notes, ["decision A", "decision B"]);
    assert.equal(envelope.data.requirements.length, 1);
  });

  it("returns error envelope when no flow exists", () => {
    tmp = createTmpDir();
    try {
      execFileSync(
        "node", [FLOW_CMD, "resume"],
        { encoding: "utf8", env: { ...process.env, SDD_WORK_ROOT: tmp } },
      );
      assert.fail("should exit non-zero");
    } catch (err) {
      const envelope = JSON.parse(err.stdout);
      assert.equal(envelope.ok, false);
      assert.equal(envelope.data, null);
      assert.ok(envelope.errors.length > 0);
      assert.match(envelope.errors[0].messages[0], /no active flow/i);
    }
  });

  it("shows resume in flow --help output", () => {
    const result = execFileSync("node", [FLOW_CMD, "--help"], { encoding: "utf8" });
    assert.match(result, /resume/);
  });
});
