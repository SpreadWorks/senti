import { describe, it, beforeEach, afterEach } from "node:test";
import { makeFlowManager } from "../../helpers/flow-setup.js";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "node:child_process";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
function createTmpProject() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "flow-auto-"));
  fs.mkdirSync(path.join(tmp, ".senrail"), { recursive: true });
  fs.mkdirSync(path.join(tmp, "specs", "001-test"), { recursive: true });
  execFileSync("git", ["init", tmp], { stdio: "ignore" });
  return tmp;
}

function createFlowState(tmp) {
  const state = {
    specId: "001-test",
    runId: "run-test",
    baseBranch: "main",
    featureBranch: "feature/001-test",
    steps: buildInitialSteps(),
    tasks: [{ id: "T-1", title: "x", goal: "x", parent: null, origin: "plan", added_round: 0, status: "pending", steps: [] }],
    currentTaskId: null,
  };
  makeFlowManager(tmp).create(state);
  makeFlowManager(tmp).addActiveFlow("001-test", "branch");
  return state;
}

describe("flow-state autoApprove", () => {
  let tmp;

  beforeEach(() => {
    tmp = createTmpProject();
    createFlowState(tmp);
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("sets autoApprove to true via mutateFlowState", () => {
    makeFlowManager(tmp).mutate((state) => {
      state.autoApprove = true;
    });
    const loaded = makeFlowManager(tmp).load();
    assert.equal(loaded.autoApprove, true);
  });

  it("sets autoApprove to false via mutateFlowState", () => {
    // First set to true
    makeFlowManager(tmp).mutate((state) => {
      state.autoApprove = true;
    });
    // Then set to false
    makeFlowManager(tmp).mutate((state) => {
      state.autoApprove = false;
    });
    const loaded = makeFlowManager(tmp).load();
    assert.equal(loaded.autoApprove, false);
  });

  it("autoApprove defaults to undefined when not set", () => {
    const loaded = makeFlowManager(tmp).load();
    assert.equal(loaded.autoApprove, undefined);
  });

  it("preserves autoApprove across other mutations", () => {
    makeFlowManager(tmp).mutate((state) => {
      state.autoApprove = true;
    });
    makeFlowManager(tmp).mutate((state) => {
      state.request = "test request";
    });
    const loaded = makeFlowManager(tmp).load();
    assert.equal(loaded.autoApprove, true);
    assert.equal(loaded.request, "test request");
  });
});
