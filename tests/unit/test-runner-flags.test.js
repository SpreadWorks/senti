/**
 * tests/unit/test-runner-flags.test.js
 *
 * Spec 212 — R1/R2/R3/R5: tests/run.js --agent / --all selector semantics.
 * Covers the pure helpers (buildSearchDirs / validateFlags) and the
 * end-to-end behavior of `node tests/run.js --agent --preset <x>` rejection.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
  buildSearchDirs,
  validateFlags,
} from "../helpers/test-runner-search-dirs.js";

const ROOT = resolve(import.meta.dirname, "..", "..");
const RUN_JS = resolve(ROOT, "tests", "run.js");

describe("buildSearchDirs", () => {
  it("default (no flags) returns unit + e2e + presets (no tests/agent)", () => {
    const dirs = buildSearchDirs({ root: ROOT }, {});
    assert.ok(dirs.some((d) => d.endsWith("/tests/unit")));
    assert.ok(dirs.some((d) => d.endsWith("/tests/e2e")));
    assert.ok(dirs.some((d) => d.endsWith("/src/presets")));
    assert.ok(!dirs.some((d) => d.endsWith("/tests/agent")));
  });

  it("--agent returns only tests/agent", () => {
    const dirs = buildSearchDirs({ root: ROOT }, { agent: true });
    assert.equal(dirs.length, 1);
    assert.ok(dirs[0].endsWith("/tests/agent"));
  });

  it("--all returns default dirs plus tests/agent", () => {
    const dirs = buildSearchDirs({ root: ROOT }, { all: true });
    assert.ok(dirs.some((d) => d.endsWith("/tests/unit")));
    assert.ok(dirs.some((d) => d.endsWith("/tests/e2e")));
    assert.ok(dirs.some((d) => d.endsWith("/src/presets")));
    assert.ok(dirs.some((d) => d.endsWith("/tests/agent")));
  });

  it("--preset preserves existing preset search behavior and excludes tests/agent", () => {
    const dirs = buildSearchDirs({ root: ROOT }, { preset: "hono" });
    assert.ok(!dirs.some((d) => d.endsWith("/tests/agent")));
  });

  it("--scope unit returns unit dirs only and excludes tests/agent", () => {
    const dirs = buildSearchDirs({ root: ROOT }, { scope: "unit" });
    assert.ok(dirs.some((d) => d.endsWith("/tests/unit")));
    assert.ok(!dirs.some((d) => d.endsWith("/tests/e2e")));
    assert.ok(!dirs.some((d) => d.endsWith("/tests/agent")));
  });
});

describe("validateFlags", () => {
  it("accepts no flags", () => {
    assert.equal(validateFlags({}).error, null);
  });

  it("accepts --agent alone", () => {
    assert.equal(validateFlags({ agent: true }).error, null);
  });

  it("accepts --all alone", () => {
    assert.equal(validateFlags({ all: true }).error, null);
  });

  it("rejects --agent with --preset", () => {
    const res = validateFlags({ agent: true, preset: "hono" });
    assert.ok(res.error);
    assert.match(res.error, /--agent/);
  });

  it("rejects --agent with --scope", () => {
    const res = validateFlags({ agent: true, scope: "unit" });
    assert.ok(res.error);
    assert.match(res.error, /--agent/);
  });

  it("rejects --agent with --all", () => {
    const res = validateFlags({ agent: true, all: true });
    assert.ok(res.error);
  });
});

describe("tests/run.js integration — flag rejection", () => {
  it("--agent --preset exits non-zero with stderr", () => {
    const res = spawnSync("node", [RUN_JS, "--agent", "--preset", "hono"], {
      encoding: "utf8",
      cwd: ROOT,
    });
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /--agent/);
  });

  it("--agent --scope unit exits non-zero with stderr", () => {
    const res = spawnSync("node", [RUN_JS, "--agent", "--scope", "unit"], {
      encoding: "utf8",
      cwd: ROOT,
    });
    assert.notEqual(res.status, 0);
    assert.match(res.stderr, /--agent/);
  });
});
