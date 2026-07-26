import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { FlowManager } from "../../../src/lib/flow-manager.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import RunRecoverExistingImplementationCommand from "../../../src/flow/lib/run-recover-existing-implementation.js";
import { buildRepairFingerprint } from "../../../src/flow/lib/impl-repair-artifacts.js";
import { writeRepairFingerprintManifest } from "../../../src/flow/lib/repair-state-identity.js";
import { findActiveNode } from "../../../src/flow/definition.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { makeFlowState, moveFlowToStep } from "../../helpers/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const SPEC_ID = "001-existing-implementation";
const SPEC_PATH = `specs/${SPEC_ID}/spec.json`;

function writeFile(root, relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function writeJson(root, relativePath, value) {
  writeFile(root, relativePath, `${JSON.stringify(value, null, 2)}\n`);
}

describe("recover existing implementation", () => {
  let tmp;

  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  it("records the recovery ledger and promotes post-implementation verification", () => {
    tmp = createTmpDir("recover-existing-implementation-");
    writeJson(tmp, SPEC_PATH, { goal: "Revalidate an already implemented flow.", requirements: [] });
    writeFile(tmp, "src/implementation.js", "export const delivery = 'before';\n");

    const state = moveFlowToStep(makeFlowState({
      runId: "run-existing-implementation",
      spec: SPEC_PATH,
      featureBranch: "feature/001-existing-implementation",
      planRewinds: [{ sourceStage: "acceptance-review", destinationStep: "draft" }],
    }), "scenario-validity");
    const manager = new FlowManager({ root: tmp, mainRoot: tmp, inWorktree: false });
    manager.create(state);
    manager.addActiveFlow(SPEC_ID, "branch");
    const activeState = manager.loadReadOnly();

    const specDir = path.join(tmp, `specs/${SPEC_ID}`);
    const previous = buildRepairFingerprint({ root: tmp, specPath: SPEC_PATH, state: activeState });
    writeRepairFingerprintManifest(specDir, previous);
    writeJson(tmp, `specs/${SPEC_ID}/test-execute-result.json`, {
      repairFingerprint: previous.hash,
    });
    writeFile(tmp, `specs/${SPEC_ID}/tests/.raw/test-execution.log`, "stale test evidence\n");
    writeJson(tmp, `specs/${SPEC_ID}/scenario-validity-result.json`, {
      version: "1",
      result: "block",
      preflight: { invalid_paths: ["src/implementation.js"] },
    });
    writeFile(tmp, "src/implementation.js", "export const delivery = 'after';\n");

    const result = new RunRecoverExistingImplementationCommand().execute({
      root: tmp,
      flowState: activeState,
      flowManager: manager,
      expectRunId: activeState.runId,
      expectSpec: activeState.spec,
      expectNoIssue: true,
    });

    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(result.data.activeStep, "test-execute");
    assert.deepEqual(result.data.skipped, ["scenario-validity", "test-review"]);
    assert.equal(fs.existsSync(path.join(specDir, "test-execute-result.json")), false);
    const refreshed = manager.loadReadOnly();
    assert.equal(findActiveNode(refreshed)?.stepId, "test-execute");
    assert.equal(findStepById(refreshed.steps, "scenario-validity")?.status, "skipped");
    assert.equal(findStepById(refreshed.steps, "test-review")?.status, "skipped");
    assert.equal(findStepById(refreshed.steps, "implement")?.status, "done");
    assert.equal(findStepById(refreshed.steps, "test-execute")?.status, "in_progress");
    const ledger = JSON.parse(fs.readFileSync(path.join(specDir, "impl-repair.json"), "utf8"));
    assert.equal(ledger.entries.length, 1);
    assert.deepEqual(ledger.entries[0].sourceFindingIds, ["test-evidence-refresh:existing-implementation-revalidation"]);
  });

  it("exposes the guarded recovery command through the flow registry", () => {
    const entry = FLOW_COMMANDS.run["recover-existing-implementation"];
    assert.ok(entry);
    assert.match(entry.help, /Usage: senti flow run recover-existing-implementation/);
    assert.ok(entry.args.options.includes("--expect-run-id"));
  });
});
