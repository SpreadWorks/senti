import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../helpers/tmp-dir.js";
import { initGitRepo, commitAll } from "../../../helpers/git-repo.js";

const SENTI = path.join(process.cwd(), "src/senti.js");

function config(command) {
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
  const root = createTmpDir("senti-post-worktree-e2e-");
  writeJson(root, ".senti/config.json", config(command));
  writeJson(root, "package.json", { name: "post-worktree-e2e", version: "1.0.0", type: "module" });
  writeFile(root, "src/index.js", "export const value = 1;\n");
  writeFile(root, ".senti/output/.gitkeep", "");
  initGitRepo(root);
  commitAll(root, "initial");
  return root;
}

function runPrepare(root, title = "post-worktree") {
  const output = execFileSync("node", [
    SENTI,
    "flow",
    "prepare",
    "--title",
    title,
    "--worktree",
    "--request",
    "post worktree test",
  ], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: root },
  });
  return JSON.parse(output);
}

describe("flow prepare PostWorktree hook", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("runs PostWorktree in the new worktree before spec files are written", () => {
    const command = [
      "node -e",
      "\"const fs=require('fs');",
      "fs.writeFileSync('post-worktree.marker', JSON.stringify({ cwd: process.cwd(), specs: fs.existsSync('specs') }))\"",
    ].join(" ");
    tmp = setupProject(command);

    const envelope = runPrepare(tmp);
    const worktreePath = envelope.data.artifacts.worktree;
    const marker = JSON.parse(fs.readFileSync(path.join(worktreePath, "post-worktree.marker"), "utf8"));

    assert.equal(marker.cwd, worktreePath);
    assert.equal(marker.specs, false);
    assert.ok(fs.existsSync(path.join(worktreePath, envelope.data.artifacts.specDir, "spec.json")));
  });

  it("continues prepare when PostWorktree exits non-zero", () => {
    tmp = setupProject("node -e \"process.stderr.write('expected hook failure'); process.exit(9)\"");

    const envelope = runPrepare(tmp, "post-worktree-failure");
    const specPath = path.join(envelope.data.artifacts.worktree, envelope.data.artifacts.specDir, "spec.json");

    assert.equal(envelope.ok, true);
    assert.ok(fs.existsSync(specPath));
  });
});
