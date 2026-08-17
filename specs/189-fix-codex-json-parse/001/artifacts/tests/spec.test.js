/**
 * Spec 189 verification tests — JSON flag literal propagation.
 *
 * Run: node --test specs/189-fix-codex-json-parse/tests/spec.test.js
 *
 * These tests verify the spec's requirements:
 *   R1.x: builtin profiles carry the JSON flag literally in args
 *   R2.x: Agent._buildInvocation does not inject JSON flags
 *   R2.3: Provider classes no longer expose jsonFlag()
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { Agent } from "../../../src/lib/agent.js";
import {
  Provider,
  ClaudeProvider,
  CodexProvider,
  ProviderRegistry,
} from "../../../src/lib/provider.js";
import { Logger } from "../../../src/lib/log.js";

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "spec189-"));
}

function makeAgent(config) {
  const root = tmpDir();
  const agentWorkDir = path.join(root, ".tmp");
  const registry = new ProviderRegistry(config.agent?.providers || {});
  return new Agent({
    config,
    paths: { root, agentWorkDir },
    registry,
    logger: new Logger({ logDir: os.tmpdir(), enabled: false }),
  });
}

describe("R1.1 — builtin profiles contain JSON flag literally", () => {
  it("CodexProvider builtin profiles contain '--json' in args", () => {
    const profiles = new CodexProvider().builtinProfiles();
    for (const [key, profile] of Object.entries(profiles)) {
      assert.ok(
        profile.args.includes("--json"),
        `${key} args must contain literal '--json': got ${JSON.stringify(profile.args)}`,
      );
    }
  });

  it("ClaudeProvider builtin profiles contain '--output-format json' in args", () => {
    const profiles = new ClaudeProvider().builtinProfiles();
    for (const [key, profile] of Object.entries(profiles)) {
      const args = profile.args;
      const idx = args.indexOf("--output-format");
      assert.notEqual(idx, -1, `${key} args must contain '--output-format'`);
      assert.equal(args[idx + 1], "json", `${key} args must pair '--output-format' with 'json'`);
    }
  });
});

describe("R2.3 — Provider abstraction has no jsonFlag method", () => {
  it("Provider base class does not expose jsonFlag()", () => {
    assert.equal(
      typeof Provider.prototype.jsonFlag,
      "undefined",
      "Provider.prototype.jsonFlag must be removed",
    );
  });

  it("ClaudeProvider does not expose jsonFlag()", () => {
    assert.equal(
      typeof new ClaudeProvider().jsonFlag,
      "undefined",
      "ClaudeProvider.jsonFlag must be removed",
    );
  });

  it("CodexProvider does not expose jsonFlag()", () => {
    assert.equal(
      typeof new CodexProvider().jsonFlag,
      "undefined",
      "CodexProvider.jsonFlag must be removed",
    );
  });
});

describe("R2.1 — user config profile args pass through literally", () => {
  it("no additional flags injected into user profile args (codex-like command)", () => {
    const userArgs = ["exec", "-m", "custom-model", "{{PROMPT}}"];
    const cfg = {
      agent: {
        default: "custom/codex",
        providers: { "custom/codex": { command: "codex", args: [...userArgs] } },
        timeout: 300,
      },
    };
    const agent = makeAgent(cfg);
    const built = agent._buildInvocationForTest("hello", { commandId: "test" });

    // workDir injection is legitimate (runtime path), but no --json should appear
    // when the user has not written it in their args.
    assert.ok(
      !built.finalArgs.includes("--json"),
      `unexpected '--json' injection: ${JSON.stringify(built.finalArgs)}`,
    );
  });

  it("no additional flags injected into user profile args (claude-like command)", () => {
    const userArgs = ["-p", "{{PROMPT}}", "--model", "custom"];
    const cfg = {
      agent: {
        default: "custom/claude",
        providers: { "custom/claude": { command: "claude", args: [...userArgs] } },
        timeout: 300,
      },
    };
    const agent = makeAgent(cfg);
    const built = agent._buildInvocationForTest("hello", { commandId: "test" });

    assert.ok(
      !built.finalArgs.includes("--output-format"),
      `unexpected '--output-format' injection: ${JSON.stringify(built.finalArgs)}`,
    );
  });
});

describe("R2.2 — builtin flag can be overridden via config without code change", () => {
  it("user can define a codex profile with a different JSON flag name", () => {
    const userArgs = ["exec", "--hypothetical-new-json-flag", "-m", "gpt-X", "{{PROMPT}}"];
    const cfg = {
      agent: {
        default: "custom/future-codex",
        providers: { "custom/future-codex": { command: "codex", args: [...userArgs] } },
        timeout: 300,
      },
    };
    const agent = makeAgent(cfg);
    const built = agent._buildInvocationForTest("hello", { commandId: "test" });

    // The user's flag must survive; no replacement or augmentation from the package.
    assert.ok(
      built.finalArgs.includes("--hypothetical-new-json-flag"),
      "user-defined flag must propagate",
    );
    assert.ok(
      !built.finalArgs.includes("--json"),
      "package must not also inject '--json' alongside user's flag",
    );
  });
});

describe("R1.3 — builtin codex invocation sends --json to CLI", () => {
  it("default codex/gpt-5.4 builtin produces '--json' in finalArgs", () => {
    const cfg = { agent: { default: "codex/gpt-5.4", timeout: 300 } };
    const agent = makeAgent(cfg);
    const built = agent._buildInvocationForTest("hello", { commandId: "test" });
    assert.ok(
      built.finalArgs.includes("--json"),
      `builtin codex invocation must include '--json': ${JSON.stringify(built.finalArgs)}`,
    );
  });

  it("default claude/opus builtin produces '--output-format json' in finalArgs", () => {
    const cfg = { agent: { default: "claude/opus", timeout: 300 } };
    const agent = makeAgent(cfg);
    const built = agent._buildInvocationForTest("hello", { commandId: "test" });
    const idx = built.finalArgs.indexOf("--output-format");
    assert.notEqual(idx, -1, "builtin claude invocation must include '--output-format'");
    assert.equal(built.finalArgs[idx + 1], "json");
  });
});
