import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  ImplRepairEntry,
  ImplRepairLedger,
  buildRepairFingerprint,
  completeImplRepair,
  ensureRepairFingerprintContract,
  prepareImplTriageArtifact,
  readImplRepairLedger,
  recoverImplRepairTransaction,
} from "../../../src/flow/lib/impl-repair-artifacts.js";
import {
  RepairArtifactRegistry,
  RepairDeltaArtifact,
  REPAIR_BASELINE_PUBLICATION_DIR,
  beginRepairBaselinePublication,
  captureRepairBaseline,
  completeRepairBaselinePublication,
  deleteRepairBaselineForFlow,
  deleteRepairBaselineRef,
  recoverRepairBaselinePublications,
  writeRepairDelta,
} from "../../../src/flow/lib/repair-state-identity.js";
import {
  AcceptanceBudgetError,
  buildAcceptancePrompt,
  implementationDiff,
  parseAcceptanceResponse,
} from "../../../src/flow/lib/run-acceptance-review.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

let tmp = null;

afterEach(() => {
  if (tmp) removeTmpDir(tmp);
  tmp = null;
});

function write(relPath, content) {
  const file = path.join(tmp, relPath);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function git(...args) {
  return execFileSync("git", args, { cwd: tmp, encoding: "utf8" }).trim();
}

function initRepository({ config = {} } = {}) {
  tmp = createTmpDir("repair-state-identity-");
  git("init", "-q", "-b", "main");
  git("config", "user.email", "test@example.com");
  git("config", "user.name", "Test User");
  write(".senti/config.json", JSON.stringify(config));
  write("specs/demo/spec.json", JSON.stringify({ requirements: [] }));
  write("specs/demo/tests/demo.test.js", "export const test = true;\n");
  write("app/original.js", "export const value = 1;\n");
  write(".gitignore", "src/node_modules/\n");
  write("src/node_modules/tracked.js", "export const tracked = 1;\n");
  git("add", ".");
  git("add", "-f", "src/node_modules/tracked.js");
  git("commit", "-q", "-m", "baseline");
  const baseline = captureRepairBaseline({ root: tmp, baseRef: "main", runId: "run-test" });
  return {
    baseline,
    state: {
      spec: "specs/demo/spec.json",
      baseBranch: "main",
      runId: "run-test",
      repairBaseline: baseline.toJSON(),
    },
  };
}

describe("repair state identity", () => {
  it("pins and validates SHA-256 repository baselines when supported", (t) => {
    tmp = createTmpDir("repair-state-sha256-");
    try {
      execFileSync("git", ["init", "-q", "--object-format=sha256", "-b", "main"], { cwd: tmp });
    } catch (_) {
      t.skip("installed Git does not support SHA-256 repositories");
      return;
    }
    git("config", "user.email", "test@example.com");
    git("config", "user.name", "Test User");
    git("commit", "-q", "--allow-empty", "-m", "baseline");
    const baseline = captureRepairBaseline({ root: tmp, baseRef: "main", runId: "sha256-run" });
    assert.equal(baseline.objectFormat, "sha256");
    assert.equal(baseline.commitOid.length, 64);
    assert.equal(deleteRepairBaselineRef({ root: tmp, baseline }), true);
  });

  it("uses Git policy instead of project layout names and captures staged plus worktree state", () => {
    const { baseline, state } = initRepository();
    fs.mkdirSync(path.join(tmp, "packages", "api"), { recursive: true });
    git("mv", "app/original.js", "packages/api/renamed.js");
    git("add", "packages/api/renamed.js");
    write("packages/api/renamed.js", "export const value = 3;\n");
    write("packages/api/untracked.js", "export const untracked = true;\n");
    write("src/node_modules/tracked.js", "export const tracked = 2;\n");
    write("src/node_modules/ignored.js", "export const ignored = true;\n");

    const first = buildRepairFingerprint({ root: tmp, specPath: state.spec, state });
    const second = buildRepairFingerprint({ root: tmp, specPath: state.spec, state });
    const paths = new Set(first.entries.map((entry) => entry.path));
    const renamed = first.entries.find((entry) => entry.path === "packages/api/renamed.js");

    assert.equal(first.hash, second.hash);
    assert.equal(renamed.oldPath, "app/original.js");
    assert.ok(renamed.statuses.includes("index:R"));
    assert.ok(renamed.statuses.includes("worktree:M"));
    assert.ok(paths.has("packages/api/untracked.js"));
    assert.ok(paths.has("src/node_modules/tracked.js"));
    assert.ok(!paths.has("src/node_modules/ignored.js"));
    assert.ok(paths.has(".senti/config.json"));
    assert.ok(paths.has(".senti/config.local.json"));
    assert.ok(paths.has("specs/demo/spec.json"));
    assert.equal(deleteRepairBaselineRef({ root: tmp, baseline }), true);
    assert.equal(deleteRepairBaselineRef({ root: tmp, baseline }), false);
  });

  it("streams large files and handles 10,000 changed paths under the default boundary", () => {
    const { state } = initRepository();
    const generated = path.join(tmp, "packages", "generated");
    fs.mkdirSync(generated, { recursive: true });
    for (let index = 0; index < 10_000; index++) {
      fs.writeFileSync(path.join(generated, `${String(index).padStart(5, "0")}.js`), "x\n");
    }
    write("packages/large.bin", Buffer.alloc(2 * 1024 * 1024, 7));

    const fingerprint = buildRepairFingerprint({ root: tmp, specPath: state.spec, state });
    assert.equal(fingerprint.entries.filter((entry) => entry.path.startsWith("packages/generated/")).length, 10_000);
    assert.ok(fingerprint.entries.some((entry) => entry.path === "packages/large.bin"));
  });

  it("returns to the original identity when a worktree change is reverted", () => {
    const { state } = initRepository();
    const before = buildRepairFingerprint({ root: tmp, specPath: state.spec, state });
    write("app/original.js", "export const value = 2;\n");
    assert.notEqual(buildRepairFingerprint({ root: tmp, specPath: state.spec, state }).hash, before.hash);
    write("app/original.js", "export const value = 1;\n");
    assert.equal(buildRepairFingerprint({ root: tmp, specPath: state.spec, state }).hash, before.hash);
  });

  it("keeps tool-owned commits out of the canonical hash", () => {
    const { state } = initRepository();
    const before = buildRepairFingerprint({ root: tmp, specPath: state.spec, state });
    write("specs/demo/impl-review.json", JSON.stringify({ generated: true }));
    git("add", "specs/demo/impl-review.json");
    git("commit", "-q", "-m", "generated evidence");

    const after = buildRepairFingerprint({ root: tmp, specPath: state.spec, state });
    assert.notEqual(after.headOid, before.headOid);
    assert.equal(after.hash, before.hash);
  });

  it("keeps commit metadata changes out of explicit input content identity", () => {
    const { state } = initRepository();
    write("specs/demo/tests/new.test.js", "export const addedTest = true;\n");
    const beforeCommit = buildRepairFingerprint({
      root: tmp,
      specPath: state.spec,
      state,
    });

    git("add", "specs/demo/tests/new.test.js");
    git("commit", "-q", "-m", "commit unchanged explicit input content");
    const afterCommit = buildRepairFingerprint({
      root: tmp,
      specPath: state.spec,
      state,
    });

    assert.equal(afterCommit.hash, beforeCommit.hash);
  });

  it("tracks explicit ignored inputs and fails closed at the configured complete-count boundary", () => {
    const { state } = initRepository({
      config: { flow: { repairFingerprint: { maxChangedPaths: 6, include: ["vendor/cache"] } } },
    });
    write(".gitignore", "src/node_modules/\nvendor/cache/\n");
    write("vendor/cache/input.dat", "required ignored input\n");
    const within = buildRepairFingerprint({ root: tmp, specPath: state.spec, state });
    assert.ok(within.entries.some((entry) => entry.path === "vendor/cache/input.dat"));

    write("packages/extra.js", "extra\n");
    assert.throws(
      () => buildRepairFingerprint({ root: tmp, specPath: state.spec, state }),
      /changed path count 7 exceeds configured limit 6.*flow\.repairFingerprint\.maxChangedPaths/,
    );
  });

  it("identifies deletion, symlink target, executable mode, intent-to-add, and Git environment changes", () => {
    const { state } = initRepository();
    git("config", "core.filemode", "true");
    fs.unlinkSync(path.join(tmp, "src/node_modules/tracked.js"));
    write("bin/tool", "#!/bin/sh\nexit 0\n");
    git("add", "bin/tool");
    fs.chmodSync(path.join(tmp, "bin/tool"), 0o755);
    fs.symlinkSync("first-target", path.join(tmp, "link"));
    write("intent.js", "intent\n");
    git("add", "-N", "intent.js");

    const first = buildRepairFingerprint({ root: tmp, specPath: state.spec, state });
    const deleted = first.entries.find((entry) => entry.path === "src/node_modules/tracked.js");
    assert.equal(deleted.mode, "100644");
    assert.ok(deleted.statuses.includes("worktree:D"));
    assert.equal(first.entries.find((entry) => entry.path === "bin/tool").mode, "100755");
    assert.equal(first.entries.find((entry) => entry.path === "link").mode, "120000");
    const intent = first.entries.find((entry) => entry.path === "intent.js");
    assert.ok(intent.indexOid);
    assert.ok(intent.statuses.includes("worktree:A"));

    fs.unlinkSync(path.join(tmp, "link"));
    fs.symlinkSync("second-target", path.join(tmp, "link"));
    git("config", "core.autocrlf", "true");
    const second = buildRepairFingerprint({ root: tmp, specPath: state.spec, state });
    assert.notEqual(second.hash, first.hash);
    assert.notEqual(second.environmentHash, first.environmentHash);
  });

  it("rejects hidden index flags and reuses the pinned baseline after the source branch moves", () => {
    const { baseline, state } = initRepository();
    git("update-index", "--assume-unchanged", "app/original.js");
    assert.throws(
      () => buildRepairFingerprint({ root: tmp, specPath: state.spec, state }),
      /assume-unchanged index entry/,
    );
    git("update-index", "--no-assume-unchanged", "app/original.js");
    write("later.js", "later\n");
    git("add", "later.js");
    git("commit", "-q", "-m", "move main");
    const retried = captureRepairBaseline({ root: tmp, baseRef: "main", runId: "run-test" });
    assert.equal(retried.commitOid, baseline.commitOid);
    assert.equal(retried.treeOid, baseline.treeOid);
  });

  it("returns typed baseline resolution failures without interpreting ref-like input as options", () => {
    initRepository();
    assert.throws(
      () => captureRepairBaseline({ root: tmp, baseRef: "--not-a-ref", runId: "invalid-source" }),
      (error) => error.code === "REPAIR_BASELINE_UNRESOLVABLE" && /--not-a-ref/.test(error.message),
    );
  });

  it("recovers crash-journaled orphan refs and retains refs owned by persisted flow state", () => {
    initRepository();
    const orphanStatePath = path.join(tmp, "specs", "orphan", "flow.json");
    const orphan = beginRepairBaselinePublication({
      root: tmp,
      mainRoot: tmp,
      baseRef: "main",
      runId: "orphan-run",
      statePath: orphanStatePath,
    });
    const journalDir = path.join(tmp, REPAIR_BASELINE_PUBLICATION_DIR);
    assert.ok(fs.existsSync(path.join(journalDir, "orphan-run.json")));
    assert.equal(git("rev-parse", orphan.baseline.ref), orphan.baseline.commitOid);
    assert.deepEqual(recoverRepairBaselinePublications({ root: tmp, mainRoot: tmp }), {
      recovered: ["orphan-run"],
      retained: [],
    });
    assert.throws(() => git("rev-parse", orphan.baseline.ref));

    const liveStatePath = path.join(tmp, "specs", "live", "flow.json");
    const live = beginRepairBaselinePublication({
      root: tmp,
      mainRoot: tmp,
      baseRef: "main",
      runId: "live-run",
      statePath: liveStatePath,
    });
    write("specs/live/flow.json", JSON.stringify({
      runId: "live-run",
      repairBaseline: live.baseline.toJSON(),
    }));
    assert.deepEqual(recoverRepairBaselinePublications({ root: tmp, mainRoot: tmp }), {
      recovered: [],
      retained: ["live-run"],
    });
    assert.equal(git("rev-parse", live.baseline.ref), live.baseline.commitOid);
    assert.equal(completeRepairBaselinePublication({ mainRoot: tmp, publication: live }), false);
  });

  it("rejects manual skip-worktree flags outside sparse checkout", () => {
    const { state } = initRepository();
    git("update-index", "--skip-worktree", "app/original.js");
    assert.throws(
      () => buildRepairFingerprint({ root: tmp, specPath: state.spec, state }),
      /manual skip-worktree entry/,
    );
  });

  it("treats sparse-checkout omissions as environment state instead of deletions", () => {
    const { state } = initRepository();
    git("sparse-checkout", "init", "--cone");
    git("sparse-checkout", "set", "app", "specs", ".senti");
    assert.equal(fs.existsSync(path.join(tmp, "src/node_modules/tracked.js")), false);
    const sparse = buildRepairFingerprint({ root: tmp, specPath: state.spec, state });
    assert.equal(sparse.entries.some((entry) => entry.path === "src/node_modules/tracked.js"), false);

    git("sparse-checkout", "add", "src");
    const expanded = buildRepairFingerprint({ root: tmp, specPath: state.spec, state });
    assert.notEqual(expanded.environmentHash, sparse.environmentHash);
    assert.notEqual(expanded.hash, sparse.hash);
  });

  it("identifies submodule HEAD changes and rejects dirty submodules", () => {
    const initialized = initRepository();
    deleteRepairBaselineRef({ root: tmp, baseline: initialized.baseline });
    const source = path.join(tmp, ".git", "submodule-source");
    fs.mkdirSync(source, { recursive: true });
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: source });
    execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: source });
    execFileSync("git", ["config", "user.name", "Test User"], { cwd: source });
    fs.writeFileSync(path.join(source, "value.js"), "export const value = 1;\n");
    execFileSync("git", ["add", "."], { cwd: source });
    execFileSync("git", ["commit", "-q", "-m", "initial"], { cwd: source });
    git("-c", "protocol.file.allow=always", "submodule", "add", "-q", source, "deps/lib");
    git("commit", "-q", "-am", "add submodule");
    const baseline = captureRepairBaseline({ root: tmp, baseRef: "main", runId: "run-test" });
    const state = { ...initialized.state, repairBaseline: baseline.toJSON() };

    fs.writeFileSync(path.join(tmp, "deps/lib/value.js"), "export const value = 2;\n");
    execFileSync("git", ["add", "value.js"], { cwd: path.join(tmp, "deps/lib") });
    execFileSync("git", ["commit", "-q", "-m", "advance"], { cwd: path.join(tmp, "deps/lib") });
    const advanced = buildRepairFingerprint({ root: tmp, specPath: state.spec, state });
    assert.equal(advanced.entries.find((entry) => entry.path === "deps/lib").mode, "160000");

    fs.writeFileSync(path.join(tmp, "deps/lib/value.js"), "dirty\n");
    assert.throws(
      () => buildRepairFingerprint({ root: tmp, specPath: state.spec, state }),
      /dirty submodule is not valid repair evidence/,
    );
  });

  it("cleans only the finalized flow baseline ref and is idempotent", () => {
    const { baseline } = initRepository();
    const second = captureRepairBaseline({ root: tmp, baseRef: "main", runId: "another-run" });
    assert.equal(deleteRepairBaselineForFlow(tmp, { runId: "run-test", repairBaseline: baseline.toJSON() }), true);
    assert.equal(deleteRepairBaselineForFlow(tmp, { runId: "run-test", repairBaseline: baseline.toJSON() }), false);
    assert.equal(git("rev-parse", "refs/senti/flows/another-run/baseline"), second.commitOid);
    assert.throws(
      () => deleteRepairBaselineForFlow(tmp, { runId: "run-test", repairBaseline: second.toJSON() }),
      (error) => error.code === "REPAIR_BASELINE_AUTHORITY_MISMATCH",
    );
  });

  it("uses exact artifact ownership pathspecs for layout-independent acceptance diffs", () => {
    const { state } = initRepository();
    write("backend/service.js", "export const changed = true;\n");
    write("specs/demo/impl-review.json", JSON.stringify({ opaque: "must-not-leak" }));
    const diff = implementationDiff(tmp, state);
    assert.match(diff, /backend\/service\.js/);
    assert.doesNotMatch(diff, /must-not-leak|impl-review\.json/);
    const registry = new RepairArtifactRegistry(state.spec);
    assert.equal(registry.owns(".senti/.active-flow"), true);
    assert.equal(registry.owns(".senti/.active-flow.other-run"), true);
    assert.equal(registry.owns(".senti/agent-cache/other-flow.json"), true);
    assert.equal(registry.owns(".senti/recovery/finalize-cleanup/other.json"), true);
    assert.equal(registry.owns("specs/demo/upgrade-result.json"), true);
    assert.equal(registry.owns("specs/demo/review-evidence/evidence-digest.json"), true);
    assert.equal(registry.owns("specs/demo/.flow.json.writer.lock"), true);
    assert.equal(registry.owns("specs/demo/.flow.json.writer.owner.tmp"), true);
    assert.ok(registry.gitPathspecExcludes().every((entry) => entry.startsWith(":(exclude,top")));
  });

  it("migrates an active legacy flow transactionally and invalidates downstream evidence", () => {
    const initialized = initRepository();
    deleteRepairBaselineRef({ root: tmp, baseline: initialized.baseline });
    const state = {
      ...initialized.state,
      repairBaseline: undefined,
      steps: [
        { id: "test-execute", status: "done" },
        { id: "test-result-review", status: "in_progress" },
      ],
    };
    delete state.repairBaseline;
    write("specs/demo/test-execute-result.json", JSON.stringify({
      version: "2",
      repairFingerprint: "1".repeat(64),
    }));
    write("specs/demo/final-regression-result.json", JSON.stringify({ version: "1" }));
    write("specs/demo/report.json", JSON.stringify({ text: "legacy report" }));
    const flowManager = {
      mutate(mutator) { mutator(state); },
    };

    const result = ensureRepairFingerprintContract({
      root: tmp,
      state,
      flowManager,
      continueAfterMigration: true,
    });
    assert.equal(result.migrated, true);
    assert.ok(result.state.repairBaseline);
    assert.equal(state.steps[0].status, "in_progress");
    assert.equal(state.steps[1].status, "pending");
    assert.ok(!fs.existsSync(path.join(tmp, "specs/demo/test-execute-result.json")));
    assert.ok(!fs.existsSync(path.join(tmp, "specs/demo/final-regression-result.json")));
    assert.ok(!fs.existsSync(path.join(tmp, "specs/demo/report.json")));
    assert.ok(!fs.existsSync(path.join(tmp, "specs/demo/repair-state-migration.json")));
    assert.equal(git("rev-parse", "refs/senti/flows/run-test/baseline"), result.state.repairBaseline.commitOid);
  });
});

