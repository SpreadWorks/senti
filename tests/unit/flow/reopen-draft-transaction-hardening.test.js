import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const SPEC_ID = "441-single-state-atomic";
const SPEC_PATH = `specs/${SPEC_ID}/spec.json`;
const DEAD_PID = 2_147_483_647;

function baseManager(root) {
  return new FlowManager({ root, mainRoot: root, inWorktree: false });
}

function boundManager(root) {
  return baseManager(root).forRoot(root, { specId: SPEC_ID });
}

function state(marker, overrides = {}) {
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
    ...overrides,
  };
}

function flowPath(root) {
  return path.join(root, "specs", SPEC_ID, "flow.json");
}

function lockPath(root) {
  return path.join(path.dirname(flowPath(root)), ".flow.json.writer.lock");
}

function setup(root, mode = 0o640) {
  const original = state("old");
  baseManager(root).save(original);
  fs.chmodSync(flowPath(root), mode);
  return original;
}

function replacement(root, original, marker = "new", options = {}) {
  return boundManager(root).saveAtomic(
    state(marker),
    { expectedOriginal: original, ...options },
  );
}

function writerTemps(root) {
  const directory = path.dirname(flowPath(root));
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((name) => name.startsWith(".flow.json.") && name.endsWith(".tmp"))
    .map((name) => path.join(directory, name));
}

function bytes(file) {
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
}

function waitForFile(file, timeoutMs = 5000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const poll = () => {
      if (fs.existsSync(file)) return resolve();
      if (Date.now() - started >= timeoutMs) return reject(new Error(`timeout waiting for ${file}`));
      setTimeout(poll, 20);
    };
    poll();
  });
}

function waitForExit(child) {
  return new Promise((resolve, reject) => {
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`child exit ${code}/${signal}: ${stderr}`));
    });
  });
}

function writeStaleLock(root, overrides = {}) {
  fs.writeFileSync(lockPath(root), `${JSON.stringify({
    version: 1,
    kind: "flow-state-writer",
    token: "11111111-1111-4111-8111-111111111111",
    pid: DEAD_PID,
    root: fs.realpathSync(root),
    spec: SPEC_PATH,
    statePath: fs.realpathSync(flowPath(root)),
    ...overrides,
  }, null, 2)}\n`, { mode: 0o600 });
}

