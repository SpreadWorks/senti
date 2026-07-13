/**
 * specs/207-unify-taskid-in-logs/tests/integration-task-lifecycle.test.js
 *
 * End-to-end: task creation → set metric (task scope) → completeTask
 *   → set metric (flow scope) → get status
 * Verifies that taskId is correctly preserved across lifecycle boundaries
 * and that metricsSummary partitions flow vs task scope.
 */
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

import { makeFlowManager, makeFlowState } from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "../../..");
const FLOW_CMD = path.join(REPO_ROOT, "src/flow.js");

function runCli(tmp, args) {
  return execFileSync(
    "node", [FLOW_CMD, ...args],
    { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp } },
  );
}

describe("task lifecycle: taskId across scope transitions", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("partitions metrics by task boundary and flow scope", () => {
    tmp = createTmpDir();
    const fm = makeFlowManager(tmp);
    fm.create(makeFlowState());
    fm.addActiveFlow("001-test", "local");

    // 1. Flow-scope metric (no task yet)
    fm.incrementMetric("draft", "question");

    // 2. Create task, metrics now task-scoped
    fm.addTask({
      id: "T1",
      spec: "x",
      origin: "plan",
      parent: null,
      status: "pending",
      steps: [{ id: "impl", status: "pending" }],
      requirements: [],
      summary: null,
    });
    fm.incrementMetric("impl", "srcRead");
    fm.incrementMetric("impl", "srcRead");

    // 3. Complete task → metrics back to flow scope
    fm.completeTask("T1");
    fm.incrementMetric("finalize", "question");

    // Verify raw entries preserve taskId across transitions
    const loaded = fm.load("001-test");
    assert.equal(loaded.metrics.length, 4);
    assert.equal(loaded.metrics[0].taskId, null);
    assert.equal(loaded.metrics[1].taskId, "T1");
    assert.equal(loaded.metrics[2].taskId, "T1");
    assert.equal(loaded.metrics[3].taskId, null);

    // Verify get status summary
    const out = runCli(tmp, ["get", "status"]);
    const { data } = JSON.parse(out);
    assert.equal(data.metricsSummary.flow.draft.question, 1);
    assert.equal(data.metricsSummary.flow.finalize.question, 1);
    assert.equal(data.metricsSummary.tasks.T1.impl.srcRead, 2);
    assert.equal(data.metricsSummary.total.impl.srcRead, 2);
    assert.equal(data.metricsSummary.total.draft.question, 1);
  });
});
