/**
 * tests/unit/flow/resolve-context-extended.test.js
 *
 * Tests for extended resolve-context returning git/gh state.
 */

import { describe, it, afterEach } from "node:test";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { join } from "path";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
const FLOW_CMD = join(process.cwd(), "src/flow.js");

describe("flow get resolve-context (extended fields)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupFlowState(dir) {
    const specId = "001-test";
    const state = {
      spec: `specs/${specId}/spec.md`,
      baseBranch: "main",
      featureBranch: "feature/001-test",
      steps: buildInitialSteps(),
      requirements: [],
      tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
      currentTaskId: null,
    };
    makeFlowManager(dir).save(state);
    makeFlowManager(dir).addActiveFlow(specId, "local");
  }

  function writeSpecJson(dir, specId, overrides = {}) {
    const specDir = path.join(dir, "specs", specId);
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, "spec.json"), JSON.stringify({
      goal: "JSON goal",
      background: "",
      scope: { in: ["JSON scope"], out: [] },
      constraints: [],
      design_principles: [],
      overview: { modules: [], data_flow: [], decisions: [] },
      requirements: [{ id: "R1", desc: "Do it." }],
      acceptance_criteria: ["Done."],
      clarifications: [],
      alternatives_considered: [],
      open_questions: [],
      ...overrides,
    }, null, 2));
  }

  it("returns dirty, currentBranch, aheadCount, ghAvailable fields", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    const result = execFileSync(
      "node", [FLOW_CMD, "get", "resolve-context"],
      { encoding: "utf8", env: { ...process.env, SENTI_WORK_ROOT: tmp } },
    );
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.ok("dirty" in envelope.data, "should have dirty field");
    assert.ok("currentBranch" in envelope.data, "should have currentBranch field");
    assert.ok("ghAvailable" in envelope.data, "should have ghAvailable field");
    assert.ok("aheadCount" in envelope.data, "should have aheadCount field");
    assert.ok("lastCommit" in envelope.data, "should have lastCommit field");
  });

  it("reads goal and scope from spec.json instead of spec.md", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);
    writeSpecJson(tmp, "001-test");
    fs.writeFileSync(
      join(tmp, "specs", "001-test", "spec.md"),
      "# Spec\n## Goal\nstale markdown goal\n## Scope\nstale markdown scope\n",
    );

    const result = execFileSync(
      "node", [FLOW_CMD, "get", "resolve-context"],
      { encoding: "utf8", env: { ...process.env, SENTI_WORK_ROOT: tmp } },
    );
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.goal, "JSON goal");
    assert.deepEqual(envelope.data.scope, { in: ["JSON scope"], out: [] });
  });
});
