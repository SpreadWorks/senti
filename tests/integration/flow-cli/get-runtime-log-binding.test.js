import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { afterEach, it } from "node:test";

import { FlowTargetBinding } from "../../../src/lib/flow-target-guard.js";
import { RuntimeLogBlockWriter } from "../../../src/lib/runtime-log.js";
import { CanonicalFlowFixture, makeFlowManager } from "../../support/infrastructure/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";

const SENNEL = path.resolve("src/sennel.js");
const roots = [];

afterEach(() => {
  while (roots.length > 0) removeTmpDir(roots.pop());
});

function root() {
  const directory = createTmpDir("sennel-runtime-log-binding-");
  roots.push(directory);
  return directory;
}

function invoke(directory, args) {
  const result = spawnSync(process.execPath, [SENNEL, "flow", "get", "runtime-log", ...args], {
    cwd: directory,
    encoding: "utf8",
    timeout: 30_000,
    env: { ...process.env, SENNEL_WORK_ROOT: directory },
  });
  return { ...result, envelope: result.stdout.trim() === "" ? null : JSON.parse(result.stdout) };
}

it("reads a runtime log with the same opaque binding and rejects a genuine authority mismatch", () => {
  const directory = root();
  const flowManager = makeFlowManager(directory);
  const fixture = new CanonicalFlowFixture({
    flowManager,
    specId: "715-runtime-log-binding",
    runId: "runtime-log-binding-run",
  }).create().registerActive();
  const state = fixture.state();
  const writer = new RuntimeLogBlockWriter({
    root: directory,
    flowId: state.specId,
    runId: state.runId,
    command: "flow run gate",
  });
  writer.capture("stdout", "runtime log binding fixture\n");
  writer.close(0);
  const binding = FlowTargetBinding.captureContext({
    root: directory,
    mainRoot: directory,
    executionRoot: directory,
    flowState: state,
  }).serialize();

  const same = invoke(directory, ["--expect-binding", binding, "--format", "json"]);
  assert.equal(same.status, 0, same.stderr);
  assert.equal(same.envelope.ok, true);
  assert.match(same.envelope.data.text, /runtime log binding fixture/);

  const other = root();
  const mismatched = new FlowTargetBinding({
    runId: state.runId,
    issue: state.issue,
    specId: state.specId,
    authority: {
      mode: state.execution.mode,
      mainRoot: other,
      executionRoot: other,
      featureBranch: state.execution.mode === "branch" ? state.featureBranch : null,
      baseBranch: state.execution.mode === "branch" ? state.baseBranch : null,
    },
  }).serialize();
  const stale = invoke(directory, ["--expect-binding", mismatched, "--format", "json"]);
  assert.notEqual(stale.status, 0, stale.stderr);
  assert.equal(stale.envelope.errors[0].code, "ACTIVE_FLOW_MISMATCH");
});
