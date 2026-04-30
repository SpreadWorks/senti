/**
 * specs/246-test-map-null-sentinel/tests/246-null-sentinel.test.js
 *
 * Spec 246: test-map.json null sentinel — tryStaticEvaluation の null 対応テスト
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { RunRetroCommand } from "../../../src/flow/lib/run-retro.js";

function createRepo() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "retro-null-"));
  execFileSync("git", ["init", tmp], { stdio: "ignore" });
  execFileSync("git", ["-C", tmp, "config", "user.email", "t@t.t"], { stdio: "ignore" });
  execFileSync("git", ["-C", tmp, "config", "user.name", "t"], { stdio: "ignore" });
  execFileSync("git", ["-C", tmp, "commit", "--allow-empty", "-m", "init"], { stdio: "ignore" });
  execFileSync("git", ["-C", tmp, "checkout", "-b", "main"], { stdio: "ignore" });
  execFileSync("git", ["-C", tmp, "checkout", "-b", "feature/246-test"], { stdio: "ignore" });
  fs.writeFileSync(path.join(tmp, "change.txt"), "hello\n");
  execFileSync("git", ["-C", tmp, "add", "."], { stdio: "ignore" });
  execFileSync("git", ["-C", tmp, "commit", "-m", "change"], { stdio: "ignore" });
  return tmp;
}

function writeSpecWithTestMap(tmp, specId, requirements, testMap) {
  const specDir = path.join(tmp, "specs", specId);
  const testsDir = path.join(specDir, "tests");
  fs.mkdirSync(testsDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "spec.json"), JSON.stringify({
    goal: "test",
    background: "",
    scope: { in: [], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements,
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
  }, null, 2));
  fs.writeFileSync(path.join(testsDir, "test-map.json"), JSON.stringify(testMap, null, 2));
  return { specDir, testsDir };
}

function writeSimpleTest(testsDir, fileName, reqId, pass) {
  fs.writeFileSync(path.join(testsDir, fileName), `
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
describe("${reqId}", () => {
  it("${reqId}: test case", () => {
    assert.${pass ? "ok(true)" : "fail('expected failure')"};
  });
});
`);
}

describe("R1: tryStaticEvaluation treats null entries as n/a", () => {
  let tmp;
  afterEach(() => tmp && fs.rmSync(tmp, { recursive: true, force: true }));

  it("null entry gets status n/a and is excluded from summary totals", async () => {
    tmp = createRepo();
    const specId = "246-test";
    const requirements = [
      { id: "R1", desc: "tested requirement", priority: "must" },
      { id: "R2", desc: "not-tested requirement (null)", priority: "must" },
    ];
    const testMap = {
      R1: ["passing.test.js > R1: test case"],
      R2: null,
    };
    const { testsDir } = writeSpecWithTestMap(tmp, specId, requirements, testMap);
    writeSimpleTest(testsDir, "passing.test.js", "R1", true);

    const cmd = new RunRetroCommand();
    const result = cmd.tryStaticEvaluation(tmp, `specs/${specId}/spec.json`, requirements);

    assert.ok(result, "tryStaticEvaluation should return a result");

    const r1 = result.requirements.find((r) => r.desc === "tested requirement");
    assert.equal(r1.status, "done");

    const r2 = result.requirements.find((r) => r.desc === "not-tested requirement (null)");
    assert.equal(r2.status, "n/a", "null entry should have status n/a");

    assert.equal(result.summary.total, 1, "total should exclude n/a entries");
    assert.equal(result.summary.done, 1);
    assert.equal(result.summary.not_done, 0);
    assert.equal(result.summary.rate, 1.0, "rate should be 1.0 when only tested req passes");
  });
});

describe("R2: summary includes na_count field", () => {
  let tmp;
  afterEach(() => tmp && fs.rmSync(tmp, { recursive: true, force: true }));

  it("na_count records the number of n/a entries", async () => {
    tmp = createRepo();
    const specId = "246-test";
    const requirements = [
      { id: "R1", desc: "tested", priority: "must" },
      { id: "R2", desc: "n/a one", priority: "must" },
      { id: "R3", desc: "n/a two", priority: "must" },
    ];
    const testMap = {
      R1: ["passing.test.js > R1: test case"],
      R2: null,
      R3: null,
    };
    const { testsDir } = writeSpecWithTestMap(tmp, specId, requirements, testMap);
    writeSimpleTest(testsDir, "passing.test.js", "R1", true);

    const cmd = new RunRetroCommand();
    const result = cmd.tryStaticEvaluation(tmp, `specs/${specId}/spec.json`, requirements);

    assert.ok(result);
    assert.equal(result.summary.na_count, 2, "na_count should be 2");
    assert.equal(result.summary.total, 1, "total should exclude n/a entries");
  });
});

describe("R3: null entries do not cause TypeError in testMap iteration", () => {
  let tmp;
  afterEach(() => tmp && fs.rmSync(tmp, { recursive: true, force: true }));

  it("null entries are skipped during test file extraction, valid tests still run", async () => {
    tmp = createRepo();
    const specId = "246-test";
    const requirements = [
      { id: "R1", desc: "tested", priority: "must" },
      { id: "R2", desc: "null entry", priority: "must" },
    ];
    const testMap = {
      R1: ["passing.test.js > R1: test case"],
      R2: null,
    };
    const { testsDir } = writeSpecWithTestMap(tmp, specId, requirements, testMap);
    writeSimpleTest(testsDir, "passing.test.js", "R1", true);

    const cmd = new RunRetroCommand();
    const result = cmd.tryStaticEvaluation(tmp, `specs/${specId}/spec.json`, requirements);
    assert.ok(result, "should return a result, not null (null would mean fallback to AI eval)");
    assert.equal(result.requirements[0].status, "done", "R1 test should still run and pass");
  });
});

describe("R1: all-null testMap still produces static evaluation", () => {
  let tmp;
  afterEach(() => tmp && fs.rmSync(tmp, { recursive: true, force: true }));

  it("returns result with total=0 and rate=0 when all entries are null", async () => {
    tmp = createRepo();
    const specId = "246-test";
    const requirements = [
      { id: "R1", desc: "n/a only one", priority: "must" },
      { id: "R2", desc: "n/a only two", priority: "must" },
    ];
    const testMap = {
      R1: null,
      R2: null,
    };
    writeSpecWithTestMap(tmp, specId, requirements, testMap);

    const cmd = new RunRetroCommand();
    const result = cmd.tryStaticEvaluation(tmp, `specs/${specId}/spec.json`, requirements);

    assert.ok(result, "should not return null — static evaluation should still succeed");
    assert.equal(result.summary.total, 0, "total should be 0 when all entries are n/a");
    assert.equal(result.summary.rate, 0, "rate should be 0 when total is 0");
    assert.equal(result.summary.na_count, 2);
  });
});

describe("backward compatibility: existing testMap without null", () => {
  let tmp;
  afterEach(() => tmp && fs.rmSync(tmp, { recursive: true, force: true }));

  it("existing testMap without null entries behaves identically", async () => {
    tmp = createRepo();
    const specId = "246-test";
    const requirements = [
      { id: "R1", desc: "tested", priority: "must" },
      { id: "R2", desc: "untested", priority: "must" },
    ];
    const testMap = {
      R1: ["passing.test.js > R1: test case"],
      R2: [],
    };
    const { testsDir } = writeSpecWithTestMap(tmp, specId, requirements, testMap);
    writeSimpleTest(testsDir, "passing.test.js", "R1", true);

    const cmd = new RunRetroCommand();
    const result = cmd.tryStaticEvaluation(tmp, `specs/${specId}/spec.json`, requirements);

    assert.ok(result);
    assert.equal(result.summary.total, 2, "total includes all non-null entries");
    assert.equal(result.summary.done, 1);
  });
});
