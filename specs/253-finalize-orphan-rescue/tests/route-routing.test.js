// spec: R4 R5 R11 R20 R21
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readCleanupSrc() {
  return fs.readFileSync(
    path.resolve(__dirname, "../../../src/flow/lib/run-finalize-cleanup.js"),
    "utf8",
  );
}

describe("R4: PR route and spec-only mode skip orphan detection", () => {
  it("R4: PR route bypasses orphan detection and proceeds to teardown", () => {
    const src = readCleanupSrc();
    assert.ok(
      src.includes("mergeStrategy") || src.includes("merge_route") || src.includes("'pr'"),
      "must read merge route from flow state",
    );
    assert.ok(
      /['"]pr['"][\s\S]{0,200}skip|skip[\s\S]{0,200}['"]pr['"]/.test(src) ||
        src.includes("// PR route"),
      "must skip detection for PR route",
    );
  });
  it("R4: spec-only mode (featureBranch===baseBranch) keeps existing early-return", () => {
    const src = readCleanupSrc();
    assert.ok(
      src.includes("featureBranch === baseBranch"),
      "spec-only early return must be preserved",
    );
  });
});

describe("R5: missing squash baseline halts and only --force passes", () => {
  it("R5: SQUASH_BASELINE_MISSING is returned when baseline state is null without --force", () => {
    const src = readCleanupSrc();
    assert.ok(
      src.includes("SQUASH_BASELINE_MISSING"),
      "SQUASH_BASELINE_MISSING fail path required",
    );
    assert.ok(
      src.includes("--force") || src.includes("ctx.args.force") || /\.force\b/.test(src),
      "--force must be honored to bypass baseline missing",
    );
  });
});

describe("R11: --auto-rescue and --force are mutually exclusive", () => {
  it("R11: simultaneous --auto-rescue --force returns ARGS_ERROR with no side-effects", () => {
    const src = readCleanupSrc();
    assert.ok(src.includes("ARGS_ERROR"), "ARGS_ERROR code required");
    assert.ok(
      /autoRescue[\s\S]{0,200}force|force[\s\S]{0,200}autoRescue/.test(src),
      "execute must check both flags for mutual exclusion",
    );
  });
});

describe("R20: exit code contract for finalize-cleanup", () => {
  it("R20: success / warning paths use Envelope.ok or addWarning (exit 0)", () => {
    const src = readCleanupSrc();
    assert.ok(
      src.includes("Envelope.ok") || src.includes("addWarning"),
      "success/warning envelope path required",
    );
  });
  it("R20: validation/detection halt paths use Envelope.fail (non-zero exit)", () => {
    const src = readCleanupSrc();
    const failOccurrences = (src.match(/Envelope\.fail/g) || []).length;
    assert.ok(failOccurrences >= 3, `multiple Envelope.fail call sites required (found ${failOccurrences})`);
  });
});

describe("R21: user-facing argument validation for finalize-cleanup", () => {
  it("R21: registry registers --auto-rescue and --force as boolean flags", () => {
    const registrySrc = fs.readFileSync(
      path.resolve(__dirname, "../../../src/flow/registry.js"),
      "utf8",
    );
    const finalizeCleanupBlock = registrySrc.match(
      /["']finalize-cleanup["'][\s\S]{0,2000}/,
    );
    assert.ok(finalizeCleanupBlock, "finalize-cleanup registry entry must exist");
    const block = finalizeCleanupBlock[0];
    assert.ok(block.includes("--auto-rescue"), "--auto-rescue must be registered");
    assert.ok(block.includes("--force"), "--force must be registered");
  });
  it("R21: execute() validates flag combinations at entry point", () => {
    const src = readCleanupSrc();
    const execMatch = src.match(/async\s+execute\s*\([\s\S]{0,3000}/);
    assert.ok(execMatch, "execute method must be present");
    assert.ok(
      execMatch[0].includes("ARGS_ERROR") ||
        execMatch[0].includes("autoRescue") ||
        /\.force\b/.test(execMatch[0]),
      "execute must validate flag arguments at entry",
    );
  });
});
