/**
 * tests/integration/flow/prompt-impl-finalize.test.js
 *
 * Tests for impl/finalize prompt kind updates.
 */

import { describe, it, afterEach } from "node:test";
import { CanonicalFlowFixture, makeFlowManager } from "../../support/infrastructure/flow-setup.js";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { join } from "path";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";
const FLOW_CMD = join(process.cwd(), "src/flow.js");

function setupFlowState(dir) {
  const specId = "001-test";
  new CanonicalFlowFixture({
    flowManager: makeFlowManager(dir), specId, runId: `run-${specId}`,
  }).create().registerActive();
}

describe("flow get prompt impl.review-mode (reworked)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns 3 choices: auto-fix, review-only, skip", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const result = execFileSync(
      "node", [FLOW_CMD, "get", "prompt", "impl.review-mode"],
      { encoding: "utf8", env: { ...process.env, SENNEL_WORK_ROOT: tmp } },
    );
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.choices.length, 3);
  });

  it("does not contain old labels (はい/スキップ)", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const result = execFileSync(
      "node", [FLOW_CMD, "get", "prompt", "impl.review-mode"],
      { encoding: "utf8", env: { ...process.env, SENNEL_WORK_ROOT: tmp } },
    );
    const envelope = JSON.parse(result);
    const labels = envelope.data.choices.map((c) => c.label);
    for (const label of labels) {
      assert.ok(label !== "はい", `should not contain old label: はい`);
      assert.ok(label !== "スキップ", `should not contain old label: スキップ`);
    }
  });
});

describe("flow get prompt impl.confirmation (reworked)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns 4 choices: approve, overview, detail, other", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const result = execFileSync(
      "node", [FLOW_CMD, "get", "prompt", "impl.confirmation"],
      { encoding: "utf8", env: { ...process.env, SENNEL_WORK_ROOT: tmp } },
    );
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.choices.length, 4);
  });

  it("does not contain old labels (終了処理を開始する)", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const result = execFileSync(
      "node", [FLOW_CMD, "get", "prompt", "impl.confirmation"],
      { encoding: "utf8", env: { ...process.env, SENNEL_WORK_ROOT: tmp } },
    );
    const envelope = JSON.parse(result);
    const labels = envelope.data.choices.map((c) => c.label);
    for (const label of labels) {
      assert.ok(!label.includes("終了処理"), `should not contain old label: ${label}`);
    }
  });
});

describe("flow get prompt finalize.mode (description added)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("each choice has a non-empty description", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const result = execFileSync(
      "node", [FLOW_CMD, "get", "prompt", "finalize.mode"],
      { encoding: "utf8", env: { ...process.env, SENNEL_WORK_ROOT: tmp } },
    );
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    for (const choice of envelope.data.choices) {
      assert.ok(choice.description.length > 0, `choice ${choice.id} should have description`);
    }
  });
});
