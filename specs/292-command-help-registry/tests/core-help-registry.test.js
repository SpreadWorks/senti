// spec: R2 R3 R6 R7 R11 R12
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import { join } from "node:path";

import * as help from "../../../src/help.js";
import * as registry from "../../../src/lib/command-registry.js";

const { allCommands } = registry;

const CLI = join(process.cwd(), "src/senti.js");
const EXISTING_CORE_HELP_COMMANDS = [
  "help",
  "setup",
  "upgrade",
  "plugin",
  "docs build",
  "docs scan",
  "docs enrich",
  "docs init",
  "docs data",
  "docs text",
  "docs readme",
  "docs forge",
  "docs review",
  "docs translate",
  "docs changelog",
  "docs agents",
  "docs snapshot",
  "flow get",
  "flow set",
  "flow run",
  "metrics token",
  "presets list",
];
const EXPECTED_TOP_LEVEL_HELP_CONTENT = [
  "Project",
  "Docs",
  "Flow",
  "Metrics",
  "Info",
  "Generate docs",
  "Source code analysis",
  "Execute flow actions",
  "Aggregate and display token/cache/cost metrics",
  "Show preset inheritance tree",
];
const EXPECTED_DOCS_BUILD_HELP_CONTENT = [
  "Usage: senti docs build",
  "Generate docs",
  "scan",
  "enrich",
  "init",
  "data",
  "text",
  "readme",
];

