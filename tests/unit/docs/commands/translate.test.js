import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { createTmpDir, removeTmpDir, writeFile } from "../../../support/builders/tmp-dir.js";
import { buildTranslationTasks } from "../../../../src/docs/commands/translate.js";

describe("translate parallel", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  describe("buildTranslationTasks", () => {
    it("flattens lang × files into a single task list", () => {
      tmp = createTmpDir();
      const docsDir = path.join(tmp, "docs");
      fs.mkdirSync(docsDir, { recursive: true });
      writeFile(tmp, "docs/overview.md", "# Overview");
      writeFile(tmp, "docs/design.md", "# Design");
      writeFile(tmp, "README.md", "# README");

      const tasks = buildTranslationTasks({
        sourceFiles: ["overview.md", "design.md"],
        targetLangs: ["ja", "zh"],
        docsDir,
        readmePath: path.join(tmp, "README.md"),
        hasReadme: true,
        force: true,
      });

      // 2 langs × (2 chapters + 1 readme) = 6 tasks
      assert.equal(tasks.length, 6);

      // Each task has lang, sourcePath, targetPath, label
      for (const t of tasks) {
        assert.ok(t.lang);
        assert.ok(t.sourcePath);
        assert.ok(t.targetPath);
        assert.ok(t.label);
      }

      // Verify both languages are represented
      const langs = [...new Set(tasks.map((t) => t.lang))];
      assert.deepEqual(langs.sort(), ["ja", "zh"]);

      // Verify README is included
      const readmeTasks = tasks.filter((t) => t.label.includes("README"));
      assert.equal(readmeTasks.length, 2);
    });

    it("filters out up-to-date files when force is false", () => {
      tmp = createTmpDir();
      const docsDir = path.join(tmp, "docs");
      fs.mkdirSync(path.join(docsDir, "ja"), { recursive: true });
      writeFile(tmp, "docs/overview.md", "# Overview");
      writeFile(tmp, "docs/design.md", "# Design");

      // Make ja/overview.md newer than source (up-to-date)
      writeFile(tmp, "docs/ja/overview.md", "# 概要");
      const src = path.join(docsDir, "overview.md");
      const tgt = path.join(docsDir, "ja", "overview.md");
      const past = new Date(Date.now() - 10000);
      fs.utimesSync(src, past, past);

      const tasks = buildTranslationTasks({
        sourceFiles: ["overview.md", "design.md"],
        targetLangs: ["ja"],
        docsDir,
        readmePath: path.join(tmp, "README.md"),
        hasReadme: false,
        force: false,
      });

      // overview.md should be skipped (target is newer), design.md should be included
      assert.equal(tasks.length, 1);
      assert.ok(tasks[0].label.includes("design.md"));
    });

    it("includes all files when force is true", () => {
      tmp = createTmpDir();
      const docsDir = path.join(tmp, "docs");
      fs.mkdirSync(path.join(docsDir, "ja"), { recursive: true });
      writeFile(tmp, "docs/overview.md", "# Overview");
      // Target is newer
      writeFile(tmp, "docs/ja/overview.md", "# 概要");
      const src = path.join(docsDir, "overview.md");
      const past = new Date(Date.now() - 10000);
      fs.utimesSync(src, past, past);

      const tasks = buildTranslationTasks({
        sourceFiles: ["overview.md"],
        targetLangs: ["ja"],
        docsDir,
        readmePath: path.join(tmp, "README.md"),
        hasReadme: false,
        force: true,
      });

      assert.equal(tasks.length, 1);
    });

    it("returns empty array when no files need translation", () => {
      tmp = createTmpDir();
      const docsDir = path.join(tmp, "docs");
      fs.mkdirSync(path.join(docsDir, "ja"), { recursive: true });
      writeFile(tmp, "docs/overview.md", "# Overview");
      writeFile(tmp, "docs/ja/overview.md", "# 概要");
      const src = path.join(docsDir, "overview.md");
      const past = new Date(Date.now() - 10000);
      fs.utimesSync(src, past, past);

      const tasks = buildTranslationTasks({
        sourceFiles: ["overview.md"],
        targetLangs: ["ja"],
        docsDir,
        readmePath: path.join(tmp, "README.md"),
        hasReadme: false,
        force: false,
      });

      assert.equal(tasks.length, 0);
    });
  });
});
