// spec: R1 R2 R3 R4 R5 R6
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Agent } from "../../../src/lib/agent.js";
import { Logger } from "../../../src/lib/log.js";
import { ProviderRegistry } from "../../../src/lib/provider.js";
import DocsTextCommand, { processTemplateFileBatch } from "../../../src/docs/commands/text.js";

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "spec-268-"));
}

function tmpFile(name) {
  return path.join(os.tmpdir(), `spec-268-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

async function rejectedError(promise) {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  assert.fail("expected promise to reject");
}

function makeAgent(profile, cfgExtra = {}) {
  const root = tmpDir();
  const config = {
    agent: {
      default: "test/exec",
      providers: { "test/exec": profile },
      timeout: 0.05,
      ...cfgExtra,
    },
  };
  return new Agent({
    config,
    paths: { root, agentWorkDir: path.join(root, ".tmp") },
    registry: new ProviderRegistry(config.agent.providers),
    logger: new Logger({ logDir: os.tmpdir(), enabled: false }),
  });
}

function timeoutScript(counterPath, stdoutLength = 0) {
  return `
    const fs = require("fs");
    const counter = ${JSON.stringify(counterPath)};
    let n = 0;
    try { n = Number(fs.readFileSync(counter, "utf8")); } catch {}
    fs.writeFileSync(counter, String(n + 1));
    process.stdout.write("X".repeat(${Number(stdoutLength)}));
    setTimeout(() => {}, 5000);
  `;
}

function textTemplate() {
  return [
    "# Generated",
    "",
    '<!-- {{text({prompt: "write a short section"})}} -->',
    "<!-- {{/text}} -->",
    "",
  ].join("\n");
}

function writeDocsFixture() {
  const root = tmpDir();
  const docsDir = path.join(root, "docs");
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(path.join(docsDir, "chapter.md"), textTemplate(), "utf8");
  return { root, docsDir };
}

describe("spec 268: codex timeout retry and JSON diagnostics", () => {
  it("R1: timeout exits retry until retryCount is exhausted", async () => {
    const counter = tmpFile("r1-counter");
    const agent = makeAgent(
      { command: "node", args: ["-e", timeoutScript(counter)] },
      { retryCount: 1 },
    );

    const err = await rejectedError(agent.call("", { commandId: "test", retryDelayMs: 10 }));
    assert.match(err.message, /timeout|SIGTERM/i);

    const attempts = Number(fs.readFileSync(counter, "utf8"));
    assert.equal(attempts, 2, `expected initial timeout plus one retry, got ${attempts}`);
  });

  it("R2: built-in codex profiles keep literal JSON output configuration", () => {
    const registry = new ProviderRegistry();
    for (const key of ["codex/gpt-5.4", "codex/gpt-5.3"]) {
      const resolved = registry.resolveProfile(key);
      assert.ok(resolved, `${key} must resolve`);
      assert.equal(resolved.providerKey, "codex");
      assert.equal(resolved.profile.jsonOutputFlag, "--json");
      assert.ok(resolved.profile.args.includes("--json"), `${key} args must include --json`);
    }
  });

  it("R3: timeout errors include provider, profile, and a capped stdout preview", async () => {
    const counter = tmpFile("r3-counter");
    const agent = makeAgent({ command: "node", args: ["-e", timeoutScript(counter, 260)] });

    const err = await rejectedError(
      agent.call("", { commandId: "test", retryCount: 0 }),
    );

    assert.match(err.message, /provider.*user/i);
    assert.match(err.message, /profile.*test\/exec/i);
    assert.match(err.message, /X{120}/);
    assert.doesNotMatch(err.message, /X{201}/, "stdout preview must be capped at 200 characters");
  });

  it("R4: batch JSON parse errors include file name and normalized response preview", async () => {
    const response = `${"Y".repeat(260)}END`;
    const agent = { call: async () => response };

    const err = await rejectedError(
      processTemplateFileBatch(
        textTemplate(),
        { structure: {} },
        "chapter.md",
        agent,
        false,
        [],
        "",
        undefined,
        undefined,
        "en",
      ),
    );

    assert.match(err.message, /chapter\.md/);
    assert.match(err.message, /Y{120}/);
    assert.doesNotMatch(err.message, /Y{201}/, "response preview must be capped at 200 characters");
  });

  it("R5: command-level batch JSON parse failures report file errors and non-zero exit", async () => {
    const { root, docsDir } = writeDocsFixture();
    const agent = {
      resolve: () => true,
      call: async () => "plain text that is not directive JSON",
    };
    const command = new DocsTextCommand();

    const err = await rejectedError(
      command.execute({
        docsCtx: {
          root,
          srcRoot: root,
          docsDir,
          config: {
            docs: { style: {}, defaultLanguage: "en" },
            agent: { retryCount: 0 },
          },
          agent,
          files: ["chapter.md"],
          outputLang: "en",
          commandId: "docs.text",
        },
      }),
    );

    assert.notEqual(err.exitCode, 0);
    assert.deepEqual(err.data.errors, ["chapter.md"]);
    assert.match(err.message, /1 file\(s\) failed: chapter\.md/);
  });

  it("R6: this spec-local file covers every testable requirement without a long codex CLI timeout", () => {
    const testFile = fs.readFileSync(new URL(import.meta.url), "utf8");
    for (const id of ["R1", "R2", "R3", "R4", "R5", "R6"]) {
      assert.match(testFile, new RegExp(`(?:describe|it|test)\\("${id}:`));
    }
    const forbidden = new RegExp(["300_?0" + "00", "300 " + "seconds", "codex " + "exec"].join("|"));
    assert.doesNotMatch(testFile, forbidden);
  });
});
