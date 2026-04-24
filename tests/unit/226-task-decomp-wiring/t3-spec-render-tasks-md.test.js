/**
 * tests/unit/226-task-decomp-wiring/t3-spec-render-tasks-md.test.js
 *
 * Spec 226 / T-3: spec render による tasks/<id>.md 自動生成。
 *
 * REQ-10 / REQ-11 に対応。
 */

import { describe, it } from "node:test";

describe("T-3: spec render generates tasks/<id>.md", () => {
  it.todo("generates tasks/<id>.md for each task in spec.json");
  it.todo("markdown contains Goal / Acceptance / Implementation Notes / Test Strategy sections");
  it.todo("markdown is deterministic (idempotent across re-renders)");
  it.todo("markdown contains manual-edit-forbidden marker");
  it.todo("spec.md Tasks section shows summary (title + goal) per task");
  it.todo("render is additive-only (orphan md files are not deleted)");
  it.todo("render creates tasks/ directory if not exists");
});
