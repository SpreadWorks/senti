// spec: R1 R2 R3 R4 R7
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import * as definition from "../../../src/flow/definition.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";

const root = process.cwd();
const repairModulePath = path.join(root, "src/flow/lib/impl-repair-artifacts.js");

async function loadRepairModule() {
  assert.equal(fs.existsSync(repairModulePath), true, "implementation repair domain module must exist");
  return import(`${pathToFileURL(repairModulePath).href}?t=${Date.now()}`);
}

function actionSnapshots(actions) {
  return actions.map((action) => ({ className: action.constructor.name, ...action }));
}

function findAction(actions, className, fields) {
  return actions.find((action) => (
    action.className === className
    && Object.entries(fields).every(([key, value]) => isDeepStrictEqual(action[key], value))
  ));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function fingerprintInput(seed) {
  return {
    paths: ["src/a.js"],
    pathHashes: { "src/a.js": seed.repeat(64) },
  };
}

test("R1: flow definition exposes implementation triage and repair routing", () => {
  const order = definition.getFlowDefinitionOrder();
  const reviewIndex = order.indexOf("impl-review");

  assert.deepEqual(order.slice(reviewIndex, reviewIndex + 4), [
    "impl-review",
    "impl-triage",
    "impl-repair",
    "impl-gate",
  ]);
  assert.equal(definition.deriveNextAction({ stepId: "impl-triage" }).instructionsKey, "impl.impl-triage");
  assert.equal(definition.deriveNextAction({ stepId: "impl-repair" }).instructionsKey, "impl.impl-repair");

  const passed = actionSnapshots(definition.resolveLifecycle({
    event: "review:post",
    command: "run-review",
    currentStepId: "impl-review",
    result: { artifacts: { phase: "impl", verdict: "PASS" } },
  }));
  assert.ok(findAction(passed, "SetStepStatus", { step: "impl-review", status: "done" }));
  assert.ok(findAction(passed, "SetStepStatus", { step: "impl-triage", status: "done" }));
  assert.ok(findAction(passed, "SetStepStatus", { step: "impl-repair", status: "done" }));

  const failed = actionSnapshots(definition.resolveLifecycle({
    event: "review:post",
    command: "run-review",
    currentStepId: "impl-review",
    result: { artifacts: { phase: "impl", verdict: "FAIL", blockingCount: 1 } },
  }));
  assert.ok(findAction(failed, "SetStepStatus", { step: "impl-review", status: "done" }));
  assert.ok(findAction(failed, "SetStepStatus", { step: "impl-triage", status: "in_progress" }));
});

test("R2: implementation triage and repair values enforce audit invariants", async () => {
  const {
    ImplRepairEntry,
    ImplTriageItem,
    RepairFingerprint,
    appendImplRepairEntry,
    validateImplTriageArtifact,
  } = await loadRepairModule();
  const previous = new RepairFingerprint(fingerprintInput("a"));
  const current = new RepairFingerprint(fingerprintInput("b"));

  assert.throws(() => new ImplTriageItem({ findingId: "", decision: "apply", rationale: "repair" }));
  assert.throws(() => new ImplTriageItem({ findingId: "F-1", decision: "unknown", rationale: "repair" }));
  const triageItem = {
    findingId: "F-1",
    sourceStep: "impl-review",
    decision: "apply",
    rationale: "Repair the blocking finding.",
    evidenceRefs: ["impl-review.json#F-1"],
  };
  const triage = {
    version: 1,
    phase: "impl-triage",
    sourceStep: "impl-review",
    sourceArtifact: "impl-review.json",
    previousFingerprint: previous,
    items: [triageItem],
  };
  assert.equal(validateImplTriageArtifact(triage, { sourceFindingIds: ["F-1"] }), triage);
  assert.throws(
    () => validateImplTriageArtifact({ ...triage, items: [] }, { sourceFindingIds: ["F-1"] }),
    /missing.*F-1|F-1.*missing/i,
  );
  assert.throws(
    () => validateImplTriageArtifact({ ...triage, items: [triageItem, triageItem] }, { sourceFindingIds: ["F-1"] }),
    /duplicate.*F-1|F-1.*duplicate/i,
  );
  assert.throws(
    () => validateImplTriageArtifact({
      ...triage,
      items: [triageItem, { ...triageItem, findingId: "F-2" }],
    }, { sourceFindingIds: ["F-1"] }),
    /unknown.*F-2|F-2.*unknown/i,
  );
  const requiredAudit = {
    id: "repair-001",
    sourceFindingIds: ["F-1"],
    changedPaths: ["src/a.js"],
    reason: "Apply the blocking repair.",
    previousFingerprint: previous,
    currentFingerprint: current,
    invalidations: [{
      path: "test-execute-result.json",
      reason: "Implementation inputs changed.",
      previousFingerprint: previous.hash,
    }],
    createdAt: "2026-07-12T00:00:00.000Z",
  };
  for (const invalid of [
    { sourceFindingIds: [] },
    { changedPaths: [] },
    { reason: "" },
    { invalidations: [] },
    { createdAt: "" },
  ]) {
    const field = Object.keys(invalid)[0];
    assert.throws(() => new ImplRepairEntry({ ...requiredAudit, ...invalid }), new RegExp(field, "i"));
  }

  const entry = new ImplRepairEntry(requiredAudit);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-impl-repair-ledger-"));
  try {
    const written = appendImplRepairEntry({ specDir: tmp, entry });
    assert.equal(path.basename(written.path), "impl-repair.json");
    assert.deepEqual(written.artifact.entries[0], entry.toJSON());
    assert.equal(written.artifact.version, 1);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("R3: repair fingerprint covers defined inputs and fails closed at bounds", async () => {
  const {
    REPAIR_FINGERPRINT_PATH_LIMIT,
    RepairFingerprint,
    buildRepairFingerprint,
  } = await loadRepairModule();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-repair-fingerprint-"));
  try {
    const specPath = "specs/001-test/spec.json";
    writeJson(path.join(tmp, specPath), { requirements: [{ id: "R1" }] });
    fs.mkdirSync(path.join(tmp, "specs/001-test/tests"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "specs/001-test/tests/a.test.js"), "test('a', () => {});\n");
    fs.mkdirSync(path.join(tmp, "src"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "src/a.js"), "export const value = 1;\n");
    fs.mkdirSync(path.join(tmp, "plugins/example"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "plugins/example/index.js"), "export const plugin = 1;\n");
    writeJson(path.join(tmp, ".senti/config.json"), { name: "test" });
    writeJson(path.join(tmp, "specs/001-test/test-execute-result.json"), { result: "pass" });

    const expectedPaths = [
      "src/a.js",
      ".senti/config.json",
      "plugins/example/index.js",
      specPath,
      "specs/001-test/tests/a.test.js",
    ];
    const first = buildRepairFingerprint({ root: tmp, specPath });
    assert.ok(first instanceof RepairFingerprint);
    assert.deepEqual(first.paths, expectedPaths.sort());
    assert.equal(first.hash.length, 64);

    fs.mkdirSync(path.join(tmp, "specs/001-test/tests/.raw"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "specs/001-test/tests/.raw/test-execution.log"), "generated output\n");
    assert.equal(
      buildRepairFingerprint({ root: tmp, specPath }).hash,
      first.hash,
      "generated test logs do not change the repair fingerprint",
    );

    fs.writeFileSync(path.join(tmp, "src/a.js"), "export const value = 2;\n");
    const second = buildRepairFingerprint({ root: tmp, specPath });
    assert.notEqual(second.hash, first.hash);

    fs.writeFileSync(path.join(tmp, "plugins/example/index.js"), "export const plugin = 2;\n");
    const afterPluginContent = buildRepairFingerprint({ root: tmp, specPath });
    assert.notEqual(afterPluginContent.hash, second.hash, "changing plugin content changes the fingerprint");

    fs.writeFileSync(path.join(tmp, "plugins/example/added.js"), "export const addedPlugin = true;\n");
    const afterPluginAddition = buildRepairFingerprint({ root: tmp, specPath });
    assert.notEqual(afterPluginAddition.hash, afterPluginContent.hash, "adding a plugin path changes the fingerprint");

    fs.rmSync(path.join(tmp, "plugins/example/added.js"));
    const afterPluginRemoval = buildRepairFingerprint({ root: tmp, specPath });
    assert.notEqual(afterPluginRemoval.hash, afterPluginAddition.hash, "removing a plugin path changes the fingerprint");

    writeJson(path.join(tmp, ".senti/config.json"), { name: "changed" });
    const afterConfigContent = buildRepairFingerprint({ root: tmp, specPath });
    assert.notEqual(afterConfigContent.hash, afterPluginRemoval.hash, "changing config content changes the fingerprint");
    fs.rmSync(path.join(tmp, ".senti/config.json"));
    const afterConfigRemoval = buildRepairFingerprint({ root: tmp, specPath });
    assert.notEqual(afterConfigRemoval.hash, afterConfigContent.hash, "removing config changes the fingerprint");
    writeJson(path.join(tmp, ".senti/config.json"), { name: "restored" });
    const afterConfigAddition = buildRepairFingerprint({ root: tmp, specPath });
    assert.notEqual(afterConfigAddition.hash, afterConfigRemoval.hash, "adding config changes the fingerprint");

    writeJson(path.join(tmp, specPath), { requirements: [{ id: "R1" }, { id: "R2" }] });
    const afterSpecContent = buildRepairFingerprint({ root: tmp, specPath });
    assert.notEqual(afterSpecContent.hash, afterConfigAddition.hash, "changing active spec content changes the fingerprint");
    fs.rmSync(path.join(tmp, specPath));
    const afterSpecRemoval = buildRepairFingerprint({ root: tmp, specPath });
    assert.notEqual(afterSpecRemoval.hash, afterSpecContent.hash, "removing the active spec changes the fingerprint");
    writeJson(path.join(tmp, specPath), { requirements: [{ id: "R1" }] });
    const afterSpecAddition = buildRepairFingerprint({ root: tmp, specPath });
    assert.notEqual(afterSpecAddition.hash, afterSpecRemoval.hash, "adding the active spec changes the fingerprint");

    fs.writeFileSync(path.join(tmp, "specs/001-test/tests/a.test.js"), "test('changed', () => {});\n");
    const afterTestContent = buildRepairFingerprint({ root: tmp, specPath });
    assert.notEqual(afterTestContent.hash, afterSpecAddition.hash, "changing an active spec test changes the fingerprint");
    fs.writeFileSync(path.join(tmp, "specs/001-test/tests/added.test.js"), "test('added', () => {});\n");
    const afterTestAddition = buildRepairFingerprint({ root: tmp, specPath });
    assert.notEqual(afterTestAddition.hash, afterTestContent.hash, "adding an active spec test changes the fingerprint");
    fs.rmSync(path.join(tmp, "specs/001-test/tests/added.test.js"));
    const afterTestRemoval = buildRepairFingerprint({ root: tmp, specPath });
    assert.notEqual(afterTestRemoval.hash, afterTestAddition.hash, "removing an active spec test changes the fingerprint");

    fs.writeFileSync(path.join(tmp, "src/added.js"), "export const added = true;\n");
    const afterAddition = buildRepairFingerprint({ root: tmp, specPath });
    assert.notEqual(afterAddition.hash, afterTestRemoval.hash, "adding an included path changes the fingerprint");

    fs.rmSync(path.join(tmp, "src/added.js"));
    const afterRemoval = buildRepairFingerprint({ root: tmp, specPath });
    assert.notEqual(afterRemoval.hash, afterAddition.hash, "removing an included path changes the fingerprint");

    const longPath = path.join("src", "x".repeat(100), "y".repeat(100), "z".repeat(100), "a.js");
    fs.mkdirSync(path.dirname(path.join(tmp, longPath)), { recursive: true });
    fs.writeFileSync(path.join(tmp, longPath), "export const longPath = true;\n");
    assert.throws(() => buildRepairFingerprint({ root: tmp, specPath }), /300|length|bound/i);
    fs.rmSync(path.join(tmp, "src", "x".repeat(100)), { recursive: true, force: true });

    assert.throws(() => buildRepairFingerprint({ root: tmp, specPath, truncated: true }), /truncat/i);
    fs.mkdirSync(path.join(tmp, "src/many"), { recursive: true });
    for (let index = 0; index <= REPAIR_FINGERPRINT_PATH_LIMIT; index++) {
      fs.writeFileSync(path.join(tmp, `src/many/${index}.js`), `export const value${index} = ${index};\n`);
    }
    assert.throws(() => buildRepairFingerprint({ root: tmp, specPath }), /500|limit|bound/i);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("R4: mismatched downstream evidence is invalidated while plan inputs remain", async () => {
  const {
    RepairFingerprint,
    invalidateRepairEvidence,
  } = await loadRepairModule();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-repair-invalidation-"));
  try {
    writeJson(path.join(tmp, "spec.json"), { requirements: [{ id: "R1" }] });
    fs.mkdirSync(path.join(tmp, "tests"), { recursive: true });
    fs.writeFileSync(path.join(tmp, "tests/closure.test.js"), "// spec input\n");
    writeJson(path.join(tmp, "scenario-validity-result.json"), { result: "pass" });
    writeJson(path.join(tmp, "retro.json"), {});
    const previous = new RepairFingerprint(fingerprintInput("a"));
    const current = new RepairFingerprint(fingerprintInput("b"));
    writeJson(path.join(tmp, "test-execute-result.json"), { repairFingerprint: previous.hash });
    writeJson(path.join(tmp, "test-result-review.json"), { repairFingerprint: previous.hash });
    writeJson(path.join(tmp, "impl-gate-result.json"), { repairFingerprint: current.hash });

    const result = invalidateRepairEvidence({
      specDir: tmp,
      currentFingerprint: current,
      previousFingerprint: previous,
      reason: "Implementation repair changed src/a.js.",
    });
    assert.deepEqual(result.invalidatedArtifacts.sort(), [
      "retro.json",
      "test-execute-result.json",
      "test-result-review.json",
    ]);
    assert.deepEqual(
      result.invalidations.map((record) => record.path).sort(),
      result.invalidatedArtifacts.sort(),
    );
    for (const record of result.invalidations) {
      assert.match(record.reason, /Implementation repair changed src\/a\.js/);
      assert.match(record.reason, /repair_fingerprint_mismatch|missing_repair_fingerprint/);
      assert.equal(record.previousFingerprint, previous.hash);
    }
    assert.equal(fs.existsSync(path.join(tmp, "impl-gate-result.json")), true, "matching evidence remains");
    assert.equal(fs.existsSync(path.join(tmp, "spec.json")), true);
    assert.equal(fs.existsSync(path.join(tmp, "tests/closure.test.js")), true);
    assert.equal(fs.existsSync(path.join(tmp, "scenario-validity-result.json")), true);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("R4: the shared evidence writer stamps every required producer artifact", async () => {
  const {
    EVIDENCE_FILE_BY_STEP,
    RepairFingerprint,
    writeRepairEvidenceArtifact,
  } = await loadRepairModule();
  const expectedSteps = [
    "test-execute",
    "test-result-review",
    "impl-review",
    "impl-gate",
    "retro",
    "acceptance-review",
  ];
  assert.deepEqual(Object.keys(EVIDENCE_FILE_BY_STEP).sort(), expectedSteps.sort());
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "senti-repair-producers-"));
  try {
    const current = new RepairFingerprint(fingerprintInput("c"));
    for (const stepId of expectedSteps) {
      const written = writeRepairEvidenceArtifact({
        specDir: tmp,
        stepId,
        artifact: { version: 1, result: "pass" },
        fingerprint: current,
      });
      assert.equal(written.artifact.repairFingerprint, current.hash, `${stepId} fingerprint`);
      assert.equal(JSON.parse(fs.readFileSync(written.path, "utf8")).repairFingerprint, current.hash);
    }

  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("R7: retained command registry surfaces include repair-aware lifecycle commands", () => {
  assert.ok(FLOW_COMMANDS.run.review);
  assert.ok(FLOW_COMMANDS.run["acceptance-review"]);
  assert.ok(FLOW_COMMANDS.set["acceptance-decision"]);
  assert.ok(FLOW_COMMANDS.get["next-action"]);
  assert.ok(FLOW_COMMANDS.get.status);
  assert.deepEqual([...FLOW_COMMANDS.set.step.args.options].sort(), [
    "--expect-issue",
    "--expect-run-id",
    "--expect-spec",
  ]);
});
