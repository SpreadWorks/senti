import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderSpecMarkdown } from "../../../src/spec/commands/render.js";

function sampleSpec() {
  return {
    goal: "Introduce spec.json schema and render command.",
    background: "Foundational work for cac6 T1.",
    scope: {
      in: ["Define schema.", "Add render command."],
      out: ["Replace existing spec.md read sites (T8)."],
    },
    constraints: ["No new external dependencies."],
    design_principles: ["Deterministic output."],
    overview: {
      modules: ["src/spec/commands/render.js"],
      data_flow: ["spec.json -> render -> spec.md"],
      decisions: ["Section order matches existing skeleton."],
    },
    clarifications: [
      { q: "How many fields?", a: "Eleven." },
    ],
    alternatives_considered: [
      { option: "Keep spec.md primary.", reason: "Rejected; conflicts with cac6 decision." },
    ],
    requirements: [
      { id: "R1", desc: "schema defines 11 fields", priority: "must", status: "pending" },
    ],
    acceptance_criteria: ["schema file exists"],
    open_questions: [],
  };
}

function sampleMeta() {
  return {
    title: "196-spec-json-schema-render",
    featureBranch: "feature/196-spec-json-schema-render",
    created: "2026-04-19",
    status: "Draft",
    input: "GitHub Issue #181",
  };
}

describe("renderSpecMarkdown", () => {
  it("produces a spec.md string with the H1 title", () => {
    const md = renderSpecMarkdown(sampleSpec(), sampleMeta());
    assert.match(md, /^# Feature Specification: 196-spec-json-schema-render/);
  });

  it("emits all required sections in the skeleton-compatible order", () => {
    const md = renderSpecMarkdown(sampleSpec(), sampleMeta());
    const indexOf = (heading) => md.indexOf(heading);
    const goal = indexOf("## Goal");
    const scope = indexOf("## Scope");
    const outOfScope = indexOf("## Out of Scope");
    const clarifications = indexOf("## Clarifications (Q&A)");
    const alternatives = indexOf("## Alternatives Considered");
    const userConfirmation = indexOf("## User Confirmation");
    const requirements = indexOf("## Requirements");
    const acceptance = indexOf("## Acceptance Criteria");
    const openQuestions = indexOf("## Open Questions");

    for (const [name, pos] of Object.entries({
      goal, scope, outOfScope, clarifications, alternatives,
      userConfirmation, requirements, acceptance, openQuestions,
    })) {
      assert.ok(pos >= 0, `${name} section missing`);
    }

    // Existing skeleton order must be preserved.
    assert.ok(goal < scope);
    assert.ok(scope < outOfScope);
    assert.ok(outOfScope < clarifications);
    assert.ok(clarifications < alternatives);
    assert.ok(alternatives < userConfirmation);
    assert.ok(userConfirmation < requirements);
    assert.ok(requirements < acceptance);
    assert.ok(acceptance < openQuestions);
  });

  it("emits cac6 additional sections (Background, Constraints, Design Principles, Overview)", () => {
    const md = renderSpecMarkdown(sampleSpec(), sampleMeta());
    assert.ok(md.includes("## Background"));
    assert.ok(md.includes("## Constraints"));
    assert.ok(md.includes("## Design Principles"));
    assert.ok(md.includes("## Overview"));
  });

  it("is deterministic (same input produces byte-identical output)", () => {
    const spec = sampleSpec();
    const meta = sampleMeta();
    const a = renderSpecMarkdown(spec, meta);
    const b = renderSpecMarkdown(spec, meta);
    assert.equal(a, b);
  });

  it("does not embed a timestamp other than the provided meta.created", () => {
    const md = renderSpecMarkdown(sampleSpec(), sampleMeta());
    const matches = md.match(/\d{4}-\d{2}-\d{2}/g) || [];
    for (const m of matches) {
      assert.equal(m, "2026-04-19", `unexpected date ${m} in output`);
    }
  });

  it("renders requirements with id, priority and desc", () => {
    const md = renderSpecMarkdown(sampleSpec(), sampleMeta());
    assert.ok(md.includes("R1"));
    assert.ok(md.includes("schema defines 11 fields"));
  });

  it("renders clarifications as Q/A pairs", () => {
    const md = renderSpecMarkdown(sampleSpec(), sampleMeta());
    assert.ok(md.includes("How many fields?"));
    assert.ok(md.includes("Eleven"));
  });

  it("renders alternatives as option/reason pairs", () => {
    const md = renderSpecMarkdown(sampleSpec(), sampleMeta());
    assert.ok(md.includes("Keep spec.md primary"));
    assert.ok(md.includes("Rejected"));
  });

  it("emits Scope with in entries and Out of Scope with out entries", () => {
    const md = renderSpecMarkdown(sampleSpec(), sampleMeta());
    const scopeSection = md.slice(md.indexOf("## Scope"), md.indexOf("## Out of Scope"));
    assert.ok(scopeSection.includes("Define schema."));
    const outSection = md.slice(md.indexOf("## Out of Scope"), md.indexOf("## Constraints"));
    assert.ok(outSection.includes("Replace existing spec.md read sites (T8)."));
  });
});
