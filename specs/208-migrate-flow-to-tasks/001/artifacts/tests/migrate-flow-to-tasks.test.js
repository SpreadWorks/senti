import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  migrateFlowJson,
  migrateSpecMd,
  parseSpecMd,
  EMPTY_SPEC_DEFAULTS,
} from "../migrate-flow-to-tasks.js";

describe("migrateFlowJson", () => {
  it("adds tasks and currentTaskId when absent", () => {
    const legacy = {
      spec: "specs/xxx/spec.md",
      baseBranch: "main",
      steps: [{ id: "branch", status: "done" }],
    };
    const { state, changed } = migrateFlowJson(legacy);
    assert.deepEqual(state.tasks, []);
    assert.equal(state.currentTaskId, null);
    assert.deepEqual(state.steps, legacy.steps, "flat steps untouched");
    assert.equal(changed, true);
  });

  it("is idempotent on already-migrated flow", () => {
    const migrated = {
      spec: "specs/xxx/spec.md",
      tasks: [],
      currentTaskId: null,
      notes: [{ taskId: null, text: "x", ts: "2026-01-01T00:00:00.000Z" }],
      metrics: [{ phase: "draft", counter: "q", value: 1, taskId: null, ts: "2026-01-01T00:00:00.000Z" }],
    };
    const { state, changed } = migrateFlowJson(migrated);
    assert.equal(changed, false, "already-new shape should be no-op");
    assert.deepEqual(state, migrated);
  });

  it("converts notes: string[] to object entries", () => {
    const legacy = {
      tasks: undefined,
      notes: ["note A", "note B"],
    };
    const { state } = migrateFlowJson(legacy);
    assert.equal(state.notes.length, 2);
    for (const n of state.notes) {
      assert.equal(n.taskId, null);
      assert.ok(typeof n.text === "string");
      assert.ok(typeof n.ts === "string");
    }
    assert.equal(state.notes[0].text, "note A");
  });

  it("converts metrics dict to entry array", () => {
    const legacy = {
      metrics: {
        draft: { question: 3, docsRead: 1 },
        impl: { commits: 2 },
      },
    };
    const { state } = migrateFlowJson(legacy);
    assert.ok(Array.isArray(state.metrics));
    const draftQ = state.metrics.find(
      (e) => e.phase === "draft" && e.counter === "question",
    );
    assert.equal(draftQ.value, 3);
    assert.equal(draftQ.taskId, null);
    const implC = state.metrics.find(
      (e) => e.phase === "impl" && e.counter === "commits",
    );
    assert.equal(implC.value, 2);
  });

  it("preserves existing T10-shape notes and metrics", () => {
    const newShapeNote = { taskId: null, text: "kept", ts: "2026-03-01T00:00:00.000Z" };
    const newShapeMetric = {
      phase: "gate",
      counter: "attempts",
      value: 1,
      taskId: null,
      ts: "2026-03-01T00:00:00.000Z",
    };
    const legacy = {
      tasks: [],
      currentTaskId: null,
      notes: [newShapeNote],
      metrics: [newShapeMetric],
    };
    const { state, changed } = migrateFlowJson(legacy);
    assert.equal(changed, false);
    assert.deepEqual(state.notes, [newShapeNote]);
    assert.deepEqual(state.metrics, [newShapeMetric]);
  });

  it("hoists per-task metrics/notes to top-level arrays", () => {
    const legacy = {
      tasks: [
        {
          id: "001",
          spec: "tasks/001.md",
          origin: "plan",
          parent: null,
          status: "done",
          steps: [],
          metrics: { draft: { question: 2 } },
          notes: ["task-scoped note"],
        },
      ],
      currentTaskId: null,
    };
    const { state, changed } = migrateFlowJson(legacy);
    assert.equal(changed, true);
    assert.ok(!("metrics" in state.tasks[0]));
    assert.ok(!("notes" in state.tasks[0]));
    const hoisted = state.metrics.find((e) => e.taskId === "001");
    assert.ok(hoisted, "task-scoped metric hoisted to top-level with taskId");
    const hoistedNote = state.notes.find((e) => e.taskId === "001");
    assert.equal(hoistedNote.text, "task-scoped note");
  });
});

