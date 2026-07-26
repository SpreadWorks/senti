import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

import { FlowManager } from "../../src/lib/flow-manager.js";
import {
  WorktreeFlowBindingStore,
  WorktreeFlowIdentity,
} from "../../src/lib/worktree-flow-binding.js";
import { createTmpDir, removeTmpDir } from "./tmp-dir.js";
import {
  makeFlowState,
  moveFlowToStep,
} from "./flow-setup.js";

export function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

export function createDirectFlowFixture({
  specId = "476-direct",
  issue = 476,
} = {}) {
  const root = createTmpDir("senti-direct-flow-");
  git(root, ["init", "--quiet"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "Test User"]);
  fs.writeFileSync(path.join(root, "README.md"), "# direct flow fixture\n");
  fs.writeFileSync(path.join(root, ".gitignore"), ".tmp/\n.senti/worktree/\n");
  fs.writeFileSync(path.join(root, "package.json"), `${JSON.stringify({
    name: "direct-flow-fixture",
    version: "0.0.0",
    type: "module",
  }, null, 2)}\n`);
  fs.mkdirSync(path.join(root, ".senti"), { recursive: true });
  fs.writeFileSync(path.join(root, ".senti", "config.json"), `${JSON.stringify({
    lang: "en",
    type: "base",
    commands: { gh: "disable" },
    docs: { languages: ["en"], defaultLanguage: "en" },
  }, null, 2)}\n`);
  git(root, ["add", "README.md", ".gitignore", "package.json", ".senti/config.json"]);
  git(root, ["commit", "--quiet", "-m", "initial"]);
  const remotePath = path.join(root, ".git", "test-origin.git");
  execFileSync("git", ["init", "--bare", "--quiet", remotePath], { encoding: "utf8" });
  git(root, ["remote", "add", "origin", remotePath]);
  git(root, ["push", "--quiet", "-u", "origin", "master"]);

  const spec = `specs/${specId}/spec.json`;
  const featureBranch = `feature/${specId}`;
  const worktreePath = path.join(
    root,
    ".senti",
    "worktree",
    featureBranch.replaceAll("/", "-"),
  );
  git(root, ["worktree", "add", "-b", featureBranch, worktreePath]);

  const state = moveFlowToStep(makeFlowState({
    spec,
    runId: `run-${specId}`,
    issue,
    baseBranch: "master",
    featureBranch,
    worktree: true,
  }), "implement");
  state.state = { mergeStrategy: "squash" };
  const specDir = path.join(worktreePath, "specs", specId);
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "flow.json"), `${JSON.stringify(state, null, 2)}\n`);
  fs.writeFileSync(path.join(specDir, "spec.json"), `${JSON.stringify({
    goal: "Exercise the bounded direct completion path.",
    background: "",
    scope: { in: ["Direct flow fixture"], out: [] },
    constraints: [],
    design_principles: [],
    overview: { modules: [], data_flow: [], decisions: [] },
    requirements: [],
    acceptance_criteria: [],
    clarifications: [],
    alternatives_considered: [],
    open_questions: [],
  }, null, 2)}\n`);
  git(worktreePath, ["add", `specs/${specId}`]);
  git(worktreePath, ["commit", "--quiet", "-m", "add managed flow"]);

  const excludePath = git(worktreePath, ["rev-parse", "--git-path", "info/exclude"]);
  fs.appendFileSync(excludePath, [
    "/.senti/flow-identity.json",
    "/.senti/flow-identity.issue-transaction.json",
    "",
  ].join("\n"));
  new WorktreeFlowBindingStore({ worktreePath }).save(new WorktreeFlowIdentity({
    runId: state.runId,
    issue,
    spec,
    worktreePath,
  }));
  new FlowManager({
    root,
    mainRoot: root,
    inWorktree: false,
    specId,
  }).addActiveFlow(specId, "worktree");

  function context({ fromMain = false } = {}) {
    const targetRoot = fromMain ? root : worktreePath;
    const flowManager = new FlowManager({
      root: targetRoot,
      mainRoot: root,
      inWorktree: !fromMain,
      specId,
    });
    return {
      root: targetRoot,
      mainRoot: root,
      inWorktree: !fromMain,
      flowManager,
      flowState: flowManager.loadReadOnly(specId),
      expectRunId: state.runId,
      expectIssue: issue,
      expectSpec: spec,
      config: { commands: { gh: "disable" } },
    };
  }

  function cleanup() {
    if (fs.existsSync(root)) {
      const registered = spawnSync(
        "git",
        ["-C", root, "worktree", "list", "--porcelain"],
        { encoding: "utf8" },
      );
      if (registered.status === 0 && registered.stdout.includes(`worktree ${worktreePath}`)) {
        spawnSync(
          "git",
          ["-C", root, "worktree", "remove", "--force", worktreePath],
          { encoding: "utf8" },
        );
      }
      removeTmpDir(root);
    }
  }

  return {
    root,
    specId,
    spec,
    issue,
    featureBranch,
    worktreePath,
    runId: state.runId,
    context,
    cleanup,
  };
}
