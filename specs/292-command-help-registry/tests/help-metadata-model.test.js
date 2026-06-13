// spec: R1 R5 R8 R10
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import * as help from "../../../src/help.js";
import { allCommands } from "../../../src/lib/command-registry.js";

describe("command help metadata model", () => {
  test("R1: core command metadata exposes renderer-ready fields", () => {
    assert.equal(typeof help.buildCoreHelpModel, "function");
    const model = help.buildCoreHelpModel({ commands: allCommands, lang: "en" });
    const docsBuild = model.findCommand(["docs", "build"]);
    const docs = model.findCommand(["docs"]);

    assert.equal(docsBuild.name, "docs build");
    assert.equal(typeof docsBuild.section, "string");
    assert.equal(typeof docsBuild.summary, "string");
    assert.equal(typeof docsBuild.usage, "string");
    assert.equal(typeof docsBuild.args, "object");
    assert.ok(Array.isArray(docsBuild.options));
    assert.ok("experimental" in docsBuild);
    assert.ok(docsBuild.localeKey || docsBuild.locale);
    assert.ok(Array.isArray(docs.subcommands));
    assert.ok(docs.subcommands.some((subcommand) => subcommand.name === "build"));

    for (const command of model.allCommands()) {
      assert.equal(typeof command.name, "string", command.name);
      assert.equal(typeof command.section, "string", command.name);
      assert.equal(typeof command.summary, "string", command.name);
      assert.equal(typeof command.usage, "string", command.name);
      assert.equal(typeof command.args, "object", command.name);
      assert.ok(Array.isArray(command.options), command.name);
      assert.equal(typeof command.experimental, "boolean", command.name);
      assert.ok(command.localeKey || command.locale, command.name);
      for (const subcommand of command.subcommands || []) {
        assert.equal(typeof subcommand.name, "string", `${command.name} subcommand`);
        assert.equal(typeof subcommand.summary, "string", subcommand.name);
        assert.equal(typeof subcommand.usage, "string", subcommand.name);
        assert.equal(typeof subcommand.args, "object", subcommand.name);
        assert.ok(Array.isArray(subcommand.options), subcommand.name);
        assert.equal(typeof subcommand.experimental, "boolean", subcommand.name);
      }
    }
  });

  test("R5: renderer resolves localized command text with fallback", async () => {
    assert.equal(typeof help.renderCommandHelp, "function");

    const en = await help.renderCommandHelp({
      command: ["docs", "build"],
      lang: "en",
      root: process.cwd(),
    });
    const ja = await help.renderCommandHelp({
      command: ["docs", "build"],
      lang: "ja",
      root: process.cwd(),
    });

    assert.match(en, /docs build/);
    assert.match(ja, /docs build/);
    assert.notEqual(en, ja);

    const fallback = await help.renderCommandHelp({
      command: ["docs", "build"],
      lang: "zz",
      root: process.cwd(),
    });
    assert.equal(fallback, en);

    const topLevelEn = await help.renderHelp({ root: process.cwd(), argv: [], lang: "en" });
    const topLevelJa = await help.renderHelp({ root: process.cwd(), argv: [], lang: "ja" });
    const topLevelFallback = await help.renderHelp({ root: process.cwd(), argv: [], lang: "zz" });
    assert.match(topLevelJa, /ドキュメント一括生成/);
    assert.notEqual(topLevelJa, topLevelEn);
    assert.equal(topLevelFallback, topLevelEn);
  });

  test("R8: metadata read path does not invoke command run behavior", async () => {
    assert.equal(typeof help.buildCoreHelpModel, "function");
    let invoked = false;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "senti-help-side-effect-"));
    const marker = path.join(tempDir, "imported");
    const modulePath = path.join(tempDir, "fake-command.mjs");
    fs.writeFileSync(modulePath, [
      "import fs from 'node:fs';",
      `fs.writeFileSync(${JSON.stringify(marker)}, 'imported');`,
      "export default class FakeCommand {}",
      "",
    ].join("\n"));
    const fakeCommands = {
      fake: {
        help: "Usage: senti fake",
        summary: "Fake command",
        command: () => {
          invoked = true;
          return import(pathToFileURL(modulePath).href);
        },
        outputMode: "raw",
      },
    };

    const model = help.buildCoreHelpModel({ commands: fakeCommands, lang: "en" });
    assert.equal(invoked, false);
    assert.equal(model.findCommand(["fake"]).name, "fake");

    const rendered = await help.renderCommandHelp({
      root: process.cwd(),
      command: ["fake"],
      lang: "en",
      commands: fakeCommands,
    });
    assert.equal(invoked, false);
    assert.equal(fs.existsSync(marker), false);
    assert.match(rendered, /Usage: senti fake/);
  });

  test("R8: command metadata convention documents import-time side effect policy", () => {
    const source = fs.readFileSync("src/lib/command-registry.js", "utf8");
    assert.match(source, /import-time side effects/i);
    assert.match(source, /help metadata/i);
  });

  test("R10: this spec-local test file declares requirement coverage in the header", () => {
    const testDir = "specs/292-command-help-registry/tests";
    const files = fs.readdirSync(testDir).filter((file) => file.endsWith(".test.js"));
    assert.ok(files.length > 0);

    for (const file of files) {
      const source = fs.readFileSync(`${testDir}/${file}`, "utf8");
      const firstLine = source.split(/\r?\n/, 1)[0];
      assert.match(firstLine, /^\/\/ spec: R\d+(?: R\d+)*$/);
      for (const id of firstLine.replace("// spec: ", "").split(" ")) {
        assert.ok(source.includes(`test("${id}:`), `expected ${file} to contain a ${id}: test`);
      }
    }
  });
});
