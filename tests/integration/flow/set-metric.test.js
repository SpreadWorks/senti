/**
 * tests/integration/flow/set-metric.test.js
 *
 * Tests for `flow set metric` — appends an entry to the state.metrics
 * append-only array (cac6/T10).
 */

import { describe, it, afterEach } from "node:test";
import { CanonicalFlowFixture, makeFlowManager } from "../../support/infrastructure/flow-setup.js";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { join } from "path";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";

const FLOW_CMD = join(process.cwd(), "src/flow.js");

describe("flow set metric", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupFlowState(dir) {
    const specId = "001-test";
    new CanonicalFlowFixture({
      flowManager: makeFlowManager(dir), specId, runId: `run-${specId}`,
    }).create().registerActive();
  }

  it("appends a metric entry and returns JSON envelope", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const result = execFileSync(
      "node", [FLOW_CMD, "set", "metric", "draft", "question"],
      { encoding: "utf8", env: { ...process.env, SENNEL_WORK_ROOT: tmp } },
    );
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.type, "set");
    assert.equal(envelope.key, "metric");

    const loaded = makeFlowManager(tmp).load();
    assert.ok(Array.isArray(loaded.metrics));
    assert.equal(loaded.metrics.length, 1);
    assert.equal(loaded.metrics[0].phase, "draft");
    assert.equal(loaded.metrics[0].counter, "question");
    assert.equal(loaded.metrics[0].taskId, null);
  });

  it("appends multiple entries on repeated invocations", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    execFileSync(
      "node", [FLOW_CMD, "set", "metric", "draft", "question"],
      { encoding: "utf8", env: { ...process.env, SENNEL_WORK_ROOT: tmp } },
    );
    execFileSync(
      "node", [FLOW_CMD, "set", "metric", "draft", "question"],
      { encoding: "utf8", env: { ...process.env, SENNEL_WORK_ROOT: tmp } },
    );
    const loaded = makeFlowManager(tmp).load();
    assert.equal(loaded.metrics.length, 2);
  });

  it("supports all phase and counter combinations", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    execFileSync(
      "node", [FLOW_CMD, "set", "metric", "spec", "docsRead"],
      { encoding: "utf8", env: { ...process.env, SENNEL_WORK_ROOT: tmp } },
    );
    const loaded = makeFlowManager(tmp).load();
    assert.equal(loaded.metrics[0].phase, "spec");
    assert.equal(loaded.metrics[0].counter, "docsRead");
  });
});
