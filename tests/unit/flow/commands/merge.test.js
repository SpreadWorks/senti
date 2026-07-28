import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseSpec, buildPrTitle, buildPrBody, squashMergeFailure } from "../../../../src/flow/commands/merge.js";

const SAMPLE_SPEC_JSON = {
  goal: "flow-finalize の PR ルートで PR description を自動生成する。",
  background: "",
  scope: {
    in: ["merge.js を拡張する", "spec.json を読む"],
    out: ["squash merge の変更"],
  },
  constraints: [],
  design_principles: [],
  overview: { modules: [], data_flow: [], decisions: [] },
  requirements: [
    { id: "R1", desc: "パーサーを追加する", priority: "must" },
    { id: "R2", desc: "buildPrBody を拡張する", priority: "must" },
  ],
  acceptance_criteria: ["PR body に Goal が含まれること"],
  clarifications: [],
  alternatives_considered: [],
  open_questions: [],
};

const MINIMAL_SPEC_JSON = {
  goal: "最小限の spec。",
  background: "",
  scope: { in: [], out: [] },
  constraints: [],
  design_principles: [],
  overview: { modules: [], data_flow: [], decisions: [] },
  requirements: [],
  acceptance_criteria: [],
  clarifications: [],
  alternatives_considered: [],
  open_questions: [],
};

describe("parseSpec (spec.json-based, spec 207 / T8)", () => {
  it("extracts Goal, Scope, Requirements as structured data", () => {
    const result = parseSpec(SAMPLE_SPEC_JSON);
    assert.equal(result.goal, "flow-finalize の PR ルートで PR description を自動生成する。");
    assert.deepEqual(result.scopeIn, ["merge.js を拡張する", "spec.json を読む"]);
    assert.deepEqual(result.scopeOut, ["squash merge の変更"]);
    assert.equal(result.requirements.length, 2);
    assert.equal(result.requirements[0].id, "R1");
    assert.equal(result.requirements[0].desc, "パーサーを追加する");
  });

  it("returns empty collections when scope/requirements are empty", () => {
    const result = parseSpec(MINIMAL_SPEC_JSON);
    assert.equal(result.goal, "最小限の spec。");
    assert.deepEqual(result.scopeIn, []);
    assert.deepEqual(result.scopeOut, []);
    assert.deepEqual(result.requirements, []);
  });

  it("returns null goal and empty collections for null input", () => {
    const result = parseSpec(null);
    assert.equal(result.goal, null);
    assert.deepEqual(result.scopeIn, []);
    assert.deepEqual(result.scopeOut, []);
    assert.deepEqual(result.requirements, []);
  });
});

describe("buildPrTitle", () => {
  it("returns Goal first line from spec", () => {
    const spec = { goal: "PR description を自動生成する。\n複数行の Goal", scopeIn: [], scopeOut: [], requirements: [] };
    const title = buildPrTitle(spec, "fallback-title");
    assert.equal(title, "PR description を自動生成する。");
  });

  it("falls back to specTitle when goal is null", () => {
    const spec = { goal: null, scopeIn: [], scopeOut: [], requirements: [] };
    const title = buildPrTitle(spec, "fallback-title");
    assert.equal(title, "fallback-title");
  });

  it("falls back when spec is null", () => {
    const title = buildPrTitle(null, "fallback-title");
    assert.equal(title, "fallback-title");
  });
});

describe("buildPrBody", () => {
  it("generates structured body with issue, goal, requirements, scope", () => {
    const state = { issue: 37, request: "original request" };
    const spec = {
      goal: "PR description を自動生成する。",
      scopeIn: ["merge.js を拡張"],
      scopeOut: [],
      requirements: [
        { id: "R1", desc: "パーサー追加", priority: "must" },
        { id: "R2", desc: "body 拡張" },
      ],
    };
    const body = buildPrBody(state, spec);
    assert.ok(body.includes("fixes #37"));
    assert.ok(body.includes("## Goal"));
    assert.ok(body.includes("PR description を自動生成する。"));
    assert.ok(body.includes("## Requirements"));
    assert.ok(body.includes("- R1 [must]: パーサー追加"));
    assert.ok(body.includes("## Scope"));
    assert.ok(body.includes("- merge.js を拡張"));
  });

  it("omits sections that are empty", () => {
    const state = { issue: 5 };
    const spec = { goal: "ゴール", scopeIn: [], scopeOut: [], requirements: [] };
    const body = buildPrBody(state, spec);
    assert.ok(body.includes("fixes #5"));
    assert.ok(body.includes("## Goal"));
    assert.ok(!body.includes("## Requirements"));
    assert.ok(!body.includes("## Scope"));
  });

  it("falls back to request-based body when spec is null", () => {
    const state = { issue: 10, request: "元のリクエスト" };
    const body = buildPrBody(state, null);
    assert.ok(body.includes("fixes #10"));
    assert.ok(body.includes("元のリクエスト"));
    assert.ok(!body.includes("## Goal"));
  });

  it("handles no issue and no spec", () => {
    const state = { request: "リクエスト" };
    const body = buildPrBody(state, null);
    assert.ok(!body.includes("fixes"));
    assert.ok(body.includes("リクエスト"));
  });

  it("handles no issue with spec", () => {
    const state = {};
    const spec = { goal: "ゴール", scopeIn: [], scopeOut: [], requirements: [] };
    const body = buildPrBody(state, spec);
    assert.ok(!body.includes("fixes"));
    assert.ok(body.includes("## Goal"));
  });
});

describe("squashMergeFailure", () => {
  it("reports an actual unmerged path as a conflict", () => {
    const error = squashMergeFailure({
      mergeResult: { stdout: "", stderr: "CONFLICT" },
      unmerged: ["src/example.js"],
    });

    assert.equal(error.code, "MERGE_CONFLICT");
    assert.match(error.message, /src\/example\.js/);
  });

  it("preserves non-conflict git failures instead of labeling them as conflicts", () => {
    const error = squashMergeFailure({
      mergeResult: { stdout: "", stderr: "Your local changes would be overwritten" },
      unmerged: [],
    });

    assert.equal(error.code, "MERGE_SQUASH_FAILED");
    assert.match(error.message, /local changes would be overwritten/);
    assert.doesNotMatch(error.message, /Merge conflict detected/);
  });
});
