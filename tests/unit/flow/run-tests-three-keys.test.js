/**
 * tests/unit/flow/run-tests-three-keys.test.js
 *
 * Spec 200 — REQ-2: flow run tests records unit/integration/acceptance/exitCode
 * when the test command emits all three labels.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { join } from "path";
import fs from "fs";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { setupFlow, makeFlowManager } from "../../helpers/flow-setup.js";

const FLOW_CMD = join(process.cwd(), "src/flow.js");

function runFlow(tmp, args) {
  return execFileSync("node", [FLOW_CMD, ...args], {
    encoding: "utf8",
    env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
    cwd: tmp,
  });
}

describe("flow run tests — three-key summary (spec 200)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("records unit + integration + acceptance when test command emits labels", () => {
    tmp = createTmpDir();
    setupFlow(tmp);
    const script = "console.log('unit: 3'); console.log('integration: 5'); console.log('acceptance: 2');";
    fs.writeFileSync(join(tmp, "package.json"), JSON.stringify({
      name: "fixture",
      scripts: { test: `node -e "${script}"` },
    }));
    runFlow(tmp, ["run", "tests"]);
    const state = makeFlowManager(tmp).load();
    assert.equal(state.test.summary.unit, 3);
    assert.equal(state.test.summary.integration, 5);
    assert.equal(state.test.summary.acceptance, 2);
    assert.equal(state.test.summary.exitCode, 0);
  });

  it("records zero counts as zero (not missing) when labels explicitly say 0", () => {
    tmp = createTmpDir();
    setupFlow(tmp);
    const script = "console.log('unit: 0'); console.log('integration: 0'); console.log('acceptance: 0');";
    fs.writeFileSync(join(tmp, "package.json"), JSON.stringify({
      name: "fixture",
      scripts: { test: `node -e "${script}"` },
    }));
    runFlow(tmp, ["run", "tests"]);
    const state = makeFlowManager(tmp).load();
    assert.equal(state.test.summary.unit, 0);
    assert.equal(state.test.summary.integration, 0);
    assert.equal(state.test.summary.acceptance, 0);
  });
});
