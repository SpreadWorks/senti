// spec: R3 R4 R5
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../tests/helpers/tmp-dir.js";
import { initGitRepo, commitAll } from "../../../tests/helpers/git-repo.js";

const SDD_FORGE = path.join(process.cwd(), "src/sdd-forge.js");

function projectConfig(command) {
  return {
    lang: "en",
    type: "node-cli",
    scan: { include: ["src/**/*.js"], exclude: [] },
    docs: { languages: ["en"], defaultLanguage: "en" },
    flow: {
      hooks: {
        PostWorktree: command,
      },
    },
  };
}

function setupProject(command) {
  const root = createTmpDir("sdd-post-worktree-");
  writeJson(root, ".sdd-forge/config.json", projectConfig(command));
  writeJson(root, "package.json", { name: "hook-project", version: "1.0.0", type: "module" });
  writeFile(root, "src/index.js", "export const value = 1;\n");
  writeFile(root, ".sdd-forge/output/.gitkeep", "");
  initGitRepo(root);
  commitAll(root, "initial");
  return root;
}

function runSdd(args, root, opts = {}) {
  return execFileSync("node", [SDD_FORGE, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SDD_FORGE_WORK_ROOT: root },
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });
}

function runFlowPrepare(root, title = "hook-order") {
  const output = runSdd(["flow", "prepare", "--title", title, "--worktree", "--request", "test request"], root);
  return JSON.parse(output);
}

describe("280 PostWorktree integration and hook list CLI", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("R5: hook CLI regression returns PostWorktree table output", () => {
    tmp = setupProject("printf hook-coverage");

    const output = runSdd(["hook", "list"], tmp);
    assert.match(output, /PostWorktree/);
  });

  it("R3: flow prepare --worktree invokes PostWorktree in the new worktree before spec files are written", () => {
    const command = [
      "node -e",
      "\"const fs=require('fs');",
      "fs.writeFileSync('post-worktree.marker', JSON.stringify({ cwd: process.cwd(), specs: fs.existsSync('specs') }))\"",
    ].join(" ");
    tmp = setupProject(command);

    const envelope = runFlowPrepare(tmp);
    const worktreePath = envelope.data.artifacts.worktree;
    const marker = JSON.parse(fs.readFileSync(path.join(worktreePath, "post-worktree.marker"), "utf8"));

    assert.equal(marker.cwd, worktreePath);
    assert.equal(marker.specs, false, "PostWorktree must run before specs/ is created");
    assert.ok(fs.existsSync(path.join(worktreePath, envelope.data.artifacts.specDir, "spec.json")));
  });

  it("R3: flow prepare --worktree continues when PostWorktree exits non-zero", () => {
    tmp = setupProject("node -e \"process.stderr.write('expected hook failure'); process.exit(9)\"");

    const envelope = runFlowPrepare(tmp, "hook-failure");
    const specPath = path.join(envelope.data.artifacts.worktree, envelope.data.artifacts.specDir, "spec.json");

    assert.equal(envelope.ok, true);
    assert.ok(fs.existsSync(specPath), "prepare must still create spec files after a hook failure");
  });

  it("R4: sdd-forge hook list prints PostWorktree metadata and current configured command", () => {
    tmp = setupProject("printf hook-list");

    const output = runSdd(["hook", "list"], tmp);

    assert.match(output, /PostWorktree/);
    assert.match(output, /CWD/);
    assert.match(output, /worktree/i);
    assert.match(output, /printf hook-list/);
  });

  it("R4: sdd-forge hook list --json returns structured PostWorktree data", () => {
    tmp = setupProject("printf hook-json");

    const hooks = JSON.parse(runSdd(["hook", "list", "--json"], tmp));
    const postWorktree = hooks.find((hook) => hook.name === "PostWorktree");

    assert.ok(postWorktree);
    assert.match(postWorktree.description, /worktree/i);
    assert.deepEqual(postWorktree.placeholders, ["CWD"]);
    assert.equal(postWorktree.command, "printf hook-json");
  });

  it("R4: sdd-forge hook list rejects invalid arguments", () => {
    tmp = setupProject("printf hook-invalid");

    assert.throws(
      () => runSdd(["hook", "list", "--unknown"], tmp),
      (err) => {
        assert.notEqual(err.status, 0);
        assert.match(err.stderr, /Unknown option|Unexpected argument|unknown/i);
        return true;
      },
    );
  });
});
