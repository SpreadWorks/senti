/**
 * tests/unit/226-task-decomp-wiring/t1-entry-enforcement.test.js
 *
 * Spec 226 / T-1: タスク必須化の入口強制。
 * guardrail (task-single-responsibility) の追加、plan prompts (spec.md,
 * draft.md) の強化、spec gate の structural check 層への tasks 空 FAIL 判定
 * 追加、を検証する。
 *
 * REQ-1 / REQ-12 / REQ-13 / REQ-14 に対応。
 */

import { describe, it } from "node:test";

describe("T-1: entry enforcement (guardrail + prompts + spec gate tasks check)", () => {
  it.todo("guardrail.json includes task-single-responsibility with phase=[spec, task-spec]");
  it.todo("plan/spec.md prompt contains Task Decomposition Rules markers");
  it.todo("plan/draft.md prompt contains concern-based decomposition notice");
  it.todo("spec gate structural check rejects spec.json with empty tasks[]");
  it.todo("spec gate structural check rejects spec.json with undefined tasks");
  it.todo("spec gate accepts spec.json with non-empty tasks[]");
  it.todo("existing spec.json (tasks undefined) is still valid under JSON schema");
});
