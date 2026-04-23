/**
 * tests/unit/flow/run-reopen-draft.test.js
 *
 * Tests for REQ-4, REQ-5 (spec 215): `sdd-forge flow reopen-draft` CLI.
 * Rewinds the draft step to in_progress when guard conditions pass:
 *   - flow.json has at least one task with status='done'
 *   - lifecycle is still 'active' (not 'finalizing' or later)
 * Records the event in issue-log.json.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { setupFlow } from "../../helpers/flow-setup.js";
import { RunReopenDraftCommand } from "../../../src/flow/lib/run-reopen-draft.js";

function ctxFor(tmp, extra = {}) {
  return { root: tmp, config: {}, ...extra };
}

function markStep(state, id, status) {
  const s = state.steps.find((x) => x.id === id);
  if (s) s.status = status;
}

function writeFlowFile(tmp, state) {
  const p = path.join(tmp, state.spec.replace(/\/spec\.(json|md)$/, "/flow.json"));
  fs.writeFileSync(p, JSON.stringify(state, null, 2));
}

describe("RunReopenDraftCommand (REQ-4, REQ-5)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("REQ-4: rewinds draft step when done task exists and flow is active", async () => {
    tmp = createTmpDir();
    const state = setupFlow(tmp, {
      spec: "specs/215-flow-task-decomposition/spec.json",
      tasks: [
        { id: "T-1", spec: "x", origin: "plan", parent: null, status: "done", steps: [], requirements: [], summary: null },
      ],
    });
    // mark some early steps done
    markStep(state, "branch", "done");
    markStep(state, "draft", "done");
    markStep(state, "spec", "done");
    markStep(state, "gate", "done");
    markStep(state, "approval", "done");
    markStep(state, "implement", "in_progress");
    writeFlowFile(tmp, state);

    const cmd = new RunReopenDraftCommand();
    const result = await cmd.execute(ctxFor(tmp));
    assert.equal(result.ok, true);

    const flow = JSON.parse(fs.readFileSync(path.join(tmp, "specs/215-flow-task-decomposition/flow.json"), "utf8"));
    const draftStep = flow.steps.find((s) => s.id === "draft");
    assert.equal(draftStep.status, "in_progress");
    // issue-log should have an entry
    const logPath = path.join(tmp, "specs/215-flow-task-decomposition/issue-log.json");
    assert.ok(fs.existsSync(logPath), "issue-log.json should be created");
    const log = JSON.parse(fs.readFileSync(logPath, "utf8"));
    assert.ok(Array.isArray(log.entries) && log.entries.length > 0);
    assert.ok(log.entries[log.entries.length - 1].reason.includes("reopen-draft"));
  });

  it("REQ-5: rejects when no done task exists", async () => {
    tmp = createTmpDir();
    const state = setupFlow(tmp, {
      spec: "specs/215-flow-task-decomposition/spec.json",
      tasks: [
        { id: "T-1", spec: "x", origin: "plan", parent: null, status: "pending", steps: [], requirements: [], summary: null },
      ],
    });
    writeFlowFile(tmp, state);

    const cmd = new RunReopenDraftCommand();
    const result = await cmd.execute(ctxFor(tmp));
    assert.equal(result.ok, false);
    assert.ok(JSON.stringify(result.errors).includes("no done task"));
  });

  it("REQ-5: rejects when lifecycle is finalizing or later", async () => {
    tmp = createTmpDir();
    const state = setupFlow(tmp, {
      spec: "specs/215-flow-task-decomposition/spec.json",
      lifecycle: "finalizing",
      tasks: [
        { id: "T-1", spec: "x", origin: "plan", parent: null, status: "done", steps: [], requirements: [], summary: null },
      ],
    });
    writeFlowFile(tmp, state);

    const cmd = new RunReopenDraftCommand();
    const result = await cmd.execute(ctxFor(tmp));
    assert.equal(result.ok, false);
    assert.ok(JSON.stringify(result.errors).includes("finalizing") || JSON.stringify(result.errors).includes("lifecycle"));
  });

  it("REQ-5: rejects when tasks[] is empty", async () => {
    tmp = createTmpDir();
    const state = setupFlow(tmp, {
      spec: "specs/215-flow-task-decomposition/spec.json",
      tasks: [],
    });
    writeFlowFile(tmp, state);

    const cmd = new RunReopenDraftCommand();
    const result = await cmd.execute(ctxFor(tmp));
    assert.equal(result.ok, false);
  });
});
