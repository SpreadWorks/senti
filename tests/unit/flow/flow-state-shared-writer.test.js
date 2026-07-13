import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import * as writerModule from "../../../src/lib/flow-state-atomic-writer.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";
import { findStepById } from "../../../src/flow/lib/step-tree.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const SPEC_ID = "441-shared-flow-writer";
const SPEC_PATH = `specs/${SPEC_ID}/spec.json`;
const OTHER_SPEC_ID = "442-untargeted-flow";

function manager(root, specId = null) {
  const base = new FlowManager({ root, mainRoot: root, inWorktree: false });
  return specId == null ? base : base.forRoot(root, { specId });
}

function state(marker, overrides = {}) {
  return {
    spec: SPEC_PATH,
    baseBranch: "main",
    featureBranch: `feature/${SPEC_ID}`,
    runId: "run-shared-flow-writer",
    issue: 441,
    marker,
    steps: buildInitialSteps(),
    requirements: [],
    tasks: [],
    currentTaskId: null,
    ...overrides,
  };
}

function statePath(root, specId = SPEC_ID) {
  return path.join(root, "specs", specId, "flow.json");
}

function setup(root) {
  const original = state("old");
  manager(root).create(original);
  return original;
}

function bytes(file) {
  return fs.readFileSync(file);
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

function captureError(operation) {
  try {
    operation();
    return null;
  } catch (error) {
    return error;
  }
}

function childScript(root, original, operation, barrier, release) {
  const moduleUrl = pathToFileURL(path.resolve("src/lib/flow-manager.js")).href;
  const mutation = `
    state.marker = "winner";
    state.planRewinds = [{ category: "spec-correction", reason: "winner audit" }];
  `;
  const wait = `
    fs.writeFileSync(${JSON.stringify(barrier)}, "ready");
    while (!fs.existsSync(${JSON.stringify(release)})) {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  `;
  const body = operation === "saveAtomic"
    ? `fm.saveAtomic({ ...expectedOriginal, marker: "winner", planRewinds: [{ category: "spec-correction", reason: "winner audit" }] }, {
        expectedOriginal,
        faultInjector(event) {
          if (event.phase === "lock-acquired") { ${wait} }
        },
      });`
    : `fm.mutate((state) => { ${wait} ${mutation} }, { faultInjector() {} });`;
  return `
    import fs from "node:fs";
    import { FlowManager } from ${JSON.stringify(moduleUrl)};
    const root = ${JSON.stringify(root)};
    const expectedOriginal = ${JSON.stringify(original)};
    const fm = new FlowManager({ root, mainRoot: root, inWorktree: false })
      .forRoot(root, { specId: ${JSON.stringify(SPEC_ID)} });
    ${body}
  `;
}

function spawnHolder(root, original, operation, barrier, release) {
  const script = path.join(root, `holder-${operation}.mjs`);
  fs.writeFileSync(script, childScript(root, original, operation, barrier, release));
  return spawn(process.execPath, [script], { stdio: ["ignore", "ignore", "pipe"] });
}

function writeLock(root, processIdentity) {
  const lock = path.join(path.dirname(statePath(root)), ".flow.json.writer.lock");
  fs.writeFileSync(lock, `${JSON.stringify({
    version: 2,
    kind: "flow-state-writer",
    processIdentity,
    root: fs.realpathSync(root),
    spec: SPEC_PATH,
    statePath: fs.realpathSync(statePath(root)),
  }, null, 2)}\n`, { mode: 0o600 });
  return lock;
}

function identitySource({ bootId = "boot-current", startFingerprint = "100", unavailable = false } = {}) {
  assert.equal(typeof writerModule.ProcessIdentitySource, "function");
  return new writerModule.ProcessIdentitySource({
    platform: "linux",
    pid: process.pid,
    readBootIdentity() {
      if (unavailable) throw Object.assign(new Error("boot identity unavailable"), { code: "EACCES" });
      return bootId;
    },
    readProcessStartFingerprint() {
      if (unavailable) throw Object.assign(new Error("process stat unavailable"), { code: "EACCES" });
      return startFingerprint;
    },
  });
}

describe("Issue #441 shared flow state writer", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("exposes explicit create-only state creation and rejects direct save", () => {
    tmp = createTmpDir("flow-create-only-");
    const fm = manager(tmp);
    const original = state("created");

    assert.equal(typeof fm.create, "function");
    fm.create(original);
    const created = bytes(statePath(tmp));
    assert.throws(
      () => fm.create(state("replacement")),
      (error) => error.code === "FLOW_STATE_ALREADY_EXISTS",
    );
    assert.deepEqual(bytes(statePath(tmp)), created);
    assert.equal(typeof fm.save, "undefined");
    assert.deepEqual(bytes(statePath(tmp)), created);
  });

  it("rejects create through a symlinked specs directory without outside mutation", () => {
    tmp = createTmpDir("flow-create-authority-");
    const outside = createTmpDir("flow-create-outside-");
    fs.mkdirSync(path.join(outside, "specs"));
    fs.symlinkSync(path.join(outside, "specs"), path.join(tmp, "specs"));

    try {
      assert.throws(
        () => manager(tmp).create(state("created")),
        (error) => error.code === "FLOW_STATE_ATOMIC_AUTHORITY_INVALID",
      );
      assert.equal(fs.existsSync(path.join(outside, "specs", SPEC_ID)), false);
    } finally {
      removeTmpDir(outside);
    }
  });

  it("keeps load byte-identical and rejects missing or legacy schema", () => {
    for (const legacy of ["missing-runId", "legacy-step-tree"]) {
      tmp = createTmpDir(`flow-load-${legacy}-`);
      const original = state("old");
      if (legacy === "missing-runId") delete original.runId;
      if (legacy === "legacy-step-tree") {
        const plan = original.steps.find((step) => step.id === "plan");
        plan.children = plan.children.filter((step) => step.id !== "draft-refine");
        assert.equal(findStepById(original.steps, "draft-refine"), null);
      }
      const invalidPath = statePath(tmp);
      fs.mkdirSync(path.dirname(invalidPath), { recursive: true });
      fs.writeFileSync(invalidPath, `${JSON.stringify(original, null, 2)}\n`);
      const before = bytes(statePath(tmp));

      const fm = manager(tmp, SPEC_ID);
      const error = captureError(() => fm.load());
      const readOnlyError = captureError(() => fm.loadReadOnly(SPEC_ID));

      assert.deepEqual(bytes(statePath(tmp)), before, legacy);
      assert.equal(error?.code, "FLOW_STATE_SCHEMA_UNSUPPORTED", legacy);
      assert.equal(readOnlyError?.code, "FLOW_STATE_SCHEMA_UNSUPPORTED", `${legacy} read-only`);
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("uses raw load revision for CAS and restricts identity transitions", () => {
    tmp = createTmpDir("flow-raw-revision-");
    const original = setup(tmp);
    fs.writeFileSync(statePath(tmp), JSON.stringify(original));
    const fm = manager(tmp, SPEC_ID);
    const loaded = fm.load();

    fm.saveAtomic({ ...loaded, marker: "raw-cas" }, { expectedOriginal: loaded });
    assert.equal(fm.load().marker, "raw-cas");

    for (const [field, value] of [
      ["runId", "run-other"],
      ["spec", `specs/${OTHER_SPEC_ID}/spec.json`],
      ["issue", 999],
    ]) {
      const before = bytes(statePath(tmp));
      assert.throws(
        () => fm.mutate((current) => { current[field] = value; }),
        (error) => error.code === "FLOW_STATE_ATOMIC_AUTHORITY_INVALID",
        field,
      );
      assert.deepEqual(bytes(statePath(tmp)), before, field);
    }

    for (const [field, value] of [
      ["runId", "run-other"],
      ["spec", `specs/${OTHER_SPEC_ID}/spec.json`],
      ["issue", 998],
    ]) {
      const tamperedExpected = fm.load();
      tamperedExpected[field] = value;
      const before = bytes(statePath(tmp));
      assert.throws(
        () => fm.saveAtomic(tamperedExpected, { expectedOriginal: tamperedExpected }),
        (error) => error.code === "FLOW_STATE_ATOMIC_AUTHORITY_INVALID",
        `loaded ${field}`,
      );
      assert.deepEqual(bytes(statePath(tmp)), before, `loaded ${field}`);
    }

    fm.setIssue(999);
    assert.equal(fm.load().issue, 999);
  });

  it("serializes saveAtomic and mutate in both orders plus two mutators", async () => {
    for (const [holderOperation, loserOperation] of [
      ["saveAtomic", "mutate"],
      ["mutate", "saveAtomic"],
      ["mutate", "mutate"],
    ]) {
      tmp = createTmpDir(`flow-shared-${holderOperation}-${loserOperation}-`);
      const original = setup(tmp);
      const other = state("untargeted", {
        spec: `specs/${OTHER_SPEC_ID}/spec.json`,
        featureBranch: `feature/${OTHER_SPEC_ID}`,
        runId: "run-untargeted",
        issue: 442,
      });
      manager(tmp).create(other);
      const otherBefore = bytes(statePath(tmp, OTHER_SPEC_ID));
      const barrier = path.join(tmp, "barrier");
      const release = path.join(tmp, "release");
      const child = spawnHolder(tmp, original, holderOperation, barrier, release);
      await waitForFile(barrier);
      const fm = manager(tmp, SPEC_ID);
      try {
        const operation = loserOperation === "saveAtomic"
          ? () => fm.saveAtomic({ ...original, marker: "loser" }, { expectedOriginal: original })
          : () => fm.mutate((current) => { current.marker = "loser"; });
        assert.throws(
          operation,
          (error) => [
            "REPOSITORY_FLOW_OPERATION_BUSY",
            "FLOW_STATE_ATOMIC_BUSY",
            "FLOW_STATE_ATOMIC_STALE",
          ].includes(error.code),
          `${holderOperation} -> ${loserOperation}`,
        );
        assert.deepEqual(bytes(statePath(tmp, OTHER_SPEC_ID)), otherBefore);
      } finally {
        fs.writeFileSync(release, "go");
        await waitForExit(child);
      }
      const winner = JSON.parse(fs.readFileSync(statePath(tmp), "utf8"));
      assert.equal(winner.marker, "winner");
      assert.equal(winner.planRewinds[0].reason, "winner audit");
      assert.deepEqual(bytes(statePath(tmp, OTHER_SPEC_ID)), otherBefore);
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("distinguishes PID reuse and boot changes and fails unknown identity closed", () => {
    for (const [name, owner, source, expectedCode] of [
      [
        "pid-reuse",
        { pid: process.pid, bootIdentity: "boot-current", startFingerprint: "99", ownerToken: "11111111-1111-4111-8111-111111111111" },
        identitySource(),
        "FLOW_STATE_ATOMIC_LOCK_STALE",
      ],
      [
        "boot-change",
        { pid: process.pid, bootIdentity: "boot-previous", startFingerprint: "100", ownerToken: "11111111-1111-4111-8111-111111111111" },
        identitySource(),
        "FLOW_STATE_ATOMIC_LOCK_STALE",
      ],
      [
        "unknown",
        { pid: process.pid, bootIdentity: "boot-current", startFingerprint: "100", ownerToken: "11111111-1111-4111-8111-111111111111" },
        identitySource({ unavailable: true }),
        "FLOW_STATE_ATOMIC_LOCK_UNKNOWN",
      ],
      [
        "unsupported-platform",
        { pid: process.pid, bootIdentity: "boot-current", startFingerprint: "100", ownerToken: "11111111-1111-4111-8111-111111111111" },
        new writerModule.ProcessIdentitySource({ platform: "darwin" }),
        "FLOW_STATE_ATOMIC_LOCK_UNKNOWN",
      ],
    ]) {
      tmp = createTmpDir(`flow-process-identity-${name}-`);
      const original = setup(tmp);
      const lock = writeLock(tmp, owner);
      const before = bytes(statePath(tmp));

      const error = captureError(
        () => manager(tmp, SPEC_ID).saveAtomic(state("new"), {
          expectedOriginal: original,
          processIdentitySource: source,
        }),
      );
      assert.equal(error?.code, expectedCode, name);
      assert.equal(error?.lockPath, lock, name);
      assert.deepEqual(bytes(statePath(tmp)), before, name);
      assert.equal(fs.existsSync(lock), true, name);
      removeTmpDir(tmp);
      tmp = null;
    }
  });

  it("has no production flow state save or direct-write bypass", () => {
    const flowStore = fs.readFileSync(path.resolve("src/lib/flow-store.js"), "utf8");
    const flowManager = fs.readFileSync(path.resolve("src/lib/flow-manager.js"), "utf8");
    const prepare = fs.readFileSync(path.resolve("src/flow/lib/run-prepare-spec.js"), "utf8");
    assert.doesNotMatch(flowStore, /\bsave\(state\)/);
    assert.doesNotMatch(flowStore, /this\.save\(/);
    assert.doesNotMatch(flowStore, /fs\.writeFileSync\((?:resolvedPath|migration\.path|p),/);
    assert.doesNotMatch(flowManager, /\bsave\(state\)/);
    assert.doesNotMatch(prepare, /flowManager\.forRoot\(specRoot\)\.save\(state\)/);
    assert.doesNotMatch(prepare, /fs\.writeFileSync\(flowPath,/);
  });
});
