// spec: R1 R2 R3 R4 R5 R6
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { processTemplate, processTemplateFileBatch, textFillFromAnalysis } from "../../../src/docs/commands/text.js";
import { Agent } from "../../../src/lib/agent.js";
import { defaultAgentProviders } from "../../../src/lib/agent-defaults.js";
import { container } from "../../../src/lib/container.js";
import { ProviderRegistry } from "../../../src/lib/provider.js";
import { Logger } from "../../../src/lib/log.js";

const SPEC_ID = "specs/306-docs-text-json-schema/spec.json";

function templateWithTextDirective() {
  return [
    "# Test",
    "",
    '<!-- {{text({prompt: "write overview"})}} -->',
    "<!-- {{/text}} -->",
    "",
  ].join("\n");
}

function makeRecordingAgent(responses) {
  const calls = [];
  return {
    calls,
    resolve() {
      return true;
    },
    async call(_prompt, options) {
      calls.push(options || {});
      const index = calls.length - 1;
      return responses[Math.min(index, responses.length - 1)];
    },
  };
}

function makeTmpRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "senti-docs-text-schema-"));
  fs.mkdirSync(path.join(root, ".tmp"), { recursive: true });
  return root;
}

function makeFlowManager() {
  return {
    resolveCurrentContext() {
      return { spec: SPEC_ID, taskId: null, sentiPhase: "test" };
    },
    loadActiveFlows() {
      return [{ spec: SPEC_ID }];
    },
    appendMetric() {},
  };
}

function schemaConstrainsDirectiveStrings(schema, directiveId) {
  if (!schema || schema.type !== "object") return false;
  if (schema.properties?.[directiveId]?.type === "string") return true;
  if (schema.additionalProperties?.type === "string") return true;
  const patternProperties = schema.patternProperties || {};
  return Object.values(patternProperties).some((value) => value?.type === "string");
}

function makeAgent(root, profile) {
  const config = {
    agent: {
      default: "test/raw",
      providers: {
        "test/raw": profile,
      },
      timeout: 300,
    },
  };
  return new Agent({
    config,
    paths: { root, agentWorkDir: path.join(root, ".tmp") },
    registry: new ProviderRegistry(config.agent.providers),
    logger: new Logger({ logDir: os.tmpdir(), enabled: false }),
    flowManager: makeFlowManager(),
  });
}