describe("parseSpecMd", () => {
  const md = `# Feature Specification: sample

**Feature Branch**: \`feature/sample\`

## Goal
achieve X by doing Y.

## Scope
- do A
- do B

## Out of Scope
- C
- D

## Requirements
- R1 [must]: When X happens, the system shall do Y.
- R2: do Z.

## Acceptance Criteria
- X works
- Y works

## Clarifications (Q&A)
- Q: What?
  - A: This.

## Open Questions
- [ ] unresolved?

## Alternatives Considered
- option one — reason one.
- option two — reason two.
`;

  it("extracts goal as plain string", () => {
    const sections = parseSpecMd(md);
    assert.ok(sections.goal.startsWith("achieve X"));
  });

  it("extracts scope.in and scope.out as bullet arrays", () => {
    const sections = parseSpecMd(md);
    assert.deepEqual(sections.scope.in, ["do A", "do B"]);
    assert.deepEqual(sections.scope.out, ["C", "D"]);
  });

  it("extracts requirements preserving id and desc", () => {
    const sections = parseSpecMd(md);
    assert.equal(sections.requirements.length, 2);
    assert.equal(sections.requirements[0].id, "R1");
    assert.ok(sections.requirements[0].desc.startsWith("When X"));
    assert.equal(sections.requirements[0].priority, "must");
  });

  it("extracts clarifications as {q,a} objects", () => {
    const sections = parseSpecMd(md);
    assert.equal(sections.clarifications.length, 1);
    assert.equal(sections.clarifications[0].q, "What?");
    assert.equal(sections.clarifications[0].a, "This.");
  });

  it("extracts alternatives as {option,reason} pairs", () => {
    const sections = parseSpecMd(md);
    assert.equal(sections.alternatives_considered.length, 2);
    assert.equal(sections.alternatives_considered[0].option, "option one");
    assert.equal(sections.alternatives_considered[0].reason, "reason one.");
  });
});

describe("migrateSpecMd", () => {
  it("fills missing required fields with empty defaults", () => {
    const minimal = `# Feature Specification: minimal

## Goal
A goal.
`;
    const { specJson, warnings } = migrateSpecMd(minimal);
    assert.equal(specJson.goal, "A goal.");
    assert.equal(specJson.background, EMPTY_SPEC_DEFAULTS.background);
    assert.deepEqual(specJson.scope, { in: [], out: [] });
    assert.deepEqual(specJson.constraints, []);
    assert.deepEqual(specJson.design_principles, []);
    assert.deepEqual(specJson.overview, { modules: [], data_flow: [], decisions: [] });
    assert.deepEqual(specJson.requirements, []);
    assert.deepEqual(specJson.acceptance_criteria, []);
    assert.deepEqual(specJson.clarifications, []);
    assert.deepEqual(specJson.alternatives_considered, []);
    assert.deepEqual(specJson.open_questions, []);
    assert.ok(warnings.length > 0, "should emit warnings about missing sections");
  });

  it("produces a spec.json that validates against spec.schema.json", async () => {
    const { readFile } = await import("node:fs/promises");
    const { validateSpecJson } = await import("../migrate-flow-to-tasks.js");
    const md = `# Feature Specification: full

## Goal
goal text.

## Background
bg text.

## Scope
- in1

## Out of Scope
- out1

## Constraints
- c1

## Design Principles
- p1

## Overview
### Modules
- m1
### Data Flow
- d1
### Decisions
- dec1

## Requirements
- R1: do X.

## Acceptance Criteria
- a1

## Clarifications (Q&A)
- Q: q?
  - A: a.

## Alternatives Considered
- one — reason.

## Open Questions
- [ ] todo
`;
    const { specJson } = migrateSpecMd(md);
    const result = validateSpecJson(specJson);
    assert.equal(result.valid, true, `schema validation failed: ${JSON.stringify(result.errors)}`);
  });
});
