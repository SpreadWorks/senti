// spec: R1 R2 R3

import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { makeFlowManager } from "../../../tests/helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import GetResolveContextCommand from "../../../src/flow/lib/get-resolve-context.js";
import { FlowCommand } from "../../../src/flow/lib/base-command.js";

const SENTI_CMD = path.join(process.cwd(), "src/senti.js");
const FLOW_ARGS = ["flow", "get", "resolve-context"];
const REQUIRED_TARGET_GUARDS = ["--expect-issue", "--expect-spec", "--expect-run-id"];
const TARGET_GUARDS = FLOW_COMMANDS.get.status.args.options;
const REGISTRY_SOURCE = fs.readFileSync(path.join(process.cwd(), "src/flow/registry.js"), "utf8");
const RESOLVE_CONTEXT_SOURCE = fs.readFileSync(
  path.join(process.cwd(), "src/flow/lib/get-resolve-context.js"),
  "utf8",
);

function setupFlowState(root) {
  const specId = "001-test";
  const state = {
    spec: `specs/${specId}/spec.json`,
    baseBranch: "main",
    featureBranch: "feature/001-test",
    runId: "run-001-test",
    issue: 429,
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [{
      id: "T-1",
      title: "Test task",
      goal: "Exercise resolve-context dispatch.",
      parent: null,
      origin: "plan",
      added_round: 0,
      status: "pending",
      steps: [],
    }],
    currentTaskId: null,
  };
  const flowManager = makeFlowManager(root);
  flowManager.create(state);
  flowManager.addActiveFlow(specId, "local");
  return state;
}

function runResolveContext(root, args = []) {
  return execFileSync("node", [SENTI_CMD, ...FLOW_ARGS, ...args], {
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: root },
  });
}

function mismatchEnvelope(root, args) {
  try {
    runResolveContext(root, args);
    assert.fail(`expected guarded resolve-context to fail: ${args.join(" ")}`);
  } catch (error) {
    return JSON.parse(error.stdout);
  }
}

describe("Issue #429 resolve-context target guards", () => {
  let tmp;

  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = undefined;
  });

  it("R1: exposes identical target guard options through registry dispatch and help", () => {
    const entry = FLOW_COMMANDS.get["resolve-context"];
    assert.deepEqual(TARGET_GUARDS, REQUIRED_TARGET_GUARDS);
    assert.deepEqual(entry.args?.options, TARGET_GUARDS);
    const resolveContextEntry = REGISTRY_SOURCE.match(
      /"resolve-context":\s*\{[\s\S]*?\n\s{4}\},\n\s{4}check:/,
    )?.[0];
    assert.ok(resolveContextEntry, "resolve-context registry source should be present");
    assert.match(
      resolveContextEntry,
      /args:\s*\{\s*options:\s*FLOW_TARGET_GUARD_OPTIONS\s*\}/,
      "resolve-context must reuse FLOW_TARGET_GUARD_OPTIONS",
    );

    const help = execFileSync("node", [SENTI_CMD, ...FLOW_ARGS, "--help"], {
      encoding: "utf8",
    });
    for (const option of TARGET_GUARDS) {
      assert.match(help, new RegExp(option));
    }
  });

  it("R2: accepts matching guards and rejects each mismatching guard with ACTIVE_FLOW_MISMATCH", () => {
    tmp = createTmpDir();
    const state = setupFlowState(tmp);

    const matching = JSON.parse(runResolveContext(tmp, [
      "--expect-run-id", state.runId,
      "--expect-issue", String(state.issue),
      "--expect-spec", state.spec,
    ]));
    assert.equal(matching.ok, true);
    assert.equal(matching.data.activeFlow, "001-test");
    assert.equal(matching.data.issue, state.issue);
    assert.equal(matching.data.spec, state.spec);

    const mismatches = [
      ["--expect-run-id", "run-other"],
      ["--expect-issue", "430"],
      ["--expect-spec", "specs/002-other/spec.json"],
    ];
    for (const args of mismatches) {
      const envelope = mismatchEnvelope(tmp, args);
      assert.equal(envelope.ok, false);
      assert.equal(envelope.errors[0].code, "ACTIVE_FLOW_MISMATCH");
    }
  });

  it("R3: preserves guard-free dispatch and inherited shared target validation", () => {
    tmp = createTmpDir();
    setupFlowState(tmp);

    const envelope = JSON.parse(runResolveContext(tmp));
    assert.equal(envelope.ok, true);
    assert.ok("dirty" in envelope.data);
    assert.equal(FLOW_COMMANDS.get["resolve-context"].targetGuard, undefined);

    const command = new GetResolveContextCommand();
    assert.ok(command instanceof FlowCommand);
    assert.equal(command.targetGuard, true);
    assert.doesNotMatch(
      RESOLVE_CONTEXT_SOURCE,
      /expect(?:RunId|RunID|Issue|Spec)|targetMismatchEnvelopeForInput|targetGuard\s*:/,
      "resolve-context must not implement target guard comparison or bypass locally",
    );
  });
});
