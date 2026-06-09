import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../helpers/tmp-dir.js";

const CMD = join(process.cwd(), "src/senti.js");
const CMD_ARGS = ["docs", "review"];
const MIN_CONFIG = { lang: "en", type: "node-cli", docs: { languages: ["en"], defaultLanguage: "en" } };

function setupTmp() {
  const tmp = createTmpDir();
  writeJson(tmp, ".senti/config.json", MIN_CONFIG);
  return tmp;
}

function runReview(tmp) {
  return execFileSync("node", [CMD, ...CMD_ARGS], {
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: tmp },
  });
}

function runReviewExpectFail(tmp) {
  try {
    execFileSync("node", [CMD, ...CMD_ARGS], {
      encoding: "utf8",
      env: { ...process.env, SENTI_WORK_ROOT: tmp },
    });
    assert.fail("should have exited non-zero");
  } catch (err) {
    return { stdout: err.stdout || "", stderr: err.stderr || "" };
  }
}

/** Create a valid chapter file with enough lines and H1. */
function writeValidChapter(tmp, name, extra) {
  const lines = ["# 01. Test", ""];
  for (let i = 0; i < 20; i++) lines.push(`Line ${i}`);
  if (extra) lines.push(extra);
  writeFile(tmp, `docs/${name}`, lines.join("\n"));
}

/** Setup tmp with valid chapter + analysis + README so review passes baseline. */
function setupPassingTmp() {
  const tmp = setupTmp();
  writeValidChapter(tmp, "test.md");
  writeJson(tmp, ".senti/output/analysis.json", { analyzedAt: "2026-01-01" });
  writeFile(tmp, "README.md", "# README\n");
  return tmp;
}

