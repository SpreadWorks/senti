import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyOverviewAdditions,
  filterOverviewByTask,
  validateAdditions,
} from "../../../src/flow/lib/overview-merge.js";

function baseSpec() {
  return {
    goal: "g",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: {
      modules: [{ text: "src/existing.js" }],
      data_flow: [{ text: "old flow", added_by_task: "T1" }],
      decisions: [],
    },
    background: "",
    requirements: [],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
  };
}

describe("applyOverviewAdditions", () => {
  it("appends new entries to each category with the supplied taskId stamped", () => {
    const spec = baseSpec();
    const additions = {
      modules: ["src/new.js"],
      data_flow: ["new -> added"],
      decisions: ["use X"],
    };
    const next = applyOverviewAdditions(spec, additions, "T9");
    assert.deepEqual(next.overview.modules, [
      { text: "src/existing.js" },
      { text: "src/new.js", added_by_task: "T9" },
    ]);
    assert.deepEqual(next.overview.data_flow, [
      { text: "old flow", added_by_task: "T1" },
      { text: "new -> added", added_by_task: "T9" },
    ]);
    assert.deepEqual(next.overview.decisions, [
      { text: "use X", added_by_task: "T9" },
    ]);
  });

  it("does not mutate the original spec", () => {
    const spec = baseSpec();
    const snapshot = JSON.stringify(spec);
    applyOverviewAdditions(spec, { modules: ["m"], data_flow: [], decisions: [] }, "T9");
    assert.equal(JSON.stringify(spec), snapshot);
  });

  it("handles empty additions as a no-op (still returns a new spec object)", () => {
    const spec = baseSpec();
    const next = applyOverviewAdditions(spec, { modules: [], data_flow: [], decisions: [] }, "T9");
    assert.deepEqual(next.overview, spec.overview);
    assert.notStrictEqual(next, spec);
  });

  it("throws when taskId is missing or empty", () => {
    const spec = baseSpec();
    assert.throws(
      () => applyOverviewAdditions(spec, { modules: ["x"], data_flow: [], decisions: [] }, ""),
      /taskId/i,
    );
    assert.throws(
      () => applyOverviewAdditions(spec, { modules: ["x"], data_flow: [], decisions: [] }, null),
      /taskId/i,
    );
  });

  it("is deterministic (same inputs produce byte-identical JSON)", () => {
    const spec = baseSpec();
    const additions = { modules: ["m1", "m2"], data_flow: ["d1"], decisions: ["dec1"] };
    const a = JSON.stringify(applyOverviewAdditions(spec, additions, "T9"));
    const b = JSON.stringify(applyOverviewAdditions(spec, additions, "T9"));
    assert.equal(a, b);
  });
});

describe("validateAdditions", () => {
  it("accepts additions-only payload with only modules/data_flow/decisions arrays", () => {
    const errors = validateAdditions({
      modules: ["src/a.js"],
      data_flow: [],
      decisions: ["x"],
    });
    assert.deepEqual(errors, []);
  });

  it("accepts empty arrays", () => {
    const errors = validateAdditions({ modules: [], data_flow: [], decisions: [] });
    assert.deepEqual(errors, []);
  });

  it("rejects unknown top-level fields (e.g. removals / modifications)", () => {
    const errors = validateAdditions({
      modules: [],
      data_flow: [],
      decisions: [],
      removals: { modules: [0] },
    });
    assert.ok(errors.length > 0);
    assert.ok(errors.some((e) => /removals/.test(e)));
  });

  it("rejects unknown category keys", () => {
    const errors = validateAdditions({
      modules: [],
      data_flow: [],
      decisions: [],
      strategies: ["x"],
    });
    assert.ok(errors.length > 0);
  });

  it("rejects non-string entries", () => {
    const errors = validateAdditions({
      modules: [{ text: "nope" }],
      data_flow: [],
      decisions: [],
    });
    assert.ok(errors.length > 0);
  });

  it("rejects missing required category", () => {
    const errors = validateAdditions({ modules: [], data_flow: [] });
    assert.ok(errors.some((e) => /decisions/.test(e)));
  });

  it("rejects category exceeding the bounded entry-count upper limit", () => {
    const overlong = Array.from({ length: 60 }, (_, i) => `entry ${i}`);
    const errors = validateAdditions({ modules: overlong, data_flow: [], decisions: [] });
    assert.ok(errors.some((e) => /exceeds upper bound/.test(e)), `got: ${errors.join(" / ")}`);
  });

  it("rejects entry exceeding the bounded text-length upper limit", () => {
    const overlong = "x".repeat(600);
    const errors = validateAdditions({ modules: [overlong], data_flow: [], decisions: [] });
    assert.ok(errors.some((e) => /exceeds 500 chars/.test(e)), `got: ${errors.join(" / ")}`);
  });
});

describe("filterOverviewByTask", () => {
  it("removes every entry whose added_by_task matches the given task id", () => {
    const spec = baseSpec();
    spec.overview.modules.push({ text: "src/t9.js", added_by_task: "T9" });
    spec.overview.decisions.push({ text: "t9 decision", added_by_task: "T9" });
    const next = filterOverviewByTask(spec, "T9");
    assert.deepEqual(next.overview.modules, [{ text: "src/existing.js" }]);
    assert.deepEqual(next.overview.data_flow, [{ text: "old flow", added_by_task: "T1" }]);
    assert.deepEqual(next.overview.decisions, []);
  });

  it("leaves entries without added_by_task untouched", () => {
    const spec = baseSpec();
    const next = filterOverviewByTask(spec, "T9");
    assert.deepEqual(next.overview.modules, [{ text: "src/existing.js" }]);
  });

  it("returns spec with identical overview when no entry matches", () => {
    const spec = baseSpec();
    const next = filterOverviewByTask(spec, "T999");
    assert.deepEqual(next.overview, spec.overview);
  });

  it("does not mutate the original spec", () => {
    const spec = baseSpec();
    spec.overview.modules.push({ text: "src/t9.js", added_by_task: "T9" });
    const snapshot = JSON.stringify(spec);
    filterOverviewByTask(spec, "T9");
    assert.equal(JSON.stringify(spec), snapshot);
  });

  it("throws when taskId is missing or empty", () => {
    const spec = baseSpec();
    assert.throws(() => filterOverviewByTask(spec, ""), /taskId/i);
    assert.throws(() => filterOverviewByTask(spec, null), /taskId/i);
  });
});
