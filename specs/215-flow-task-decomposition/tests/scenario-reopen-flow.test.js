/**
 * specs/215-flow-task-decomposition/tests/scenario-reopen-flow.test.js
 *
 * Spec-specific acceptance test for REQ-12:
 * Scenario: plan phase で tasks 2 件定義 → approval → 実装中に 1 件 done 化
 *           → reopen-draft CLI → spec.json に 1 件追記 → 再 approval
 *           → flow.json.tasks[] が 3 件、既存 2 件の status が保持される
 *
 * Uses the direct module API (not CLI spawn) to keep the test fast and
 * isolated from global sdd-forge installation.
 *
 * This is a spec verification test; placed under specs/<spec>/tests/
 * (not run by default `npm test`).
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { setupFlow } from "../../../tests/helpers/flow-setup.js";
import { syncSpecTasksToFlow } from "../../../src/flow/lib/sync-spec-tasks.js";
import { checkTasksMonotonic } from "../../../src/flow/lib/check-tasks-monotonic.js";
import { RunReopenDraftCommand } from "../../../src/flow/lib/run-reopen-draft.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SPEC_REL = "specs/215-flow-task-decomposition/spec.json";

function writeSpecJson(tmp, tasks) {
  const p = path.join(tmp, SPEC_REL);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify({
    goal: "", scope: { in: [], out: [] }, constraints: [], design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    background: "", requirements: [], acceptance_criteria: [],
    clarifications: [], alternatives_considered: [], open_questions: [],
    tasks,
  }, null, 2));
}

function loadFlow(tmp) {
  const p = path.join(tmp, "specs/215-flow-task-decomposition/flow.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeFlow(tmp, state) {
  const p = path.join(tmp, "specs/215-flow-task-decomposition/flow.json");
  fs.writeFileSync(p, JSON.stringify(state, null, 2));
}

describe("spec 215 scenario: draft-return round trip (REQ-12)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("plan→approval→impl→reopen→append→reapprove yields 3 tasks with original 2 preserved", async () => {
    tmp = createTmpDir();

    // 1. plan フェーズ: 2 件の task を spec.json に定義
    setupFlow(tmp, { spec: SPEC_REL });
    writeSpecJson(tmp, [
      { id: "T-1", title: "Schema", description: "", origin: "plan", added_round: 0, status: "pending" },
      { id: "T-2", title: "CLI",    description: "", origin: "plan", added_round: 0, status: "pending" },
    ]);

    // 2. 1st approval: monotonic check passes (flow.tasks empty → no-op)
    const specRead1 = JSON.parse(fs.readFileSync(path.join(tmp, SPEC_REL), "utf8"));
    const pre1 = loadFlow(tmp);
    assert.deepEqual(
      checkTasksMonotonic({ flowTasks: pre1.tasks, specTasks: specRead1.tasks }),
      [],
      "1st approval monotonic check should pass",
    );

    // 2.1. approval post-hook: sync spec→flow
    const sync1 = syncSpecTasksToFlow({ root: tmp });
    assert.deepEqual(sync1.added, ["T-1", "T-2"]);
    const flow1 = loadFlow(tmp);
    assert.equal(flow1.tasks.length, 2);

    // 3. impl フェーズ: T-1 を done にする
    const flow1m = loadFlow(tmp);
    flow1m.tasks[0].status = "done";
    writeFlow(tmp, flow1m);

    // 4. reopen-draft CLI
    const reopenCmd = new RunReopenDraftCommand();
    const reopenResult = await reopenCmd.execute({ root: tmp, config: {} });
    assert.equal(reopenResult.ok, true, `reopen-draft failed: ${JSON.stringify(reopenResult.errors)}`);

    // 5. spec.json に 1 件追記 (added_round = 1)
    writeSpecJson(tmp, [
      { id: "T-1", title: "Schema", description: "", origin: "plan", added_round: 0, status: "done" },
      { id: "T-2", title: "CLI",    description: "", origin: "plan", added_round: 0, status: "pending" },
      { id: "T-3", title: "Review", description: "", origin: "plan", added_round: 1, status: "pending" },
    ]);

    // 6. 2nd approval: monotonic check passes
    const specRead2 = JSON.parse(fs.readFileSync(path.join(tmp, SPEC_REL), "utf8"));
    const pre2 = loadFlow(tmp);
    const issues2 = checkTasksMonotonic({ flowTasks: pre2.tasks, specTasks: specRead2.tasks });
    assert.deepEqual(issues2, [], `2nd approval monotonic issues: ${issues2.join("; ")}`);

    // 6.1. approval post-hook: sync only new task
    const sync2 = syncSpecTasksToFlow({ root: tmp });
    assert.deepEqual(sync2.added, ["T-3"], "only T-3 should be newly added");

    // 7. 検証: flow.json.tasks[] が 3 件、既存 2 件の status は保持
    const flow2 = loadFlow(tmp);
    assert.equal(flow2.tasks.length, 3, "flow should have 3 tasks");
    assert.equal(flow2.tasks[0].id, "T-1");
    assert.equal(flow2.tasks[0].status, "done", "T-1 must remain done");
    assert.equal(flow2.tasks[1].id, "T-2");
    assert.equal(flow2.tasks[1].status, "pending");
    assert.equal(flow2.tasks[2].id, "T-3");
    assert.equal(flow2.tasks[2].added_round, 1);

    // 8. issue-log.json should have the reopen entry
    const logPath = path.join(tmp, "specs/215-flow-task-decomposition/issue-log.json");
    assert.ok(fs.existsSync(logPath));
    const log = JSON.parse(fs.readFileSync(logPath, "utf8"));
    assert.ok(log.entries.some((e) => /reopen-draft/.test(e.reason)));
  });

  it("rejects spec tampering: changing origin of a done task", () => {
    tmp = createTmpDir();
    setupFlow(tmp, {
      spec: SPEC_REL,
      tasks: [{
        id: "T-1", spec: "x", origin: "plan", parent: null,
        status: "done", steps: [], requirements: [], summary: null, added_round: 0,
      }],
    });
    writeSpecJson(tmp, [
      { id: "T-1", title: "x", origin: "integration", added_round: 0, status: "done" },
    ]);
    const flow = loadFlow(tmp);
    const spec = JSON.parse(fs.readFileSync(path.join(tmp, SPEC_REL), "utf8"));
    const issues = checkTasksMonotonic({ flowTasks: flow.tasks, specTasks: spec.tasks });
    assert.ok(issues.some((i) => /T-1/.test(i) && /origin/.test(i)));
  });
});
