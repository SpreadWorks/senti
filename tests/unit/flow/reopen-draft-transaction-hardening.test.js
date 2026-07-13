import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const SPEC_ID = "441-single-state-atomic";
const SPEC_PATH = `specs/${SPEC_ID}/spec.json`;

function manager(root) {
  return new FlowManager({ root, mainRoot: root, inWorktree: false });
}

function state(marker) {
  return {
    spec: SPEC_PATH,
    baseBranch: "main",
    featureBranch: `feature/${SPEC_ID}`,
    runId: "run-single-state-atomic",
    issue: 441,
    marker,
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [],
    currentTaskId: null,
  };
}

function flowPath(root) {
  return path.join(root, "specs", SPEC_ID, "flow.json");
}

function tempFiles(root) {
  const directory = path.dirname(flowPath(root));
  return fs.readdirSync(directory).filter((name) => name.startsWith(".flow.json.") && name.endsWith(".tmp"));
}

describe("Issue #441 single-state atomic flow replacement", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("preserves the existing mode and leaves no temporary file on success", () => {
    tmp = createTmpDir("reopen-atomic-success-");
    const fm = manager(tmp);
    fm.save(state("old"));
    fs.chmodSync(flowPath(tmp), 0o640);

    const result = fm.saveAtomic(state("new"));

    assert.equal(result.committed, true);
    assert.equal(JSON.parse(fs.readFileSync(flowPath(tmp), "utf8")).marker, "new");
    assert.equal(fs.statSync(flowPath(tmp)).mode & 0o777, 0o640);
    assert.deepEqual(tempFiles(tmp), []);
  });

  it("keeps old bytes before rename and complete new bytes after rename across durability faults", () => {
    const failures = [
      ["before-temp-write", false],
      ["after-temp-write", false],
      ["before-file-fsync", false],
      ["after-file-fsync", false],
      ["before-rename", false],
      ["after-rename", true],
      ["before-dir-fsync", true],
      ["after-dir-fsync", true],
    ];

    for (const [phase, committed] of failures) {
      tmp = createTmpDir(`reopen-atomic-${phase}-`);
      const fm = manager(tmp);
      fm.save(state("old"));
      fs.chmodSync(flowPath(tmp), 0o640);
      const oldBytes = fs.readFileSync(flowPath(tmp));

      assert.throws(
        () => fm.saveAtomic(state("new"), {
          faultInjector(event) {
            if (event.phase === phase) throw new Error(phase);
          },
        }),
        (err) => err.code === "FLOW_STATE_ATOMIC_SAVE_FAILED" && err.committed === committed,
        phase,
      );

      const bytes = fs.readFileSync(flowPath(tmp));
      assert.doesNotThrow(() => JSON.parse(bytes.toString("utf8")), phase);
      if (committed) {
        assert.equal(JSON.parse(bytes.toString("utf8")).marker, "new", phase);
      } else {
        assert.deepEqual(bytes, oldBytes, phase);
      }
      assert.equal(fs.statSync(flowPath(tmp)).mode & 0o777, 0o640, phase);
      assert.deepEqual(tempFiles(tmp), [], phase);
      removeTmpDir(tmp);
      tmp = null;
    }
  });
});
