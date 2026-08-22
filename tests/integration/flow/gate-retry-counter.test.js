import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";
import { CanonicalFlowFixture, makeFlowManager, setupFlowConfig } from "../../support/infrastructure/flow-setup.js";

// -----------------------------------------------------------------------------
// spec 201: retry counter plumbing (P2-R1, P2-R4)
// -----------------------------------------------------------------------------

const SENNEL_CMD = path.join(process.cwd(), "src/sennel.js");

function activeFixture(root) {
  const flowManager = makeFlowManager(root);
  return new CanonicalFlowFixture({
    flowManager,
    execution: { mode: "branch", baseBranch: "main", featureBranch: "feature/001-test" },
  }).create().registerActive();
}

describe("VALID_METRIC_COUNTERS includes gateRetry (P2-R1)", () => {
  it("exports gateRetry as a valid counter name", async () => {
    const mod = await import("../../../src/lib/constants.js");
    assert.ok(
      mod.VALID_METRIC_COUNTERS.includes("gateRetry"),
      "VALID_METRIC_COUNTERS must include gateRetry",
    );
  });
});

describe("flow set metric <phase> gateRetry (P2-R1)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("accepts gateRetry counter and appends an entry to canonical metrics", () => {
    tmp = createTmpDir();
    setupFlowConfig(tmp, "ja");
    activeFixture(tmp);

    const out = execFileSync(
      "node",
      [SENNEL_CMD, "flow", "set", "metric", "task-impl", "gateRetry"],
      { encoding: "utf8", env: { ...process.env, SENNEL_WORK_ROOT: tmp } },
    );
    const res = JSON.parse(out);
    assert.equal(res.ok, true);
    assert.equal(res.data.counter, "gateRetry");

    const flow = makeFlowManager(tmp).loadReadOnly();
    assert.ok(Array.isArray(flow.metrics));
    const hits = flow.metrics.filter((e) => e.phase === "task-impl" && e.counter === "gateRetry");
    assert.equal(hits.length, 1);
  });

  it("appends an entry per invocation", () => {
    tmp = createTmpDir();
    setupFlowConfig(tmp, "ja");
    activeFixture(tmp);

    for (let i = 0; i < 3; i++) {
      execFileSync(
        "node",
        [SENNEL_CMD, "flow", "set", "metric", "task-impl", "gateRetry"],
        { encoding: "utf8", env: { ...process.env, SENNEL_WORK_ROOT: tmp } },
      );
    }
    const flow = makeFlowManager(tmp).loadReadOnly();
    const hits = flow.metrics.filter((e) => e.phase === "task-impl" && e.counter === "gateRetry");
    assert.equal(hits.length, 3);
  });
});
