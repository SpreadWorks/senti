import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir } from "../../../helpers/tmp-dir.js";
import { CanonicalFlowFixture, makeFlowManager } from "../../../helpers/flow-setup.js";

const CMD = join(process.cwd(), "src/sennel.js");
const CMD_ARGS = ["docs", "changelog"];

/**
 * Set up a normal production V1 Flow, never a hand-written root-level
 * flow.json/spec.json pair. The changelog is a read-only consumer, so this
 * deliberately leaves no active-flow registry shortcut for it to consult.
 */
function createCanonicalChangelogFlow(tmp, {
  specId = "001-test-feature",
  goal = "Test feature goal.",
  scopeIn = [],
  finalized = false,
} = {}) {
  const flowManager = makeFlowManager(tmp);
  const fixture = new CanonicalFlowFixture({
    flowManager,
    specId,
    runId: `changelog-${specId}`,
    request: `Create ${goal}`,
    execution: { mode: "direct" },
    specRecord: {
      goal,
      scope: { in: scopeIn, out: [] },
    },
  }).create();
  if (finalized) {
    const leafIds = fixture.leaves().map((step) => step.id);
    for (const nodeId of leafIds) fixture.settle(nodeId);
    flowManager.finalizeFlow(specId);
  }
  return fixture;
}

describe("changelog CLI", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("generates changelog from specs", () => {
    tmp = createTmpDir();
    const flow = createCanonicalChangelogFlow(tmp, {
      goal: "Test feature goal.",
      scopeIn: ["Add tests"],
      finalized: true,
    });
    fs.mkdirSync(join(tmp, "docs"), { recursive: true });

    execFileSync("node", [CMD, ...CMD_ARGS], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp, SENNEL_SOURCE_ROOT: tmp },
    });

    const outFile = join(tmp, "docs", "change_log.md");
    assert.ok(fs.existsSync(outFile), "change_log.md should be created");
    const content = fs.readFileSync(outFile, "utf8");
    assert.match(content, /Change Log/);
    assert.match(content, /001-test-feature/);
    assert.match(content, /completed/);
    assert.match(content, /001\/spec\.json/);
    assert.equal(fs.existsSync(join(tmp, "specs", flow.specId, "flow.json")), false);
    assert.equal(fs.existsSync(join(tmp, "specs", flow.specId, "spec.json")), false);
  });

  it("generates empty changelog when no specs exist", () => {
    tmp = createTmpDir();
    fs.mkdirSync(join(tmp, "docs"), { recursive: true });

    execFileSync("node", [CMD, ...CMD_ARGS], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp, SENNEL_SOURCE_ROOT: tmp },
    });

    const outFile = join(tmp, "docs", "change_log.md");
    assert.ok(fs.existsSync(outFile));
    const content = fs.readFileSync(outFile, "utf8");
    assert.match(content, /Change Log/);
  });

  it("--dry-run outputs to stdout without writing file", () => {
    tmp = createTmpDir();
    createCanonicalChangelogFlow(tmp, {
      goal: "Test feature goal.",
    });
    fs.mkdirSync(join(tmp, "docs"), { recursive: true });

    const result = execFileSync("node", [CMD, ...CMD_ARGS, "--dry-run"], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp, SENNEL_SOURCE_ROOT: tmp },
    });
    assert.match(result, /Change Log/);
    assert.match(result, /001-test-feature/);
    // File should NOT be written
    const outFile = join(tmp, "docs", "change_log.md");
    assert.ok(!fs.existsSync(outFile), "change_log.md should NOT be created in dry-run");
  });

  it("overwrites existing file without MANUAL blocks", () => {
    tmp = createTmpDir();
    fs.mkdirSync(join(tmp, "docs"), { recursive: true });
    const outFile = join(tmp, "docs", "change_log.md");
    const existing = "old content\n";
    fs.writeFileSync(outFile, existing);

    execFileSync("node", [CMD, ...CMD_ARGS], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp, SENNEL_SOURCE_ROOT: tmp },
    });

    const content = fs.readFileSync(outFile, "utf8");
    assert.ok(!content.includes("old content"));
    assert.match(content, /AUTO-GEN:START/);
  });
});
