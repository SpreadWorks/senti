// spec: R4 R6 R7 R9 R12
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

import * as help from "../../../src/help.js";
import {
  discoverFlowCommandHooks,
  loadPluginRegistry,
  runFlowCommandHooks,
} from "../../../src/lib/plugin-registry.js";

function makePluginProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "senti-help-plugin-"));
  const pluginRoot = path.join(root, ".senti", "plugins", "example");
  fs.mkdirSync(path.join(root, ".senti"), { recursive: true });
  fs.mkdirSync(path.join(pluginRoot, "commands"), { recursive: true });
  fs.mkdirSync(path.join(pluginRoot, "hooks"), { recursive: true });
  fs.writeFileSync(path.join(root, ".senti", "config.json"), JSON.stringify({
    lang: "en",
    plugin: {
      packages: [{ id: "example", enabled: true }],
      sources: [],
      config: {},
    },
  }, null, 2));
  fs.writeFileSync(path.join(pluginRoot, "plugin.json"), JSON.stringify({
    name: "example",
    files: ["commands/"],
    contributions: {
      commands: [{
        name: "sample",
        path: "commands/sample.js",
        desc: "Sample plugin command",
        help: "Usage: senti sample",
        subcommands: [{
          name: "inspect",
          desc: "Inspect sample data",
          help: "Usage: senti sample inspect",
        }],
      }],
    },
  }, null, 2));
  fs.writeFileSync(path.join(pluginRoot, "commands", "sample.js"), [
    "import fs from 'node:fs';",
    "fs.writeFileSync(new URL('../../../../plugin-import-called', import.meta.url), 'imported');",
    "export default function register(api) {",
    "  return {",
    "    async main(args, ctx) {",
    "      if (args.includes('--fail')) return api.Envelope.fail('plugin', 'sample', 'SAMPLE_FAILED', ['sample failed']);",
    "      await import('node:fs').then((fs) => fs.writeFileSync(ctx.project.root + '/plugin-main-called', args.join(' ')));",
    "      return api.Envelope.ok('plugin', 'sample', { message: 'executed plugin command' });",
    "    },",
    "  };",
    "}",
    "",
  ].join("\n"));
  fs.writeFileSync(path.join(pluginRoot, "commands", "undiscovered.js"), [
    "export default function register(api) {",
    "  return {",
    "    async main() {",
    "      return api.Envelope.ok('plugin', 'undiscovered', { message: 'should not run' });",
    "    },",
    "  };",
    "}",
    "",
  ].join("\n"));
  fs.writeFileSync(path.join(pluginRoot, "hooks", "review-post.js"), [
    "import fs from 'node:fs';",
    "export default function register(api) {",
    "  class ReviewPostHook extends api.FlowCommandHook {",
    "    static command = 'review';",
    "    static hook = 'post';",
    "    async run(ctx) {",
    "      fs.writeFileSync(ctx.project.root + '/plugin-hook-called', ctx.result.phase || 'review');",
    "      return api.Envelope.ok('plugin-hook', 'review-post', { dispatched: true });",
    "    }",
    "  }",
    "  return ReviewPostHook;",
    "}",
    "",
  ].join("\n"));
  return root;
}