describe("bounded repair audit and acceptance prompt", () => {
  function prepareFilesystemRepair(root) {
    const writeAt = (relPath, content) => {
      const file = path.join(root, relPath);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
    };
    writeAt(".senti/config.json", "{}");
    writeAt("specs/demo/spec.json", JSON.stringify({ requirements: [] }));
    writeAt("specs/demo/tests/demo.test.js", "export const test = true;\n");
    writeAt("app/example.js", "export const value = 1;\n");
    const state = {
      spec: "specs/demo/spec.json",
      steps: [
        { id: "impl-repair", status: "in_progress" },
        { id: "test-execute", status: "pending" },
      ],
    };
    const fingerprint = buildRepairFingerprint({ root, specPath: state.spec, state });
    writeAt("specs/demo/impl-review.json", JSON.stringify({
      version: 1,
      phase: "impl",
      verdict: "REJECTED",
      summary: { blocking: 1, nonBlocking: 0, total: 1 },
      blockingFindings: [{ findingId: "F-1", suggestion: "repair" }],
      nonBlockingImprovements: [],
      repairFingerprint: fingerprint.hash,
    }));
    prepareImplTriageArtifact({
      specDir: path.join(root, "specs", "demo"),
      sourceStep: "impl-review",
      sourceArtifact: "impl-review.json",
      findings: [{ findingId: "F-1", suggestion: "repair" }],
      fingerprint,
    });
    writeAt("app/example.js", "export const value = 2;\n");
    return {
      state,
      flowManager: { mutate(mutator) { mutator(state); } },
    };
  }

  it("resumes a journaled repair after a crash without forking the ledger", () => {
    tmp = createTmpDir("repair-transaction-");
    write(".senti/config.json", "{}");
    write("specs/demo/spec.json", JSON.stringify({ requirements: [] }));
    write("specs/demo/tests/demo.test.js", "export const test = true;\n");
    write("app/example.js", "export const value = 1;\n");
    const state = {
      spec: "specs/demo/spec.json",
      steps: [
        { id: "impl-repair", status: "in_progress" },
        { id: "test-execute", status: "pending" },
      ],
    };
    const fingerprint = buildRepairFingerprint({ root: tmp, specPath: state.spec, state });
    write("specs/demo/impl-review.json", JSON.stringify({
      version: 1,
      phase: "impl",
      verdict: "REJECTED",
      summary: { blocking: 1, nonBlocking: 0, total: 1 },
      blockingFindings: [{ findingId: "F-1", suggestion: "repair" }],
      nonBlockingImprovements: [],
      repairFingerprint: fingerprint.hash,
    }));
    prepareImplTriageArtifact({
      specDir: path.join(tmp, "specs", "demo"),
      sourceStep: "impl-review",
      sourceArtifact: "impl-review.json",
      findings: [{ findingId: "F-1", suggestion: "repair" }],
      fingerprint,
    });
    write("app/example.js", "export const value = 2;\n");
    const flowManager = {
      mutate(mutator) { mutator(state); },
    };

    assert.throws(() => completeImplRepair({
      root: tmp,
      state,
      flowManager,
      resetStepIds: ["test-execute"],
      faultInjector({ phase }) {
        if (phase === "after-ledger") throw new Error("simulated crash");
      },
    }), /simulated crash/);
    assert.ok(fs.existsSync(path.join(tmp, "specs/demo/impl-repair-transaction.json")));

    const result = completeImplRepair({
      root: tmp,
      state,
      flowManager,
      resetStepIds: ["test-execute"],
    });
    const ledger = readImplRepairLedger(path.join(tmp, "specs", "demo"));
    assert.equal(result.entry.id, "repair-001");
    assert.equal(ledger.entries.length, 1);
    assert.equal(ledger.entries[0].changedPathCount, 1);
    assert.ok(fs.existsSync(path.join(tmp, "specs/demo/repair-deltas/repair-001.json")));
    assert.ok(!fs.existsSync(path.join(tmp, "specs/demo/impl-repair-transaction.json")));
    assert.ok(!fs.existsSync(path.join(tmp, "specs/demo/impl-review.json")));
    assert.equal(state.steps[0].status, "done");
    assert.equal(state.steps[1].status, "in_progress");

    const deltaPath = path.join(tmp, "specs/demo/repair-deltas/repair-001.json");
    const tampered = JSON.parse(fs.readFileSync(deltaPath, "utf8"));
    tampered.changedPaths.push("forged.js");
    fs.writeFileSync(deltaPath, JSON.stringify(tampered));
    assert.throws(() => readImplRepairLedger(path.join(tmp, "specs", "demo")), /repair delta digest/);
  });

  it("writes each immutable delta once and rejects conflicting reuse", () => {
    tmp = createTmpDir("repair-delta-");
    const specDir = path.join(tmp, "specs", "demo");
    const delta = new RepairDeltaArtifact({
      version: 1,
      id: "repair-001",
      previousHash: "a".repeat(64),
      currentHash: "b".repeat(64),
      changedPaths: ["packages/api/a.js"],
    });
    assert.equal(writeRepairDelta(specDir, delta), "repair-deltas/repair-001.json");
    assert.equal(writeRepairDelta(specDir, delta), "repair-deltas/repair-001.json");
    assert.throws(() => writeRepairDelta(specDir, {
      ...delta.toJSON(),
      changedPaths: ["packages/api/b.js"],
      digest: null,
    }), /different content/);
  });

  it("rolls repair transactions forward from every durable crash boundary", () => {
    tmp = createTmpDir("repair-crash-boundaries-");
    for (const phase of ["after-delta", "after-manifest", "after-invalidation", "after-flow-state"]) {
      const root = path.join(tmp, phase);
      fs.mkdirSync(root, { recursive: true });
      const { state, flowManager } = prepareFilesystemRepair(root);
      assert.throws(() => completeImplRepair({
        root,
        state,
        flowManager,
        resetStepIds: ["test-execute"],
        faultInjector(event) {
          if (event.phase === phase) throw new Error(`crash:${phase}`);
        },
      }), new RegExp(`crash:${phase}`));
      const resumed = phase === "after-flow-state"
        ? recoverImplRepairTransaction({ root, state, flowManager })
        : completeImplRepair({
            root,
            state,
            flowManager,
            resetStepIds: ["test-execute"],
          });
      assert.equal(resumed.entry.id, "repair-001");
      assert.equal(readImplRepairLedger(path.join(root, "specs", "demo")).entries.length, 1);
      assert.ok(!fs.existsSync(path.join(root, "specs/demo/impl-repair-transaction.json")));
    }
  });

  it("rejects a concurrent repair owner before writing a second chain entry", () => {
    tmp = createTmpDir("repair-lock-conflict-");
    const { state, flowManager } = prepareFilesystemRepair(tmp);
    const lockDir = path.join(tmp, "specs", "demo", ".impl-repair.lock");
    fs.mkdirSync(lockDir);
    fs.writeFileSync(path.join(lockDir, "owner.json"), JSON.stringify({ pid: process.pid }));
    assert.throws(() => completeImplRepair({
      root: tmp,
      state,
      flowManager,
      resetStepIds: ["test-execute"],
    }), /already running/);
    assert.ok(!fs.existsSync(path.join(tmp, "specs/demo/impl-repair.json")));
  });

  it("keeps full manifests and changed path arrays out of the ledger projection", () => {
    const hashFor = (value) => value.toString(16).padStart(64, "0");
    const invalidations = [{
      path: "test-execute-result.json",
      reason: "stale evidence",
      previousFingerprint: "a".repeat(64),
    }];
    const entries = Array.from({ length: 5 }, (_, index) => new ImplRepairEntry({
      id: `repair-${String(index + 1).padStart(3, "0")}`,
      sourceFindingIds: [`F-${index + 1}`],
      reason: "repair",
      previousHash: hashFor(index + 1),
      currentHash: hashFor(index + 2),
      changedPathCount: 500,
      changedPathsRef: `repair-deltas/repair-${String(index + 1).padStart(3, "0")}.json`,
      changedPathsDigest: "c".repeat(64),
      changedPathsPreview: ["packages/api/example.js"],
      changedPathGroups: [{ prefix: "packages/api", count: 500 }],
      invalidations,
      createdAt: new Date(index * 1000).toISOString(),
    }));
    const ledger = new ImplRepairLedger({ version: 2, entries });
    const serialized = JSON.stringify(ledger.toJSON());

    assert.ok(!serialized.includes("pathHashes"));
    assert.ok(!serialized.includes('"previousFingerprint":{"hash"'));
    assert.ok(!serialized.includes('"changedPaths"'));
    assert.equal(ledger.toJSON().entries[0].changedPathCount, 500);
  });

  it("keeps a five-round 500-path repair audit bounded in the AI request", () => {
    tmp = createTmpDir("repair-projection-");
    const { state } = prepareFilesystemRepair(tmp);
    const current = buildRepairFingerprint({ root: tmp, specPath: state.spec, state });
    const hashFor = (value) => value.toString(16).padStart(64, "0");
    const chain = [hashFor(1), hashFor(2), hashFor(3), hashFor(4), hashFor(5), current.hash];
    const invalidations = [{
      path: "test-execute-result.json",
      reason: "stale evidence",
      previousFingerprint: "a".repeat(64),
    }];
    const entries = Array.from({ length: 5 }, (_, index) => new ImplRepairEntry({
      id: `repair-${String(index + 1).padStart(3, "0")}`,
      sourceFindingIds: [`F-${index + 1}`],
      reason: "repair",
      previousHash: chain[index],
      currentHash: chain[index + 1],
      changedPathCount: 500,
      changedPathsRef: `repair-deltas/repair-${String(index + 1).padStart(3, "0")}.json`,
      changedPathsDigest: "c".repeat(64),
      changedPathsPreview: ["packages/api/example.js"],
      changedPathGroups: [{ prefix: "packages/api", count: 500 }],
      invalidations,
      createdAt: new Date(index * 1000).toISOString(),
    }));
    const projection = new ImplRepairLedger({ version: 2, entries }).toProjection(current);
    const prompt = buildAcceptancePrompt({
      evidence: {
        requirements: [{ id: "R1" }],
        diff: "",
        repairEvidence: { kind: "repair-audit", ref: "impl-repair.json", artifact: projection },
        testEvidence: {},
      },
    });
    const serialized = `${prompt.systemPrompt}\n${prompt.userPrompt}\n${JSON.stringify(prompt.jsonSchema)}\n${prompt.fmtFallback}`;
    assert.equal(projection.currentFingerprintMatched, true);
    assert.ok(serialized.length < 20_000);
    assert.doesNotMatch(serialized, /pathHashes|currentManifest|previousFingerprint"\s*:\s*\{/);
    assert.equal(serialized.match(/impl-repair\.json/g)?.length, 1);
  });

  it("bounds the complete request and response instead of only evidence components", () => {
    const context = {
      evidence: {
        requirements: [{ id: "R1", desc: "demo" }],
        diff: "diff --git a/app/a.js b/app/a.js\n",
        repairEvidence: { kind: "no-repair", ref: "acceptance:no-repair", artifact: { reason: "none" } },
        testEvidence: {},
      },
    };
    const prompt = buildAcceptancePrompt(context);
    assert.ok(prompt.userPrompt.includes("Acceptance Evidence"));
    assert.throws(() => buildAcceptancePrompt({
      evidence: { payload: "x".repeat(900_000) },
    }), AcceptanceBudgetError);
    assert.throws(() => parseAcceptanceResponse("x".repeat(900_001)), AcceptanceBudgetError);
  });
});
