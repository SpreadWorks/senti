/**
 * specs/228-fix-phase-to-skill-dead-ref/tests/phase-to-skill.test.js
 *
 * Spec verification: phaseToSkill returns current skill names.
 * Tests via `flow get resolve-context` CLI output (phaseToSkill is unexported).
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { join } from "path";
import { mkdirSync, writeFileSync } from "fs";
import { createTmpDir, removeTmpDir } from "../../../tests/helpers/tmp-dir.js";
import { buildInitialSteps } from "../../../src/lib/flow-helpers.js";

const FLOW_CMD = join(process.cwd(), "src/flow.js");

function setupFlow(dir, specId = "001-test", stepOverrides = {}) {
  const steps = buildInitialSteps();
  for (const s of steps) {
    if (stepOverrides[s.id]) s.status = stepOverrides[s.id];
  }
  const state = {
    spec: `specs/${specId}/spec.md`,
    baseBranch: "main",
    featureBranch: `feature/${specId}`,
    steps,
    request: "test request",
    notes: [],
  };

  const specDir = join(dir, "specs", specId);
  mkdirSync(specDir, { recursive: true });
  writeFileSync(join(specDir, "flow.json"), JSON.stringify(state, null, 2));
  writeFileSync(join(specDir, "spec.md"), [
    "# Spec", "", "## Goal", "Test goal", "", "## Scope", "Test scope", "",
  ].join("\n"));

  const activeFlowPath = join(dir, ".sdd-forge", ".active-flow");
  mkdirSync(join(dir, ".sdd-forge"), { recursive: true });
  writeFileSync(activeFlowPath, JSON.stringify(
    [{ spec: specId, mode: "local" }],
  ));
}

function getResolveContext(dir) {
  const result = execFileSync(
    "node", [FLOW_CMD, "get", "resolve-context"],
    { encoding: "utf8", env: { ...process.env, SDD_WORK_ROOT: dir } },
  );
  return JSON.parse(result);
}

describe("spec 228: phaseToSkill mapping", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("R1: recommendedSkill is sdd-forge.flow for plan phase", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "001-test", { draft: "in_progress" });
    const envelope = getResolveContext(tmp);
    assert.equal(envelope.data.recommendedSkill, "sdd-forge.flow");
  });

  it("R1: recommendedSkill is sdd-forge.flow for impl phase", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "001-test", { implement: "in_progress" });
    const envelope = getResolveContext(tmp);
    assert.equal(envelope.data.recommendedSkill, "sdd-forge.flow");
  });

  it("R1: recommendedSkill is sdd-forge.flow for finalize phase", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "001-test", { commit: "in_progress" });
    const envelope = getResolveContext(tmp);
    assert.equal(envelope.data.recommendedSkill, "sdd-forge.flow");
  });

  it("R2: impl phase does not return removed skill names", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "001-test", { implement: "in_progress" });
    const envelope = getResolveContext(tmp);
    const skill = envelope.data.recommendedSkill;
    const removed = ["flow-plan", "flow-impl", "flow-finalize"];
    for (const r of removed) {
      assert.ok(!skill.endsWith(r), `should not return removed skill "${r}", got "${skill}"`);
    }
  });

  it("R3: recommendedSkill field is present in envelope", () => {
    tmp = createTmpDir();
    setupFlow(tmp, "001-test");
    const envelope = getResolveContext(tmp);
    assert.ok("recommendedSkill" in envelope.data);
    assert.equal(typeof envelope.data.recommendedSkill, "string");
  });
});
