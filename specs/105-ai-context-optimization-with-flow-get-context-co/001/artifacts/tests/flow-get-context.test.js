import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../../tests/helpers/tmp-dir.js";
import { setupFlow, setStepDone } from "../../../tests/helpers/flow-setup.js";

const CMD = join(process.cwd(), "src/flow.js");

describe("flow get context", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupWithAnalysis(tmp, entries, overrides = {}) {
    const analysis = {
      analyzedAt: new Date().toISOString(),
      enrichedAt: new Date().toISOString(),
      modules: { entries, summary: { total: entries.length } },
    };
    fs.mkdirSync(join(tmp, ".sdd-forge/output"), { recursive: true });
    writeJson(tmp, ".sdd-forge/output/analysis.json", analysis);
    setupFlow(tmp, overrides);
  }

  it("list mode returns filtered fields (no hash/mtime/lines/id)", () => {
    tmp = createTmpDir();
    setupWithAnalysis(tmp, [
      {
        id: "abc123",
        file: "src/index.js",
        hash: "deadbeef",
        lines: 100,
        mtime: "2026-01-01T00:00:00Z",
        summary: "Main entry point",
        methods: ["main", "init"],
        chapter: "overview",
        role: "cli",
        enrich: { processedAt: "2026-01-01" },
      },
    ]);

    const result = execFileSync("node", [CMD, "get", "context"], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp },
    });
    const data = JSON.parse(result);
    assert.ok(data.ok);
    const entries = data.data.entries;
    assert.equal(entries.length, 1);
    assert.equal(entries[0].file, "src/index.js");
    assert.equal(entries[0].summary, "Main entry point");
    assert.deepEqual(entries[0].methods, ["main", "init"]);
    // Excluded fields
    assert.equal(entries[0].hash, undefined);
    assert.equal(entries[0].mtime, undefined);
    assert.equal(entries[0].lines, undefined);
    assert.equal(entries[0].id, undefined);
    assert.equal(entries[0].enrich, undefined);
  });

  it("list mode marks unenriched entries", () => {
    tmp = createTmpDir();
    setupWithAnalysis(tmp, [
      {
        id: "abc123",
        file: "src/index.js",
        hash: "deadbeef",
        lines: 50,
        mtime: "2026-01-01T00:00:00Z",
        methods: ["main"],
      },
    ]);

    const result = execFileSync("node", [CMD, "get", "context"], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp },
    });
    const data = JSON.parse(result);
    const entry = data.data.entries[0];
    assert.equal(entry.file, "src/index.js");
    assert.equal(entry.summary, undefined);
    assert.ok(entry.needsSource, "unenriched entry should have needsSource marker");
  });

  it("file mode increments docsRead for docs/ path", () => {
    tmp = createTmpDir();
    const state = setupWithAnalysis(tmp, []);
    // Set draft step to in_progress so resolvePhase returns "draft"
    const flowPath = join(tmp, "specs/001-test/flow.json");
    const flow = JSON.parse(fs.readFileSync(flowPath, "utf8"));
    const draftStep = flow.steps.find(s => s.id === "draft");
    if (draftStep) draftStep.status = "in_progress";
    fs.writeFileSync(flowPath, JSON.stringify(flow, null, 2));

    writeFile(tmp, "docs/overview.md", "# Overview\nProject overview.");

    execFileSync("node", [CMD, "get", "context", "docs/overview.md"], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp },
    });

    const flowJson = JSON.parse(fs.readFileSync(flowPath, "utf8"));
    assert.equal(flowJson.metrics?.draft?.docsRead, 1, "docsRead should be 1");
  });

  it("file mode increments srcRead for src/ path", () => {
    tmp = createTmpDir();
    setupWithAnalysis(tmp, []);
    const flowPath = join(tmp, "specs/001-test/flow.json");
    const flow = JSON.parse(fs.readFileSync(flowPath, "utf8"));
    const implStep = flow.steps.find(s => s.id === "implement");
    if (implStep) implStep.status = "in_progress";
    fs.writeFileSync(flowPath, JSON.stringify(flow, null, 2));

    writeFile(tmp, "src/index.js", "export function main() {}");

    execFileSync("node", [CMD, "get", "context", "src/index.js"], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp },
    });

    const flowJson = JSON.parse(fs.readFileSync(flowPath, "utf8"));
    assert.equal(flowJson.metrics?.impl?.srcRead, 1, "srcRead should be 1");
  });

  it("--raw returns content without envelope", () => {
    tmp = createTmpDir();
    setupWithAnalysis(tmp, [
      {
        id: "abc123",
        file: "src/index.js",
        hash: "deadbeef",
        lines: 50,
        mtime: "2026-01-01T00:00:00Z",
        summary: "Main entry",
        methods: ["main"],
        chapter: "overview",
        role: "cli",
      },
    ]);

    const result = execFileSync("node", [CMD, "get", "context", "--raw"], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp },
    });
    // Should NOT be a JSON envelope
    assert.ok(!result.trim().startsWith('{"ok"'), "raw mode should not return JSON envelope");
  });
});
