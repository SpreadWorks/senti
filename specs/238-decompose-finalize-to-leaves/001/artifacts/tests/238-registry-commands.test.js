import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";

describe("spec 238: registry individual finalize commands", () => {

  it("R3: finalize-commit is registered", () => {
    assert.ok(FLOW_COMMANDS.run["finalize-commit"], "finalize-commit registered");
    assert.ok(FLOW_COMMANDS.run["finalize-commit"].command, "has command");
  });

  it("R3: finalize-merge is registered", () => {
    assert.ok(FLOW_COMMANDS.run["finalize-merge"], "finalize-merge registered");
    assert.ok(FLOW_COMMANDS.run["finalize-merge"].command, "has command");
  });

  it("R3: finalize-sync is registered", () => {
    assert.ok(FLOW_COMMANDS.run["finalize-sync"], "finalize-sync registered");
    assert.ok(FLOW_COMMANDS.run["finalize-sync"].command, "has command");
  });

  it("R3: finalize-cleanup is registered", () => {
    assert.ok(FLOW_COMMANDS.run["finalize-cleanup"], "finalize-cleanup registered");
    assert.ok(FLOW_COMMANDS.run["finalize-cleanup"].command, "has command");
  });

  it("R10: old unified finalize command is removed", () => {
    assert.equal(FLOW_COMMANDS.run["finalize"], undefined, "finalize unified command removed");
  });

  it("R4: finalize-commit has post hook", () => {
    const cmd = FLOW_COMMANDS.run["finalize-commit"];
    assert.ok(cmd.post, "finalize-commit has post hook");
    assert.equal(typeof cmd.post, "function");
  });

  it("R5: finalize-merge has onError hook", () => {
    const cmd = FLOW_COMMANDS.run["finalize-merge"];
    assert.ok(cmd.onError, "finalize-merge has onError hook");
    assert.equal(typeof cmd.onError, "function");
  });

  it("R16: finalize-commit accepts --message option", () => {
    const cmd = FLOW_COMMANDS.run["finalize-commit"];
    assert.ok(cmd.args, "finalize-commit has args");
    assert.ok(
      cmd.args.options?.includes("--message"),
      "finalize-commit accepts --message"
    );
  });
});
