import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir, writeFile } from "../../../tests/helpers/tmp-dir.js";
import { setupFlow, setStepDone } from "../../../tests/helpers/flow-setup.js";
import { saveFlowState } from "../../../src/lib/flow-state.js";

const CMD = join(process.cwd(), "src/flow.js");

function runFlow(args, tmp) {
  return JSON.parse(
    execFileSync("node", [CMD, ...args], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp },
    }),
  );
}

function readFlowState(tmp) {
  const p = join(tmp, "specs/001-test/flow.json");
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

describe("R1: runEntry hook lifecycle (pre/post/onError/finally)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("AC1: gate run updates step via pre/post hooks", () => {
    tmp = createTmpDir();
    const state = setupFlow(tmp);
    setStepDone(state, "approach", "branch", "prepare-spec", "draft", "spec");

    // Write spec.md for gate to read
    writeFile(tmp, "specs/001-test/spec.md", [
      "# Feature Specification: 001-test",
      "",
      "**Feature Branch**: `feature/001-test`",
      "**Created**: 2026-01-01",
      "**Status**: Draft",
      "**Input**: test",
      "",
      "## Goal",
      "- Test goal",
      "",
      "## Scope",
      "- Test scope",
      "",
      "## Out of Scope",
      "- None",
      "",
      "## Requirements",
      "- R1: Test requirement",
      "",
      "## Acceptance Criteria",
      "- AC1: Test acceptance",
      "",
      "## User Confirmation",
      "- [x] User approved this spec",
      "- Confirmed at: 2026-01-01",
      "",
      "## Open Questions",
      "None",
    ].join("\n"));

    // Save updated state with done steps
    saveFlowState(tmp, state);

    // Run gate — it will likely fail but hooks should still fire
    try {
      runFlow(["run", "gate"], tmp);
    } catch (_) {
      // gate may fail (non-zero exit) but we check flow.json
    }

    const updated = readFlowState(tmp);
    const gateStep = updated.steps.find((s) => s.id === "gate");
    // Gate hook should have set it to in_progress (pre) then done or in_progress (post)
    assert.ok(
      gateStep.status === "done" || gateStep.status === "in_progress",
      `gate step should be done or in_progress, got: ${gateStep.status}`,
    );
  });
});

describe("R2: registry hook expansion", () => {
  it("AC3: registry defines pre/post hooks for commands that exclusively own steps", async () => {
    const { FLOW_COMMANDS } = await import("../../../src/flow/registry.js");
    const runCmds = FLOW_COMMANDS.run;

    // Commands that exclusively own their step should have pre/post hooks
    const expectedHooked = ["gate", "review", "finalize"];
    for (const cmd of expectedHooked) {
      assert.ok(runCmds[cmd], `run.${cmd} should exist in registry`);
      assert.ok(typeof runCmds[cmd].pre === "function", `run.${cmd} should have pre hook`);
      assert.ok(typeof runCmds[cmd].post === "function", `run.${cmd} should have post hook`);
    }

    // Sub-commands that don't exclusively own a step should NOT have hooks
    const noHooks = ["impl-confirm", "lint", "retro", "sync"];
    for (const cmd of noHooks) {
      assert.ok(runCmds[cmd], `run.${cmd} should exist in registry`);
      assert.equal(runCmds[cmd].pre, undefined, `run.${cmd} should not have pre hook`);
      assert.equal(runCmds[cmd].post, undefined, `run.${cmd} should not have post hook`);
    }
  });

  it("AC4/AC5/AC6: get.context has post hook", async () => {
    const { FLOW_COMMANDS } = await import("../../../src/flow/registry.js");
    const ctx = FLOW_COMMANDS.get.context;
    assert.ok(typeof ctx.post === "function", "get.context should have post hook");
  });

  it("AC7: set.redo has post hook", async () => {
    const { FLOW_COMMANDS } = await import("../../../src/flow/registry.js");
    const redo = FLOW_COMMANDS.set.redo;
    assert.ok(typeof redo.post === "function", "set.redo should have post hook");
  });

  it("registry uses pre/post (not before/after)", async () => {
    const { FLOW_COMMANDS } = await import("../../../src/flow/registry.js");
    const runCmds = FLOW_COMMANDS.run;
    for (const [name, entry] of Object.entries(runCmds)) {
      assert.equal(entry.before, undefined, `run.${name} should not have 'before' (use 'pre')`);
      assert.equal(entry.after, undefined, `run.${name} should not have 'after' (use 'post')`);
    }
  });
});

describe("R3: incrementMetric in flow-state.js", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("incrementMetric is exported from flow-state.js", async () => {
    const mod = await import("../../../src/lib/flow-state.js");
    assert.ok(typeof mod.incrementMetric === "function", "incrementMetric should be exported");
  });

  it("incrementMetric increments counter in flow.json", async () => {
    tmp = createTmpDir();
    setupFlow(tmp);

    const { incrementMetric } = await import("../../../src/lib/flow-state.js");
    incrementMetric(tmp, "plan", "docsRead");
    incrementMetric(tmp, "plan", "docsRead");
    incrementMetric(tmp, "plan", "srcRead");

    const state = readFlowState(tmp);
    assert.equal(state.metrics.plan.docsRead, 2);
    assert.equal(state.metrics.plan.srcRead, 1);
  });
});

describe("R4: prepare-spec --issue/--request", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("AC9: prepare-spec help shows --issue and --request options", () => {
    // prepare --help requires a config.json to exist (resolveCtx checks config)
    tmp = createTmpDir();
    fs.mkdirSync(join(tmp, ".sdd-forge"), { recursive: true });
    fs.writeFileSync(join(tmp, ".sdd-forge", "config.json"), JSON.stringify({
      lang: "en", type: "node-cli",
      docs: { languages: ["en"], defaultLanguage: "en" },
    }));

    const result = execFileSync("node", [CMD, "prepare", "--help"], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp },
    });
    assert.ok(result.includes("--issue"), "help should mention --issue option");
    assert.ok(result.includes("--request"), "help should mention --request option");
  });
});

describe("R2d: set.redo post hook increments redo metric", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("AC7: redo metric auto-increments on set redo", () => {
    tmp = createTmpDir();
    const state = setupFlow(tmp);
    setStepDone(state, "approach", "branch", "prepare-spec", "draft", "spec", "gate", "approval", "test");
    state.steps.find((s) => s.id === "implement").status = "in_progress";
    saveFlowState(tmp, state);

    // Write spec.md so redo can find spec dir
    writeFile(tmp, "specs/001-test/spec.md", "# test");

    runFlow(["set", "redo", "--step", "implement", "--reason", "test reason"], tmp);

    const updated = readFlowState(tmp);
    assert.ok(updated.metrics, "metrics should exist after redo");
    assert.ok(updated.metrics.impl, "impl phase metrics should exist");
    assert.equal(updated.metrics.impl.redo, 1, "redo counter should be 1");
  });
});
