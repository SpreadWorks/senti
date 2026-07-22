// spec: R2 R5 R7
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { commitAll, initGitRepo } from "../../../tests/helpers/git-repo.js";
import {
  makeFlowManager,
  makeFlowState,
  moveFlowToStep,
  setupFlowConfig,
} from "../../../tests/helpers/flow-setup.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (relPath) => {
  const file = path.join(root, relPath);
  assert.ok(fs.existsSync(file), `${relPath} must be implemented`);
  return fs.readFileSync(file, "utf8");
};
const importRoot = (relPath) => import(pathToFileURL(path.join(root, relPath)).href);
const treeSha = "d".repeat(40);

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function runFlowCli(workRoot, args) {
  const result = spawnSync(process.execPath, [path.join(root, "src/senti.js"), "flow", ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: workRoot },
  });
  const stdout = result.stdout.trim();
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
    envelope: stdout ? JSON.parse(stdout) : null,
  };
}

function auditInput(overrides = {}) {
  return {
    version: 1,
    provenance: {
      provider: "independent-reviewer",
      invocationId: "audit-001",
      capturedAt: "2026-07-22T00:00:00.000Z",
    },
    phase: "impl",
    taskId: null,
    treeSha,
    disposition: "ADVISORY",
    blockingFindings: [],
    advisoryFindings: [{
      findingId: "A-1",
      summary: "Non-blocking improvement.",
      fingerprint: "e".repeat(64),
      evidenceRefs: ["audit.json#A-1"],
    }],
    ...overrides,
  };
}

async function evidenceStore() {
  const relPath = "src/flow/lib/review-evidence-store.js";
  assert.ok(fs.existsSync(path.join(root, relPath)), `${relPath} must be implemented`);
  return importRoot(relPath);
}

function createCliFixture(t, { inputOverrides = {}, outsideSpec = false, rawInput = null } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-review-evidence-cli-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  initGitRepo(tmp);
  setupFlowConfig(tmp, "en");
  fs.writeFileSync(path.join(tmp, "product.txt"), "review target\n");
  commitAll(tmp, "initial target");
  const currentTreeSha = git(tmp, ["rev-parse", "HEAD^{tree}"]);
  const specId = "001-review-evidence";
  const specPath = `specs/${specId}/spec.json`;
  const specDir = path.join(tmp, "specs", specId);
  fs.mkdirSync(specDir, { recursive: true });
  fs.writeFileSync(path.join(specDir, "spec.json"), `${JSON.stringify({ requirements: [] }, null, 2)}\n`);
  const relativeInput = outsideSpec ? "outside-audit.json" : `specs/${specId}/independent-audit.json`;
  const inputPath = path.join(tmp, relativeInput);
  const document = auditInput({ treeSha: currentTreeSha, ...inputOverrides });
  fs.writeFileSync(inputPath, rawInput ?? `${JSON.stringify(document, null, 2)}\n`);

  const state = moveFlowToStep(makeFlowState({
    spec: specPath,
    runId: "run-review-evidence",
    issue: 452,
    baseBranch: "main",
    featureBranch: "main",
    worktree: false,
  }), "impl-review");
  for (const task of state.tasks) {
    task.status = "done";
    for (const step of task.steps) step.status = "done";
  }
  const manager = makeFlowManager(tmp);
  manager.create(state);
  manager.addActiveFlow(specId, "local");
  return {
    tmp,
    manager,
    specId,
    specPath,
    currentTreeSha,
    relativeInput,
  };
}

function evidenceArgs(fixture, overrides = {}) {
  return [
    "set",
    "review-evidence",
    "--file",
    fixture.relativeInput,
    "--expect-run-id",
    "run-review-evidence",
    "--expect-issue",
    String(overrides.issue ?? 452),
    "--expect-spec",
    fixture.specPath,
  ];
}

test("R2: evidence validator rejects stale target and caller supplied digest before persistence", async () => {
  const { ReviewEvidenceInput } = await evidenceStore();
  const input = new ReviewEvidenceInput(auditInput());
  assert.throws(() => new ReviewEvidenceInput(auditInput({ treeSha: "f".repeat(40) })).validateTarget({
    phase: "impl",
    taskId: null,
    treeSha,
  }), /tree|target/i);
  assert.throws(() => input.validateTarget({ phase: "test", taskId: null, treeSha }), /phase|target/i);
  assert.throws(() => input.validateTarget({ phase: "impl", taskId: "T-1", treeSha }), /task|target/i);
  assert.throws(() => new ReviewEvidenceInput(auditInput({ evidenceDigest: "0".repeat(64) })), /digest|caller/i);
  assert.throws(() => new ReviewEvidenceInput(auditInput({ provenance: { provider: "", invocationId: "", capturedAt: "bad" } })), /provenance|provider|invocation|captured/i);
});

