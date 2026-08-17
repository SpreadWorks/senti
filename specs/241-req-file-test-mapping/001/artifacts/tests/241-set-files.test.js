import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function createTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sdd-241-"));
}

function writeSpecJson(root, specPath, requirements) {
  const dir = path.resolve(root, path.dirname(specPath));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.resolve(root, specPath),
    JSON.stringify({
      goal: "test",
      scope: { in: [], out: [] },
      constraints: [],
      design_principles: [],
      overview: { modules: [], data_flow: [], decisions: [] },
      background: "",
      requirements,
      acceptance_criteria: [],
      clarifications: [],
      alternatives_considered: [],
      open_questions: [],
    }, null, 2),
  );
}

function writeFlowJson(root, spec, baseBranch) {
  const flowDir = path.join(root, ".sdd-forge");
  fs.mkdirSync(flowDir, { recursive: true });
  fs.writeFileSync(
    path.join(flowDir, "flow.json"),
    JSON.stringify({
      spec,
      baseBranch: baseBranch || "main",
      featureBranch: "feature/test",
      steps: [],
      requirements: [],
      tasks: [],
      currentTaskId: null,
    }, null, 2),
  );
}

describe("R1/R2: flow set files command and file-map.json", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should create file-map.json with reqId and paths on first call", async () => {
    const specPath = "specs/test-spec/spec.json";
    writeSpecJson(tmpDir, specPath, [
      { id: "R1", desc: "test requirement", status: "pending" },
    ]);
    writeFlowJson(tmpDir, specPath, "main");

    const { loadFileMap, appendFiles } = await import("../../../src/flow/lib/req-map.js");
    const specDir = path.resolve(tmpDir, "specs/test-spec");

    appendFiles(specDir, "R1", ["src/a.js"], tmpDir, specPath);

    const map = loadFileMap(specDir);
    assert.deepStrictEqual(map, { R1: ["src/a.js"] });
  });

  it("should append paths without duplicates", async () => {
    const specPath = "specs/test-spec/spec.json";
    writeSpecJson(tmpDir, specPath, [
      { id: "R1", desc: "test requirement", status: "pending" },
    ]);
    writeFlowJson(tmpDir, specPath, "main");

    const { loadFileMap, appendFiles } = await import("../../../src/flow/lib/req-map.js");
    const specDir = path.resolve(tmpDir, "specs/test-spec");

    appendFiles(specDir, "R1", ["src/a.js"], tmpDir, specPath);
    appendFiles(specDir, "R1", ["src/a.js", "src/b.js"], tmpDir, specPath);

    const map = loadFileMap(specDir);
    assert.deepStrictEqual(map, { R1: ["src/a.js", "src/b.js"] });
  });

  it("should reject non-existent reqId with error", async () => {
    const specPath = "specs/test-spec/spec.json";
    writeSpecJson(tmpDir, specPath, [
      { id: "R1", desc: "test requirement", status: "pending" },
    ]);
    writeFlowJson(tmpDir, specPath, "main");

    const { appendFiles } = await import("../../../src/flow/lib/req-map.js");
    const specDir = path.resolve(tmpDir, "specs/test-spec");

    assert.throws(
      () => appendFiles(specDir, "R99", ["src/a.js"], tmpDir, specPath),
      (err) => err.message.includes("R99") || err.code === "INVALID_REQ_ID",
    );
  });

  it("should create empty file-map.json structure when file does not exist", async () => {
    const specPath = "specs/test-spec/spec.json";
    writeSpecJson(tmpDir, specPath, [
      { id: "R1", desc: "test", status: "pending" },
    ]);

    const { loadFileMap } = await import("../../../src/flow/lib/req-map.js");
    const specDir = path.resolve(tmpDir, "specs/test-spec");

    const map = loadFileMap(specDir);
    assert.deepStrictEqual(map, {});
  });
});
