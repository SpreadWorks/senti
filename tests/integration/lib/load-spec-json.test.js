import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadSpecJson } from "../../../src/lib/spec-json.js";

const specDirectories = [];

function mkSpecDir() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "spec-json-test-"));
  specDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of specDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function minimalSpec() {
  return {
    goal: "g",
    scope: { in: ["a"], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    background: "",
    requirements: [{ id: "R1", desc: "d", priority: "must", status: "pending" }],
    acceptance_criteria: ["ok"],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
  };
}

describe("loadSpecJson (spec 207 / T8)", () => {
  it("loads spec.json from a spec directory and returns a plain object", () => {
    const dir = mkSpecDir();
    fs.writeFileSync(path.join(dir, "spec.json"), JSON.stringify(minimalSpec()));
    const spec = loadSpecJson(dir);
    assert.equal(spec.goal, "g");
    assert.deepEqual(spec.scope.in, ["a"]);
    assert.equal(typeof spec, "object");
  });

  it("accepts a path that directly points to spec.json", () => {
    const dir = mkSpecDir();
    const file = path.join(dir, "spec.json");
    fs.writeFileSync(file, JSON.stringify(minimalSpec()));
    const spec = loadSpecJson(file);
    assert.equal(spec.goal, "g");
  });

  it("throws when spec.json does not exist", () => {
    const dir = mkSpecDir();
    assert.throws(() => loadSpecJson(dir), /spec\.json/);
  });

  it("throws when spec.json violates schema", () => {
    const dir = mkSpecDir();
    const bad = minimalSpec();
    delete bad.goal;
    fs.writeFileSync(path.join(dir, "spec.json"), JSON.stringify(bad));
    assert.throws(() => loadSpecJson(dir), /goal/);
  });

  it("accepts a path that points to a .md file and resolves to its sibling spec.json", () => {
    const dir = mkSpecDir();
    fs.writeFileSync(path.join(dir, "spec.json"), JSON.stringify(minimalSpec()));
    const spec = loadSpecJson(path.join(dir, "spec.md"));
    assert.equal(spec.goal, "g");
  });
});