test("R5: independent evidence requires every version-1 audit field including explicit null taskId", async () => {
  const { ReviewEvidenceInput } = await evidenceStore();
  for (const field of [
    "version",
    "phase",
    "taskId",
    "treeSha",
    "provenance",
    "disposition",
    "blockingFindings",
    "advisoryFindings",
  ]) {
    const document = auditInput();
    delete document[field];
    assert.throws(() => new ReviewEvidenceInput(document), new RegExp(`${field}.*required`, "i"));
  }
  assert.equal(new ReviewEvidenceInput(auditInput({ taskId: null })).taskId, null);
});

test("R2: duplicate identity rejection preserves canonical files and flow-state bytes", async (t) => {
  const {
    ReviewEvidenceInput,
    ReviewEvidenceRegistrar,
    ReviewEvidenceStore,
  } = await evidenceStore();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-review-duplicate-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const specDir = path.join(tmp, "specs/demo");
  fs.mkdirSync(specDir, { recursive: true });
  const inputPath = path.join(specDir, "independent-audit.json");
  fs.writeFileSync(inputPath, `${JSON.stringify(auditInput(), null, 2)}\n`);
  const evidence = ReviewEvidenceInput.fromFile({ root: tmp, specDir, inputPath })
    .toEvidence({ phase: "impl", taskId: null, treeSha });
  const registrar = new ReviewEvidenceRegistrar({
    store: new ReviewEvidenceStore({ root: tmp, specDir }),
  });
  const initialState = {
    runId: "run-1",
    spec: "specs/demo/spec.json",
    reviewConvergence: { records: [] },
  };
  const initialBytes = Buffer.from(JSON.stringify(initialState));
  assert.throws(() => registrar.register({
    flowState: initialState,
    evidence,
    expectedRevision: { ...initialState, revision: "foreign" },
  }), /revision|expected/i);
  assert.deepEqual(Buffer.from(JSON.stringify(initialState)), initialBytes);
  const first = registrar.register({ flowState: initialState, evidence });
  const committedState = first.nextState;
  const stateBytes = Buffer.from(JSON.stringify(committedState));
  const evidenceDir = path.join(specDir, "review-evidence");
  const artifactSnapshot = new Map(fs.readdirSync(evidenceDir).map((name) => [
    name,
    fs.readFileSync(path.join(evidenceDir, name)),
  ]));

  assert.throws(
    () => registrar.register({ flowState: committedState, evidence }),
    /duplicate|identity/i,
  );
  assert.deepEqual(Buffer.from(JSON.stringify(committedState)), stateBytes);
  assert.deepEqual(
    new Map(fs.readdirSync(evidenceDir).map((name) => [name, fs.readFileSync(path.join(evidenceDir, name))])),
    artifactSnapshot,
  );
});

test("R5: spec-local independent evidence write is bounded immutable and idempotent", async (t) => {
  const {
    ReviewEvidenceInput,
    ReviewEvidenceStore,
  } = await evidenceStore();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-review-evidence-"));
  t.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
  const specDir = path.join(tmp, "specs/demo");
  fs.mkdirSync(specDir, { recursive: true });
  const inputPath = path.join(specDir, "independent-audit.json");
  fs.writeFileSync(inputPath, `${JSON.stringify(auditInput(), null, 2)}\n`);

  const input = ReviewEvidenceInput.fromFile({ root: tmp, specDir, inputPath });
  const store = new ReviewEvidenceStore({ root: tmp, specDir });
  const first = store.write(input.toEvidence({ phase: "impl", taskId: null, treeSha }));
  const second = store.write(input.toEvidence({ phase: "impl", taskId: null, treeSha }));

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.path, second.path);
  assert.match(path.relative(specDir, first.path), /^review-evidence\//);
  assert.deepEqual(fs.readFileSync(first.path), fs.readFileSync(second.path));
});

