import { describe, it } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import fs from "fs";
import {
  loadAnalysisData,
  loadFullAnalysis,
  getChapterFiles,
} from "../../../../src/docs/lib/command-context.js";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../../helpers/tmp-dir.js";

describe("loadAnalysisData", () => {
  let tmp;

  it("returns null when no analysis files exist", () => {
    tmp = createTmpDir("analysis");
    fs.mkdirSync(path.join(tmp, ".sennel", "output"), { recursive: true });
    assert.equal(loadAnalysisData(tmp), null);
    removeTmpDir(tmp);
  });

  it("returns analysis.json data", () => {
    tmp = createTmpDir("analysis");
    writeJson(tmp, ".sennel/output/analysis.json", { source: "analysis" });
    const data = loadAnalysisData(tmp);
    assert.equal(data.source, "analysis");
    removeTmpDir(tmp);
  });
});

describe("loadFullAnalysis", () => {
  let tmp;

  it("returns analysis.json data", () => {
    tmp = createTmpDir("full-analysis");
    writeJson(tmp, ".sennel/output/analysis.json", { source: "analysis" });
    const data = loadFullAnalysis(tmp);
    assert.equal(data.source, "analysis");
    removeTmpDir(tmp);
  });

  it("returns null when analysis.json missing", () => {
    tmp = createTmpDir("full-analysis");
    fs.mkdirSync(path.join(tmp, ".sennel", "output"), { recursive: true });
    assert.equal(loadFullAnalysis(tmp), null);
    removeTmpDir(tmp);
  });
});

describe("getChapterFiles", () => {
  let tmp;

  it("returns empty array for non-existent directory", () => {
    assert.deepEqual(getChapterFiles("/nonexistent/dir"), []);
  });

  it("returns sorted chapter files", () => {
    tmp = createTmpDir("chapters");
    writeFile(tmp, "overview.md", "# Overview");
    writeFile(tmp, "commands.md", "# Commands");
    writeFile(tmp, "configuration.md", "# Config");
    writeFile(tmp, "README.md", "# Readme");
    writeFile(tmp, "notes.txt", "notes");
    const files = getChapterFiles(tmp);
    assert.deepEqual(files, [
      "commands.md",
      "configuration.md",
      "overview.md",
    ]);
    removeTmpDir(tmp);
  });
});