describe("Issue #441 bound atomic flow writer", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("requires a bound spec and expected original while preserving mode on success", () => {
    tmp = createTmpDir("reopen-bound-writer-");
    const original = setup(tmp);
    assert.throws(
      () => baseManager(tmp).saveAtomic(state("new"), { expectedOriginal: original }),
      (err) => err.code === "FLOW_STATE_ATOMIC_AUTHORITY_INVALID",
    );
    assert.throws(
      () => boundManager(tmp).saveAtomic(state("new")),
      (err) => err.code === "FLOW_STATE_ATOMIC_AUTHORITY_INVALID",
    );

    const result = replacement(tmp, original);

    assert.equal(result.committed, true);
    assert.equal(JSON.parse(fs.readFileSync(flowPath(tmp), "utf8")).marker, "new");
    assert.equal(fs.statSync(flowPath(tmp)).mode & 0o777, 0o640);
    assert.equal(fs.existsSync(lockPath(tmp)), false);
    assert.deepEqual(writerTemps(tmp), []);
  });

  it("rejects foreign and non-normalized state specs before mutation", () => {
    for (const [name, expectedSpec, nextSpec] of [
      ["foreign expected", "specs/999-foreign/spec.json", SPEC_PATH],
      ["foreign next", SPEC_PATH, "specs/999-foreign/spec.json"],
      ["dotdot expected", "specs/../441-single-state-atomic/spec.json", SPEC_PATH],
      ["dotdot next", SPEC_PATH, "specs/../441-single-state-atomic/spec.json"],
      ["backslash next", SPEC_PATH, `specs\\${SPEC_ID}\\spec.json`],
    ]) {
      tmp = createTmpDir(`reopen-authority-${name.replaceAll(" ", "-")}-`);
      const original = setup(tmp);
      const before = bytes(flowPath(tmp));
      assert.throws(
        () => boundManager(tmp).saveAtomic(
          state("new", { spec: nextSpec }),
          { expectedOriginal: { ...original, spec: expectedSpec } },
        ),
        (err) => err.code === "FLOW_STATE_ATOMIC_AUTHORITY_INVALID",
        name,
      );
      assert.deepEqual(bytes(flowPath(tmp)), before, name);
      assert.equal(fs.existsSync(lockPath(tmp)), false, name);
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("rejects symlinked or invalid root/specs/spec-directory/flow authority", () => {
    const cases = [
      ["root symlink", (root) => {
        const real = path.join(root, "real");
        fs.mkdirSync(real);
        const original = setup(real);
        const alias = path.join(root, "alias");
        fs.symlinkSync(real, alias);
        return { root: alias, original, observed: flowPath(real) };
      }],
      ["specs symlink", (root) => {
        const outsideRoot = path.join(root, "outside-root");
        fs.mkdirSync(outsideRoot);
        const original = setup(outsideRoot);
        fs.symlinkSync(path.join(outsideRoot, "specs"), path.join(root, "specs"));
        return { root, original, observed: flowPath(outsideRoot) };
      }],
      ["spec directory symlink", (root) => {
        const outsideRoot = path.join(root, "outside-root");
        fs.mkdirSync(outsideRoot);
        const original = setup(outsideRoot);
        fs.mkdirSync(path.join(root, "specs"), { recursive: true });
        fs.symlinkSync(path.join(outsideRoot, "specs", SPEC_ID), path.join(root, "specs", SPEC_ID));
        return { root, original, observed: flowPath(outsideRoot) };
      }],
      ["flow symlink", (root) => {
        const original = setup(root);
        const outside = path.join(root, "outside-flow.json");
        fs.renameSync(flowPath(root), outside);
        fs.symlinkSync(outside, flowPath(root));
        return { root, original, observed: outside };
      }],
      ["non-regular flow", (root) => {
        const original = setup(root);
        fs.unlinkSync(flowPath(root));
        fs.mkdirSync(flowPath(root));
        return { root, original, observed: null };
      }],
      ["missing flow", (root) => {
        const original = setup(root);
        fs.unlinkSync(flowPath(root));
        return { root, original, observed: null };
      }],
    ];

    for (const [name, prepare] of cases) {
      tmp = createTmpDir(`reopen-path-${name.replaceAll(" ", "-")}-`);
      const prepared = prepare(tmp);
      const before = prepared.observed ? bytes(prepared.observed) : null;
      assert.throws(
        () => replacement(prepared.root, prepared.original),
        (err) => err.code === "FLOW_STATE_ATOMIC_AUTHORITY_INVALID",
        name,
      );
      if (prepared.observed) assert.deepEqual(bytes(prepared.observed), before, name);
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("keeps old bytes before rename and complete new bytes after rename across durability faults", () => {
    const failures = [
      ["before-state-temp-write", false],
      ["after-state-temp-write", false],
      ["before-state-file-fsync", false],
      ["after-state-file-fsync", false],
      ["before-state-rename", false],
      ["after-state-rename", true],
      ["before-state-dir-fsync", true],
      ["after-state-dir-fsync", true],
    ];
    for (const [phase, committed] of failures) {
      tmp = createTmpDir(`reopen-durability-${phase}-`);
      const original = setup(tmp);
      const oldBytes = bytes(flowPath(tmp));
      assert.throws(
        () => replacement(tmp, original, "new", {
          faultInjector(event) {
            if (event.phase === phase) throw new Error(phase);
          },
        }),
        (err) => err.code === "FLOW_STATE_ATOMIC_SAVE_FAILED" && err.committed === committed,
        phase,
      );
      const current = bytes(flowPath(tmp));
      assert.doesNotThrow(() => JSON.parse(current.toString("utf8")), phase);
      assert.equal(JSON.parse(current.toString("utf8")).marker, committed ? "new" : "old", phase);
      if (!committed) assert.deepEqual(current, oldBytes, phase);
      assert.equal(fs.statSync(flowPath(tmp)).mode & 0o777, 0o640, phase);
      assert.deepEqual(writerTemps(tmp), [], phase);
      assert.equal(fs.existsSync(lockPath(tmp)), false, phase);
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("detects sequential lost updates and preserves the winner", () => {
    tmp = createTmpDir("reopen-stale-write-");
    const original = setup(tmp);
    replacement(tmp, original, "winner");
    assert.throws(
      () => replacement(tmp, original, "loser"),
      (err) => err.code === "FLOW_STATE_ATOMIC_STALE" && err.committed === false,
    );
    assert.equal(JSON.parse(fs.readFileSync(flowPath(tmp), "utf8")).marker, "winner");
  });

  it("allows only one of two concurrent processes to write and retains the winner audit", async () => {
    tmp = createTmpDir("reopen-concurrent-writer-");
    const original = setup(tmp);
    const barrier = path.join(tmp, "barrier");
    const release = path.join(tmp, "release");
    const script = path.join(tmp, "holder.mjs");
    const moduleUrl = pathToFileURL(path.resolve("src/lib/flow-manager.js")).href;
    fs.writeFileSync(script, `
      import fs from "node:fs";
      import { FlowManager } from ${JSON.stringify(moduleUrl)};
      const root = ${JSON.stringify(tmp)};
      const expectedOriginal = ${JSON.stringify(original)};
      const next = { ...expectedOriginal, marker: "winner", planRewinds: [{ category: "spec-correction", reason: "winner audit" }] };
      const fm = new FlowManager({ root, mainRoot: root, inWorktree: false }).forRoot(root, { specId: ${JSON.stringify(SPEC_ID)} });
      fm.saveAtomic(next, {
        expectedOriginal,
        faultInjector(event) {
          if (event.phase !== "lock-acquired") return;
          fs.writeFileSync(${JSON.stringify(barrier)}, "ready");
          while (!fs.existsSync(${JSON.stringify(release)})) {
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
          }
        },
      });
    `);
    const child = spawn(process.execPath, [script], { stdio: ["ignore", "ignore", "pipe"] });
    await waitForFile(barrier);
    try {
      assert.throws(
        () => replacement(tmp, original, "loser"),
        (err) => err.code === "FLOW_STATE_ATOMIC_BUSY" && err.committed === false,
      );
    } finally {
      fs.writeFileSync(release, "go");
      await waitForExit(child);
    }
    const current = JSON.parse(fs.readFileSync(flowPath(tmp), "utf8"));
    assert.equal(current.marker, "winner");
    assert.equal(current.planRewinds[0].reason, "winner audit");
  });

  it("fails closed for stale or corrupt locks without reclaiming them", () => {
    for (const corrupt of [false, true]) {
      tmp = createTmpDir(`reopen-${corrupt ? "corrupt" : "stale"}-lock-`);
      const original = setup(tmp);
      if (corrupt) fs.writeFileSync(lockPath(tmp), "{broken\n");
      else writeStaleLock(tmp);
      const before = bytes(flowPath(tmp));
      assert.throws(
        () => replacement(tmp, original),
        (err) => err.code === (corrupt ? "FLOW_STATE_ATOMIC_LOCK_CORRUPT" : "FLOW_STATE_ATOMIC_LOCK_STALE")
          && err.lockPath === lockPath(tmp),
      );
      assert.deepEqual(bytes(flowPath(tmp)), before);
      assert.equal(fs.existsSync(lockPath(tmp)), true);
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("surfaces lock creation and normal release failures", () => {
    for (const [phase, committed, expectLock, expectCleanupError] of [
      ["before-lock-publish", false, false, false],
      ["after-lock-publish", false, false, false],
      ["after-lock-dir-fsync", false, false, false],
      ["before-lock-release-unlink", true, true, true],
      ["before-lock-release-dir-fsync", true, false, true],
    ]) {
      tmp = createTmpDir(`reopen-lock-fault-${phase}-`);
      const original = setup(tmp);
      const oldBytes = bytes(flowPath(tmp));
      assert.throws(
        () => replacement(tmp, original, "new", {
          faultInjector(event) {
            if (event.phase === phase) throw new Error(phase);
          },
        }),
        (err) => err.code === "FLOW_STATE_ATOMIC_SAVE_FAILED"
          && err.committed === committed
          && (err.cleanupErrors.length > 0) === expectCleanupError,
        phase,
      );
      assert.equal(JSON.parse(fs.readFileSync(flowPath(tmp), "utf8")).marker, committed ? "new" : "old");
      if (!committed) assert.deepEqual(bytes(flowPath(tmp)), oldBytes);
      assert.equal(fs.existsSync(lockPath(tmp)), expectLock);
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("reports close, unlink, and cleanup fsync errors with residue and commit state", () => {
    for (const [cleanupPhase, expectResidue] of [
      ["before-state-cleanup-close", false],
      ["before-state-cleanup-unlink", true],
      ["before-state-cleanup-dir-fsync", false],
    ]) {
      tmp = createTmpDir(`reopen-cleanup-${cleanupPhase}-`);
      const original = setup(tmp);
      const oldBytes = bytes(flowPath(tmp));
      let primaryInjected = false;
      assert.throws(
        () => replacement(tmp, original, "new", {
          faultInjector(event) {
            if (event.phase === "before-state-file-fsync" && !primaryInjected) {
              primaryInjected = true;
              throw new Error("primary write failure");
            }
            if (event.phase === cleanupPhase) throw new Error(cleanupPhase);
          },
        }),
        (err) => err.code === "FLOW_STATE_ATOMIC_SAVE_FAILED"
          && err.committed === false
          && err.cleanupErrors.some((cleanup) => cleanup.phase === cleanupPhase)
          && err.residuePaths.length === (expectResidue ? 1 : 0),
        cleanupPhase,
      );
      assert.deepEqual(bytes(flowPath(tmp)), oldBytes);
      assert.equal(writerTemps(tmp).length, expectResidue ? 1 : 0);
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("retries lock and state temp collisions without deleting foreign files", () => {
    for (const phase of ["before-lock-owner-temp-open", "before-state-temp-open"]) {
      tmp = createTmpDir(`reopen-temp-collision-${phase}-`);
      const original = setup(tmp);
      let collision = null;
      const result = replacement(tmp, original, "new", {
        faultInjector(event) {
          if (event.phase === phase && collision == null) {
            collision = event.tempPath;
            fs.writeFileSync(collision, "foreign collision\n");
          }
        },
      });
      assert.equal(result.committed, true, phase);
      assert.equal(fs.readFileSync(collision, "utf8"), "foreign collision\n", phase);
      assert.equal(JSON.parse(fs.readFileSync(flowPath(tmp), "utf8")).marker, "new", phase);
      removeTmpDir(tmp);
      tmp = null;
    }
  });
});
