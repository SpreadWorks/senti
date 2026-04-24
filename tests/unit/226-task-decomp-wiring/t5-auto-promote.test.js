/**
 * tests/unit/226-task-decomp-wiring/t5-auto-promote.test.js
 *
 * Spec 226 / T-5: タスク遷移の自動化と auto-promote。
 * auto-promote 関数の単一性、sync 末尾と gate-impl post-hook の 2 箇所のみ
 * から呼ばれること、completeTask が auto-promote を呼ばないこと、全 task
 * done 時の flow-scope 遷移を検証する。
 *
 * REQ-4 / REQ-5 / REQ-7 に対応。
 */

import { describe, it } from "node:test";

describe("T-5: auto-promote function and callers", () => {
  it.todo("promoteNextPending is no-op when currentTaskId is non-null");
  it.todo("promoteNextPending selects first pending (forest leaf priority)");
  it.todo("promoteNextPending is no-op when tasks[] is empty (flat compatibility)");
  it.todo("promoteNextPending is no-op when all tasks are done");

  it.todo("sync-spec-tasks calls promoteNextPending at the end");
  it.todo("gate-impl PASS post-hook calls completeTask then promoteNextPending");
  it.todo("auto-promote is called from exactly 2 production sites (grep verification)");

  it.todo("completeTask does NOT call promoteNextPending (separation of concerns)");

  it.todo("get-next-action returns flow-scope finalize when all tasks done");
  it.todo("get-next-action keeps task-scope while pending tasks exist");
});
