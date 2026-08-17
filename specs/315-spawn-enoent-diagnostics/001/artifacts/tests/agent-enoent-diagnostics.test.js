// spec: R1 R2 R3 R4 R5
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Agent } from "../../../src/lib/agent.js";
import { ProviderRegistry } from "../../../src/lib/provider.js";
import { Logger } from "../../../src/lib/log.js";

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "senti-agent-enoent-"));
}

function makeAgent(profile, tmpDir, { logger, flowManager } = {}) {
  const config = {
    agent: {
      default: "codex/missing",
      providers: {
        "codex/missing": profile,
      },
      timeout: 5,
    },
  };
  return new Agent({
    config,
    paths: { root: tmpDir, agentWorkDir: path.join(tmpDir, ".tmp") },
    registry: new ProviderRegistry(config.agent.providers),
    logger: logger ?? new Logger({ logDir: tmpDir, enabled: false }),
    flowManager: flowManager ?? null,
  });
}

function diagnosticProfile(command = "__senti_missing_codex_cli__") {
  return {
    command,
    args: ["exec", "{{PROMPT}}"],
    jsonOutputFlag: "--json",
  };
}

async function captureError(agent, options = {}) {
  try {
    await agent.call("prompt", {
      commandId: "workflow.refine",
      retryCount: 0,
      ...options,
    });
  } catch (err) {
    return err;
  }
  throw new Error("expected agent.call to fail");
}

describe("agent ENOENT diagnostics", () => {
  it("R1: reports command, PATH, provider, profile, commandId, guidance, and ENOENT code", async () => {
    const tmpDir = makeTmpDir();
    try {
      const agent = makeAgent(diagnosticProfile(), tmpDir);
      const err = await captureError(agent);

      assert.equal(err.code, "ENOENT");
      assert.match(err.message, /command=__senti_missing_codex_cli__/);
      assert.match(err.message, /PATH=/);
      assert.match(err.message, /provider=codex/);
      assert.match(err.message, /profile=codex\/missing/);
      assert.match(err.message, /commandId=workflow\.refine/);
      assert.match(err.message, /add .*CLI .*PATH/i);
      assert.match(err.message, /environment .*start.*senti/i);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("R2: preserves process PATH in the spawn environment and omits CLAUDECODE", async () => {
    const tmpDir = makeTmpDir();
    const oldPath = process.env.PATH;
    const oldClaudeCode = process.env.CLAUDECODE;
    const oldSentinel = process.env.SENTI_AGENT_ENOENT_SENTINEL;
    process.env.PATH = `${tmpDir}${path.delimiter}${oldPath || ""}`;
    process.env.CLAUDECODE = "1";
    process.env.SENTI_AGENT_ENOENT_SENTINEL = "kept";
    try {
      const agent = makeAgent(diagnosticProfile(), tmpDir);
      const built = agent._buildInvocationForTest("prompt", { commandId: "workflow.refine" });
      assert.equal(built.env.PATH, process.env.PATH);
      assert.equal(built.env.SENTI_AGENT_ENOENT_SENTINEL, "kept");
      assert.equal("CLAUDECODE" in built.env, false);

      const err = await captureError(agent);
      assert.match(err.message, new RegExp(`PATH=${escapeRegExp(process.env.PATH)}`));
    } finally {
      if (oldPath === undefined) delete process.env.PATH;
      else process.env.PATH = oldPath;
      if (oldClaudeCode === undefined) delete process.env.CLAUDECODE;
      else process.env.CLAUDECODE = oldClaudeCode;
      if (oldSentinel === undefined) delete process.env.SENTI_AGENT_ENOENT_SENTINEL;
      else process.env.SENTI_AGENT_ENOENT_SENTINEL = oldSentinel;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("R3: reports an absolute configured command without package-manager path completion", async () => {
    const tmpDir = makeTmpDir();
    const oldPath = process.env.PATH;
    process.env.PATH = tmpDir;
    try {
      const absoluteCommand = path.join(tmpDir, "missing-codex");
      const agent = makeAgent(diagnosticProfile(absoluteCommand), tmpDir);
      const resolved = agent.resolve("workflow.refine");
      assert.equal(resolved.profile.command, absoluteCommand);

      const err = await captureError(agent);
      assert.match(err.message, new RegExp(`command=${escapeRegExp(absoluteCommand)}`));
      assert.doesNotMatch(err.message, /pnpm|npm|nvm/i);
    } finally {
      if (oldPath === undefined) delete process.env.PATH;
      else process.env.PATH = oldPath;
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("R4: keeps failure logging useful when ENOENT is wrapped", async () => {
    const tmpDir = makeTmpDir();
    try {
      const logger = new Logger({
        logDir: tmpDir,
        enabled: true,
        entryCommand: "test",
        cwd: tmpDir,
      });
      const agent = makeAgent(diagnosticProfile(), tmpDir, { logger });
      const err = await captureError(agent);
      await logger.flush();

      const logFile = path.join(tmpDir, `senti-${new Date().toISOString().slice(0, 10)}.jsonl`);
      const logText = fs.readFileSync(logFile, "utf8");
      assert.equal(err.code, "ENOENT");
      assert.match(logText, /"exitCode":"ENOENT"/);
      assert.match(logText, /"agentKey":"__senti_missing_codex_cli__"/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("R4: preserves successful Agent.call trimmed output", async () => {
    const tmpDir = makeTmpDir();
    try {
      const agent = makeAgent({
        command: "node",
        args: ["-e", "process.stdout.write('  retained output\\n')"],
      }, tmpDir);

      const result = await agent.call("prompt", {
        commandId: "workflow.refine",
        retryCount: 0,
      });

      assert.equal(result, "retained output");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("R4: preserves non-ENOENT provider/profile/exit/stderr/stdout diagnostics", async () => {
    const tmpDir = makeTmpDir();
    try {
      const agent = makeAgent({
        command: "node",
        args: ["-e", "process.stdout.write('partial output'); process.stderr.write('retained stderr'); process.exit(7)"],
      }, tmpDir);

      const err = await captureError(agent);

      assert.equal(err.code, 7);
      assert.match(err.message, /provider=user/);
      assert.match(err.message, /profile=codex\/missing/);
      assert.match(err.message, /exit=7/);
      assert.match(err.message, /retained stderr/);
      assert.match(err.message, /stdoutPreview=partial output/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("R4: preserves flow metric provider and profile dimensions", async () => {
    const tmpDir = makeTmpDir();
    const calls = [];
    const flowManager = {
      resolveCurrentContext: () => ({ spec: "315-spawn-enoent-diagnostics", sentiPhase: "test" }),
      accumulateAgentMetrics: (...args) => calls.push(args),
    };
    try {
      const agent = makeAgent({
        command: "node",
        args: ["-e", "process.stdout.write('metric ok')"],
      }, tmpDir, { flowManager });

      await agent.call("prompt", {
        commandId: "workflow.refine",
        retryCount: 0,
      });

      assert.equal(calls.length, 1);
      assert.equal(calls[0][0], "test");
      assert.equal(calls[0][1].provider, "user");
      assert.equal(calls[0][1].profileKey, "codex/missing");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("R5: uses deterministic missing commands instead of live package-manager CLIs", () => {
    const profile = diagnosticProfile();
    assert.equal(profile.command, "__senti_missing_codex_cli__");
    assert.notEqual(profile.command, "codex");
    assert.notEqual(profile.command, "claude");
  });
});

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, (char) => `\\${char}`);
}
