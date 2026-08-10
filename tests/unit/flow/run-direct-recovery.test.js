import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { afterEach, test } from "node:test";

import { setupFlowAtStep } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

let root = null;

afterEach(() => {
  if (root) removeTmpDir(root);
  root = null;
});

test("flow run direct reports normal recovery availability without creating a second Flow state", () => {
  root = createTmpDir("run-direct-recovery-");
  const state = setupFlowAtStep(root, "impl-gate", {
    specId: "run-direct-recovery",
    runId: "run-direct-recovery",
    issue: 656,
  });
  const result = execFileSync(process.execPath, [
    path.resolve("src/sennel.js"),
    "flow", "run", "direct",
    "--expect-run-id", state.runId,
    "--expect-issue", String(state.issue),
    "--expect-spec", state.specId,
  ], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SENNEL_WORK_ROOT: root, SENNEL_SOURCE_ROOT: root },
  });
  const envelope = JSON.parse(result);

  assert.equal(envelope.ok, true);
  assert.equal(envelope.data.status, "unavailable");
  assert.equal(envelope.data.recovery.reason, "recovery-record-unavailable");
});
