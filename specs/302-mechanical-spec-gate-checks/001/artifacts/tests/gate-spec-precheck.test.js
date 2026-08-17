// spec: R1 R2 R3 R4 R5 R6
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import RunGateCommand, { checkSpecJson, computeGitState } from "../../../src/flow/lib/run-gate.js";
import { validateTestHeaders } from "../../../src/flow/lib/test-headers.js";
import { filterByPhase, loadMergedGuardrails } from "../../../src/lib/guardrail.js";
import { validateSpecJsonObject } from "../../../src/lib/spec-json.js";

function requirement(id, extra = {}) {
  return {
    id,
    desc: `${id} requirement`,
    ...extra,
  };
}

function task(id, extra = {}) {
  return {
    id,
    title: `${id} task`,
    goal: `${id} goal`,
    origin: "plan",
    added_round: 0,
    status: "pending",
    parent: null,
    ...extra,
  };
}

function spec(overrides = {}) {
  return {
    goal: "Gate precheck behavior",
    background: "Spec gate should short-circuit obvious structural failures.",
    scope: { in: ["spec gate"], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements: [
      requirement("R1", { priority: "must" }),
      requirement("R2", { priority: "must" }),
      requirement("R3", { priority: "must" }),
    ],
    acceptance_criteria: ["Required behavior is covered."],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
    tasks: [task("T-1", { test_strategy: "Run unit tests." })],
    ...overrides,
  };
}

describe("spec gate mechanical prechecks", () => {
  it("R1: reports each missing or null priority when requirements count is greater than three", () => {
    const input = spec({
      requirements: [
        requirement("R1", { priority: "must" }),
        requirement("R2"),
        requirement("R3", { priority: null }),
        requirement("R4", { priority: "should" }),
      ],
    });

    const issues = checkSpecJson(input);

    assert.deepEqual(
      issues.filter((issue) => issue.includes(".priority")),
      [
        "requirements[1].priority: missing priority for requirement R2 (required when requirements length is greater than 3)",
        "requirements[2].priority: missing priority for requirement R3 (required when requirements length is greater than 3)",
      ],
    );
  });

  it("R1: does not require priority when requirements count is exactly three", () => {
    const input = spec({
      requirements: [
        requirement("R1", { priority: "must" }),
        requirement("R2"),
        requirement("R3", { priority: null }),
      ],
    });

    assert.deepEqual(
      checkSpecJson(input).filter((issue) => issue.includes(".priority")),
      [],
    );
  });

  it("R2: leaves non-null invalid priority values to schema validation", () => {
    const cases = [
      ["empty string", "", /requirements\[1\]\.priority: must be one of enum/],
      ["invalid string", "invalid", /requirements\[1\]\.priority: must be one of enum/],
      ["non-string", 42, /requirements\[1\]\.priority: must be string/],
    ];

    for (const [name, value, message] of cases) {
      const invalid = spec({
        requirements: [
          requirement("R1", { priority: "must" }),
          requirement("R2", { priority: value }),
          requirement("R3", { priority: "should" }),
          requirement("R4", { priority: "nice-to-have" }),
        ],
      });
      assert.throws(
        () => validateSpecJsonObject(invalid),
        message,
        `${name} priority must remain schema-owned`,
      );
      assert.deepEqual(
        checkSpecJson(invalid).filter((issue) => issue.includes(".priority")),
        [],
        `${name} priority must not produce duplicate checkSpecJson priority issues`,
      );
    }

    const nullPriority = spec({
      requirements: [
        requirement("R1", { priority: "must" }),
        requirement("R2", { priority: null }),
        requirement("R3", { priority: "should" }),
        requirement("R4", { priority: "nice-to-have" }),
      ],
    });
    assert.doesNotThrow(() => validateSpecJsonObject(nullPriority));
    assert.ok(
      checkSpecJson(nullPriority).some((issue) => issue.includes("requirements[1].priority")),
    );
  });

  it("R3: reports missing, null, and whitespace-only task test_strategy with task ids", () => {
    const input = spec({
      tasks: [
        task("T-1"),
        task("T-2", { test_strategy: null }),
        task("T-3", { test_strategy: "   " }),
        task("T-4", { test_strategy: "Run focused unit tests." }),
      ],
    });

    const issues = checkSpecJson(input);

    assert.deepEqual(
      issues.filter((issue) => issue.includes(".test_strategy")),
      [
        "tasks[0].test_strategy: missing test strategy for task T-1",
        "tasks[1].test_strategy: missing test strategy for task T-2",
        "tasks[2].test_strategy: missing test strategy for task T-3",
      ],
    );
  });

  it("R4: keeps existing missing and empty tasks failures as the only task failures when tasks are absent", () => {
    const missingTasks = spec({ tasks: undefined });
    assert.deepEqual(
      checkSpecJson(missingTasks).filter((issue) => issue.startsWith("tasks")),
      ["tasks: missing field (task decomposition required per spec 226)"],
    );

    const emptyTasks = spec({ tasks: [] });
    assert.deepEqual(
      checkSpecJson(emptyTasks).filter((issue) => issue.startsWith("tasks")),
      ["tasks: empty array (task decomposition required for all new specs per spec 226)"],
    );
  });

  it("R5: skipGuardrail still returns structural failure before retry accounting can replace it", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-gate-precheck-"));
    const specPath = path.join(tmp, "spec.json");
    const issueLogPath = path.join(tmp, "issue-log.json");
    const input = spec({
      requirements: [
        requirement("R1", { priority: "must" }),
        requirement("R2"),
        requirement("R3", { priority: "should" }),
        requirement("R4", { priority: "nice-to-have" }),
      ],
      tasks: [task("T-1")],
    });

    try {
      fs.writeFileSync(specPath, JSON.stringify(input, null, 2) + "\n");
      const gitState = computeGitState(process.cwd());
      const priorIssueLog = {
        entries: [
          {
            phase: "spec",
            reason: "prior semantic failure should not override structural precheck ordering",
            evaluations: [
              { guardrail_id: "prioritize-requirements", result: "fail", reason: "prior failure" },
            ],
            headSha: gitState.headSha,
            worktreeHash: gitState.worktreeHash,
          },
        ],
      };
      fs.writeFileSync(issueLogPath, JSON.stringify(priorIssueLog, null, 2) + "\n");
      const issueLogBefore = fs.readFileSync(issueLogPath, "utf8");
      const result = await new RunGateCommand().execute({
        root: process.cwd(),
        config: {},
        flowState: { spec: specPath, baseBranch: "main", metrics: [] },
        phase: "spec",
        spec: specPath,
        skipGuardrail: true,
      });

      assert.equal(result.result, "fail");
      assert.equal(result.artifacts.level, "parent");
      assert.equal(result.artifacts.phase, "spec");
      assert.equal(result.artifacts.failureKind, "mechanical");
      assert.deepEqual(result.artifacts.evaluations, []);
      assert.deepEqual(result.artifacts.issues, [
        "requirements[1].priority: missing priority for requirement R2 (required when requirements length is greater than 3)",
        "tasks[0].test_strategy: missing test strategy for task T-1",
      ]);
      assert.equal(result.next, "spec");
      assert.equal(fs.readFileSync(issueLogPath, "utf8"), issueLogBefore);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("R5: schema validation failures stay ahead of checkSpecJson mechanical prechecks", async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-gate-schema-"));
    const specPath = path.join(tmp, "spec.json");
    const input = spec({
      requirements: [
        requirement("R1", { priority: "must" }),
        requirement("R2", { priority: "" }),
        requirement("R3", { priority: "should" }),
        requirement("R4", { priority: "nice-to-have" }),
      ],
      tasks: [task("T-1")],
    });

    try {
      fs.writeFileSync(specPath, JSON.stringify(input, null, 2) + "\n");
      const result = await new RunGateCommand().execute({
        root: process.cwd(),
        config: {},
        flowState: { spec: specPath, baseBranch: "main", metrics: [] },
        phase: "spec",
        spec: specPath,
        skipGuardrail: true,
      });

      assert.equal(result.result, "fail");
      assert.equal(result.artifacts.failureKind, "mechanical");
      assert.deepEqual(result.artifacts.evaluations, []);
      assert.match(
        result.artifacts.issues[0],
        /^schema: spec\.json failed schema validation: requirements\[1\]\.priority: must be one of enum/,
      );
      assert.equal(
        result.artifacts.issues.some((issue) => issue.includes("test_strategy")),
        false,
      );
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("R5: preserves spec-phase AI guardrail definitions while moving only structural checks", () => {
    const specGuardrails = new Map(
      filterByPhase(loadMergedGuardrails(process.cwd()), "spec")
        .map((guardrail) => [guardrail.id, guardrail]),
    );

    assert.match(
      specGuardrails.get("prioritize-requirements")?.body || "",
      /requirements number more than three items/,
    );
    assert.match(
      specGuardrails.get("spec-includes-test-strategy")?.body || "",
      /include a test strategy/,
    );
  });

  it("R6: preserves existing checkSpecJson and validateTestHeaders behavior", () => {
    assert.ok(
      checkSpecJson(spec({ goal: "TODO" }))
        .some((issue) => issue.includes("goal") && issue.includes("TODO")),
    );
    assert.deepEqual(
      checkSpecJson(spec({ goal: "" })).filter((issue) => issue.startsWith("goal")),
      ["goal: empty (spec must have a non-empty goal)"],
    );
    assert.deepEqual(
      checkSpecJson(spec({ requirements: [] })).filter((issue) => issue.startsWith("requirements")),
      ["requirements: empty (spec must have at least one requirement)"],
    );
    assert.deepEqual(
      checkSpecJson(spec({ acceptance_criteria: [] })).filter((issue) => issue.startsWith("acceptance_criteria")),
      ["acceptance_criteria: empty (spec must have at least one acceptance criterion)"],
    );
    assert.deepEqual(
      checkSpecJson(spec({ tasks: undefined })).filter((issue) => issue.startsWith("tasks")),
      ["tasks: missing field (task decomposition required per spec 226)"],
    );
    assert.deepEqual(
      checkSpecJson(spec({ tasks: [] })).filter((issue) => issue.startsWith("tasks")),
      ["tasks: empty array (task decomposition required for all new specs per spec 226)"],
    );

    const deepTasks = Array.from({ length: 12 }, (_, i) => task(`T-${i + 1}`, {
      parent: i === 0 ? null : `T-${i}`,
      test_strategy: "Run focused unit tests.",
    }));
    assert.deepEqual(
      checkSpecJson(spec({ tasks: deepTasks })).filter((issue) => issue.startsWith("tasks: forest depth")),
      ["tasks: forest depth 11 exceeds maximum of 10"],
    );

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-test-headers-"));
    try {
      const testsDir = path.join(tmp, "tests");
      fs.mkdirSync(testsDir, { recursive: true });
      fs.writeFileSync(
        path.join(testsDir, "covered.test.js"),
        [
          "// spec: R1",
          'import { test } from "node:test";',
          'test("R1: covered behavior", () => {});',
          "",
        ].join("\n"),
      );

      const covered = validateTestHeaders({
        specDir: tmp,
        spec: { requirements: [requirement("R1")] },
      });
      assert.equal(covered.ok, true);

      const uncovered = validateTestHeaders({
        specDir: tmp,
        spec: { requirements: [requirement("R1"), requirement("R2")] },
      });
      assert.equal(uncovered.ok, false);
      assert.deepEqual(uncovered.uncoveredRequirements, [
        { id: "R2", desc: "R2 requirement" },
      ]);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }

    assert.ok(
      checkSpecJson(spec({ tasks: [task("T-1")] }))
        .some((issue) => issue.includes("tasks[0].test_strategy")),
    );
  });
});
