/**
 * Spec 135 verification tests.
 * Verifies that the consolidation requirements are met.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve(import.meta.dirname, "../../../src");

describe("spec-135: consolidate command execution", () => {
  it("git-state.js no longer exists", () => {
    assert.ok(
      !fs.existsSync(path.join(SRC, "lib/git-state.js")),
      "src/lib/git-state.js should be removed",
    );
  });

  it("git-helpers.js exists", () => {
    assert.ok(
      fs.existsSync(path.join(SRC, "lib/git-helpers.js")),
      "src/lib/git-helpers.js should exist",
    );
  });

  it("process.js exports runCmd and runCmdAsync", async () => {
    const mod = await import("../../../src/lib/process.js");
    assert.equal(typeof mod.runCmd, "function", "runCmd should be exported");
    assert.equal(typeof mod.runCmdAsync, "function", "runCmdAsync should be exported");
  });

  it("runSync is no longer exported from process.js", async () => {
    const mod = await import("../../../src/lib/process.js");
    assert.equal(mod.runSync, undefined, "runSync should be removed");
  });

  it("no execFileSync imports outside process.js and agent.js", () => {
    const srcFiles = collectJsFiles(SRC);
    const violations = [];
    for (const file of srcFiles) {
      const rel = path.relative(SRC, file);
      if (rel === "lib/process.js") continue;
      if (rel === "lib/agent.js") continue;
      const content = fs.readFileSync(file, "utf8");
      if (/execFileSync/.test(content)) {
        violations.push(rel);
      }
    }
    assert.deepEqual(violations, [], `execFileSync found in: ${violations.join(", ")}`);
  });

  it("no tryExec references in src/", () => {
    const srcFiles = collectJsFiles(SRC);
    const violations = [];
    for (const file of srcFiles) {
      const content = fs.readFileSync(file, "utf8");
      if (/\btryExec\b/.test(content)) {
        violations.push(path.relative(SRC, file));
      }
    }
    assert.deepEqual(violations, [], `tryExec found in: ${violations.join(", ")}`);
  });
});

function collectJsFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules" && entry.name !== "presets") {
      results.push(...collectJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      results.push(full);
    }
  }
  return results;
}
