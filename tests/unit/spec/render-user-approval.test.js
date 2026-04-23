/**
 * tests/unit/spec/render-user-approval.test.js
 *
 * spec 221: spec.json の user_approval を renderer が読み出して
 * `## User Confirmation` セクションを生成することを検証する。
 * R1, R2, R3 に対応。
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderSpecMarkdown } from "../../../src/spec/commands/render.js";

function baseSpec(extras = {}) {
  return {
    goal: "g",
    background: "bg",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    clarifications: [],
    alternatives_considered: [],
    requirements: [],
    acceptance_criteria: [],
    open_questions: [],
    ...extras,
  };
}

const meta = {
  title: "221-persist-user-approval",
  featureBranch: "feature/221-persist-user-approval",
  created: "2026-04-23",
  status: "Draft",
  input: "GitHub Issue #244",
};

function userConfirmationSection(md) {
  const start = md.indexOf("## User Confirmation");
  assert.ok(start >= 0, "missing ## User Confirmation section");
  const end = md.indexOf("## Requirements", start);
  return md.slice(start, end);
}

describe("renderSpecMarkdown — user_approval (spec 221)", () => {
  it("R2: emits unapproved placeholder when user_approval is absent", () => {
    const md = renderSpecMarkdown(baseSpec(), meta);
    const section = userConfirmationSection(md);
    assert.match(section, /- \[ \] User approved this spec/);
    assert.match(section, /- Confirmed at:\s*\n/);
    assert.match(section, /- Notes:\s*\n/);
  });

  it("R2: emits unapproved placeholder when user_approval.approved is false", () => {
    const spec = baseSpec({ user_approval: { approved: false } });
    const md = renderSpecMarkdown(spec, meta);
    const section = userConfirmationSection(md);
    assert.match(section, /- \[ \] User approved this spec/);
    assert.match(section, /- Confirmed at:\s*\n/);
    assert.match(section, /- Notes:\s*\n/);
  });

  it("R3: emits checked marker with confirmed_at and notes when approved is true", () => {
    const spec = baseSpec({
      user_approval: {
        approved: true,
        confirmed_at: "2026-04-23T12:34:56.000Z",
        notes: "looks good",
      },
    });
    const md = renderSpecMarkdown(spec, meta);
    const section = userConfirmationSection(md);
    assert.match(section, /- \[x\] User approved this spec/);
    assert.ok(section.includes("- Confirmed at: 2026-04-23T12:34:56.000Z"));
    assert.ok(section.includes("- Notes: looks good"));
  });

  it("R3: emits checked marker with empty notes line when notes is unset", () => {
    const spec = baseSpec({
      user_approval: {
        approved: true,
        confirmed_at: "2026-04-23T00:00:00.000Z",
      },
    });
    const md = renderSpecMarkdown(spec, meta);
    const section = userConfirmationSection(md);
    assert.match(section, /- \[x\] User approved this spec/);
    assert.ok(section.includes("- Confirmed at: 2026-04-23T00:00:00.000Z"));
    assert.match(section, /- Notes:\s*\n/);
  });

  it("AC: rendering twice in a row produces byte-identical output (idempotent)", () => {
    const spec = baseSpec({
      user_approval: {
        approved: true,
        confirmed_at: "2026-04-23T11:11:11.111Z",
        notes: "ok",
      },
    });
    const a = renderSpecMarkdown(spec, meta);
    const b = renderSpecMarkdown(spec, meta);
    assert.equal(a, b);
  });
});
