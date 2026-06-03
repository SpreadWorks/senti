// spec: R1 R2 R3 R4
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { executeCommitPost } from "../../../src/flow/lib/run-finalize.js";

function runGit(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, `git ${args.join(" ")} failed: ${result.stderr}`);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n");
}

function setupRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "finalize-retro-report-"));
  runGit(root, ["init"]);
  runGit(root, ["checkout", "-b", "main"]);
  runGit(root, ["config", "user.email", "test@example.com"]);
  runGit(root, ["config", "user.name", "Test User"]);
  fs.writeFileSync(path.join(root, "README.md"), "fixture\n");
  runGit(root, ["add", "README.md"]);
  runGit(root, ["commit", "-m", "initial"]);
  return root;
}

test("R1: executeCommitPost restores existing retro.json into report input", async () => {
  const root = setupRepo();
  const specRel = "specs/001-finalize-retro/spec.json";
  const specDir = path.join(root, "specs", "001-finalize-retro");
  writeJson(path.join(root, specRel), {
    goal: "fixture",
    requirements: [],
  });
  writeJson(path.join(specDir, "retro.json"), {
    summary: {
      total: 1,
      done: 1,
      partial: 0,
      not_done: 0,
      rate: 1,
    },
    requirements: [
      {
        id: "R1",
        desc: "retro result is displayed",
        status: "done",
      },
    ],
  });

  const results = {};
  await executeCommitPost({
    root,
    flowState: {
      spec: specRel,
      baseBranch: "main",
      requirements: [],
      metrics: [],
    },
    _results: results,
  });

  assert.equal(results.retro.status, "done");
  assert.equal(results.retro.summary.done, 1);
  assert.deepEqual(results.retro.requirements, [
    {
      id: "R1",
      desc: "retro result is displayed",
      status: "done",
    },
  ]);
});

test("R2: executeCommitPost still leaves results.retro unset when retro.json is absent", async () => {
  const root = setupRepo();
  const specRel = "specs/001-finalize-retro/spec.json";
  writeJson(path.join(root, specRel), {
    goal: "fixture",
    requirements: [],
  });

  const results = {};
  await executeCommitPost({
    root,
    flowState: {
      spec: specRel,
      baseBranch: "main",
      requirements: [],
      metrics: [],
    },
    _results: results,
  });

  assert.equal(results.retro, undefined);
});

test("R3: finalize report.json includes retro summary and requirements from retro.json", async () => {
  const root = setupRepo();
  const specRel = "specs/001-finalize-retro/spec.json";
  const specDir = path.join(root, "specs", "001-finalize-retro");
  writeJson(path.join(root, specRel), {
    goal: "fixture",
    requirements: [],
  });
  writeJson(path.join(specDir, "retro.json"), {
    summary: {
      total: 2,
      done: 1,
      partial: 1,
      not_done: 0,
      rate: 0.5,
    },
    requirements: [
      {
        id: "R1",
        desc: "partial item",
        status: "partial",
        note: "needs follow-up",
      },
    ],
  });

  await executeCommitPost({
    root,
    flowState: {
      spec: specRel,
      baseBranch: "main",
      requirements: [],
      metrics: [],
    },
    _results: {},
  });

  const report = JSON.parse(fs.readFileSync(path.join(specDir, "report.json"), "utf8"));
  assert.equal(report.data.retro.done, 1);
  assert.equal(report.data.retro.partial, 1);
  assert.equal(report.data.retro.not_done, 0);
  assert.equal(report.data.retro.rate, 0.5);
  assert.deepEqual(report.data.retro.requirements, [
    {
      id: "R1",
      desc: "partial item",
      status: "partial",
      note: "needs follow-up",
    },
  ]);
});

test("R4: finalize report text displays the Retro aggregate instead of only '-'", async () => {
  const root = setupRepo();
  const specRel = "specs/001-finalize-retro/spec.json";
  const specDir = path.join(root, "specs", "001-finalize-retro");
  writeJson(path.join(root, specRel), {
    goal: "fixture",
    requirements: [],
  });
  writeJson(path.join(specDir, "retro.json"), {
    summary: {
      total: 1,
      done: 1,
      partial: 0,
      not_done: 0,
      rate: 1,
    },
    requirements: [],
  });

  await executeCommitPost({
    root,
    flowState: {
      spec: specRel,
      baseBranch: "main",
      requirements: [],
      metrics: [],
    },
    _results: {},
  });

  const report = JSON.parse(fs.readFileSync(path.join(specDir, "report.json"), "utf8"));
  assert.match(report.text, /100%  \(1 done \/ 0 partial \/ 0 miss\)/);
  assert.doesNotMatch(report.text, /Retro\n[-\s]+\n\s+-\n/);
});
