import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const SRC = path.join(ROOT, "src");

function createTmpDir() {
  return fs.mkdtempSync(path.join(ROOT, ".tmp", "test-233-"));
}

function removeTmpDir(dir) {
  if (dir && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function writeFile(base, rel, content) {
  const p = path.join(base, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof content === "string" ? content : JSON.stringify(content, null, 2));
}

describe("spec 233: lifecycle field removal", () => {
  let tmp;
  afterEach(() => removeTmpDir(tmp));

  // R1: run-prepare-spec.js should not write lifecycle field
  it("R1: flow.json created by prepare does not contain lifecycle field", () => {
    const src = fs.readFileSync(path.join(SRC, "flow/lib/run-prepare-spec.js"), "utf8");
    assert.ok(!src.includes('lifecycle:'), "run-prepare-spec.js should not set lifecycle field in flow.json template");
  });

  // R2: finalize step done transition before cleanup
  it("R2: run-finalize.js has finalize step done transition before cleanup", () => {
    const src = fs.readFileSync(path.join(SRC, "flow/lib/run-finalize.js"), "utf8");
    const finalizeRef = src.indexOf('"finalize"');
    const doneRef = src.indexOf('"done"', finalizeRef);
    const cleanupStart = src.indexOf("Step 4: cleanup");
    assert.ok(finalizeRef !== -1, "finalize should be referenced in step transition block");
    assert.ok(doneRef !== -1 && doneRef < cleanupStart, "finalize done transition should come before cleanup");
    assert.ok(src.includes('"show-report"') && src.includes('"finalize"'), "both show-report and finalize should be transitioned");
  });

  // R3: changelog uses finalizedAt for status
  it("R3: changelog.js uses state.finalizedAt instead of lifecycle", () => {
    const src = fs.readFileSync(path.join(SRC, "docs/commands/changelog.js"), "utf8");
    assert.ok(!src.includes("flow.lifecycle"), "changelog.js should not read flow.lifecycle");
    assert.ok(src.includes("finalizedAt"), "changelog.js should use finalizedAt for status");
  });

  // R3: e2e - finalizedAt → completed
  it("R3: changelog renders completed for spec with finalizedAt", () => {
    tmp = createTmpDir();
    writeFile(tmp, "specs/001-test/spec.json", JSON.stringify({
      goal: "Test",
      scope: { in: [], out: [] },
      constraints: [],
      design_principles: [],
      overview: { modules: [], data_flow: [], decisions: [] },
      background: "",
      requirements: [],
      acceptance_criteria: [],
      clarifications: [],
      alternatives_considered: [],
      open_questions: [],
    }));
    writeFile(tmp, "specs/001-test/flow.json", JSON.stringify({
      featureBranch: "feature/001-test",
      baseBranch: "main",
      spec: "specs/001-test/spec.json",
      state: { finalizedAt: "2026-04-27T00:00:00.000Z" },
    }));
    fs.mkdirSync(path.join(tmp, "docs"), { recursive: true });

    execFileSync("node", [path.join(SRC, "docs.js"), "changelog"], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp, SDD_FORGE_SOURCE_ROOT: tmp },
    });

    const content = fs.readFileSync(path.join(tmp, "docs", "change_log.md"), "utf8");
    assert.match(content, /completed/, "status should be 'completed' for finalized spec");
  });

  // R3: e2e - no finalizedAt → active
  it("R3: changelog renders active for spec without finalizedAt", () => {
    tmp = createTmpDir();
    writeFile(tmp, "specs/002-test/spec.json", JSON.stringify({
      goal: "Test",
      scope: { in: [], out: [] },
      constraints: [],
      design_principles: [],
      overview: { modules: [], data_flow: [], decisions: [] },
      background: "",
      requirements: [],
      acceptance_criteria: [],
      clarifications: [],
      alternatives_considered: [],
      open_questions: [],
    }));
    writeFile(tmp, "specs/002-test/flow.json", JSON.stringify({
      featureBranch: "feature/002-test",
      baseBranch: "main",
      spec: "specs/002-test/spec.json",
    }));
    fs.mkdirSync(path.join(tmp, "docs"), { recursive: true });

    execFileSync("node", [path.join(SRC, "docs.js"), "changelog"], {
      encoding: "utf8",
      env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp, SDD_FORGE_SOURCE_ROOT: tmp },
    });

    const content = fs.readFileSync(path.join(tmp, "docs", "change_log.md"), "utf8");
    assert.match(content, /active/, "status should be 'active' for non-finalized spec");
  });

  // R4/R8: get-status output does not contain lifecycle
  it("R4: get-status output does not include lifecycle field", () => {
    const src = fs.readFileSync(path.join(SRC, "flow/lib/get-status.js"), "utf8");
    const outputSection = src.slice(src.indexOf("return {"));
    assert.ok(!outputSection.includes("lifecycle:") || outputSection.includes("lifecycle === \"preparing\""),
      "get-status output should not include lifecycle field (preparing check is OK)");
  });

  // R5: reopen-draft has no lifecycle guard
  it("R5: run-reopen-draft.js has no lifecycle guard", () => {
    const src = fs.readFileSync(path.join(SRC, "flow/lib/run-reopen-draft.js"), "utf8");
    assert.ok(!src.includes('lifecycle !== "active"'), "reopen-draft should not check lifecycle !== active");
    assert.ok(!src.includes("state.lifecycle"), "reopen-draft should not access state.lifecycle");
  });

  // R6: resume output does not contain lifecycle
  it("R6: run-resume.js output does not include lifecycle field", () => {
    const src = fs.readFileSync(path.join(SRC, "flow/lib/run-resume.js"), "utf8");
    assert.ok(!src.includes("lifecycle:") || !src.includes("state.lifecycle"),
      "run-resume should not output lifecycle field");
  });
});
