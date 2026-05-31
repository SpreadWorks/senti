// spec: R7 R8
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..", "..", "..");
const toolPath = path.join(repoRoot, "src", "scripts", "rename-phase-steps.js");

// flow.json with flow-scope (steps[]) and task-scope (tasks[].steps[]) step ids.
function flowJson() {
  return {
    steps: [
      { id: "plan", children: [
        { id: "gate-draft", status: "done" },
        { id: "gate", status: "done" },
      ] },
      { id: "impl", children: [
        { id: "review", status: "done" },
        { id: "gate-impl", status: "done" },
      ] },
    ],
    tasks: [
      { id: "T-1", steps: [
        { id: "impl", status: "done" },
        { id: "review", status: "done" },
        { id: "gate-impl", status: "done" },
      ] },
    ],
  };
}

function issueLogJson() {
  // All 7 unambiguous 1:1 ids (must convert) plus gate-impl collision (must stay).
  return [
    { step: "gate", reason: "w", timestamp: "t" },
    { step: "gate-draft", reason: "x", timestamp: "t" },
    { step: "gate-impl", reason: "y", timestamp: "t" },
    { step: "review-draft-questions", reason: "z", timestamp: "t" },
    { step: "review-draft-coverage", reason: "z", timestamp: "t" },
    { step: "review-spec", reason: "z", timestamp: "t" },
    { step: "review-test", reason: "z", timestamp: "t" },
    { step: "spec-review-triage", reason: "z", timestamp: "t" },
    { step: "review", reason: "c", timestamp: "t" },
    { step: "impl", reason: "c", timestamp: "t" },
  ];
}

// review.md: unambiguous id `gate-draft` placed in prose (keep), a fenced code block
// (rename) and an inline-code path (rename). Markdown replacement is code-block/path only.
const REVIEW_MD = [
  "# Review",
  "",
  "In prose we mention gate-draft as a step name and it must stay untouched.",
  "",
  "```text",
  "current step: gate-draft",
  "collision step: gate-impl",
  "```",
  "",
  "Path ref: `specs/alpha/gate-draft/output.txt`",
  "",
].join("\n");

// report/retro JSON: path-string values (contain `/`) rename UNAMBIGUOUS ids; collision ids
// (review/gate-impl/impl) are left as-is in these flat files (no scope, like issue-log);
// prose values are never replaced.
function reportJson() {
  return {
    narrative: "the gate-draft step failed (prose)",
    artifact_path: "specs/alpha/gate-draft/log.txt",
    collision_path: "logs/gate-impl/run.txt",
  };
}
function retroJson() {
  return {
    lesson: "gate-draft prose mention",
    evidence_path: "logs/gate-draft/run.json",
    collision_path: "logs/gate-impl/run.json",
  };
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "rename-steps-"));
  const writeSpec = (id, { active = false } = {}) => {
    const dir = path.join(root, "specs", id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "flow.json"), JSON.stringify(flowJson(), null, 2));
    fs.writeFileSync(path.join(dir, "issue-log.json"), JSON.stringify(issueLogJson(), null, 2));
    fs.writeFileSync(path.join(dir, "review.md"), REVIEW_MD);
    fs.writeFileSync(path.join(dir, "report.json"), JSON.stringify(reportJson(), null, 2));
    fs.writeFileSync(path.join(dir, "retro.json"), JSON.stringify(retroJson(), null, 2));
  };
  writeSpec("alpha");
  writeSpec("active-spec");
  fs.mkdirSync(path.join(root, ".sdd-forge"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".sdd-forge", ".active-flow"),
    JSON.stringify([{ spec: "active-spec", mode: "worktree" }]),
  );
  return root;
}

function runTool(root, args) {
  return spawnSync("node", [toolPath, ...args], {
    cwd: root,
    env: { ...process.env, SDD_WORK_ROOT: root },
    encoding: "utf8",
  });
}

function gitInit(root) {
  const g = (...a) => spawnSync("git", ["-C", root, ...a], { encoding: "utf8" });
  g("init", "-q");
  g("-c", "user.email=t@t", "-c", "user.name=t", "add", "-A");
  spawnSync("git", ["-C", root, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "-m", "fixture"], { encoding: "utf8" });
}

test("R7: dry-run (default) reports changes and writes nothing, exit 0", () => {
  assert.ok(fs.existsSync(toolPath), "migration tool src/scripts/rename-phase-steps.js must exist");
  const root = makeFixture();
  const before = fs.readFileSync(path.join(root, "specs", "alpha", "flow.json"), "utf8");
  const res = runTool(root, []);
  assert.equal(res.status, 0, `dry-run should exit 0; stderr=${res.stderr}`);
  const after = fs.readFileSync(path.join(root, "specs", "alpha", "flow.json"), "utf8");
  assert.equal(after, before, "dry-run must not modify files");
  // dry-run must print the planned diff (new names appear in the report)
  assert.match(res.stdout, /draft-gate/, "dry-run should report planned rename to draft-gate");
});

test("R7: invalid argument exits non-zero", () => {
  assert.ok(fs.existsSync(toolPath), "migration tool src/scripts/rename-phase-steps.js must exist");
  const root = makeFixture();
  const res = runTool(root, ["--bogus-flag"]);
  assert.notEqual(res.status, 0, "invalid argument should exit non-zero");
});

