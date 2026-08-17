/**
 * spec 156: gate draft format detection pattern relaxation
 *
 * Tests that checkDraftText() accepts both ## heading format and key: colon format
 * for 開発種別 (Development Type) and 目的 (Goal).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { checkDraftText } from "../../../src/flow/lib/run-gate.js";

// Minimal valid draft body helper
function makeDraft({ devType, goal }) {
  return [
    devType,
    "",
    goal,
    "",
    "## Q&A",
    "",
    "Q: something?",
    "A: something.",
    "",
    "- [x] User approved this draft",
  ].join("\n");
}

// ─── 開発種別 / Development Type ─────────────────────────────────────────────

test("開発種別: colon format (existing) → PASS", () => {
  const text = makeDraft({ devType: "**開発種別:** バグ修正", goal: "**目的:** テスト" });
  assert.deepStrictEqual(checkDraftText(text), []);
});

test("Development Type: colon format (existing) → PASS", () => {
  const text = makeDraft({ devType: "**Development Type:** Bug Fix", goal: "**Goal:** Test" });
  assert.deepStrictEqual(checkDraftText(text), []);
});

test("開発種別: heading format → PASS", () => {
  const text = makeDraft({ devType: "## 開発種別", goal: "**目的:** テスト" });
  const issues = checkDraftText(text);
  assert.ok(!issues.some((i) => i.includes("開発種別") || i.includes("development type")),
    `Expected no devType issue, got: ${JSON.stringify(issues)}`);
});

test("Development Type: heading format → PASS", () => {
  const text = makeDraft({ devType: "## Development Type", goal: "**Goal:** Test" });
  const issues = checkDraftText(text);
  assert.ok(!issues.some((i) => i.includes("開発種別") || i.includes("development type")),
    `Expected no devType issue, got: ${JSON.stringify(issues)}`);
});

// ─── 目的 / Goal ──────────────────────────────────────────────────────────────

test("目的: colon format (existing) → PASS", () => {
  const text = makeDraft({ devType: "**開発種別:** バグ修正", goal: "**目的:** テスト" });
  assert.deepStrictEqual(checkDraftText(text), []);
});

test("Goal: colon format (existing) → PASS", () => {
  const text = makeDraft({ devType: "**Development Type:** Bug Fix", goal: "**Goal:** Test" });
  assert.deepStrictEqual(checkDraftText(text), []);
});

test("目的: heading format → PASS", () => {
  const text = makeDraft({ devType: "**開発種別:** バグ修正", goal: "## 目的" });
  const issues = checkDraftText(text);
  assert.ok(!issues.some((i) => i.includes("目的") || i.includes("goal")),
    `Expected no goal issue, got: ${JSON.stringify(issues)}`);
});

test("Goal: heading format → PASS", () => {
  const text = makeDraft({ devType: "**Development Type:** Bug Fix", goal: "## Goal" });
  const issues = checkDraftText(text);
  assert.ok(!issues.some((i) => i.includes("目的") || i.includes("goal")),
    `Expected no goal issue, got: ${JSON.stringify(issues)}`);
});

// ─── Both heading format ──────────────────────────────────────────────────────

test("Both fields in heading format → PASS (no devType/goal issues)", () => {
  const text = makeDraft({ devType: "## 開発種別", goal: "## 目的" });
  const issues = checkDraftText(text);
  const devTypeIssues = issues.filter((i) => i.includes("開発種別") || i.includes("development type"));
  const goalIssues = issues.filter((i) => i.includes("目的") || i.includes("goal"));
  assert.deepStrictEqual(devTypeIssues, []);
  assert.deepStrictEqual(goalIssues, []);
});

// ─── Missing fields still FAIL ────────────────────────────────────────────────

test("Missing 開発種別 entirely → FAIL with devType issue", () => {
  const text = makeDraft({ devType: "", goal: "**目的:** テスト" });
  const issues = checkDraftText(text);
  assert.ok(issues.some((i) => i.includes("開発種別")),
    `Expected devType issue, got: ${JSON.stringify(issues)}`);
});

test("Missing 目的 entirely → FAIL with goal issue", () => {
  const text = makeDraft({ devType: "**開発種別:** バグ修正", goal: "" });
  const issues = checkDraftText(text);
  assert.ok(issues.some((i) => i.includes("目的")),
    `Expected goal issue, got: ${JSON.stringify(issues)}`);
});
