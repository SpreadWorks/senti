/**
 * tests/unit/flow/get-status.test.js
 *
 * Tests for `flow get status` — returns flow state as JSON envelope.
 */

import { describe, it, afterEach } from "node:test";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { join } from "path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { buildInitialSteps, FLOW_STEPS } from "../../../src/lib/flow-helpers.js";
const FLOW_CMD = join(process.cwd(), "src/sdd-forge.js");
const FLOW_CMD_ARGS_PREFIX = ["flow"];

describe("flow get status", () => {
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
    makeFlowManager(dir).save(state);
    makeFlowManager(dir).addActiveFlow(specId, "local");
    return state;
  }

  it("returns JSON envelope with ok: true", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "get", "status"], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
    });
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.type, "get");
    assert.equal(envelope.key, "status");
    assert.ok(envelope.data.spec);
    assert.ok(Array.isArray(envelope.data.steps));
  });

  it("returns ok: true with active: false when no active flow", () => {
    tmp = createTmpDir();
    const result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "get", "status"], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
    });
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.type, "get");
    assert.equal(envelope.key, "status");
    assert.equal(envelope.data.active, false);
  });

  it("returns active: true when a flow exists", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "get", "status"], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
    });
    const envelope = JSON.parse(result);
    assert.equal(envelope.data.active, true);
  });
});