describe("docs.text JSON schema and cache recovery", () => {
  const tmpRoots = [];
  afterEach(() => {
    while (tmpRoots.length > 0) {
      fs.rmSync(tmpRoots.pop(), { recursive: true, force: true });
    }
    container.reset();
  });

  it("R1: batch generation passes a directive-id JSON schema to agent.call", async () => {
    const agent = makeRecordingAgent([JSON.stringify({ d0: "Generated overview." })]);

    await processTemplateFileBatch(
      templateWithTextDirective(),
      { structure: {} },
      "overview.md",
      agent,
      false,
      [],
      "",
      undefined,
      undefined,
      "en",
    );

    assert.equal(agent.calls.length, 1);
    assert.ok(agent.calls[0].jsonSchema, "docs.text batch call must pass jsonSchema");
    assert.equal(agent.calls[0].jsonSchema.type, "object");
    assert.equal(
      schemaConstrainsDirectiveStrings(agent.calls[0].jsonSchema, "d0"),
      true,
      "jsonSchema must constrain directive ids to string markdown values",
    );
  });

  it("R2: docs.text-reachable built-in default providers expose schema flag and mode", () => {
    const providers = defaultAgentProviders();
    for (const key of ["claude/sonnet", "codex/gpt-5.4"]) {
      assert.ok(providers[key], `${key} must be materialized by defaultAgentProviders`);
      assert.equal(typeof providers[key].jsonSchemaFlag, "string", `${key} must expose jsonSchemaFlag`);
      assert.match(providers[key].jsonSchemaFlag, /^--/);
      assert.ok(["file", "inline"].includes(providers[key].jsonSchemaMode), `${key} must expose jsonSchemaMode`);
    }
  });

  it("R2: file-mode JSON schema invocations use unique temporary files and clean them up", async () => {
    const root = makeTmpRoot();
    tmpRoots.push(root);
    const agent = makeAgent(root, {
      command: process.execPath,
      args: ["-e", "process.stdout.write('{}')", "{{PROMPT}}"],
      jsonSchemaFlag: "--schema",
      jsonSchemaMode: "file",
    });
    const options = {
      commandId: "docs.text",
      jsonSchema: { type: "object" },
      retryCount: 0,
    };

    const schemaPaths = new Set();
    for (let i = 0; i < 20; i++) {
      const built = agent._buildInvocationForTest("prompt", options);
      schemaPaths.add(built.pendingSchemaWrite.path);
    }
    assert.equal(schemaPaths.size, 20);

    await agent.call("prompt", options);

    const leftovers = fs.readdirSync(path.join(root, ".tmp")).filter((file) => file.startsWith("schema-"));
    assert.deepEqual(leftovers, []);
  });

  it("R3: parse-invalid docs.text responses are not stored in active-flow prompt cache", async () => {
    const root = makeTmpRoot();
    tmpRoots.push(root);
    const agent = makeAgent(root, {
      command: process.execPath,
      args: ["-e", "process.stdout.write('not-json-response')", "{{PROMPT}}"],
    });

    await assert.rejects(
      processTemplateFileBatch(
        templateWithTextDirective(),
        { structure: {} },
        "overview.md",
        agent,
        false,
        [],
        "",
        undefined,
        undefined,
        "en",
      ),
      /batch JSON parse failed/,
    );

    const cacheDir = path.join(root, ".senti", "agent-cache");
    const cacheFiles = fs.existsSync(cacheDir)
      ? fs.readdirSync(cacheDir).map((file) => fs.readFileSync(path.join(cacheDir, file), "utf8"))
      : [];
    assert.equal(cacheFiles.some((content) => content.includes("not-json-response")), false);
  });

  it("R4: a failed target-file parse retries and succeeds on a later valid JSON response", async () => {
    const agent = makeRecordingAgent([
      "ordinary natural language",
      JSON.stringify({ d0: "Generated after retry." }),
    ]);

    const result = await processTemplateFileBatch(
      templateWithTextDirective(),
      { structure: {} },
      "overview.md",
      agent,
      false,
      [],
      "",
      undefined,
      undefined,
      "en",
      1,
    );

    assert.equal(agent.calls.length, 2);
    assert.equal(result.filled, 1);
    assert.match(result.text, /Generated after retry/);
  });

  it("R5: docs.text schema-disabled provider overrides emit an actionable diagnostic", async () => {
    const root = makeTmpRoot();
    tmpRoots.push(root);
    const agent = makeAgent(root, {
      command: process.execPath,
      args: ["-e", "process.stdout.write('{}')", "{{PROMPT}}"],
      jsonOutputFlag: null,
    });
    const writes = [];
    const originalWrite = process.stderr.write;
    process.stderr.write = (chunk, ...args) => {
      writes.push(String(chunk));
      if (typeof args.at(-1) === "function") args.at(-1)();
      return true;
    };
    try {
      await agent.call("prompt", {
        commandId: "docs.text",
        jsonSchema: { type: "object" },
        retryCount: 0,
      }).catch(() => {});
    } finally {
      process.stderr.write = originalWrite;
    }

    const diagnostic = writes.join("");
    assert.match(diagnostic, /docs\.text/);
    assert.match(diagnostic, /jsonSchemaFlag/);
    assert.match(diagnostic, /jsonSchemaMode/);
  });

  it("R6: successful docs.text batch behavior is retained while schema is supplied", async () => {
    const content = [
      "# Title",
      "",
      "<!-- {{data(\"sample\")}} -->",
      "data content",
      "<!-- {{/data}} -->",
      "",
      '<!-- {{text({prompt: "write overview"})}} -->',
      "<!-- {{/text}} -->",
      "",
    ].join("\n");
    const agent = makeRecordingAgent([JSON.stringify({ d0: "Generated overview." })]);

    const result = await processTemplateFileBatch(
      content,
      { structure: {} },
      "README.md",
      agent,
      false,
      [],
      "",
      undefined,
      undefined,
      "en",
    );

    assert.ok(agent.calls[0].jsonSchema, "retained successful path must still supply schema");
    assert.match(result.text, /Generated overview/);
    assert.match(result.text, /data content/);
  });

  it("R6: per-directive docs.text mode still fills only text directives", async () => {
    const content = [
      "# Title",
      "",
      "<!-- {{data(\"sample\")}} -->",
      "data content",
      "<!-- {{/data}} -->",
      "",
      '<!-- {{text({prompt: "write overview"})}} -->',
      "<!-- {{/text}} -->",
      "",
    ].join("\n");
    const agent = makeRecordingAgent(["Per directive generated overview."]);

    const result = await processTemplate(
      content,
      { structure: {} },
      "README.md",
      agent,
      false,
      [],
      "",
      undefined,
      1,
      "en",
    );

    assert.equal(result.filled, 1);
    assert.match(result.text, /Per directive generated overview/);
    assert.match(result.text, /data content/);
  });

  it("R6: textFillFromAnalysis still writes generated markdown files", async () => {
    const root = makeTmpRoot();
    tmpRoots.push(root);
    fs.mkdirSync(path.join(root, "docs"), { recursive: true });
    const docPath = path.join(root, "docs", "overview.md");
    fs.writeFileSync(docPath, templateWithTextDirective(), "utf8");
    const agent = makeRecordingAgent([JSON.stringify({ d0: "Generated file content." })]);
    container.set("config", {
      docs: { style: {}, defaultLanguage: "en" },
      chapters: [{ chapter: "overview.md" }],
      concurrency: 1,
      agent: { retryCount: 0 },
    });
    container.set("agent", agent);

    const result = await textFillFromAnalysis(root, { structure: {} }, "docs.text", root);

    assert.deepEqual(result.files, ["overview.md"]);
    assert.match(fs.readFileSync(docPath, "utf8"), /Generated file content/);
  });

  it("R6: user provider overrides still take precedence over built-in defaults", () => {
    const registry = new ProviderRegistry({
      "claude/sonnet": {
        command: "custom-claude",
        args: ["--custom", "{{PROMPT}}"],
        jsonSchemaFlag: "--custom-schema",
        jsonSchemaMode: "inline",
      },
    });

    const resolved = registry.resolveProfile("claude/sonnet");

    assert.equal(resolved.profile.command, "custom-claude");
    assert.equal(resolved.profile.jsonSchemaFlag, "--custom-schema");
  });

  it("R6: successful prompt cache responses remain reusable", async () => {
    const root = makeTmpRoot();
    tmpRoots.push(root);
    const marker = path.join(root, "calls.txt");
    const script = [
      "const fs = require('fs');",
      `const marker = ${JSON.stringify(marker)};`,
      "const count = fs.existsSync(marker) ? Number(fs.readFileSync(marker, 'utf8')) : 0;",
      "fs.writeFileSync(marker, String(count + 1));",
      "process.stdout.write(JSON.stringify({ d0: 'Cached content.' }));",
    ].join(" ");
    const agent = makeAgent(root, {
      command: process.execPath,
      args: ["-e", script, "{{PROMPT}}"],
    });
    const options = {
      commandId: "docs.text",
      jsonSchema: { type: "object", additionalProperties: { type: "string" } },
      retryCount: 0,
    };

    const first = await agent.call("same prompt", options);
    const second = await agent.call("same prompt", options);

    assert.equal(first, second);
    assert.equal(fs.readFileSync(marker, "utf8"), "1");
  });
});
