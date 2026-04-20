import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { setupFlow, setupFlowConfig } from "../../helpers/flow-setup.js";

// -----------------------------------------------------------------------------
// spec 201: retry counter plumbing (P2-R1, P2-R4)
// -----------------------------------------------------------------------------

const SDD_CMD = path.join(process.cwd(), "src/sdd-forge.js");

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

  it("accepts gateRetry counter and persists to flow.json metrics", () => {
    tmp = createTmpDir();
    setupFlowConfig(tmp, "ja");
    setupFlow(tmp, { featureBranch: "feature/001-test", baseBranch: "main" });

    const out = execFileSync(
      "node",
      [SDD_CMD, "flow", "set", "metric", "task-impl", "gateRetry"],
      { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp } },
    );
    const res = JSON.parse(out);
    assert.equal(res.ok, true);
    assert.equal(res.data.counter, "gateRetry");
    assert.equal(res.data.value, 1);

    const flow = JSON.parse(
      fs.readFileSync(path.join(tmp, "specs/001-test/flow.json"), "utf8"),
    );
    assert.equal(flow.metrics["task-impl"].gateRetry, 1);
  });

  it("increments counter across multiple invocations", () => {
    tmp = createTmpDir();
    setupFlowConfig(tmp, "ja");
    setupFlow(tmp, { featureBranch: "feature/001-test", baseBranch: "main" });

    for (let i = 0; i < 3; i++) {
      execFileSync(
        "node",
        [SDD_CMD, "flow", "set", "metric", "task-impl", "gateRetry"],
        { encoding: "utf8", env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp } },
      );
    }
    const flow = JSON.parse(
      fs.readFileSync(path.join(tmp, "specs/001-test/flow.json"), "utf8"),
    );
    assert.equal(flow.metrics["task-impl"].gateRetry, 3);
  });
});
