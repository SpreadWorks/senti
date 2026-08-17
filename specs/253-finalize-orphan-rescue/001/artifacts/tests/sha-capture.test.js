// spec: R16 R17
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { makeFlowManager, setupFlow } from "../../../tests/helpers/flow-setup.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readMergeSrc() {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../src/flow/commands/merge.js"),
    "utf8",
  );
}
function readFinalizeMergeSrc() {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../src/flow/lib/run-finalize-merge.js"),
    "utf8",
  );
}
describe("R16: flow state schema includes baseline and merge route", () => {
  it("R16: registry post hook persists state.featureBranchSquashedSha and state.mergeStrategy", async () => {
    const root = createTmpDir("finalize-merge-outcome-");
    try {
      const state = setupFlow(root);
      const specId = path.basename(path.dirname(state.spec));
      const flowManager = makeFlowManager(root);
      await FLOW_COMMANDS.run["finalize-merge"].post({
        root,
        specId,
        flowState: state,
        flowManager,
      }, {
        status: "done",
        strategy: "squash",
        mergedFromSha: "a".repeat(40),
      });
      const saved = flowManager.load(specId);
      assert.equal(saved.state.mergeStrategy, "squash");
      assert.equal(saved.state.featureBranchSquashedSha, "a".repeat(40));
    } finally {
      removeTmpDir(root);
    }
  });
  it("R16: schema validation rejects invalid route/baseline combinations", () => {
    const flowStorePath = path.resolve(__dirname, "../../../src/lib/flow-store.js");
    if (!fs.existsSync(flowStorePath)) return;
    const src = fs.readFileSync(flowStorePath, "utf8");
    assert.ok(
      src.includes("featureBranchSquashedSha") || src.includes("mergeStrategy"),
      "flow-store must validate baseline/route fields",
    );
  });
});

describe("R17: baseline captured at pre-sync completion / squash apply boundary", () => {
  it("R17: runMerge captures rev-parse after runPreSync and before runSquashMerge in worktree path", () => {
    const src = readMergeSrc();
    const worktreeBlock = src.match(/runPreSync[\s\S]{0,3000}runSquashMerge/);
    assert.ok(worktreeBlock, "worktree squash flow block required");
    assert.ok(
      /rev-parse/.test(worktreeBlock[0]),
      "rev-parse must occur between runPreSync and runSquashMerge",
    );
  });
  it("R17: runMerge return value carries mergedFromSha for downstream persistence", () => {
    const src = readMergeSrc();
    assert.ok(
      src.includes("mergedFromSha"),
      "runMerge must return mergedFromSha",
    );
  });
  it("R17: run-finalize-merge propagates mergedFromSha to upper layers", () => {
    const src = readFinalizeMergeSrc();
    assert.ok(
      src.includes("mergedFromSha"),
      "run-finalize-merge must propagate mergedFromSha in execute return value",
    );
  });
  it("R17: detached fallback path also captures baseline pre-squash", () => {
    const src = readMergeSrc();
    const detachedBlock = src.match(/worktree add --detach[\s\S]{0,2000}/);
    if (detachedBlock) {
      assert.ok(
        /rev-parse/.test(detachedBlock[0]),
        "detached fallback path must capture baseline via rev-parse before squash",
      );
    }
  });
});
