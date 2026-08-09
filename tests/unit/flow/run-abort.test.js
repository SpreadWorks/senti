import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";
import { RunAbortCommand } from "../../../src/flow/lib/run-abort.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import {
  WorktreeFlowBindingStore,
  WorktreeFlowIdentity,
} from "../../../src/lib/worktree-flow-binding.js";
import { makeFlowState } from "../../helpers/flow-setup.js";
import { commitAll, initGitRepo } from "../../helpers/git-repo.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

let root;

afterEach(() => {
  if (root) removeTmpDir(root);
  root = null;
});

test("abort removes only the selected worktree, branch, spec directory, and active entry", async () => {
  root = createTmpDir("flow-abort-target-");
  initGitRepo(root);
  const specRoot = "flow-artifacts/specs";
  fs.writeFileSync(path.join(root, "README.md"), "baseline\n");
  fs.writeFileSync(path.join(root, ".gitignore"), `${specRoot}/\n`);
  commitAll(root, "test: baseline");

  const specId = "485-abort-target";
  const otherSpecId = "486-other-flow";
  const worktreePath = path.join(root, ".senrail", "worktree", "feature-485-abort-target");
  execFileSync("git", ["worktree", "add", "-q", "-b", `feature/${specId}`, worktreePath, "main"], { cwd: root });
  const excludePath = execFileSync("git", ["rev-parse", "--git-path", "info/exclude"], {
    cwd: worktreePath,
    encoding: "utf8",
  }).trim();
  fs.appendFileSync(excludePath, "/.senrail/flow-identity.json\n");

  const manager = new FlowManager({
    root,
    mainRoot: root,
    inWorktree: false,
    specRoot,
  });
  const state = makeFlowState({
    specId,
    runId: "run-485-abort-target",
    featureBranch: `feature/${specId}`,
    worktree: true,
  });
  manager.create(state);
  manager.addActiveFlow(specId, "worktree");
  const identity = new WorktreeFlowIdentity({
    runId: state.runId,
    issue: null,
    specId,
    worktreePath,
  });
  new WorktreeFlowBindingStore({ worktreePath }).save(identity);

  const other = makeFlowState({
    specId: otherSpecId,
    runId: "run-486-other-flow",
    featureBranch: "main",
  });
  manager.create(other);
  manager.addActiveFlow(otherSpecId, "local");
  fs.writeFileSync(path.join(root, "unrelated.txt"), "keep me\n");

  const selected = manager.loadReadOnly(specId);
  const result = await new RunAbortCommand().execute({
    root,
    mainRoot: root,
    flowManager: manager,
    flowState: selected,
    specLocation: manager.specLocation(specId),
    force: false,
  });

  assert.equal(result.status, "aborted");
  assert.equal(fs.existsSync(worktreePath), false);
  assert.equal(fs.existsSync(manager.specLocation(specId).directory), false);
  assert.equal(fs.existsSync(manager.specLocation(otherSpecId).flowStateFile), true);
  assert.equal(fs.readFileSync(path.join(root, "unrelated.txt"), "utf8"), "keep me\n");
  assert.deepEqual(manager.loadActiveFlows(), [{ mode: "local", specId: otherSpecId }]);
});
