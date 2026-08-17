// spec: R1 R2 R3 R4
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  RunUpdateOverviewCommand,
  validateOverviewAdditions,
} from "../../../src/flow/lib/run-update-overview.js";
import {
  applyOverviewAdditions,
  validateAdditions,
} from "../../../src/flow/lib/overview-merge.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";

const validAdditions = () => ({
  modules: ["src/module.js"],
  data_flow: ["input -> output"],
  decisions: ["reuse the merge validator"],
});

function invalidShape(additions) {
  assert.ok(validateAdditions(additions).length > 0);
  const boundary = validateOverviewAdditions(JSON.stringify(additions));
  assert.equal(boundary.ok, false);
  assert.equal(boundary.code, "INVALID_SHAPE");
}

function makeFixture({ tasks } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "update-overview-contract-"));
  const specDir = path.join(root, "specs", "fixture");
  const specJsonPath = path.join(specDir, "spec.json");
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(specJsonPath, `${JSON.stringify({
    goal: "fixture",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    background: "",
    requirements: [],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
    ...(tasks ? { tasks } : {}),
  }, null, 2)}\n`);
  return {
    root,
    specDir,
    specJsonPath,
    flowState: {
      spec: "specs/fixture/spec.json",
      currentTaskId: "T-1",
    },
  };
}

