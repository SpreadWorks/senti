import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../../helpers/tmp-dir.js";

const CMD = join(process.cwd(), "src/senrail.js");
const CMD_ARGS = ["docs", "readme"];

function makeEnv(tmp) {
  return { ...process.env, SENRAIL_WORK_ROOT: tmp, SENRAIL_SOURCE_ROOT: tmp };
}

function setupProject(tmp, pkg = { name: "test-project" }) {
  writeJson(tmp, ".senrail/config.json", { lang: "ja", type: "sample-node-command", docs: { languages: ["ja"], defaultLanguage: "ja" } });
  writeJson(tmp, "package.json", pkg);
}

describe("readme CLI", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function runReadme(args = []) {
    return execFileSync("node", [CMD, ...CMD_ARGS, ...args], {
      encoding: "utf8",
      env: makeEnv(tmp),
    });
  }

  function readReadme() {
    return fs.readFileSync(join(tmp, "README.md"), "utf8");
  }

  it("generates README.md from chapter files", () => {
    tmp = createTmpDir();
    setupProject(tmp, { name: "test-project", description: "A test" });
    writeFile(tmp, "docs/overview.md", "# Overview\n## 説明\nThis is an overview\n## 内容\nSome content\n");

    runReadme();
    assert.ok(fs.existsSync(join(tmp, "README.md")), "README.md should be created");
    assert.match(readReadme(), /test-project/);
  });

  it("skips when type is not set", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".senrail/config.json", { lang: "ja", docs: { languages: ["ja"], defaultLanguage: "ja" } });
    const result = runReadme();
    assert.match(result, /type.*not set|type.*設定されていません/);
  });

  it("dry-run does not write README", () => {
    tmp = createTmpDir();
    setupProject(tmp, { name: "test" });
    writeFile(tmp, "docs/test.md", "# Test\n## 説明\ndesc\n## 内容\ncontent\n");
    runReadme(["--dry-run"]);
    assert.ok(!fs.existsSync(join(tmp, "README.md")));
  });

  it("README includes project name from package.json", () => {
    tmp = createTmpDir();
    setupProject(tmp, { name: "my-tool", description: "A CLI tool for developers" });
    writeFile(tmp, "docs/overview.md", "# Overview\n\nSome content here\n");
    runReadme();
    assert.ok(readReadme().includes("my-tool"), "README should include project name");
  });

  it("overwrites existing README.md", () => {
    tmp = createTmpDir();
    setupProject(tmp, { name: "updated-project" });
    writeFile(tmp, "docs/overview.md", "# Overview\n\nContent\n");
    writeFile(tmp, "README.md", "# Old README\n");
    runReadme();
    const content = readReadme();
    assert.ok(content.includes("updated-project"), "README should be overwritten");
    assert.ok(!content.includes("Old README"), "Old content should be gone");
  });

  it("handles multiple chapter files", () => {
    tmp = createTmpDir();
    setupProject(tmp, { name: "multi-chapter" });
    writeFile(tmp, "docs/overview.md", "# Overview\n\nFirst chapter\n");
    writeFile(tmp, "docs/cli_commands.md", "# CLI Commands\n\nSecond chapter\n");
    runReadme();
    assert.ok(fs.existsSync(join(tmp, "README.md")));
    assert.ok(readReadme().length > 0);
  });

  it("uses chapter links relative to a localized README on every generation", () => {
    tmp = createTmpDir();
    setupProject(tmp, { name: "localized-readme" });
    writeJson(tmp, ".senrail/config.json", {
      lang: "en",
      type: "base",
      docs: { languages: ["en", "ja"], defaultLanguage: "en" },
    });
    writeFile(tmp, ".senrail/templates/en/docs/README.md", [
      "# English README",
      "",
      '<!-- {{data("base.docs.chapters", {labels: "Chapter|Summary"})}} -->',
      "<!-- {{/data}} -->",
    ].join("\n"));
    writeFile(tmp, ".senrail/templates/ja/docs/README.md", [
      "# 日本語 README",
      "",
      '<!-- {{data("base.docs.chapters", {labels: "章|概要"})}} -->',
      "<!-- {{/data}} -->",
    ].join("\n"));
    writeFile(tmp, "docs/overview.md", "# Overview\n\n## Description\nOverview.\n");
    writeFile(tmp, "docs/ja/overview.md", "# 概要\n\n## 説明\n概要です。\n");

    runReadme(["--lang", "en"]);
    assert.match(readReadme(), /\]\(docs\/overview\.md\)/);

    for (let i = 0; i < 2; i++) {
      runReadme(["--lang", "ja", "--output", "docs/ja/README.md"]);
      const content = fs.readFileSync(join(tmp, "docs/ja/README.md"), "utf8");
      assert.match(content, /\]\(overview\.md\)/);
      assert.doesNotMatch(content, /\]\(docs\/ja\/overview\.md\)/);
    }
  });
});
