/**
 * specs/181-phase0-cleanup/tests/cleanup.test.js
 *
 * Verify R1 (exit-codes consolidation), R2 (repoRoot arg cleanup),
 * R3 (help single dispatch), R4 (dead helper removal).
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "..", "..");
const CLI = join(ROOT, "src", "sdd-forge.js");
const SRC = join(ROOT, "src");

function runCli(args, { env = {} } = {}) {
  try {
    const out = execFileSync("node", [CLI, ...args], {
      encoding: "utf8",
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { stdout: out, code: 0 };
  } catch (e) {
    return { stdout: e.stdout || "", stderr: e.stderr || "", code: e.status ?? 1 };
  }
}

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      walk(full, out);
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      out.push(full);
    }
  }
  return out;
}

const ALL_SRC_FILES = walk(SRC);

function anyFileMatches(pattern) {
  return ALL_SRC_FILES.some((p) => pattern.test(readFileSync(p, "utf8")));
}

function filesMatching(pattern) {
  return ALL_SRC_FILES.filter((p) => pattern.test(readFileSync(p, "utf8")));
}

// ── R1: exit-codes consolidation ─────────────────────────────────────────────

describe("R1: exit-code constants consolidated into constants.js", () => {
  it("src/lib/exit-codes.js does not exist", () => {
    assert.equal(existsSync(join(SRC, "lib", "exit-codes.js")), false);
  });

  it("no imports reference exit-codes.js", () => {
    const hits = filesMatching(/from\s+["'][^"']*exit-codes(?:\.js)?["']/);
    assert.deepEqual(hits, [], `unexpected imports: ${hits.join(", ")}`);
  });

  it("src/lib/constants.js exports EXIT_SUCCESS=0 and EXIT_ERROR=1", async () => {
    const mod = await import(join(SRC, "lib", "constants.js"));
    assert.equal(mod.EXIT_SUCCESS, 0);
    assert.equal(mod.EXIT_ERROR, 1);
  });
});

// ── R2: repoRoot argument cleanup ────────────────────────────────────────────

describe("R2: repoRoot signature simplified", () => {
  it("no call site passes import.meta.url to repoRoot", () => {
    const hits = filesMatching(/repoRoot\s*\(\s*import\.meta\.url\s*\)/);
    assert.deepEqual(hits, [], `unexpected calls: ${hits.join(", ")}`);
  });

  it("repoRoot function signature has no parameters", () => {
    const cli = readFileSync(join(SRC, "lib", "cli.js"), "utf8");
    assert.match(cli, /export\s+function\s+repoRoot\s*\(\s*\)\s*\{/);
  });

  it("repoRoot honors SDD_FORGE_WORK_ROOT env var", async () => {
    const mod = await import(join(SRC, "lib", "cli.js") + `?t=${Date.now()}`);
    const prev = process.env.SDD_FORGE_WORK_ROOT;
    process.env.SDD_FORGE_WORK_ROOT = "/tmp/sdd-forge-test-root";
    try {
      assert.equal(mod.repoRoot(), "/tmp/sdd-forge-test-root");
    } finally {
      if (prev == null) delete process.env.SDD_FORGE_WORK_ROOT;
      else process.env.SDD_FORGE_WORK_ROOT = prev;
    }
  });
});

// ── R3: help single dispatch ─────────────────────────────────────────────────

describe("R3: help processed in a single branch", () => {
  it("INDEPENDENT map does not contain help", () => {
    const entry = readFileSync(join(SRC, "sdd-forge.js"), "utf8");
    const match = entry.match(/const\s+INDEPENDENT\s*=\s*\{([^}]*)\}/s);
    assert.ok(match, "INDEPENDENT map not found");
    assert.doesNotMatch(match[1], /\bhelp\s*:/);
  });

  it("sdd-forge (no args) prints help", () => {
    const { stdout, code } = runCli([]);
    assert.equal(code, 0);
    assert.match(stdout.toLowerCase(), /usage|sdd-forge/);
  });

  it("sdd-forge -h prints help", () => {
    const { stdout, code } = runCli(["-h"]);
    assert.equal(code, 0);
    assert.match(stdout.toLowerCase(), /usage|sdd-forge/);
  });

  it("sdd-forge --help prints help", () => {
    const { stdout, code } = runCli(["--help"]);
    assert.equal(code, 0);
    assert.match(stdout.toLowerCase(), /usage|sdd-forge/);
  });

  it("sdd-forge help prints help", () => {
    const { stdout, code } = runCli(["help"]);
    assert.equal(code, 0);
    assert.match(stdout.toLowerCase(), /usage|sdd-forge/);
  });

  it("sdd-forge help <topic> does not crash", () => {
    // `help <topic>` extension: rest args should be forwarded. help.js may or may not
    // render a topic, but it must not throw / must exit 0.
    const { code } = runCli(["help", "docs"]);
    assert.equal(code, 0);
  });

  it("unknown subcommand exits with EXIT_ERROR (1)", () => {
    const { code } = runCli(["definitely-not-a-real-subcommand"]);
    assert.equal(code, 1);
  });
});

// ── R4: writeAgentContext / cleanupAgentContext removed ──────────────────────

describe("R4: dead helpers removed", () => {
  it("no references to writeAgentContext in src/", () => {
    assert.equal(anyFileMatches(/writeAgentContext/), false);
  });

  it("no references to cleanupAgentContext in src/", () => {
    assert.equal(anyFileMatches(/cleanupAgentContext/), false);
  });
});
