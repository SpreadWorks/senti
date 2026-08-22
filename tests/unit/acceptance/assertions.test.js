/**
 * tests/unit/acceptance/assertions.test.js
 *
 * Unit tests for structured directive detection in acceptance assertions.
 * Verifies that unfilled/exposed directives are reported with file name
 * and line number.
 */

import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";

// Import the functions under test
import {
  detectUnfilledDirectives,
  detectExposedDirectives,
} from "../../acceptance/lib/assertions.js";

describe("detectUnfilledDirectives", () => {
  let tmp;
  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  it("detects unfilled {{text}} blocks with file name and line number", () => {
    tmp = createTmpDir("assert-test-");
    const docsDir = path.join(tmp, "docs");
    fs.mkdirSync(docsDir, { recursive: true });

    // Line 1: heading, Line 2: text open, Line 3: empty, Line 4: text close
    const content = [
      "# Overview",
      "<!-- {{text: overview}} -->",
      "",
      "<!-- {{/text}} -->",
      "## Section",
      "Some content",
    ].join("\n");
    fs.writeFileSync(path.join(docsDir, "overview.md"), content);

    const results = detectUnfilledDirectives(docsDir, ["overview.md"]);

    assert.equal(results.length, 1);
    assert.equal(results[0].file, "overview.md");
    assert.equal(results[0].line, 2);
  });

  it("does not flag filled {{text}} blocks", () => {
    tmp = createTmpDir("assert-test-");
    const docsDir = path.join(tmp, "docs");
    fs.mkdirSync(docsDir, { recursive: true });

    const content = [
      "# Overview",
      "<!-- {{text: overview}} -->",
      "This section describes the project.",
      "<!-- {{/text}} -->",
    ].join("\n");
    fs.writeFileSync(path.join(docsDir, "overview.md"), content);

    const results = detectUnfilledDirectives(docsDir, ["overview.md"]);
    assert.equal(results.length, 0);
  });

  it("reports multiple unfilled blocks across files", () => {
    tmp = createTmpDir("assert-test-");
    const docsDir = path.join(tmp, "docs");
    fs.mkdirSync(docsDir, { recursive: true });

    const file1 = [
      "# A",
      "<!-- {{text: a}} -->",
      "",
      "<!-- {{/text}} -->",
    ].join("\n");

    const file2 = [
      "# B",
      "content",
      "<!-- {{text: b1}} -->",
      "",
      "<!-- {{/text}} -->",
      "<!-- {{text: b2}} -->",
      "",
      "<!-- {{/text}} -->",
    ].join("\n");

    fs.writeFileSync(path.join(docsDir, "a.md"), file1);
    fs.writeFileSync(path.join(docsDir, "b.md"), file2);

    const results = detectUnfilledDirectives(docsDir, ["a.md", "b.md"]);
    assert.equal(results.length, 3);
    assert.equal(results[0].file, "a.md");
    assert.equal(results[0].line, 2);
    assert.equal(results[1].file, "b.md");
    assert.equal(results[1].line, 3);
    assert.equal(results[2].file, "b.md");
    assert.equal(results[2].line, 6);
  });

  it("ignores directives inside code blocks", () => {
    tmp = createTmpDir("assert-test-");
    const docsDir = path.join(tmp, "docs");
    fs.mkdirSync(docsDir, { recursive: true });

    const content = [
      "# Docs",
      "```markdown",
      "<!-- {{text: example}} -->",
      "",
      "<!-- {{/text}} -->",
      "```",
    ].join("\n");
    fs.writeFileSync(path.join(docsDir, "docs.md"), content);

    const results = detectUnfilledDirectives(docsDir, ["docs.md"]);
    assert.equal(results.length, 0);
  });

});

describe("detectExposedDirectives", () => {
  let tmp;
  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  it("detects exposed {{data:}} directives with file name and line number", () => {
    tmp = createTmpDir("assert-test-");
    const docsDir = path.join(tmp, "docs");
    fs.mkdirSync(docsDir, { recursive: true });

    const content = [
      "# Overview",
      "Some text",
      "{{data: project.name}}",
      "More text",
    ].join("\n");
    fs.writeFileSync(path.join(docsDir, "overview.md"), content);

    const results = detectExposedDirectives(docsDir, ["overview.md"]);

    assert.equal(results.length, 1);
    assert.equal(results[0].file, "overview.md");
    assert.equal(results[0].line, 3);
  });

  it("does not flag directives inside HTML comments", () => {
    tmp = createTmpDir("assert-test-");
    const docsDir = path.join(tmp, "docs");
    fs.mkdirSync(docsDir, { recursive: true });

    const content = [
      "# Overview",
      "<!-- {{data: project.name}} -->",
      "Content here",
      "<!-- {{/data}} -->",
    ].join("\n");
    fs.writeFileSync(path.join(docsDir, "overview.md"), content);

    const results = detectExposedDirectives(docsDir, ["overview.md"]);
    assert.equal(results.length, 0);
  });

  it("does not flag directives inside inline code", () => {
    tmp = createTmpDir("assert-test-");
    const docsDir = path.join(tmp, "docs");
    fs.mkdirSync(docsDir, { recursive: true });

    const content = [
      "# Overview",
      "Use `{{data: example}}` to include data.",
    ].join("\n");
    fs.writeFileSync(path.join(docsDir, "overview.md"), content);

    const results = detectExposedDirectives(docsDir, ["overview.md"]);
    assert.equal(results.length, 0);
  });

});
