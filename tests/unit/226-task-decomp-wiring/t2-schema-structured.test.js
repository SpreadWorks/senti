/**
 * tests/unit/226-task-decomp-wiring/t2-schema-structured.test.js
 *
 * Spec 226 / T-2: spec.json.tasks[*] スキーマの構造化。
 * description 削除、goal/acceptance/implementation_notes/test_strategy/parent
 * の追加を検証する。
 *
 * REQ-2 / REQ-3 / REQ-8 に対応。
 */

import { describe, it } from "node:test";

describe("T-2: spec.json tasks[*] schema restructuring", () => {
  it.todo("schema requires id, title, goal, origin, added_round, status");
  it.todo("schema does not include description in properties or required");
  it.todo("schema accepts acceptance as optional array of strings (max 500 each)");
  it.todo("schema accepts implementation_notes as optional string (max 5000)");
  it.todo("schema accepts test_strategy as optional string (max 2000)");
  it.todo("schema accepts parent as optional string or null");
  it.todo("schema rejects unknown fields (additionalProperties=false)");
  it.todo("schema validates existing 326 spec.json (tasks undefined) as valid");
});