test("R7: --apply on a non-clean / non-git root exits non-zero", () => {
  assert.ok(fs.existsSync(toolPath), "migration tool src/scripts/rename-phase-steps.js must exist");
  const root = makeFixture(); // not a git repo
  const res = runTool(root, ["--apply"]);
  assert.notEqual(res.status, 0, "--apply must refuse when git tree is not clean / not a repo");
});

test("R7: --apply refuses a dirty git worktree", () => {
  assert.ok(fs.existsSync(toolPath), "migration tool src/scripts/rename-phase-steps.js must exist");
  const root = makeFixture();
  gitInit(root);
  fs.writeFileSync(path.join(root, "specs", "alpha", "uncommitted.txt"), "dirty");
  const res = runTool(root, ["--apply"]);
  assert.notEqual(res.status, 0, "--apply must refuse when the git worktree has uncommitted changes");
});

test("R8: --apply converts flow.json by scope and leaves issue-log collisions and active flow untouched", () => {
  assert.ok(fs.existsSync(toolPath), "migration tool src/scripts/rename-phase-steps.js must exist");
  const root = makeFixture();
  gitInit(root);
  const res = runTool(root, ["--apply"]);
  assert.equal(res.status, 0, `--apply should exit 0 on clean repo; stderr=${res.stderr}`);

  const alphaFlow = JSON.parse(fs.readFileSync(path.join(root, "specs", "alpha", "flow.json"), "utf8"));
  const planLeaves = alphaFlow.steps[0].children.map((s) => s.id);
  const implLeaves = alphaFlow.steps[1].children.map((s) => s.id);
  const taskLeaves = alphaFlow.tasks[0].steps.map((s) => s.id);
  // 1:1 and flow-scope collision conversions
  assert.deepEqual(planLeaves, ["draft-gate", "spec-gate"]);
  assert.deepEqual(implLeaves, ["impl-review", "impl-gate"]);
  // task-scope collision conversions
  assert.deepEqual(taskLeaves, ["task-impl", "task-review", "task-gate"]);

  const alphaLog = JSON.parse(fs.readFileSync(path.join(root, "specs", "alpha", "issue-log.json"), "utf8"));
  const logSteps = alphaLog.map((e) => e.step);
  // all 7 unambiguous 1:1 ids converted; collision id (gate-impl) left as-is in flat issue-log
  assert.deepEqual(logSteps, [
    "spec-gate",
    "draft-gate",
    "gate-impl",
    "draft-questions-review",
    "draft-coverage-review",
    "spec-review",
    "test-review",
    "spec-triage",
    "review",
    "impl",
  ]);

  const activeFlow = fs.readFileSync(path.join(root, "specs", "active-spec", "flow.json"), "utf8");
  assert.ok(activeFlow.includes("gate-impl"), "active flow's flow.json must be excluded (unchanged)");
  assert.ok(!activeFlow.includes("impl-gate"), "active flow's flow.json must not be converted");

  // review.md: unambiguous gate-draft renamed in code-block + path; prose kept;
  // collision id gate-impl left as-is (flat file, no scope) and NOT scope-guessed.
  const reviewMd = fs.readFileSync(path.join(root, "specs", "alpha", "review.md"), "utf8");
  assert.equal((reviewMd.match(/gate-draft/g) || []).length, 1, "review.md prose 'gate-draft' must remain");
  assert.equal((reviewMd.match(/draft-gate/g) || []).length, 2, "review.md code-block and path 'gate-draft' must be renamed");
  assert.ok(reviewMd.includes("gate-impl"), "review.md collision id 'gate-impl' must be left unchanged");
  assert.ok(!/impl-gate|task-gate/.test(reviewMd), "review.md collision id must not be scope-guessed");

  // report/retro JSON: path-string unambiguous ids renamed; prose kept; collision ids left.
  const report = JSON.parse(fs.readFileSync(path.join(root, "specs", "alpha", "report.json"), "utf8"));
  assert.ok(report.artifact_path.includes("draft-gate"), "report.json path-string value must be renamed");
  assert.ok(report.narrative.includes("gate-draft"), "report.json prose narrative must be untouched");
  assert.equal(report.collision_path, "logs/gate-impl/run.txt", "report.json collision id path must be left unchanged");
  const retro = JSON.parse(fs.readFileSync(path.join(root, "specs", "alpha", "retro.json"), "utf8"));
  assert.ok(retro.evidence_path.includes("draft-gate"), "retro.json path-string value must be renamed");
  assert.ok(retro.lesson.includes("gate-draft"), "retro.json prose value must be untouched");
  assert.equal(retro.collision_path, "logs/gate-impl/run.json", "retro.json collision id path must be left unchanged");
});

// NOTE: R8's live-repository application (running the tool against this repo's specs/
// and committing the result as a separate logical commit) is intentionally NOT asserted
// here. Per T-7's test_strategy the migration is verified deterministically on the tmp
// fixture above ("live repo ではなく fixture で決定的に検証"). A live-repo assertion at
// test-execute time would (1) contradict that strategy, (2) require the tool's --apply on
// an already-clean tree before the implementation is committed (an impossible ordering,
// since the worktree is dirty during implement and finalize-commit runs later), and
// (3) over-assert whole-file flow.json text against the spec's structural / no-scope-guess
// principle (historical free-text fields legitimately retain legacy tokens). The live
// application is verified by inspecting the finalize migration commit's diff, per R8's
// acceptance ("変換有無は適用後の各ファイル内容（diff）で検証できる").
