import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { RenameMigration } from "../../src/upgrade.js";
import { FileTreeWalker, ScanPolicy } from "../../src/lib/file-tree-walker.js";
import { createTmpDir, removeTmpDir, writeFile } from "../helpers/tmp-dir.js";

describe("RenameMigration", () => {
  it("migrates only senti-owned paths", () => {
    const tmp = createTmpDir("senti-upgrade-rename-");
    try {
      writeFile(tmp, ".sdd-forge/config.json", '{"command":"sdd-forge"}\n');
      writeFile(tmp, ".sdd-forge/templates/sdd-forge-note.md", "SDD flow\n");
      writeFile(tmp, ".agents/skills/sdd-forge.flow/SKILL.md", "legacy skill\n");
      writeFile(tmp, ".claude/skills/sdd-forge.flow/SKILL.md", "legacy skill\n");
      writeFile(tmp, ".gitignore", [
        ".sdd-forge/*",
        "!.sdd-forge/config.json",
        "!.sdd-forge/templates/",
        "!.sdd-forge/output/",
        ".sdd-forge/output/acceptance-report-*.json",
        "node_modules",
        "",
      ].join("\n"));
      writeFile(tmp, ".gitattributes", ".sdd-forge/output/analysis.json merge=ours\n");
      writeFile(tmp, "src/app/sdd-forge-note.js", "const name = 'sdd-forge';\n");
      writeFile(tmp, "src/frontend/node_modules/pkg/sdd-forge-note.js", "sdd-forge\n");
      writeFile(tmp, "docs/sdd-forge-note.md", "SDD flow\n");
      writeFile(tmp, "specs/001-sdd-forge/spec.md", "SDD flow\n");

      const changed = new RenameMigration(tmp).run();

      assert.equal(fs.readFileSync(path.join(tmp, ".senti/config.json"), "utf8"), '{"command":"senti"}\n');
      assert.equal(fs.readFileSync(path.join(tmp, ".senti/templates/senti-note.md"), "utf8"), "Spec-Driven Development flow\n");
      assert.equal(fs.existsSync(path.join(tmp, ".agents/skills/senti.flow/SKILL.md")), true);
      assert.equal(fs.existsSync(path.join(tmp, ".claude/skills/senti.flow/SKILL.md")), true);
      assert.match(fs.readFileSync(path.join(tmp, ".gitignore"), "utf8"), /^\.senti\/\*/);
      assert.equal(
        fs.readFileSync(path.join(tmp, ".gitignore"), "utf8").match(/\.sdd-forge\//g)?.length,
        1,
      );
      assert.equal(fs.readFileSync(path.join(tmp, ".gitattributes"), "utf8"), ".senti/output/analysis.json merge=ours\n");

      assert.equal(fs.readFileSync(path.join(tmp, "src/app/sdd-forge-note.js"), "utf8"), "const name = 'sdd-forge';\n");
      assert.equal(fs.readFileSync(path.join(tmp, "src/frontend/node_modules/pkg/sdd-forge-note.js"), "utf8"), "sdd-forge\n");
      assert.equal(fs.readFileSync(path.join(tmp, "docs/sdd-forge-note.md"), "utf8"), "SDD flow\n");
      assert.equal(fs.readFileSync(path.join(tmp, "specs/001-sdd-forge/spec.md"), "utf8"), "SDD flow\n");
      assert.equal(changed.some((rel) => rel.startsWith("src/")), false);
      assert.equal(changed.some((rel) => rel.startsWith("docs/")), false);
      assert.equal(changed.some((rel) => rel.startsWith("specs/")), false);
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("does not traverse project files outside the legacy managed directory", () => {
    const tmp = createTmpDir("senti-upgrade-traversal-");
    try {
      writeFile(tmp, ".sdd-forge/config.json", "{}\n");
      writeFile(tmp, "src/a.txt", "sdd\n");
      writeFile(tmp, "src/b.txt", "sdd\n");
      const walker = new FileTreeWalker(new ScanPolicy({ maxFiles: 1 }));

      new RenameMigration(tmp, { walker }).run();

      assert.equal(fs.readFileSync(path.join(tmp, "src/a.txt"), "utf8"), "sdd\n");
      assert.equal(fs.readFileSync(path.join(tmp, "src/b.txt"), "utf8"), "sdd\n");
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("fails closed when the legacy managed directory traversal is incomplete", () => {
    const tmp = createTmpDir("senti-upgrade-managed-traversal-");
    try {
      writeFile(tmp, ".sdd-forge/a.txt", "sdd\n");
      writeFile(tmp, ".sdd-forge/b.txt", "sdd\n");
      const walker = new FileTreeWalker(new ScanPolicy({ maxFiles: 1 }));

      assert.throws(
        () => new RenameMigration(tmp, { walker }).run(),
        /upgrade traversal .*\.sdd-forge is indeterminate: files limit 1/,
      );
    } finally {
      removeTmpDir(tmp);
    }
  });
});