describe("review CLI", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("passes with valid chapter files, analysis, and README", () => {
    tmp = setupPassingTmp();
    const result = runReview(tmp);
    assert.match(result, /PASSED/);
  });

  it("fails when no chapter files found", () => {
    tmp = setupTmp();
    writeFile(tmp, "docs/.gitkeep", "");

    const { stderr } = runReviewExpectFail(tmp);
    assert.match(stderr, /no chapter files found/);
  });

  it("fails when chapter is too short", () => {
    tmp = setupPassingTmp();
    writeFile(tmp, "docs/short.md", "# 01. Short\nOnly two lines\n");

    const { stdout } = runReviewExpectFail(tmp);
    assert.match(stdout, /too short/);
  });

  it("fails when chapter has no H1 heading", () => {
    tmp = setupPassingTmp();
    const lines = ["No heading here", ""];
    for (let i = 0; i < 20; i++) lines.push(`Line ${i}`);
    writeFile(tmp, "docs/noheading.md", lines.join("\n"));

    const { stdout } = runReviewExpectFail(tmp);
    assert.match(stdout, /missing H1/);
  });

  // --- WARN → FAIL: {{data}} unfilled ---

  it("fails when {{data}} directive is unfilled", () => {
    tmp = setupPassingTmp();
    const lines = ["# 01. Test", ""];
    for (let i = 0; i < 10; i++) lines.push(`Line ${i}`);
    lines.push('<!-- {{data("node-cli.controllers.list", {labels: "Name|Actions"})}} -->');
    lines.push(""); // empty = unfilled
    lines.push('<!-- {{/data}} -->');
    for (let i = 0; i < 5; i++) lines.push(`More ${i}`);
    writeFile(tmp, "docs/data_test.md", lines.join("\n"));

    const { stdout } = runReviewExpectFail(tmp);
    assert.match(stdout, /unfilled \{\{data\}\}/);
    assert.match(stdout, /senti docs data/);
  });

  it("does not fail on inline {{data}} examples in prose", () => {
    tmp = setupPassingTmp();
    const lines = ["# 01. Test", ""];
    for (let i = 0; i < 10; i++) lines.push(`Line ${i}`);
    lines.push('Example inline syntax: `{{data("base.mySource.list", {labels: "Col1|Col2"})}}`');
    lines.push('Example comment syntax: `<!-- {{data("base.mySource.list", {labels: "Col1|Col2"})}} -->`');
    lines.push('Example closing syntax: `<!-- {{/data}} -->`');
    for (let i = 0; i < 8; i++) lines.push(`More ${i}`);
    writeFile(tmp, "docs/test.md", lines.join("\n"));

    const result = runReview(tmp);
    assert.doesNotMatch(result, /unfilled \{\{data\}\}/);
    assert.match(result, /PASSED/);
  });

  // --- WARN → FAIL: {{text}} unfilled ---

  it("fails when {{text}} directive is unfilled", () => {
    tmp = setupPassingTmp();
    const lines = ["# 01. Test", ""];
    for (let i = 0; i < 10; i++) lines.push(`Line ${i}`);
    lines.push('<!-- {{text({prompt: "describe this"})}} -->');
    lines.push("<!-- {{/text}} -->");
    for (let i = 0; i < 5; i++) lines.push(`More ${i}`);
    writeFile(tmp, "docs/text_test.md", lines.join("\n"));

    const { stdout } = runReviewExpectFail(tmp);
    assert.match(stdout, /unfilled \{\{text\}\}/);
    assert.match(stdout, /senti docs text/);
  });

  // --- WARN → FAIL: analysis.json missing ---

  it("fails when analysis.json is missing", () => {
    tmp = setupTmp();
    writeValidChapter(tmp, "test.md");
    writeFile(tmp, "README.md", "# README\n");

    const { stdout } = runReviewExpectFail(tmp);
    assert.match(stdout, /analysis\.json not found/);
    assert.match(stdout, /senti docs scan/);
  });

  // --- WARN → FAIL: README.md missing ---

  it("fails when README.md is missing", () => {
    tmp = setupTmp();
    writeValidChapter(tmp, "test.md");
    writeJson(tmp, ".senti/output/analysis.json", { analyzedAt: "2026-01-01" });

    const { stdout } = runReviewExpectFail(tmp);
    assert.match(stdout, /README\.md not found/);
    assert.match(stdout, /senti docs readme/);
  });

  // --- WARN → FAIL: uncovered analysis category ---

  it("warns but does not fail when analysis category is not covered by any directive", () => {
    tmp = setupPassingTmp();
    const lines = ["# 01. Test", ""];
    for (let i = 0; i < 10; i++) lines.push(`Line ${i}`);
    lines.push('<!-- {{data("node-cli.project.name")}} -->');
    lines.push("test-project");
    lines.push('<!-- {{/data}} -->');
    for (let i = 0; i < 5; i++) lines.push(`More ${i}`);
    writeFile(tmp, "docs/test.md", lines.join("\n"));

    writeJson(tmp, ".senti/output/analysis.json", {
      analyzedAt: "2026-01-01",
      modules: { entries: [{ name: "foo" }, { name: "bar" }] },
      controllers: { entries: [{ name: "UserController" }] },
    });

    const result = runReview(tmp);
    assert.match(result, /uncovered analysis category: modules/);
    assert.match(result, /uncovered analysis category: controllers/);
    assert.match(result, /PASSED/);
  });

  it("does not fail when all analysis categories are covered", () => {
    tmp = setupTmp();
    const lines = ["# 01. Test", ""];
    for (let i = 0; i < 10; i++) lines.push(`Line ${i}`);
    lines.push('<!-- {{data("node-cli.modules.list")}} -->');
    lines.push("mod list here");
    lines.push('<!-- {{/data}} -->');
    for (let i = 0; i < 5; i++) lines.push(`More ${i}`);
    writeFile(tmp, "docs/test.md", lines.join("\n"));
    writeFile(tmp, "README.md", "# README\n");

    writeJson(tmp, ".senti/output/analysis.json", {
      analyzedAt: "2026-01-01",
      modules: [{ name: "foo" }],
    });

    const result = runReview(tmp);
    assert.ok(!result.includes("uncovered analysis category"), "should not fail for covered categories");
    assert.match(result, /PASSED/);
  });

  it("does not flag enrichedAt as uncovered category", () => {
    tmp = setupTmp();
    writeValidChapter(tmp, "test.md");
    writeFile(tmp, "README.md", "# README\n");

    writeJson(tmp, ".senti/output/analysis.json", {
      analyzedAt: "2026-01-01",
      enrichedAt: "2026-01-02",
    });

    const result = runReview(tmp);
    assert.doesNotMatch(result, /uncovered analysis category: enrichedAt/);
    assert.match(result, /PASSED/);
  });

  // --- Deleted checks: no mtime, no snapshot ---

  it("does not check analysis.json mtime", () => {
    tmp = setupPassingTmp();
    // Make analysis older than package.json — should not matter
    writeJson(tmp, "package.json", { name: "test", version: "1.0.0" });

    const result = runReview(tmp);
    assert.doesNotMatch(result, /stale/i);
    assert.match(result, /PASSED/);
  });

  it("does not check snapshots", () => {
    tmp = setupPassingTmp();
    const result = runReview(tmp);
    assert.doesNotMatch(result, /snapshot/i);
    assert.match(result, /PASSED/);
  });
});
