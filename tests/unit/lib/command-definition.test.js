import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  CommandDefinition,
  CommandRegistry,
  coreCommandRegistry,
} from "../../../src/lib/command-registry.js";
import { PluginCatalog, PluginManifest } from "../../../src/lib/plugin-registry.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

describe("CommandDefinition registry", () => {
  it("derives exactly the same help and executable route sets", () => {
    assert.deepEqual(coreCommandRegistry.helpPaths(), coreCommandRegistry.routePaths());
    assert.ok(coreCommandRegistry.routePaths().includes("docs build"));
    assert.ok(coreCommandRegistry.routePaths().includes("check config"));
    assert.ok(coreCommandRegistry.routePaths().includes("spec render"));
    assert.ok(coreCommandRegistry.routePaths().includes("metrics review"));
    assert.ok(!coreCommandRegistry.routePaths().includes("docs snapshot"));
  });

  it("rejects duplicate command registration", () => {
    const registry = new CommandRegistry([
      new CommandDefinition({
        name: "sample",
        help: { summary: "first" },
        entrypoint: { modulePath: "../help.js", invocation: "main" },
      }),
    ]);

    assert.throws(
      () => registry.register(new CommandDefinition({
        name: "sample",
        help: { summary: "duplicate" },
        entrypoint: { modulePath: "../help.js", invocation: "main" },
      })),
      /duplicate command: sample/,
    );
  });

  it("retains flow command dispatch and help metadata in one definition", () => {
    const definition = coreCommandRegistry.find(["flow", "run", "gate"]);
    const flowEntry = FLOW_COMMANDS.run.gate;
    assert.ok(definition instanceof CommandDefinition);
    assert.equal(definition.command, flowEntry.command);
    assert.equal(definition.outputMode, "envelope");
    assert.deepEqual(definition.args, flowEntry.args);
    assert.equal(definition.requiresFlow, flowEntry.requiresFlow);
    assert.equal(definition.runtimeLog, flowEntry.runtimeLog);
    assert.match(definition.help, /Usage: senrail flow run gate/);
    assert.equal(definition.metadata(["flow", "run"]).name, "flow run gate");
  });

  it("renders the complete canonical help for flow leaf commands", () => {
    const definition = coreCommandRegistry.find(["flow", "resume"]);
    assert.equal(definition.help, FLOW_COMMANDS.resume.help);
    assert.equal(definition.metadata(["flow"]).help, FLOW_COMMANDS.resume.help);
    assert.match(definition.help, /no discovery/i);
  });
});

describe("plugin command registration", () => {
  let root;
  afterEach(() => root && removeTmpDir(root));

  function manifest(providerId) {
    const pluginRoot = path.join(root, providerId);
    fs.mkdirSync(pluginRoot, { recursive: true });
    return new PluginManifest(pluginRoot, {
      name: providerId,
      files: ["commands/"],
      contributions: {
        commands: [{ name: "collision", path: "commands/index.js" }],
      },
    }, providerId);
  }

  it("rejects duplicate plugin command contributions", () => {
    root = createTmpDir("plugin-command-duplicate-");
    assert.throws(
      () => new PluginCatalog(root, [manifest("first-plugin"), manifest("second-plugin")]),
      /duplicate plugin command: collision/,
    );
  });

  it("rejects a plugin override of a core command", () => {
    root = createTmpDir("plugin-core-override-");
    assert.throws(
      () => new PluginManifest(root, {
        name: "override-plugin",
        files: ["commands/"],
        contributions: {
          commands: [{ name: "docs", path: "commands/index.js" }],
        },
      }),
      /core command/,
    );
  });
});
