import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderSpecMarkdown } from "../../../src/spec/commands/render.js";

const IMPL_TARGETS_HEADING = "## Implementation Targets";
const OPEN_QUESTIONS_HEADING = "## Open Questions";
const ACCEPTANCE_HEADING = "## Acceptance Criteria";

function sectionBetween(md, fromHeading, toHeading) {
  return md.slice(md.indexOf(fromHeading), md.indexOf(toHeading));
}

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
      modules: [{ text: "src/spec/commands/render.js" }],
      data_flow: [{ text: "spec.json -> render -> spec.md" }],
      decisions: [{ text: "Section order matches existing skeleton." }],
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

  it("renders Implementation Targets section with each entry as bullet", () => {
    const spec = sampleSpec();
    spec.implementationTargets = ["src/foo.js", "tests/foo.test.js"];
    const md = renderSpecMarkdown(spec, sampleMeta());
    const section = sectionBetween(md, IMPL_TARGETS_HEADING, OPEN_QUESTIONS_HEADING);
    assert.ok(section.includes("- src/foo.js"));
    assert.ok(section.includes("- tests/foo.test.js"));
  });

  for (const [label, value] of [
    ["empty array", []],
    ["undefined", undefined],
  ]) {
    it(`emits Implementation Targets section with placeholder when ${label}`, () => {
      const spec = sampleSpec();
      if (value === undefined) delete spec.implementationTargets;
      else spec.implementationTargets = value;
      const md = renderSpecMarkdown(spec, sampleMeta());
      assert.ok(md.includes(IMPL_TARGETS_HEADING));
      const section = sectionBetween(md, IMPL_TARGETS_HEADING, OPEN_QUESTIONS_HEADING);
      assert.match(section, /## Implementation Targets\n-\n/);
    });
  }

  it("renders overview entries as bullets using the text field (spec 207)", () => {
    const md = renderSpecMarkdown(sampleSpec(), sampleMeta());
    const overviewSection = md.slice(md.indexOf("## Overview"), md.indexOf("## Clarifications"));
    assert.ok(overviewSection.includes("- src/spec/commands/render.js"));
    assert.ok(overviewSection.includes("- spec.json -> render -> spec.md"));
    assert.ok(overviewSection.includes("- Section order matches existing skeleton."));
    assert.ok(!overviewSection.includes("[object Object]"), "rendered bullet should not stringify the raw object");
  });

  it("does not expose added_by_task in rendered markdown (spec 207)", () => {
    const spec = sampleSpec();
    spec.overview.modules = [{ text: "src/x.js", added_by_task: "T7" }];
    const md = renderSpecMarkdown(spec, sampleMeta());
    assert.ok(!md.includes("added_by_task"), "added_by_task is metadata, not rendered");
    assert.ok(!md.includes("T7"), "task id should not leak into rendered markdown");
  });

  it("places Implementation Targets after Acceptance Criteria and before Open Questions", () => {
    const md = renderSpecMarkdown(sampleSpec(), sampleMeta());
    const acceptance = md.indexOf(ACCEPTANCE_HEADING);
    const implTargets = md.indexOf(IMPL_TARGETS_HEADING);
    const openQuestions = md.indexOf(OPEN_QUESTIONS_HEADING);
    assert.ok(acceptance >= 0, `${ACCEPTANCE_HEADING} missing`);
    assert.ok(implTargets >= 0, `${IMPL_TARGETS_HEADING} missing`);
    assert.ok(openQuestions >= 0, `${OPEN_QUESTIONS_HEADING} missing`);
    assert.ok(acceptance < implTargets);
    assert.ok(implTargets < openQuestions);
  });
});
