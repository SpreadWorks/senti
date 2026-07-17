import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { populateFromAnalysis } from "../../../../src/docs/commands/data.js";
import { Paragraph } from "../../../../src/docs/lib/renderable.js";
import { createTmpDir, removeTmpDir } from "../../../helpers/tmp-dir.js";

const TYPE = "sample-node-command";
const CHAPTERS = ["overview", "cli_commands"];

function directive(method, options = "") {
  const suffix = options ? `, {${options}}` : "";
  return `<!-- {{data("${TYPE}.project.${method}"${suffix})}} -->\nold content\n<!-- {{/data}} -->\n`;
}

function setup(root, secondOptions = "") {
  const files = [
    path.join(root, "docs", "overview.md"),
    path.join(root, "docs", "cli_commands.md"),
  ];
  fs.mkdirSync(path.dirname(files[0]), { recursive: true });
  fs.writeFileSync(files[0], directive("name"));
  fs.writeFileSync(files[1], directive("version", secondOptions));
  return files;
}

function options(extra = {}) {
  return { type: TYPE, configChapters: CHAPTERS, ...extra };
}

describe("docs data transaction", () => {
  it("keeps every chapter byte-identical when a later DataSource throws", () => {
    const root = createTmpDir("docs-data-transaction-");
    try {
      const files = setup(root);
      const before = files.map((file) => fs.readFileSync(file));
      const resolve = (_preset, _source, method) => {
        if (method === "version") throw new Error("version DataSource failed");
        return new Paragraph("resolved name");
      };

      assert.throws(
        () => populateFromAnalysis(root, {}, resolve, options()),
        /version DataSource failed/,
      );
      files.forEach((file, index) => assert.deepEqual(fs.readFileSync(file), before[index]));
    } finally {
      removeTmpDir(root);
    }
  });

  it("honors explicit ignoreError for a throwing DataSource", () => {
    const root = createTmpDir("docs-data-ignore-error-");
    try {
      const files = setup(root, "ignoreError: true");
      const resolve = (_preset, _source, method) => {
        if (method === "version") throw new Error("ignored version failure");
        return new Paragraph("resolved name");
      };

      populateFromAnalysis(root, {}, resolve, options());
      assert.match(fs.readFileSync(files[0], "utf8"), /resolved name/);
      assert.doesNotMatch(fs.readFileSync(files[1], "utf8"), /old content/);
    } finally {
      removeTmpDir(root);
    }
  });

  it("rolls earlier chapters back when a later atomic commit fails", () => {
    const root = createTmpDir("docs-data-commit-failure-");
    try {
      const files = setup(root);
      const before = files.map((file) => fs.readFileSync(file));
      const resolve = (_preset, _source, method) => new Paragraph(`resolved ${method}`);

      assert.throws(
        () => populateFromAnalysis(root, {}, resolve, options({
          faultInjector(event) {
            if (event.filePath === files[1] && event.phase === "before-file-rename") {
              throw new Error("second chapter commit failed");
            }
          },
        })),
        /second chapter commit failed/,
      );
      files.forEach((file, index) => assert.deepEqual(fs.readFileSync(file), before[index]));
    } finally {
      removeTmpDir(root);
    }
  });
});
