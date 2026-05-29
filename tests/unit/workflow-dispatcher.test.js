import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { WORKFLOW_COMMANDS } from "../../src/workflow/registry.js";

describe("workflow registry", () => {
  it("defines all required subcommands", () => {
    const required = ["add", "update", "show", "search", "list", "publish"];
    for (const cmd of required) {
      assert.ok(WORKFLOW_COMMANDS[cmd], `missing command: ${cmd}`);
    }
  });

  it("each command entry has command loader", () => {
    for (const [name, entry] of Object.entries(WORKFLOW_COMMANDS)) {
      assert.equal(
        typeof entry.command,
        "function",
        `${name}.command must be a function`,
      );
    }
  });

  it("each command entry has help text", () => {
    for (const [name, entry] of Object.entries(WORKFLOW_COMMANDS)) {
      assert.ok(entry.help, `${name}.help must be defined`);
    }
  });

  it("add command has --status, --category, --body options", () => {
    const addEntry = WORKFLOW_COMMANDS.add;
    assert.ok(addEntry.args, "add.args required");
    const options = addEntry.args.options || [];
    assert.ok(options.includes("--status"), "add must have --status option");
    assert.ok(options.includes("--category"), "add must have --category option");
    assert.ok(options.includes("--body"), "add must have --body option");
  });

  it("publish command has --label option", () => {
    const publishEntry = WORKFLOW_COMMANDS.publish;
    assert.ok(publishEntry.args, "publish.args required");
    const options = publishEntry.args.options || [];
    assert.ok(options.includes("--label"), "publish must have --label option");
  });

  it("loads command modules with default export", async () => {
    for (const [name, entry] of Object.entries(WORKFLOW_COMMANDS)) {
      const mod = await entry.command();
      assert.ok(mod.default, `${name} module must have default export`);
      assert.equal(
        typeof mod.default,
        "function",
        `${name} default export must be a class/function`,
      );
    }
  });
});
