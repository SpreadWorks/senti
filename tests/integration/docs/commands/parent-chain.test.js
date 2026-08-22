import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../../support/builders/tmp-dir.js";

const SENNEL = join(process.cwd(), "src/sennel.js");

function env(tmp) {
  return { ...process.env, SENNEL_WORK_ROOT: tmp, SENNEL_SOURCE_ROOT: tmp };
}

function setup(tmp, type = "sample-node-command") {
  writeJson(tmp, ".sennel/config.json", {
    lang: "ja",
    type,
    docs: { languages: ["ja"], defaultLanguage: "ja" },
  });
  writeJson(tmp, "package.json", { name: "fixture-project" });
  writeFile(tmp, "src/sample-command.js", "export function run() {}\n");
  writeJson(tmp, ".sennel/output/analysis.json", {
    analyzedAt: "2026-01-01",
    modules: { entries: [{ file: "src/sample-command.js", role: "module" }], summary: { total: 1 } },
  });
}

describe("plugin parent chain: docs commands", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("scan loads DataSources through the enabled plugin chain", () => {
    tmp = createTmpDir();
    setup(tmp, "sample-node-command");

    const result = execFileSync("node", [SENNEL, "docs", "scan", "--stdout"], {
      encoding: "utf8",
      env: env(tmp),
    });
    const analysis = JSON.parse(result);

    assert.ok(analysis.modules, "modules category should exist");
    assert.ok(analysis.modules.entries.some((entry) => entry.file === "src/sample-command.js"));
  });

  it("init generates configured plugin fixture chapters", () => {
    tmp = createTmpDir();
    setup(tmp, "sample-preset");

    execFileSync("node", [SENNEL, "docs", "init", "--force"], {
      encoding: "utf8",
      env: env(tmp),
    });

    const files = fs.readdirSync(join(tmp, "docs")).filter((file) => file.endsWith(".md")).sort();
    assert.deepEqual(files, ["overview.md", "project_structure.md", "stack_and_ops.md"]);
  });

  it("data resolves common project DataSources with a plugin preset key", () => {
    tmp = createTmpDir();
    setup(tmp, "sample-preset");
    writeFile(tmp, "docs/overview.md", [
      "# Overview",
      '<!-- {{data("sample-preset.project.name")}} -->',
      "placeholder",
      "<!-- {{/data}} -->",
      "",
    ].join("\n"));

    execFileSync("node", [SENNEL, "docs", "data"], {
      encoding: "utf8",
      env: env(tmp),
    });

    const content = fs.readFileSync(join(tmp, "docs/overview.md"), "utf8");
    assert.match(content, /fixture-project/);
  });
});