test("R5: registry and command expose one target-guarded review-evidence mutation boundary", () => {
  const registry = read("src/flow/registry.js");
  const command = read("src/flow/lib/set-review-evidence.js");
  assert.match(registry, /["']review-evidence["']\s*:\s*\{/);
  assert.match(registry, /set review-evidence --file/);
  assert.match(registry, /FLOW_TARGET_GUARD/);
  assert.match(command, /ReviewEvidenceStore/);
  assert.doesNotMatch(command, /runCmd|provider|agent\.call/);
});

test("R5: executable CLI registers canonical evidence once without provider execution", (t) => {
  const fixture = createCliFixture(t);
  const first = runFlowCli(fixture.tmp, evidenceArgs(fixture));
  assert.equal(first.status, 0, first.stderr || first.stdout);
  assert.equal(first.envelope.ok, true);
  assert.equal(first.envelope.data.providerInvoked, false);
  assert.match(first.envelope.data.evidenceDigest, /^[a-f0-9]{64}$/);
  const artifactPath = path.join(fixture.tmp, first.envelope.data.artifactPath);
  const artifactBytes = fs.readFileSync(artifactPath);
  const stateBytes = Buffer.from(JSON.stringify(fixture.manager.load()));

  const duplicate = runFlowCli(fixture.tmp, evidenceArgs(fixture));
  assert.notEqual(duplicate.status, 0);
  assert.equal(duplicate.envelope.errors[0].code, "REVIEW_DUPLICATE_IDENTITY");
  assert.deepEqual(fs.readFileSync(artifactPath), artifactBytes);
  assert.deepEqual(Buffer.from(JSON.stringify(fixture.manager.load())), stateBytes);
});

test("R5: executable CLI rejects malformed bounded foreign and mismatched evidence", async (t) => {
  const cases = [
    {
      name: "missing provenance",
      fixture: createCliFixture(t, { inputOverrides: { provenance: undefined } }),
      code: "REVIEW_EVIDENCE_INVALID",
    },
    {
      name: "disposition mismatch",
      fixture: createCliFixture(t, { inputOverrides: { disposition: "PASS" } }),
      code: "REVIEW_EVIDENCE_INVALID",
    },
    {
      name: "outside spec directory",
      fixture: createCliFixture(t, { outsideSpec: true }),
      code: "REVIEW_EVIDENCE_PATH_OUTSIDE_SPEC",
    },
    {
      name: "oversized input",
      fixture: createCliFixture(t, { rawInput: "x".repeat((1024 * 1024) + 1) }),
      code: "REVIEW_EVIDENCE_TOO_LARGE",
    },
  ];
  for (const entry of cases) {
    await t.test(entry.name, () => {
      const before = Buffer.from(JSON.stringify(entry.fixture.manager.load()));
      const result = runFlowCli(entry.fixture.tmp, evidenceArgs(entry.fixture));
      assert.notEqual(result.status, 0);
      assert.equal(result.envelope.errors[0].code, entry.code);
      assert.deepEqual(Buffer.from(JSON.stringify(entry.fixture.manager.load())), before);
    });
  }

  const mismatch = createCliFixture(t);
  const before = Buffer.from(JSON.stringify(mismatch.manager.load()));
  const result = runFlowCli(mismatch.tmp, evidenceArgs(mismatch, { issue: 999 }));
  assert.notEqual(result.status, 0);
  assert.match(result.envelope.errors[0].code, /MISMATCH|NOT_FOUND/);
  assert.deepEqual(Buffer.from(JSON.stringify(mismatch.manager.load())), before);
});

test("R7: review CLI routing and source-verified options remain executable", async () => {
  const help = spawnSync(process.execPath, [path.join(root, "src/senti.js"), "flow", "run", "review", "--help"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(help.status, 0, help.stderr);
  const output = `${help.stdout}\n${help.stderr}`;
  for (const option of ["--phase", "--agent-work-dir", "--dry-run", "--skip-confirm"]) {
    assert.match(output, new RegExp(option));
  }
  assert.doesNotMatch(output, /--log-file/);

  const { FLOW_COMMANDS } = await importRoot("src/flow/registry.js");
  assert.equal(typeof FLOW_COMMANDS.run.review.command, "function");
  assert.equal(typeof FLOW_COMMANDS.run.review.post, "function");
  assert.ok(FLOW_COMMANDS.run.review.args.options.includes("--phase"));
  assert.ok(FLOW_COMMANDS.run.review.args.flags.includes("--dry-run"));
  assert.ok(FLOW_COMMANDS.run.review.args.flags.includes("--skip-confirm"));
});
