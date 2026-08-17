/**
 * specs/169-fix-flow-help-flag/tests/help-flag.test.js
 *
 * Verify that --help works for positional-only flow subcommands.
 * These commands define only `args.positional` (no flags/options)
 * and previously failed to recognize -h/--help.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "child_process";
import { join } from "path";

const FLOW_CMD = join(process.cwd(), "src/flow.js");

function runFlow(...args) {
  return execFileSync("node", [FLOW_CMD, ...args], { encoding: "utf8" });
}

// ── Requirement 3: positional-only commands show help with --help ────────────

describe("positional-only --help (get subcommands)", () => {
  it("flow get check --help shows usage", () => {
    const out = runFlow("get", "check", "--help");
    assert.match(out, /usage/i);
  });

  it("flow get prompt --help shows usage", () => {
    const out = runFlow("get", "prompt", "--help");
    assert.match(out, /usage/i);
  });

  it("flow get issue --help shows usage", () => {
    const out = runFlow("get", "issue", "--help");
    assert.match(out, /usage/i);
  });
});

describe("positional-only --help (set subcommands)", () => {
  it("flow set step --help shows usage", () => {
    const out = runFlow("set", "step", "--help");
    assert.match(out, /usage/i);
  });

  it("flow set request --help shows usage", () => {
    const out = runFlow("set", "request", "--help");
    assert.match(out, /usage/i);
  });

  it("flow set issue --help shows usage", () => {
    const out = runFlow("set", "issue", "--help");
    assert.match(out, /usage/i);
  });

  it("flow set note --help shows usage", () => {
    const out = runFlow("set", "note", "--help");
    assert.match(out, /usage/i);
  });

  it("flow set summary --help shows usage", () => {
    const out = runFlow("set", "summary", "--help");
    assert.match(out, /usage/i);
  });

  it("flow set req --help shows usage", () => {
    const out = runFlow("set", "req", "--help");
    assert.match(out, /usage/i);
  });

  it("flow set metric --help shows usage", () => {
    const out = runFlow("set", "metric", "--help");
    assert.match(out, /usage/i);
  });

  it("flow set auto --help shows usage", () => {
    const out = runFlow("set", "auto", "--help");
    assert.match(out, /usage/i);
  });
});

describe("positional-only -h shorthand", () => {
  it("flow get check -h shows usage", () => {
    const out = runFlow("get", "check", "-h");
    assert.match(out, /usage/i);
  });

  it("flow set step -h shows usage", () => {
    const out = runFlow("set", "step", "-h");
    assert.match(out, /usage/i);
  });
});

// ── Requirement 2: existing positional arg parsing still works ──────────────

describe("positional args regression", () => {
  it("flow get prompt plan.approach still parses positional kind", () => {
    // This should not be treated as help; it should attempt normal execution.
    // It will fail with NO_FLOW since there's no active flow, but that's expected —
    // the important thing is it does NOT show help text.
    // prompt has requiresFlow: false, so it will run normally
    const out = runFlow("get", "prompt", "plan.approach");
    // Should return JSON (prompt data), not help text
    assert.ok(!out.match(/^usage/im), "should not show help text for normal args");
  });
});
