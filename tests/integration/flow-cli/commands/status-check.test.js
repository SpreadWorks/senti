import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir } from "../../../support/builders/tmp-dir.js";
import { CanonicalFlowFixture, makeFlowManager } from "../../../support/infrastructure/flow-setup.js";
const FLOW_CMD = join(process.cwd(), "src/sennel.js");
const FLOW_CMD_ARGS_PREFIX = ["flow"];

describe("flow get check impl", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function createFixture() {
    const manager = makeFlowManager(tmp);
    return new CanonicalFlowFixture({
      flowManager: manager,
      specId: "001-test",
      runId: "status-check",
      execution: { mode: "direct", baseBranch: "main", featureBranch: null },
    }).create();
  }

  it("PASS when spec-gate and test are both done", () => {
    tmp = createTmpDir();
    createFixture().settleBefore("implement").registerActive();
    const result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "get", "check", "impl"], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp },
    });
    assert.match(result, /pass.*true/is);
  });

  it("does not construct a skipped test state when the canonical definition forbids it", () => {
    tmp = createTmpDir();
    const fixture = createFixture().settleBefore("test");
    assert.throws(
      () => fixture.settle("test", "skipped"),
      /definition forbids transition in_progress:skipped for test/,
    );
  });

  it("FAIL when test-review (last plan-branch leaf) is not done", () => {
    // In the definition-based model, the only cross-branch prerequisite for
    // `implement` is `test-review` (the last leaf of the preceding `plan` branch).
    tmp = createTmpDir();
    // `test-review` is intentionally left pending after its legitimate
    // definition predecessors have been confirmed.
    createFixture().settleBefore("test-review").registerActive();
    const result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "get", "check", "impl"], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp },
    });
    assert.match(result, /pass.*false/is);
    assert.match(result, /test-review/);
  });

  it("returns ok:true with pass:false when no flow.json exists", () => {
    tmp = createTmpDir();
    const result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "get", "check", "impl"], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp },
    });
    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.pass, false);
    assert.match(envelope.data.summary, /no active flow/);
  });
});
