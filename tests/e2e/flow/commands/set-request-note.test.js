import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { execFileSync, spawnSync } from "child_process";
import { createTmpDir, removeTmpDir } from "../../../helpers/tmp-dir.js";
import { CanonicalFlowFixture, makeFlowManager } from "../../../helpers/flow-setup.js";
const FLOW_CMD = join(process.cwd(), "src/sennel.js");
const FLOW_CMD_ARGS_PREFIX = ["flow"];

function activeFixture(root) {
  const flowManager = makeFlowManager(root);
  return new CanonicalFlowFixture({ flowManager }).create().registerActive();
}

// ---------------------------------------------------------------------------
// flow set request / flow set note
// ---------------------------------------------------------------------------

describe("flow set request", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("rejects mutation of the immutable active Flow request", () => {
    tmp = createTmpDir();
    const fixture = activeFixture(tmp);
    const result = spawnSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "set", "request", "make a resume command"], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp },
    });
    assert.notEqual(result.status, 0, result.stderr);
    const envelope = JSON.parse(result.stdout);
    assert.equal(envelope.ok, false);
    assert.equal(envelope.errors[0].code, "REQUEST_IMMUTABLE");
    assert.equal(makeFlowManager(tmp).loadReadOnly().request, fixture.state().request);
  });

  it("saves request to a preparing flow with --run-id", () => {
    tmp = createTmpDir();
    const init = execFileSync("node", [
      FLOW_CMD,
      ...FLOW_CMD_ARGS_PREFIX,
      "set",
      "init",
      "--request",
      "thin request",
    ], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp },
    });
    const runId = JSON.parse(init).data.runId;

    execFileSync("node", [
      FLOW_CMD,
      ...FLOW_CMD_ARGS_PREFIX,
      "set",
      "request",
      "Goal: refined\nScope: bounded",
      "--run-id",
      runId,
    ], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp },
    });

    const updated = makeFlowManager(tmp).loadPreparingFlow(runId);
    assert.equal(updated.request, "Goal: refined\nScope: bounded");
  });
});

describe("flow set note", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("appends {taskId, text, ts} entry to state.notes", () => {
    tmp = createTmpDir();
    activeFixture(tmp);
    execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "set", "note", "draft: first note"], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp },
    });
    const updated = makeFlowManager(tmp).load();
    assert.equal(updated.notes.length, 1);
    assert.equal(updated.notes[0].text, "draft: first note");
    assert.equal(updated.notes[0].taskId, null);
    assert.ok(updated.notes[0].ts);
  });

  it("appends multiple notes in order", () => {
    tmp = createTmpDir();
    activeFixture(tmp);
    execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "set", "note", "first note"], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp },
    });
    execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "set", "note", "second note"], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp },
    });
    const updated = makeFlowManager(tmp).load();
    assert.equal(updated.notes.length, 2);
    assert.equal(updated.notes[0].text, "first note");
    assert.equal(updated.notes[1].text, "second note");
  });

  it("preserves the canonical notes collection contract", () => {
    tmp = createTmpDir();
    activeFixture(tmp);
    execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "set", "note", "new note"], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp },
    });
    const updated = makeFlowManager(tmp).load();
    assert.ok(Array.isArray(updated.notes));
    assert.equal(updated.notes.length, 1);
    assert.equal(updated.notes[0].text, "new note");
  });
});