describe("update-overview canonical payload contract", () => {
  it("R1: accepts only the required bounded string-array shape", () => {
    assert.deepEqual(validateAdditions(validAdditions()), []);

    const fiftyEntries = Array.from({ length: 50 }, (_, index) => `entry-${index}`);
    const fiveHundredCharacters = "x".repeat(500);
    assert.deepEqual(validateAdditions({
      modules: fiftyEntries,
      data_flow: [fiveHundredCharacters],
      decisions: [""],
    }), []);

    for (const category of ["modules", "data_flow", "decisions"]) {
      const missing = validAdditions();
      delete missing[category];
      invalidShape(missing);

      invalidShape({ ...validAdditions(), [category]: "not-an-array" });
      invalidShape({ ...validAdditions(), [category]: [42] });
      invalidShape({
        ...validAdditions(),
        [category]: Array.from({ length: 51 }, (_, index) => `${index}`),
      });
      invalidShape({ ...validAdditions(), [category]: ["x".repeat(501)] });
    }

    invalidShape({ modules: [], data_flow: [], decisions: [], unknown: [] });
    invalidShape({ modules: [{ text: "legacy" }], data_flow: [], decisions: [] });
    invalidShape(null);
    invalidShape("scalar");
    invalidShape([]);
  });

  it("R1: rejects an invalid parsed shape before active-flow lookup", async () => {
    let loadCalls = 0;
    const command = new RunUpdateOverviewCommand();
    const result = await command.execute({
      root: "/path-that-must-not-be-read",
      json: JSON.stringify({ modules: [{ text: "legacy" }] }),
      flowManager: {
        load() {
          loadCalls += 1;
          throw new Error("active-flow lookup must not run");
        },
      },
    });

    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, "INVALID_SHAPE");
    assert.equal(loadCalls, 0);
  });

  it("R1: rejects an invalid parsed shape before persistence", async () => {
    const fixture = makeFixture();
    const before = fs.readFileSync(fixture.specJsonPath);

    try {
      const command = new RunUpdateOverviewCommand();
      const result = await command.execute({
        root: fixture.root,
        json: JSON.stringify({ modules: [{ text: "legacy" }] }),
        flowManager: {},
        flowState: fixture.flowState,
      });

      assert.equal(result.ok, false);
      assert.equal(result.errors[0].code, "INVALID_SHAPE");
      assert.deepEqual(fs.readFileSync(fixture.specJsonPath), before);
      assert.equal(fs.existsSync(path.join(fixture.specDir, "spec.md")), false);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("R2: documents the required shape and persists an accepted payload", async () => {
    const help = FLOW_COMMANDS.run["update-overview"].help;
    assert.match(help, /modules:\s*string\[\]/);
    assert.match(help, /data_flow:\s*string\[\]/);
    assert.match(help, /decisions:\s*string\[\]/);
    assert.match(help, /all three categories are required/i);
    assert.doesNotMatch(help, /\?\s*:/);
    assert.doesNotMatch(help, /\{text\}/);

    const fixture = makeFixture();

    try {
      const additions = {
        modules: ["src/one.js", "src/two.js"],
        data_flow: ["one -> two", "two -> three"],
        decisions: ["first", "second"],
      };
      const beforeAdditions = JSON.stringify(additions);
      const command = new RunUpdateOverviewCommand();
      const result = await command.execute({
        root: fixture.root,
        json: JSON.stringify(additions),
        flowManager: {},
        flowState: fixture.flowState,
      });

      assert.equal(result.ok, true, JSON.stringify(result.errors));
      const stored = JSON.parse(fs.readFileSync(fixture.specJsonPath, "utf8"));
      assert.equal(JSON.stringify(additions), beforeAdditions);
      for (const category of ["modules", "data_flow", "decisions"]) {
        assert.deepEqual(
          stored.overview[category].map((entry) => entry.text),
          additions[category],
        );
        assert.ok(stored.overview[category].every((entry) => entry.added_by_task === "T-1"));
      }
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("R3: preserves deterministic pure merge and task stamping", () => {
    const spec = {
      overview: {
        modules: [{ text: "existing" }],
        data_flow: [],
        decisions: [],
      },
    };
    const additions = {
      modules: ["src/one.js", "src/two.js"],
      data_flow: ["one -> two", "two -> three"],
      decisions: ["first decision", "second decision"],
    };
    const beforeSpec = JSON.stringify(spec);
    const beforeAdditions = JSON.stringify(additions);

    const first = applyOverviewAdditions(spec, additions, "T-1");
    const second = applyOverviewAdditions(spec, additions, "T-1");

    assert.equal(JSON.stringify(first), JSON.stringify(second));
    assert.equal(JSON.stringify(spec), beforeSpec);
    assert.equal(JSON.stringify(additions), beforeAdditions);
    assert.deepEqual(first.overview.modules, [
      { text: "existing" },
      { text: "src/one.js", added_by_task: "T-1" },
      { text: "src/two.js", added_by_task: "T-1" },
    ]);
    assert.deepEqual(first.overview.data_flow, [
      { text: "one -> two", added_by_task: "T-1" },
      { text: "two -> three", added_by_task: "T-1" },
    ]);
    assert.deepEqual(first.overview.decisions, [
      { text: "first decision", added_by_task: "T-1" },
      { text: "second decision", added_by_task: "T-1" },
    ]);
  });

  it("R3: leaves persistence artifacts unchanged when render planning fails", async () => {
    const duplicateTask = (id) => ({
      id,
      title: id,
      goal: id,
      parent: null,
      origin: "plan",
      added_round: 0,
      status: "pending",
    });
    const fixture = makeFixture({
      tasks: [duplicateTask("T-1"), duplicateTask("T-1")],
    });
    const before = fs.readFileSync(fixture.specJsonPath);

    try {
      const command = new RunUpdateOverviewCommand();
      const result = await command.execute({
        root: fixture.root,
        json: JSON.stringify(validAdditions()),
        flowManager: {},
        flowState: fixture.flowState,
      });

      assert.equal(result.ok, false);
      assert.equal(result.errors[0].code, "PERSIST_FAILED");
      assert.deepEqual(fs.readFileSync(fixture.specJsonPath), before);
      assert.equal(fs.existsSync(path.join(fixture.specDir, "spec.md")), false);
    } finally {
      fs.rmSync(fixture.root, { recursive: true, force: true });
    }
  });

  it("R4: preserves parse error boundaries and the next-action schema contract", () => {
    assert.equal(validateOverviewAdditions(undefined).code, "MISSING_JSON");
    assert.equal(validateOverviewAdditions("   ").code, "MISSING_JSON");
    assert.equal(validateOverviewAdditions("{").code, "INVALID_JSON");

    const schema = JSON.parse(fs.readFileSync(new URL(
      "../../../src/flow/schemas/next-action/update-overview.schema.json",
      import.meta.url,
    ), "utf8"));
    const additions = schema.properties.additions;
    assert.deepEqual(additions.required, ["modules", "data_flow", "decisions"]);
    assert.equal(additions.additionalProperties, false);
    for (const category of additions.required) {
      assert.equal(additions.properties[category].type, "array");
      assert.equal(additions.properties[category].maxItems, 50);
      assert.equal(additions.properties[category].items.type, "string");
      assert.equal(additions.properties[category].items.maxLength, 500);
    }
  });
});