function runCli(args) {
  return execFileSync("node", [CLI, ...args], {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

function spawnCli(args) {
  return spawnSync("node", [CLI, ...args], {
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

function assertContainsAll(text, expected) {
  for (const fragment of expected) {
    assert.ok(text.includes(fragment), `expected help output to include: ${fragment}`);
  }
}

describe("core help from command registry", () => {
  test("R2: top-level core help is generated from registry metadata, not a static layout", async () => {
    assert.equal(typeof help.buildCoreHelpModel, "function");
    const model = help.buildCoreHelpModel({ commands: allCommands, lang: "en" });
    const rendered = await help.renderHelp({ root: process.cwd(), argv: [], lang: "en" });
    const registryRendered = await help.renderHelp({
      root: process.cwd(),
      argv: [],
      lang: "en",
      commands: registry.coreCommandMetadataRegistry,
    });
    assert.equal(rendered.trim(), registryRendered.trim());
    assert.equal(help.resolveHelpSurfaceOwner(["help"]).source, "core-command-metadata-registry");

    for (const command of EXISTING_CORE_HELP_COMMANDS) {
      assert.equal(model.findCommand(command.split(" ")).name, command);
      assert.ok(rendered.includes(command), `expected top-level help to include ${command}`);
    }
    assertContainsAll(rendered, EXPECTED_TOP_LEVEL_HELP_CONTENT);

    const fixture = {
      fixture: {
        summary: "Registry-only fixture command",
        usage: "Usage: senti fixture",
        args: {},
        options: [],
        command: () => {
          throw new Error("fixture command must not be imported while rendering help");
        },
        outputMode: "raw",
      },
    };
    const fixtureRendered = await help.renderHelp({ root: process.cwd(), argv: [], lang: "en", commands: fixture });
    assert.match(fixtureRendered, /fixture/);
    assert.match(fixtureRendered, /Registry-only fixture command/);

    const customizedDocs = {
      docs: {
        section: "Custom Docs Section",
        summary: "Custom docs namespace summary",
        usage: "Usage: senti docs <command>",
        subcommands: {
          build: {
            summary: "Custom registry summary for docs build",
            usage: "Usage: senti docs build --custom",
            args: { flags: ["--custom"] },
            options: ["--custom"],
            command: () => {
              throw new Error("custom docs build command must not be imported while rendering help");
            },
            outputMode: "raw",
          },
        },
      },
    };
    const customized = await help.renderHelp({ root: process.cwd(), argv: [], lang: "en", commands: customizedDocs });
    assert.ok(customized.includes("Custom Docs Section"));
    assert.ok(customized.includes("Custom registry summary for docs build"));
    assert.ok(!customized.includes("Generate docs (scan"));
    assert.equal(Array.isArray(help.commands), false, "legacy static command layout must not be the source of truth");
  });

  test("R3: core command and subcommand help render from the same metadata source", async () => {
    assert.equal(typeof help.renderCommandHelp, "function");

    const namespace = await help.renderCommandHelp({ root: process.cwd(), command: ["docs"], lang: "en" });
    const leaf = await help.renderCommandHelp({ root: process.cwd(), command: ["docs", "build"], lang: "en" });

    assert.match(namespace, /docs/);
    assert.match(namespace, /build/);
    assert.match(namespace, /Subcommands:/);
    assertContainsAll(namespace, ["scan", "enrich", "translate", "snapshot"]);
    assert.match(leaf, /docs build/);
    assert.match(leaf, /Usage:/);
    assert.match(leaf, /Options:|Arguments:/);
    assertContainsAll(leaf, EXPECTED_DOCS_BUILD_HELP_CONTENT);

    const experimental = await help.renderCommandHelp({
      root: process.cwd(),
      lang: "en",
      command: ["fixture"],
      commands: {
        fixture: {
          summary: "Experimental fixture command",
          usage: "Usage: senti fixture [--flag]",
          args: { flags: ["--flag"] },
          options: ["--flag"],
          experimental: true,
          command: () => {
            throw new Error("fixture command must not be imported while rendering command help");
          },
          outputMode: "raw",
        },
      },
    });
    assert.match(experimental, /Experimental fixture command/);
    assert.match(experimental, /--flag/);
    assert.match(experimental, /experimental/i);
  });

  test("R6: non-help execution still routes through existing dispatchers", () => {
    const hookOutput = runCli(["hook", "list", "--json"]);
    assert.doesNotThrow(() => JSON.parse(hookOutput));

    fs.mkdirSync(".tmp", { recursive: true });
    fs.writeFileSync(".tmp/spec-292-changelog.md", "");
    const changelog = runCli(["docs", "changelog", "--dry-run", ".tmp/spec-292-changelog.md"]);
    assert.match(changelog, /change_log|292-command-help-registry|Feature Specification/);

    const flowOutput = runCli(["flow", "get", "status"]);
    const flowStatus = JSON.parse(flowOutput);
    assert.equal(flowStatus.type, "get");
    assert.equal(flowStatus.key, "status");

    const invalid = spawnCli(["hook", "list", "--definitely-unknown"]);
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /Unknown option|Run: senti hook list --help/);

    assert.equal(typeof help.resolveExecutionOwner, "function");
    assert.equal(help.resolveExecutionOwner(["hook", "list"]).owner, "core-dispatcher");
    assert.equal(help.resolveExecutionOwner(["flow", "get", "status"]).owner, "flow-lifecycle-registry");
  });

  test("R7: retained core and locale help surfaces are covered by executable assertions", async () => {
    const topLevel = await help.renderHelp({ root: process.cwd(), argv: [], lang: "en" });
    const command = await help.renderCommandHelp({ root: process.cwd(), command: ["docs"], lang: "en" });
    const subcommand = await help.renderCommandHelp({ root: process.cwd(), command: ["docs", "build"], lang: "en" });
    const localized = await help.renderCommandHelp({ root: process.cwd(), command: ["docs", "build"], lang: "ja" });

    assert.match(topLevel, /docs build/);
    assert.match(command, /Subcommands:/);
    assert.match(subcommand, /Usage:/);
    assert.notEqual(localized, subcommand);
  });

  test("R11: independent top-level commands have explicit metadata owners", () => {
    assert.equal(typeof registry.coreCommandMetadataRegistry?.findCommand, "function");
    assert.equal(typeof help.buildCoreHelpModel, "function");
    const model = help.buildCoreHelpModel({ commands: allCommands, lang: "en" });

    for (const command of ["help", "setup", "upgrade", "plugin", "presets list"]) {
      const registryEntry = registry.coreCommandMetadataRegistry.findCommand(command.split(" "));
      assert.equal(registryEntry.owner, "core-command-metadata");
      const entry = model.findCommand(command.split(" "));
      assert.equal(entry.name, command);
      assert.equal(entry.owner, "core-command-metadata");
    }
  });

  async function assertRendererBackedHelpSurface({ args, topic, label }) {
    assert.equal(typeof help.resolveHelpSurfaceOwner, "function");
    const owner = help.resolveHelpSurfaceOwner(args);
    assert.equal(owner.owner, "renderer-backed-metadata", label);
    assert.deepEqual(owner.topic, topic, label);
    const output = runCli(args);
    const rendered = topic.length === 0
      ? await help.renderHelp({ root: process.cwd(), argv: [] })
      : await help.renderCommandHelp({ root: process.cwd(), command: topic });
    assert.equal(output.trim(), rendered.trim(), `${label} should use shared renderer output`);
    assert.doesNotMatch(output, /unknown command|Unexpected argument|Unknown option/);
  }

  test("R12: global help surfaces resolve through renderer-backed metadata", async () => {
    await assertRendererBackedHelpSurface({ label: "senti help", args: ["help"], topic: [] });
    await assertRendererBackedHelpSurface({ label: "senti --help", args: ["--help"], topic: [] });
    await assertRendererBackedHelpSurface({ label: "senti -h", args: ["-h"], topic: [] });
  });

  test("R12: core command topic help resolves through renderer-backed metadata", async () => {
    await assertRendererBackedHelpSurface({ label: "senti help docs", args: ["help", "docs"], topic: ["docs"] });
  });

  test("R12: core subcommand topic help resolves through renderer-backed metadata", async () => {
    await assertRendererBackedHelpSurface({
      label: "senti help docs build",
      args: ["help", "docs", "build"],
      topic: ["docs", "build"],
    });
  });

  test("R12: core namespace --help resolves through renderer-backed metadata", async () => {
    await assertRendererBackedHelpSurface({ label: "senti docs --help", args: ["docs", "--help"], topic: ["docs"] });
  });

  test("R12: core leaf --help resolves through renderer-backed metadata", async () => {
    await assertRendererBackedHelpSurface({
      label: "senti docs build --help",
      args: ["docs", "build", "--help"],
      topic: ["docs", "build"],
    });
  });
});
