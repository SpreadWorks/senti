import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const cliPath = path.join(repoRoot, "src/senti.js");
const fixtureRoot = path.join(repoRoot, ".tmp", "issue-497-draft-promotion");
const roots = [];

function git(root, args) {
  const result = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function createProject() {
  fs.mkdirSync(fixtureRoot, { recursive: true });
  const root = fs.mkdtempSync(path.join(fixtureRoot, "project-"));
  roots.push(root);
  fs.mkdirSync(path.join(root, ".senti"), { recursive: true });
  fs.writeFileSync(path.join(root, ".senti", "config.json"), JSON.stringify({
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
  }, null, 2));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({
    name: "draft-promotion-fixture",
    version: "0.0.0",
    type: "module",
  }, null, 2));
  fs.writeFileSync(path.join(root, ".gitignore"), ".senti/*\n!.senti/config.json\n");
  git(root, ["init", "-b", "main"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "Test User"]);
  git(root, ["add", ".senti/config.json", ".gitignore", "package.json"]);
  git(root, ["commit", "-m", "fixture"]);
  return root;
}

function runFlow(root, args) {
  const result = spawnSync("node", [cliPath, "flow", ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: root },
  });
  const stdout = result.stdout.trim();
  return { ...result, envelope: stdout.startsWith("{") ? JSON.parse(stdout) : null };
}

function expectSuccess(result) {
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.envelope?.ok, true, result.stderr || result.stdout);
  return result.envelope.data;
}

function prepareWorktree(root, issue, title) {
  const initialized = expectSuccess(runFlow(root, [
    "set", "init", "--request", `fix Issue #${issue}`, "--issue", String(issue),
  ]));
  return expectSuccess(runFlow(root, [
    "prepare", "--title", title, "--base", "main", "--worktree", "--run-id", initialized.runId,
  ]));
}

function targetArgs(flow, issue) {
  return [
    "--expect-run-id", flow.runId,
    "--expect-issue", String(issue),
    "--expect-spec", flow.specId,
  ];
}

function writeExecutionDraft(flow, value) {
  const file = path.join(flow.worktreePath, "specs", flow.specId, "draft.json");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
  return file;
}

function canonicalDraft(root, flow) {
  return path.join(root, "specs", flow.specId, "draft.json");
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("worktree draft promotion", () => {
  it("publishes each active Flow's completed draft to only its canonical artifact", () => {
    const root = createProject();
    const first = prepareWorktree(root, 497, "first canonical draft");
    const second = prepareWorktree(root, 498, "second canonical draft");
    const firstSource = writeExecutionDraft(first, { goal: "first completed draft", qa: [] });
    const secondSource = writeExecutionDraft(second, { goal: "second completed draft", qa: [] });
    const secondPlaceholder = fs.readFileSync(canonicalDraft(root, second));

    const firstCompletion = expectSuccess(runFlow(first.worktreePath, [
      "set", "step", "draft", "done", ...targetArgs(first, 497),
    ]));
    assert.equal(firstCompletion.promoted, true);
    assert.deepEqual(fs.readFileSync(canonicalDraft(root, first)), fs.readFileSync(firstSource));
    assert.deepEqual(fs.readFileSync(canonicalDraft(root, second)), secondPlaceholder);

    const secondCompletion = expectSuccess(runFlow(second.worktreePath, [
      "set", "step", "draft", "done", ...targetArgs(second, 498),
    ]));
    assert.equal(secondCompletion.promoted, true);
    assert.deepEqual(fs.readFileSync(canonicalDraft(root, second)), fs.readFileSync(secondSource));

    for (const flow of [first, second]) {
      const state = JSON.parse(fs.readFileSync(path.join(root, "specs", flow.specId, "flow.json"), "utf8"));
      assert.equal(state.steps[0].children.find((step) => step.id === "draft").status, "done");
      assert.equal(state.steps[0].children.find((step) => step.id === "draft-questions-review").status, "in_progress");
      assert.equal(state.draftArtifactPromotion, undefined);
      assert.match(state.draftArtifactRevision.digest, /^[a-f0-9]{64}$/);
    }
  });
});
