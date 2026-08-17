/**
 * Spec 160: env var prefix unification
 * Verifies that repoRoot() / sourceRoot() read SDD_FORGE_* instead of SDD_*.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";

describe("repoRoot() reads SDD_FORGE_WORK_ROOT", () => {
  let repoRoot;

  before(async () => {
    // Import fresh after setting env var
    delete process.env.SDD_WORK_ROOT;
    delete process.env.SDD_FORGE_WORK_ROOT;
    const mod = await import("../../../src/lib/cli.js");
    repoRoot = mod.repoRoot;
  });

  it("returns SDD_FORGE_WORK_ROOT when set", () => {
    process.env.SDD_FORGE_WORK_ROOT = "/tmp/forge-work-root";
    try {
      assert.equal(repoRoot(), "/tmp/forge-work-root");
    } finally {
      delete process.env.SDD_FORGE_WORK_ROOT;
    }
  });

  it("does NOT read SDD_WORK_ROOT (old name has no effect)", () => {
    process.env.SDD_WORK_ROOT = "/tmp/old-work-root";
    process.env.SDD_FORGE_WORK_ROOT = "/tmp/new-work-root";
    try {
      // Should return SDD_FORGE_WORK_ROOT, not SDD_WORK_ROOT
      assert.equal(repoRoot(), "/tmp/new-work-root");
    } finally {
      delete process.env.SDD_WORK_ROOT;
      delete process.env.SDD_FORGE_WORK_ROOT;
    }
  });

  it("SDD_WORK_ROOT alone does not affect repoRoot() (no fallback)", () => {
    process.env.SDD_WORK_ROOT = "/tmp/old-work-root";
    delete process.env.SDD_FORGE_WORK_ROOT;
    try {
      // Should NOT return the old name's value — falls through to git / cwd
      assert.notEqual(repoRoot(), "/tmp/old-work-root");
    } finally {
      delete process.env.SDD_WORK_ROOT;
    }
  });
});

describe("sourceRoot() reads SDD_FORGE_SOURCE_ROOT", () => {
  let sourceRoot;

  before(async () => {
    delete process.env.SDD_SOURCE_ROOT;
    delete process.env.SDD_FORGE_SOURCE_ROOT;
    const mod = await import("../../../src/lib/cli.js");
    sourceRoot = mod.sourceRoot;
  });

  it("returns SDD_FORGE_SOURCE_ROOT when set", () => {
    process.env.SDD_FORGE_SOURCE_ROOT = "/tmp/forge-source-root";
    try {
      assert.equal(sourceRoot(), "/tmp/forge-source-root");
    } finally {
      delete process.env.SDD_FORGE_SOURCE_ROOT;
    }
  });

  it("does NOT read SDD_SOURCE_ROOT (old name has no effect)", () => {
    process.env.SDD_SOURCE_ROOT = "/tmp/old-source-root";
    delete process.env.SDD_FORGE_SOURCE_ROOT;
    try {
      assert.notEqual(sourceRoot(), "/tmp/old-source-root");
    } finally {
      delete process.env.SDD_SOURCE_ROOT;
    }
  });
});
