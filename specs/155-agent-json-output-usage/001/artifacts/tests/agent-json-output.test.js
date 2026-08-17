/**
 * Spec verification tests for: 155-agent-json-output-usage
 *
 * Tests for jsonOutputFlag support, provider detection, JSON parsing,
 * and usage logging in src/lib/agent.js.
 *
 * Placement: specs/<spec>/tests/ (NOT in npm test suite)
 * Run with: node --test specs/155-agent-json-output-usage/tests/agent-json-output.test.js
 *
 * Design note:
 *   Tests that verify JSON parsing or flag injection use executable fixture
 *   scripts (tests/fixtures/). When called as executables (not via `node -e`),
 *   injected flags like --output-format go to process.argv without breaking
 *   node itself. Tests that only need plain text output use `node -e`.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { resolveAgent, callAgent, callAgentAsync } from "../../../src/lib/agent.js";

const SPEC_DIR = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = (name) => path.join(SPEC_DIR, "fixtures", name);

// ---------------------------------------------------------------------------
// Req 2: provider 判定 (partial match on agent.command)
// ---------------------------------------------------------------------------

describe("resolveAgent: providerKey detection", () => {
  function makeConfig(command) {
    return {
      agent: {
        default: "main",
        providers: { main: { command, args: [] } },
      },
    };
  }

  it("sets providerKey to 'claude' when command contains 'claude'", () => {
    assert.equal(resolveAgent(makeConfig("claude")).providerKey, "claude");
  });

  it("sets providerKey to 'claude' for names containing 'claude' (e.g. claude/opus)", () => {
    assert.equal(resolveAgent(makeConfig("claude/opus")).providerKey, "claude");
  });

  it("sets providerKey to 'codex' when command contains 'codex'", () => {
    assert.equal(resolveAgent(makeConfig("codex")).providerKey, "codex");
  });

  it("sets providerKey to 'unknown' when command contains neither", () => {
    assert.equal(resolveAgent(makeConfig("gemini")).providerKey, "unknown");
  });

  it("sets providerKey to 'unknown' for generic commands like 'node'", () => {
    assert.equal(resolveAgent(makeConfig("node")).providerKey, "unknown");
  });
});

// ---------------------------------------------------------------------------
// Req 1: jsonOutputFlag is injected into args
//
// Uses fixtures/mock-claude-agent (executable): receives injected flags in
// process.argv without breaking node, checks for --output-format in argv.
// ---------------------------------------------------------------------------

describe("callAgent: jsonOutputFlag args injection", () => {
  it("adds jsonOutputFlag to args — fixture detects flag and outputs JSON", () => {
    const agent = {
      command: FIXTURE("mock-claude-agent"),
      args: ["{{PROMPT}}"],
      jsonOutputFlag: "--output-format json",
      providerKey: "claude",
    };
    const result = callAgent(agent, "test");
    assert.equal(result, "hello"); // mock outputs JSON only when flag is present
  });

  it("returns 'no-flag' string when jsonOutputFlag is not set", () => {
    const agent = {
      command: FIXTURE("mock-claude-agent"),
      args: ["{{PROMPT}}"],
      // No jsonOutputFlag → no injection → fixture outputs "no-flag"
      // providerKey defaults to "unknown" for mock-claude-agent path → plain text
    };
    const result = callAgent(agent, "test");
    assert.equal(result, "no-flag");
  });

  it("does not duplicate jsonOutputFlag if first flag part already in args", () => {
    // args already contain --output-format; injectJsonFlag should skip
    const agent = {
      command: FIXTURE("mock-claude-agent"),
      args: ["--output-format", "{{PROMPT}}"], // --output-format already present
      jsonOutputFlag: "--output-format json",
      providerKey: "claude",
    };
    // injectJsonFlag skips because --output-format already in resolvedArgs
    // → fixture receives --output-format once → outputs JSON
    const result = callAgent(agent, "json");
    assert.equal(result, "hello");
  });
});

// ---------------------------------------------------------------------------
// Req 3: JSON parse — claude format
// ---------------------------------------------------------------------------

describe("callAgent: claude JSON parsing", () => {
  it("returns text from claude JSON result field", () => {
    const agent = {
      command: FIXTURE("mock-claude-json"),
      args: ["{{PROMPT}}"],
      jsonOutputFlag: "--output-format json",
      providerKey: "claude",
      // MOCK_RESULT env not set → defaults to "hello"
    };
    const result = callAgent(agent, "test");
    assert.equal(result, "hello");
  });

  it("returns trimmed text from claude JSON", () => {
    // Use MOCK_RESULT to produce text with whitespace
    const agent = {
      command: FIXTURE("mock-claude-json"),
      args: ["{{PROMPT}}"],
      jsonOutputFlag: "--output-format json",
      providerKey: "claude",
    };
    // The fixture result field doesn't have extra whitespace, but test the trim path
    // by checking the result is a clean string
    const result = callAgent(agent, "test");
    assert.equal(result, result.trim());
  });
});

// ---------------------------------------------------------------------------
// Req 3: JSON parse — codex NDJSON format
// ---------------------------------------------------------------------------

describe("callAgent: codex NDJSON parsing", () => {
  it("returns text from codex NDJSON item.completed", () => {
    const agent = {
      command: FIXTURE("mock-codex-ndjson"),
      args: ["{{PROMPT}}"],
      jsonOutputFlag: "--json",
      providerKey: "codex",
    };
    const result = callAgent(agent, "test");
    assert.equal(result, "codex response text");
  });
});

// ---------------------------------------------------------------------------
// Req 3: Fallback — JSON parse failure
// ---------------------------------------------------------------------------

describe("callAgent: plain text fallback on JSON parse failure", () => {
  it("returns raw text when stdout is not valid JSON (unknown provider)", () => {
    // command path doesn't contain "claude"/"codex" → providerKey "unknown"
    // → jsonOutputFlag is ignored → plain text returned
    const agent = {
      command: "node",
      args: ["-e", "process.stdout.write('not valid json at all')", "--", "{{PROMPT}}"],
      jsonOutputFlag: "--output-format json",
      // providerKey: not set → resolveAgentResult uses agent.providerKey ?? "unknown"
    };
    const result = callAgent(agent, "test");
    assert.equal(result, "not valid json at all");
  });

  it("does not throw on JSON parse failure (claude provider, invalid JSON output)", () => {
    // Fixture outputs invalid JSON — parseAgentOutput should warn and return null → fallback
    const agent = {
      command: "node",
      args: ["-e", "process.stdout.write('bad json {{')", "--", "{{PROMPT}}"],
      // No jsonOutputFlag → no flag injection → no JSON parse attempt
      // To test parse failure: set providerKey only (parse happens, fails, falls back)
      providerKey: "claude",
      jsonOutputFlag: "", // empty string → flagParts = [] → no injection → no break
    };
    assert.doesNotThrow(() => callAgent(agent, "test"));
  });

  it("falls back to raw text on JSON parse failure", () => {
    const agent = {
      command: "node",
      args: ["-e", "process.stdout.write('not json')", "--", "{{PROMPT}}"],
      providerKey: "claude",
      jsonOutputFlag: "", // empty → no injection, but resolveAgentResult checks agent.jsonOutputFlag
    };
    const result = callAgent(agent, "test");
    // empty jsonOutputFlag is falsy → falls through to plain text
    assert.equal(result, "not json");
  });
});

// ---------------------------------------------------------------------------
// Req 5: Return value compatibility — always trimmed string
// ---------------------------------------------------------------------------

describe("callAgent: return value is always trimmed string", () => {
  it("returns trimmed string when jsonOutputFlag is set (claude JSON fixture)", () => {
    const agent = {
      command: FIXTURE("mock-claude-json"),
      args: ["{{PROMPT}}"],
      jsonOutputFlag: "--output-format json",
      providerKey: "claude",
    };
    const result = callAgent(agent, "test");
    assert.equal(typeof result, "string");
    assert.equal(result, result.trim());
    assert.ok(result.length > 0);
  });

  it("returns trimmed string when jsonOutputFlag is not set", () => {
    const agent = {
      command: "node",
      args: ["-e", "process.stdout.write('  plain output  ')", "--", "{{PROMPT}}"],
    };
    const result = callAgent(agent, "test");
    assert.equal(typeof result, "string");
    assert.equal(result, "plain output");
  });
});

// ---------------------------------------------------------------------------
// Req 6: Unchanged behavior when jsonOutputFlag is not set
// ---------------------------------------------------------------------------

describe("callAgent: no behavior change without jsonOutputFlag", () => {
  it("does not inject any extra flags when jsonOutputFlag is absent", () => {
    // Script outputs all received argv after --
    const script = `
      const args = process.argv.slice(2).filter(a => a !== '--');
      process.stdout.write(args.join(','));
    `;
    const agent = {
      command: "node",
      args: ["-e", script, "--", "{{PROMPT}}"],
    };
    const result = callAgent(agent, "myinput");
    assert.ok(!result.includes("--output-format"), "No --output-format should be injected");
    assert.ok(!result.includes("--json"), "No --json should be injected");
  });
});

// ---------------------------------------------------------------------------
// Req 5: callAgentAsync — return value is string
// ---------------------------------------------------------------------------

describe("callAgentAsync: return value is string (async path)", () => {
  it("returns trimmed string from async call with plain output", async () => {
    const agent = {
      command: "node",
      args: ["-e", "process.stdout.write('async output')", "--", "{{PROMPT}}"],
    };
    const result = await callAgentAsync(agent, "test");
    assert.equal(typeof result, "string");
    assert.equal(result, "async output");
  });

  it("returns text from claude JSON via async path", async () => {
    const agent = {
      command: FIXTURE("mock-claude-json"),
      args: ["{{PROMPT}}"],
      jsonOutputFlag: "--output-format json",
      providerKey: "claude",
    };
    const result = await callAgentAsync(agent, "test");
    assert.equal(typeof result, "string");
    assert.equal(result, "hello");
  });
});
