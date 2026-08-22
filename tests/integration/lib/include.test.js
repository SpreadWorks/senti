/**
 * tests/integration/lib/include.test.js
 *
 * Unit tests for the include directive resolver.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";
import { resolveIncludes } from "../../../src/lib/include.js";

describe("resolveIncludes", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  function setupSkillsPartialFixture() {
    tmp = createTmpDir();
    const skillsDir = path.join(tmp, "skills");
    const partialsDir = path.join(skillsDir, "partials");
    fs.mkdirSync(partialsDir, { recursive: true });
    fs.writeFileSync(path.join(partialsDir, "shared.md"), "Shared content");
    return { baseDir: tmp, skillsDir };
  }

  it("replaces include directive with file content", () => {
    tmp = createTmpDir();
    fs.writeFileSync(path.join(tmp, "partial.md"), "Hello from partial");

    const content = '# Title\n<!-- include("partial.md") -->\n# End';
    const result = resolveIncludes(content, { baseDir: tmp });
    assert.equal(result, "# Title\nHello from partial\n# End");
  });

  it("resolves @skills/ path", () => {
    const { baseDir, skillsDir } = setupSkillsPartialFixture();

    const content = '<!-- include("@skills/partials/shared.md") -->';
    const result = resolveIncludes(content, { baseDir, skillsDir });
    assert.equal(result, "Shared content");
  });

  it("throws when legacy skill partial namespace is used", () => {
    const { baseDir, skillsDir } = setupSkillsPartialFixture();
    const templatesDir = path.join(baseDir, "templates");
    fs.mkdirSync(path.join(templatesDir, "partials"), { recursive: true });
    fs.writeFileSync(path.join(templatesDir, "partials", "shared.md"), "Legacy content");
    // Split to avoid matching legacy-path grep audits outside this negative test.
    const legacyTemplatesNamespace = ["@", "templates"].join("");
    const oldNamespace = `${legacyTemplatesNamespace}/partials/shared.md`;
    const content = `<!-- include("${oldNamespace}") -->`;
    assert.throws(
      () => resolveIncludes(content, { baseDir, skillsDir, templatesDir }),
      (err) => err.message.includes(oldNamespace),
    );
  });

  it("rejects @presets/<preset>/ path without project registry context", () => {
    tmp = createTmpDir();
    const presetsDir = path.join(tmp, "presets");
    const presetDir = path.join(presetsDir, "base", "templates");
    fs.mkdirSync(presetDir, { recursive: true });
    fs.writeFileSync(path.join(presetDir, "fragment.md"), "Preset fragment");

    const content = '<!-- include("@presets/base/templates/fragment.md") -->';
    assert.throws(
      () => resolveIncludes(content, { baseDir: tmp, presetsDir }),
      /projectRoot and presetTypes required/,
    );
  });

  it("rejects unregistered @presets/<preset>/ path before project-local template lookup", () => {
    tmp = createTmpDir();
    const projectLocal = path.join(tmp, ".sennel", "templates", "presets", "unregistered-preset", "templates");
    fs.mkdirSync(projectLocal, { recursive: true });
    fs.writeFileSync(path.join(projectLocal, "fragment.md"), "should not resolve");

    const content = '<!-- include("@presets/unregistered-preset/templates/fragment.md") -->';
    assert.throws(
      () => resolveIncludes(content, {
        baseDir: tmp,
        projectRoot: tmp,
        presetTypes: ["base"],
      }),
      /Preset include not registered: "unregistered-preset"/,
    );
  });

  it("resolves /absolute path from pkgDir", () => {
    tmp = createTmpDir();
    const subDir = path.join(tmp, "sub");
    fs.mkdirSync(subDir, { recursive: true });
    fs.writeFileSync(path.join(tmp, "sub", "abs.md"), "Absolute resolved");

    const content = '<!-- include("/sub/abs.md") -->';
    const result = resolveIncludes(content, { baseDir: tmp, pkgDir: tmp });
    assert.equal(result, "Absolute resolved");
  });

  it("recursively resolves nested includes", () => {
    tmp = createTmpDir();
    fs.writeFileSync(path.join(tmp, "a.md"), '<!-- include("b.md") -->');
    fs.writeFileSync(path.join(tmp, "b.md"), "Nested content");

    const content = '<!-- include("a.md") -->';
    const result = resolveIncludes(content, { baseDir: tmp });
    assert.equal(result, "Nested content");
  });

  it("throws on ../ in path", () => {
    tmp = createTmpDir();
    const content = '<!-- include("../evil.md") -->';
    assert.throws(
      () => resolveIncludes(content, { baseDir: tmp }),
      /forbidden.*\.\.\//i,
    );
  });

  it("throws on ./ in path", () => {
    tmp = createTmpDir();
    const content = '<!-- include("./local.md") -->';
    assert.throws(
      () => resolveIncludes(content, { baseDir: tmp }),
      /forbidden.*\.\//i,
    );
  });

  it("throws on circular reference", () => {
    tmp = createTmpDir();
    fs.writeFileSync(path.join(tmp, "a.md"), '<!-- include("b.md") -->');
    fs.writeFileSync(path.join(tmp, "b.md"), '<!-- include("a.md") -->');

    const content = '<!-- include("a.md") -->';
    assert.throws(
      () => resolveIncludes(content, { baseDir: tmp }),
      /circular/i,
    );
  });

  it("throws on file not found with source file info", () => {
    tmp = createTmpDir();
    const content = '<!-- include("nonexistent.md") -->';
    assert.throws(
      () => resolveIncludes(content, { baseDir: tmp, sourceFile: "SKILL.en.md" }),
      /nonexistent\.md/,
    );
  });

  it("preserves lines without include directives", () => {
    tmp = createTmpDir();
    fs.writeFileSync(path.join(tmp, "part.md"), "Inserted");

    const content = "Line 1\n<!-- include(\"part.md\") -->\nLine 3";
    const result = resolveIncludes(content, { baseDir: tmp });
    assert.equal(result, "Line 1\nInserted\nLine 3");
  });

  it("handles multiple includes in one file", () => {
    tmp = createTmpDir();
    fs.writeFileSync(path.join(tmp, "a.md"), "AAA");
    fs.writeFileSync(path.join(tmp, "b.md"), "BBB");

    const content = '<!-- include("a.md") -->\nMiddle\n<!-- include("b.md") -->';
    const result = resolveIncludes(content, { baseDir: tmp });
    assert.equal(result, "AAA\nMiddle\nBBB");
  });

  // Build a linear include chain: root → a0 → a1 → ... → a(n-1) (leaf)
  // Returns the root content that kicks off the chain.
  function createLinearIncludes(dir, chainLength) {
    for (let i = 0; i < chainLength - 1; i++) {
      fs.writeFileSync(
        path.join(dir, `a${i}.md`),
        `<!-- include("a${i + 1}.md") -->`,
      );
    }
    fs.writeFileSync(path.join(dir, `a${chainLength - 1}.md`), "deep");
    return '<!-- include("a0.md") -->';
  }

  // Build a flat fan-out: root content with N sibling include lines,
  // each targeting a distinct leaf partial.
  function createFlatIncludes(dir, count) {
    const lines = [];
    for (let i = 0; i < count; i++) {
      fs.writeFileSync(path.join(dir, `p${i}.md`), `part${i}`);
      lines.push(`<!-- include("p${i}.md") -->`);
    }
    return lines.join("\n");
  }

  it("throws when recursion depth exceeds 8 levels", () => {
    tmp = createTmpDir();
    // 10-file linear chain exceeds the depth-8 bound.
    const content = createLinearIncludes(tmp, 10);
    assert.throws(
      () => resolveIncludes(content, { baseDir: tmp }),
      /depth|recursion/i,
    );
  });

  it("throws when total include count exceeds 32", () => {
    tmp = createTmpDir();
    const content = createFlatIncludes(tmp, 33);
    assert.throws(
      () => resolveIncludes(content, { baseDir: tmp }),
      /include.*count|too many include/i,
    );
  });

  it("allows up to 32 includes without throwing", () => {
    tmp = createTmpDir();
    const content = createFlatIncludes(tmp, 32);
    const result = resolveIncludes(content, { baseDir: tmp });
    assert.ok(result.includes("part0"));
    assert.ok(result.includes("part31"));
  });
});
