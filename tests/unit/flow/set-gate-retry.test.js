/**
 * tests/unit/flow/set-gate-retry.test.js
 *
 * Tests for `flow set gate-retry reset <phase> --yes` — the CLI path that
 * lets users clear a phase's gateRetry counter after addressing the root
 * cause, without hand-editing flow.json. (spec 209 / REQ-1..REQ-5)
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { join } from "path";
import { makeFlowManager, makeFlowState } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { countGateRetry } from "../../../src/flow/lib/run-gate.js";

const FLOW_CMD = join(process.cwd(), "src/flow.js");

function setupFlowState(dir) {
  const specId = "001-test";
  const state = makeFlowState({ spec: `specs/${specId}/spec.md` });
  makeFlowManager(dir).save(state);
  makeFlowManager(dir).addActiveFlow(specId, "local");
}

function runCli(args, tmp, opts = {}) {
  return execFileSync("node", [FLOW_CMD, ...args], {
    encoding: "utf8",
    env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });
}

describe("flow set gate-retry reset", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("appends a reset metric entry for task-impl with --yes (REQ-1)", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const stdout = runCli(["set", "gate-retry", "reset", "task-impl", "--yes"], tmp);
    const envelope = JSON.parse(stdout);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.type, "set");
    assert.equal(envelope.key, "gate-retry");

    const loaded = makeFlowManager(tmp).load();
    assert.equal(loaded.metrics.length, 1);
    const entry = loaded.metrics[0];
    assert.equal(entry.phase, "task-impl");
    assert.equal(entry.counter, "gateRetry");
    assert.equal(entry.delta, 0);
    assert.equal(entry.reset, true);
  });

  it("appends a reset metric entry for integration with --yes (REQ-1)", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    runCli(["set", "gate-retry", "reset", "integration", "--yes"], tmp);
    const loaded = makeFlowManager(tmp).load();
    assert.equal(loaded.metrics[0].phase, "integration");
    assert.equal(loaded.metrics[0].reset, true);
  });

  it("rejects a non-tracked phase (REQ-2)", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    assert.throws(() =>
      runCli(["set", "gate-retry", "reset", "draft", "--yes"], tmp, { stdio: "pipe" }),
    );
  });

  it("rejects invocation without --yes and reports the current count (REQ-3)", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    // seed a non-zero count so the reporter has something to print.
    const mgr = makeFlowManager(tmp);
    const state = mgr.load();
    state.metrics = [
      { phase: "task-impl", counter: "gateRetry", delta: 1, ts: "2026-04-21T00:00:00.000Z", taskId: null },
      { phase: "task-impl", counter: "gateRetry", delta: 1, ts: "2026-04-21T00:00:01.000Z", taskId: null },
    ];
    mgr.save(state);

    let err;
    try {
      runCli(["set", "gate-retry", "reset", "task-impl"], tmp, { stdio: "pipe" });
    } catch (e) {
      err = e;
    }
    assert.ok(err, "expected non-zero exit");
    const stderr = err.stderr?.toString() || "";
    assert.match(stderr, /--yes/);
    assert.match(stderr, /task-impl/);
    assert.match(stderr, /2/);
  });

  it("rejects unknown action values (REQ-4)", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    assert.throws(() =>
      runCli(["set", "gate-retry", "show", "task-impl", "--yes"], tmp, { stdio: "pipe" }),
    );
  });

  it("leaves countGateRetry at 0 after reset (REQ-5)", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const mgr = makeFlowManager(tmp);
    const state = mgr.load();
    state.metrics = [
      { phase: "task-impl", counter: "gateRetry", delta: 1, ts: "2026-04-21T00:00:00.000Z", taskId: null },
      { phase: "task-impl", counter: "gateRetry", delta: 1, ts: "2026-04-21T00:00:01.000Z", taskId: null },
      { phase: "task-impl", counter: "gateRetry", delta: 1, ts: "2026-04-21T00:00:02.000Z", taskId: null },
    ];
    mgr.save(state);
    assert.equal(countGateRetry(state.metrics, "task-impl"), 3);

    runCli(["set", "gate-retry", "reset", "task-impl", "--yes"], tmp);
    const loaded = mgr.load();
    assert.equal(countGateRetry(loaded.metrics, "task-impl"), 0);
  });
});