function runPluginCli(root, args) {
  const cli = path.join(process.cwd(), "src/senti.js");
  return execFileSync("node", [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
}

describe("plugin help rendering", () => {
  test("R4: plugin command metadata normalizes to the shared renderer input shape", () => {
    assert.equal(typeof help.normalizePluginHelpMetadata, "function");
    const root = makePluginProject();
    const command = loadPluginRegistry(root).resolveCommand("sample");
    const normalized = help.normalizePluginHelpMetadata(command, { lang: "en" });

    assert.equal(normalized.name, "sample");
    assert.equal(normalized.summary, "Sample plugin command");
    assert.equal(normalized.usage, "Usage: senti sample");
    assert.equal(normalized.section, "Plugins");
    assert.equal(normalized.owner, "plugin-command-metadata");
    assert.equal(typeof normalized.args, "object");
    assert.ok(Array.isArray(normalized.options));
    assert.equal(normalized.experimental, false);
    assert.ok(normalized.localeKey || normalized.locale);
    assert.equal(normalized.subcommands[0].name, "inspect");
    assert.equal(normalized.subcommands[0].summary, "Inspect sample data");
    assert.equal(normalized.subcommands[0].usage, "Usage: senti sample inspect");
    assert.equal(typeof normalized.subcommands[0].args, "object");
    assert.ok(Array.isArray(normalized.subcommands[0].options));
    assert.equal(normalized.subcommands[0].experimental, false);
  });

  test("R7: retained plugin help surfaces render through the shared help renderer", async () => {
    assert.equal(typeof help.renderCommandHelp, "function");
    const root = makePluginProject();

    const topLevel = await help.renderHelp({ root, argv: [], lang: "en" });
    const command = await help.renderCommandHelp({ root, command: ["sample"], lang: "en" });
    const subcommand = await help.renderCommandHelp({ root, command: ["sample", "inspect"], lang: "en" });

    assert.match(topLevel, /sample/);
    assert.match(topLevel, /Sample plugin command/);
    assert.match(command, /Usage: senti sample/);
    assert.match(command, /Sample plugin command/);
    assert.match(command, /inspect/);
    assert.match(subcommand, /Usage: senti sample inspect/);
    assert.match(subcommand, /Inspect sample data/);
  });

  test("R6: plugin hook dispatch remains owned by the existing plugin lifecycle path", async () => {
    const root = makePluginProject();
    const snapshot = await discoverFlowCommandHooks(root);
    const result = await runFlowCommandHooks(root, snapshot, {
      command: "review",
      hook: "post",
      flow: { specId: "292-command-help-registry" },
      result: { phase: "test" },
    });

    assert.equal(result.ok, true);
    assert.equal(result.warnings.length, 0);
    assert.equal(fs.readFileSync(path.join(root, "plugin-hook-called"), "utf8"), "test");
    assert.equal(result.hookData[0].data.dispatched, true);
    assert.equal(typeof help.resolveExecutionOwner, "function");
    assert.equal(help.resolveExecutionOwner(["flow", "review", "post-hook"]).owner, "plugin-hook-dispatch");
  });

  test("R12: plugin CLI help surfaces render metadata without running plugin command behavior", async () => {
    const root = makePluginProject();
    assert.equal(typeof help.resolveHelpSurfaceOwner, "function");
    assert.deepEqual(help.resolveHelpSurfaceOwner(["help", "example"], { root }), {
      owner: "renderer-backed-metadata",
      kind: "plugin-package",
      packageId: "example",
      topic: ["example"],
    });
    assert.deepEqual(help.resolveHelpSurfaceOwner(["help", "sample"], { root }), {
      owner: "renderer-backed-metadata",
      topic: ["sample"],
    });
    assert.deepEqual(help.resolveHelpSurfaceOwner(["sample", "--help"], { root }), {
      owner: "renderer-backed-metadata",
      topic: ["sample"],
    });
    assert.deepEqual(help.resolveHelpSurfaceOwner(["help", "sample", "inspect"], { root }), {
      owner: "renderer-backed-metadata",
      topic: ["sample", "inspect"],
    });
    assert.deepEqual(help.resolveHelpSurfaceOwner(["sample", "inspect", "--help"], { root }), {
      owner: "renderer-backed-metadata",
      topic: ["sample", "inspect"],
    });

    const pluginTopLevel = runPluginCli(root, ["help", "example"]);
    const helpByTopic = runPluginCli(root, ["help", "sample"]);
    const directHelp = runPluginCli(root, ["sample", "--help"]);
    const subcommandHelpByTopic = runPluginCli(root, ["help", "sample", "inspect"]);
    const directSubcommandHelp = runPluginCli(root, ["sample", "inspect", "--help"]);
    assert.equal(typeof help.renderPluginPackageHelp, "function");
    const renderedPackage = await help.renderPluginPackageHelp({ root, plugin: "example", lang: "en" });
    const renderedCommand = await help.renderCommandHelp({ root, command: ["sample"], lang: "en" });
    const renderedSubcommand = await help.renderCommandHelp({ root, command: ["sample", "inspect"], lang: "en" });

    assert.match(pluginTopLevel, /sample/);
    assert.match(pluginTopLevel, /Sample plugin command/);
    assert.match(pluginTopLevel, /Commands:/);
    assert.doesNotMatch(pluginTopLevel, /Usage: senti example/);
    assert.match(helpByTopic, /Usage: senti sample/);
    assert.match(directHelp, /Usage: senti sample/);
    assert.match(subcommandHelpByTopic, /Usage: senti sample inspect/);
    assert.match(directSubcommandHelp, /Usage: senti sample inspect/);
    assert.equal(pluginTopLevel.trim(), renderedPackage.trim());
    assert.equal(helpByTopic.trim(), renderedCommand.trim());
    assert.equal(directHelp.trim(), renderedCommand.trim());
    assert.equal(subcommandHelpByTopic.trim(), renderedSubcommand.trim());
    assert.equal(directSubcommandHelp.trim(), renderedSubcommand.trim());
    assert.equal(fs.existsSync(path.join(root, "plugin-main-called")), false);
    assert.equal(fs.existsSync(path.join(root, "plugin-import-called")), false);
  });

  test("R9: direct plugin command execution remains contribution-based, not convention-discovered", () => {
    const root = makePluginProject();
    const output = runPluginCli(root, ["sample", "--alpha", "value"]);
    const cli = path.join(process.cwd(), "src/senti.js");
    const failed = spawnSync("node", [cli, "sample", "--fail"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    });
    const unlisted = spawnSync("node", [cli, "undiscovered"], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, NO_COLOR: "1" },
    });

    assert.match(output, /executed plugin command/);
    assert.equal(fs.readFileSync(path.join(root, "plugin-main-called"), "utf8"), "--alpha value");
    assert.notEqual(failed.status, 0);
    assert.match(failed.stdout, /SAMPLE_FAILED/);
    assert.equal(loadPluginRegistry(root).resolveCommand("undiscovered"), null);
    assert.notEqual(unlisted.status, 0);
    assert.match(unlisted.stderr, /unknown command 'undiscovered'|unavailable/);
    assert.equal(typeof help.resolvePluginDiscoveryMode, "function");
    assert.equal(help.resolvePluginDiscoveryMode(root), "contribution-only");
  });
});
