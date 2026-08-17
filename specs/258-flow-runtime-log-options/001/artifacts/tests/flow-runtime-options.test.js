// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { resolveWorkDir } from "../../../src/lib/config.js";
import { assertContains, assertNotContains, read, REPO_ROOT } from "./helpers.js";

describe("spec 258: flow runtime option contracts", () => {
  it("R1: every flow run command registry entry exposes --agent-work-dir", async () => {
    const { flowCommands } = await import("../../../src/lib/command-registry.js");
    for (const [action, entry] of Object.entries(flowCommands.run)) {
      assert.ok(entry.args?.options?.includes("--agent-work-dir"), `flow run ${action} must accept --agent-work-dir`);
    }
  });

  it("R2: SDD_FORGE_WORK_DIR no longer changes resolveWorkDir", () => {
    const previous = process.env.SDD_FORGE_WORK_DIR;
    process.env.SDD_FORGE_WORK_DIR = "/tmp/sdd-forge-env-should-not-win";
    try {
      assert.equal(
        resolveWorkDir(REPO_ROOT, { agent: { workDir: ".agent-work" } }),
        path.resolve(REPO_ROOT, ".agent-work"),
      );
      assert.equal(resolveWorkDir(REPO_ROOT, {}), path.resolve(REPO_ROOT, ".tmp"));
    } finally {
      if (previous === undefined) {
        delete process.env.SDD_FORGE_WORK_DIR;
      } else {
        process.env.SDD_FORGE_WORK_DIR = previous;
      }
    }
  });

  it("R3: every flow run command registry entry exposes --log-file", async () => {
    const { flowCommands } = await import("../../../src/lib/command-registry.js");
    for (const [action, entry] of Object.entries(flowCommands.run)) {
      assert.ok(entry.args?.options?.includes("--log-file"), `flow run ${action} must accept --log-file`);
    }
  });

  it("R4: default runtime log paths are derived under agentWorkDir/logs by flow id", () => {
    const dispatcher = read("src/lib/dispatcher.js");
    assert.match(dispatcher, /agentWorkDir/, "dispatcher must derive default log path from paths.agentWorkDir");
    assert.match(dispatcher, /logs/, "dispatcher must write under a logs directory");
    assert.match(dispatcher, /specId|flowId/, "active-flow logs must include the flow/spec id directory");
    assert.match(dispatcher, /no-flow/, "no-flow dispatch must use a no-flow log directory");
  });

  it("R5: envelope JSON remains stdout-only while runtime log text is separated", () => {
    const dispatcher = read("src/lib/dispatcher.js");
    assert.match(dispatcher, /writeOut\(JSON\.stringify/, "dispatcher must preserve JSON envelope stdout writes");
    assert.match(dispatcher, /runtimeLog|logFile/i, "dispatcher must have a separate runtime log writer");
  });

  it("R6: runtime logs capture human-readable diagnostics without duplicating the final envelope contract", () => {
    const dispatcher = read("src/lib/dispatcher.js");
    assert.match(dispatcher, /writeErr|stderr/, "runtime logging must be able to capture stderr-equivalent diagnostics");
    assert.match(dispatcher, /runtimeLog|logFile/i, "runtime log writer must be explicit");
    assert.doesNotMatch(
      dispatcher,
      /runtimeLog[\s\S]{0,160}JSON\.stringify\(envelope\.toJSON\(\)/,
      "runtime log must not duplicate the final JSON envelope as a machine contract",
    );
  });

  it("R7: generated agent instructions use --agent-work-dir and --log-file, not env prefixes or redirects", () => {
    for (const relPath of [
      "src/templates/partials/core-principle.md",
      "src/templates/skills/sdd-forge.flow/SKILL.md",
    ]) {
      assertContains(relPath, /--agent-work-dir/, "must teach explicit agent work directory option");
      assertContains(relPath, /--log-file/, "must teach explicit log file option");
      assertNotContains(relPath, /SDD_FORGE_WORK_DIR/, "must not teach env workdir override");
      assertNotContains(relPath, />\s*\S+\s+2>&1/, "must not teach shell redirection for flow logs");
    }
  });

  it("R8: permanent unit coverage exists for config, container, dispatcher, registry, and templates", () => {
    for (const relPath of [
      "tests/unit/lib/config.test.js",
      "tests/unit/lib/container-init.test.js",
      "tests/unit/lib/dispatcher.test.js",
      "tests/unit/flow/commands/review.test.js",
      "tests/unit/flow/get-step-instructions.test.js",
    ]) {
      const text = read(relPath);
      assert.match(text, /agent-work-dir|agentWorkDir|log-file|logFile|SDD_FORGE_WORK_DIR/, `${relPath} must cover the new runtime option contracts`);
    }
  });

  it("R9: missing option values fail at the dispatch boundary with ARGS_ERROR envelopes", () => {
    const dispatcher = read("src/lib/dispatcher.js");
    const registry = read("src/flow/registry.js");
    assert.match(registry, /FLOW_RUN_RUNTIME_OPTIONS\s*=\s*\["--agent-work-dir",\s*"--log-file"\]/, "registry must declare both value-taking options");
    assert.match(dispatcher, /ARGS_ERROR/, "argument parse failures must be reported as ARGS_ERROR envelopes");
    assert.match(dispatcher, /missing|required|value/i, "dispatcher must reject options with missing values");
  });
});
