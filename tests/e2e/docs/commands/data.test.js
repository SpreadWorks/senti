import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../../helpers/tmp-dir.js";

const CMD = join(process.cwd(), "src/senti.js");
const CMD_ARGS = ["docs", "data"];

function makeEnv(tmp) {
  return { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp };
}

function setupProject(tmp, opts = {}) {
  writeJson(tmp, ".senti/config.json", {
    lang: "ja", type: "sample-node-command",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
    ...opts.config,
  });
  writeJson(tmp, "package.json", { name: "test-pkg", version: "1.0.0" });
  writeJson(tmp, ".senti/output/analysis.json", {
    analyzedAt: "2026-01-01", extras: {}, ...opts.analysis,
  });
}

// Block data directive helper
function dataBlock(source, method, labels, placeholder) {
  const labelsOpt = labels ? `, {labels: "${labels}"}` : "";
  return `<!-- {{data("sample-node-command.${source}.${method}"${labelsOpt})}} -->\n${placeholder}\n<!-- {{/data}} -->`;
}

describe("data CLI", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setup(docContent, opts) {
    tmp = createTmpDir();
    setupProject(tmp, opts);
    if (docContent) writeFile(tmp, "docs/overview.md", docContent);
    return tmp;
  }

  function runData(args = []) {
    return execFileSync("node", [CMD, ...CMD_ARGS, ...args], {
      encoding: "utf8",
      env: makeEnv(tmp),
    });
  }

  function readDoc(file = "docs/overview.md") {
    return fs.readFileSync(join(tmp, file), "utf8");
  }

  it("runs without error on docs with no directives", () => {
    setup("# Overview\n\nNo directives here\n");
    runData();
  });

  it("dry-run does not modify files", () => {
    const original = `# Overview\n\n${dataBlock("project", "name", "", "placeholder")}\n`;
    setup(original);
    runData(["--dry-run"]);
    assert.equal(readDoc(), original);
  });

  it("resolves {{data: project.name}} directive", () => {
    setup(`# Overview\n\n${dataBlock("project", "name", "", "placeholder")}\n`);
    runData();
    assert.ok(readDoc().includes("test-pkg"));
  });

  it("resolves {{data: project.version}} directive", () => {
    setup(`# Overview\n\n${dataBlock("project", "version", "", "placeholder")}\n`);
    runData();
    assert.ok(readDoc().includes("1.0.0"));
  });

  it("preserves {{text}} directives (skips them)", () => {
    setup([
      "# Overview", "",
      '<!-- {{text({prompt: "Describe the project overview"})}} -->',
      "Some placeholder text",
      "<!-- {{/text}} -->", "",
    ].join("\n"));
    runData();
    const content = readDoc();
    assert.ok(content.includes("{{text("), "{{text}} directives should be preserved");
    assert.ok(content.includes("{{/text}}"), "Closing tag should be preserved");
  });

  it("handles multiple directives in one file", () => {
    setup([
      "# Overview", "",
      dataBlock("project", "name", "", "placeholder-name"), "",
      "Version:", "",
      dataBlock("project", "version", "", "placeholder-ver"), "",
    ].join("\n"));
    runData();
    const content = readDoc();
    assert.ok(content.includes("test-pkg"));
    assert.ok(content.includes("1.0.0"));
  });

  it("exits non-zero and preserves bytes when a DataSource throws", () => {
    const original = [
      "# Overview",
      "",
      '<!-- {{data("sample-node-command.skills.rule")}} -->',
      "old content",
      "<!-- {{/data}} -->",
      "",
    ].join("\n");
    setup(original);

    assert.throws(
      () => runData(),
      (error) => error.status !== 0 && /missing skill rule id/.test(error.stderr),
    );
    assert.equal(readDoc(), original);
  });

  it("allows an explicitly ignored DataSource exception", () => {
    const original = [
      "# Overview",
      "",
      '<!-- {{data("sample-node-command.skills.rule", {ignoreError: true})}} -->',
      "old content",
      "<!-- {{/data}} -->",
      "",
    ].join("\n");
    setup(original);

    runData();
    assert.doesNotMatch(readDoc(), /old content/);
  });

  it("shows help with --help", () => {
    setup(null);
    try { runData(["--help"]); } catch (_) { /* help may exit 0 */ }
  });

  it("stdout mode reports changes", () => {
    setup(`# Overview\n\n${dataBlock("project", "name", "", "placeholder")}\n`);
    const stdout = runData(["--stdout"]);
    assert.ok(stdout.includes("overview.md"));
  });
});
