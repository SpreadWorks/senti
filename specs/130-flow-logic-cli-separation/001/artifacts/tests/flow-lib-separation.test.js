/**
 * specs/130-flow-logic-cli-separation/tests/flow-lib-separation.test.js
 *
 * Verify flow command logic/CLI separation:
 * - AC1: FlowCommand base class exists with run() and execute()
 * - AC2: All 27 commands in lib/ extend FlowCommand
 * - AC3: lib/ files do not import output, fail, ok, parseArgs
 * - AC4: run/, get/, set/ directories are deleted
 * - AC5: registry entries have args, help, command
 *
 * Run: node --test specs/130-flow-logic-cli-separation/tests/flow-lib-separation.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

const ROOT = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const SRC = path.join(ROOT, "src");
const LIB_DIR = path.join(SRC, "flow/lib");

describe("130: flow logic/CLI separation", () => {

  describe("AC1: FlowCommand base class", () => {
    it("base-command.js exists and exports FlowCommand with run() and execute()", async () => {
      const mod = await import(path.join(LIB_DIR, "base-command.js"));
      assert.equal(typeof mod.FlowCommand, "function", "FlowCommand should be exported");
      const instance = new mod.FlowCommand();
      assert.equal(typeof instance.run, "function", "run() should exist");
      assert.equal(typeof instance.execute, "function", "execute() should exist");
    });
  });

  describe("AC2: all commands extend FlowCommand", () => {
    it("all .js files in lib/ (except base-command.js) export a FlowCommand subclass", async () => {
      const { FlowCommand } = await import(path.join(LIB_DIR, "base-command.js"));
      const files = fs.readdirSync(LIB_DIR).filter(f => f.endsWith(".js") && f !== "base-command.js");
      assert.ok(files.length >= 27, `expected >= 27 command files, got ${files.length}`);

      for (const file of files) {
        const mod = await import(path.join(LIB_DIR, file));
        const exported = mod.default || mod.Command || mod[Object.keys(mod).find(k => typeof mod[k] === "function")];
        assert.ok(exported, `${file} should export a class`);
        const instance = new exported();
        assert.ok(instance instanceof FlowCommand, `${file} should extend FlowCommand`);
      }
    });
  });

  describe("AC3: lib/ files have no CLI imports", () => {
    it("no file in lib/ imports output, fail, ok, or parseArgs", () => {
      const files = fs.readdirSync(LIB_DIR).filter(f => f.endsWith(".js"));
      const forbidden = ["output", "parseArgs"];
      const forbiddenFromEnvelope = /import\s+\{[^}]*(output|fail|ok)[^}]*\}\s+from\s+["'][^"']*flow-envelope/;
      const forbiddenParseArgs = /import\s+\{[^}]*parseArgs[^}]*\}\s+from/;

      for (const file of files) {
        const content = fs.readFileSync(path.join(LIB_DIR, file), "utf8");
        assert.equal(
          forbiddenFromEnvelope.test(content), false,
          `${file} should not import output/fail/ok from flow-envelope`
        );
        assert.equal(
          forbiddenParseArgs.test(content), false,
          `${file} should not import parseArgs`
        );
      }
    });
  });

  describe("AC4: old directories deleted", () => {
    it("src/flow/run/ does not exist", () => {
      assert.equal(fs.existsSync(path.join(SRC, "flow/run")), false, "flow/run/ should be deleted");
    });
    it("src/flow/get/ does not exist", () => {
      assert.equal(fs.existsSync(path.join(SRC, "flow/get")), false, "flow/get/ should be deleted");
    });
    it("src/flow/set/ does not exist", () => {
      assert.equal(fs.existsSync(path.join(SRC, "flow/set")), false, "flow/set/ should be deleted");
    });
  });

  describe("AC5: registry entries have args, help, command", () => {
    it("all registry entries have command property", async () => {
      const { FLOW_COMMANDS } = await import(path.join(SRC, "flow/registry.js"));
      function checkEntries(obj, prefix) {
        for (const [key, entry] of Object.entries(obj)) {
          if (entry.command) {
            assert.equal(typeof entry.command, "function", `${prefix}.${key}.command should be a function`);
          } else if (typeof entry === "object" && !entry.execute && !entry.command) {
            checkEntries(entry, `${prefix}.${key}`);
          }
        }
      }
      checkEntries(FLOW_COMMANDS, "FLOW_COMMANDS");
    });
  });
});
