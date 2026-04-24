/**
 * tests/unit/226-task-decomp-wiring/t6-step-redesign-and-cli.test.js
 *
 * Spec 226 / T-6: task-scope step 再編と手動制御 CLI。
 * TASK_STEPS_PLAN を 7 → 5 step に再編、approval / task-spec gate /
 * update-overview 独立 step を削除、update-overview 機能を impl に統合、
 * start-task / complete-task CLI の追加を検証する。
 *
 * REQ-15 / REQ-16 / REQ-17 / REQ-18 / REQ-19 / REQ-20 に対応。
 */

import { describe, it } from "node:test";

describe("T-6: task-scope step redesign and manual control CLI", () => {
  // step redesign
  it.todo("TASK_STEPS_PLAN is [write-tests, impl, run-tests, review, gate-impl]");
  it.todo("buildInitialTaskSteps returns 5 steps matching TASK_STEPS_PLAN");
  it.todo("context-rules.json task scope has no approval/gate/update-overview entries");
  it.todo("context-rules.json task scope has gate-impl entry");

  // deleted prompts
  it.todo("src/flow/prompts/task/approval.md does not exist");
  it.todo("src/flow/prompts/task/gate.md does not exist");
  it.todo("src/flow/prompts/task/update-overview.md does not exist");

  // impl prompt has overview update directive
  it.todo("src/flow/prompts/task/impl.md contains overview update directive");

  // start-task CLI
  it.todo("start-task CLI sets currentTaskId to the specified task");
  it.todo("start-task CLI transitions task status to in_progress");
  it.todo("start-task CLI delegates validation to flow-store primitive (throws on unknown id)");
  it.todo("start-task CLI returns proper envelope shape");

  // complete-task CLI
  it.todo("complete-task CLI (no args) completes currentTaskId task");
  it.todo("complete-task CLI (with --task-id) completes specified task");
  it.todo("complete-task CLI invokes completeTask then promoteNextPending (in this order)");
  it.todo("complete-task CLI propagates to parent when all children done");
  it.todo("complete-task CLI is a thin wrapper (no validation duplication)");

  // impl overview update integration
  it.todo("impl step invokes applyOverviewAdditions via spec 207 helper");
  it.todo("impl overview update is performed in impl step (not as separate update-overview step)");
});
