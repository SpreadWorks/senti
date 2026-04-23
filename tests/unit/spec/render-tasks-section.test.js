/**
 * tests/unit/spec/render-tasks-section.test.js
 *
 * Tests for REQ-9 (spec 215): spec render の Tasks セクション出力。
 * tasks[] が存在する時は `## Tasks` セクションを round 別 subheading
 * (### Round N) で出力し、空または未定義の時は出力しない。
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderSpecMarkdown } from "../../../src/spec/commands/render.js";

function minSpec(tasks) {
  return {
    goal: "", scope: { in: [], out: [] }, constraints: [], design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    background: "", requirements: [], acceptance_criteria: [],
    clarifications: [], alternatives_considered: [], open_questions: [],
    ...(tasks !== undefined ? { tasks } : {}),
  };
}

const meta = { title: "test", featureBranch: "feature/test", created: "2026-04-23" };

describe("render.js Tasks section (REQ-9)", () => {
  it("omits Tasks section when tasks[] is empty", () => {
    const md = renderSpecMarkdown(minSpec([]), meta);
    assert.ok(!md.includes("## Tasks"));
  });

  it("omits Tasks section when tasks field is missing", () => {
    const md = renderSpecMarkdown(minSpec(undefined), meta);
    assert.ok(!md.includes("## Tasks"));
  });

  it("renders Round 0 when all tasks are round 0", () => {
    const md = renderSpecMarkdown(minSpec([
      { id: "T-1", title: "First", description: "", origin: "plan", added_round: 0, status: "pending" },
      { id: "T-2", title: "Second", description: "", origin: "plan", added_round: 0, status: "done" },
    ]), meta);
    assert.ok(md.includes("## Tasks"));
    assert.ok(md.includes("### Round 0"));
    assert.ok(md.includes("**T-1** [pending]: First"));
    assert.ok(md.includes("**T-2** [done]: Second"));
  });

  it("renders multiple rounds in ascending order", () => {
    const md = renderSpecMarkdown(minSpec([
      { id: "T-3", title: "Third", origin: "plan", added_round: 2, status: "pending" },
      { id: "T-1", title: "First", origin: "plan", added_round: 0, status: "done" },
      { id: "T-2", title: "Second", origin: "plan", added_round: 1, status: "pending" },
    ]), meta);
    const r0 = md.indexOf("### Round 0");
    const r1 = md.indexOf("### Round 1");
    const r2 = md.indexOf("### Round 2");
    assert.ok(r0 > 0 && r1 > r0 && r2 > r1, "rounds should be in ascending order");
  });

  it("includes description when present", () => {
    const md = renderSpecMarkdown(minSpec([
      { id: "T-1", title: "x", description: "long desc", origin: "plan", added_round: 0, status: "pending" },
    ]), meta);
    assert.ok(md.includes("long desc"));
  });
});
