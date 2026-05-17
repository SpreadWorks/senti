/**
 * tests/unit/docs/enrich-dump-path.test.js
 *
 * Verify that enrich failure dumps go to agent.workDir, not .sdd-forge/output/.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { resolveWorkDir } from "../../../src/lib/config.js";

describe("enrich failure dump path", () => {
  it("resolveWorkDir ignores SDD_FORGE_WORK_DIR and uses config.agent.workDir", () => {
    const root = "/project";
    const config = { agent: { workDir: ".tmp" } };
    const prev = process.env.SDD_FORGE_WORK_DIR;
    process.env.SDD_FORGE_WORK_DIR = ".sandbox-work";
    try {
      const result = resolveWorkDir(root, config);
      assert.equal(result, "/project/.tmp");
    } finally {
      if (prev == null) delete process.env.SDD_FORGE_WORK_DIR;
      else process.env.SDD_FORGE_WORK_DIR = prev;
    }
  });

  it("resolveWorkDir accepts an explicit agentWorkDir override", () => {
    const root = "/project";
    const config = { agent: { workDir: ".tmp" } };
    const result = resolveWorkDir(root, config, { agentWorkDirOverride: ".agent-run" });
    assert.equal(result, "/project/.agent-run");
  });

  it("resolveWorkDir returns agent.workDir from config", () => {
    const root = "/project";
    const config = { agent: { workDir: ".tmp" } };
    const result = resolveWorkDir(root, config);
    assert.equal(result, "/project/.tmp");
  });

  it("resolveWorkDir defaults to .tmp when agent.workDir not set", () => {
    const root = "/project";
    const config = {};
    const result = resolveWorkDir(root, config);
    assert.equal(result, "/project/.tmp");
  });

  it("enrich.js source uses resolveWorkDir for dump path, not sddOutputDir", () => {
    const enrichPath = path.join(process.cwd(), "src/docs/commands/enrich.js");
    const source = fs.readFileSync(enrichPath, "utf8");

    assert.ok(
      source.includes("resolveWorkDir"),
      "enrich.js should reference resolveWorkDir",
    );

    const dumpLines = source.split("\n").filter((l) => l.includes("enrich-fail-batch"));
    for (const line of dumpLines) {
      assert.ok(
        !line.includes("sddOutputDir"),
        `dump path line should not use sddOutputDir: ${line.trim()}`,
      );
    }
  });
});
