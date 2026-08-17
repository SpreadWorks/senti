import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../../tests/helpers/tmp-dir.js";

const SCAN_CMD = join(process.cwd(), "src/docs/commands/scan.js");

describe("analysis.json formatting", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("scan outputs analysis.json with indentation (not single-line)", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sdd-forge/config.json", {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      scan: { include: ["src/**/*.js"], exclude: [] },
    });
    fs.mkdirSync(join(tmp, ".sdd-forge/output"), { recursive: true });
    writeFile(tmp, "src/index.js", 'export function hello() { return "hi"; }\n');

    execFileSync("node", [SCAN_CMD], {
      encoding: "utf8",
      env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
    });

    const outputPath = join(tmp, ".sdd-forge/output/analysis.json");
    const content = fs.readFileSync(outputPath, "utf8");
    const lineCount = content.split("\n").length;
    assert.ok(lineCount > 5, `analysis.json should be multi-line (got ${lineCount} lines)`);
    // Verify it's valid JSON
    const parsed = JSON.parse(content);
    assert.ok(parsed.analyzedAt);
  });
});
