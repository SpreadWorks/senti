import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { collectExistingPathspecs } from "../../../src/flow/lib/run-finalize.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../helpers/tmp-dir.js";

function readRunFinalizeSource() {
  const file = path.join(process.cwd(), "src/flow/lib/run-finalize.js");
  return fs.readFileSync(file, "utf8");
}

function extractExecuteCommitPost(source) {
  const marker = "export async function executeCommitPost";
  const start = source.indexOf(marker);
  assert.ok(start >= 0, "executeCommitPost must be exported from run-finalize.js");
  let depth = 0;
  let i = source.indexOf("{", start);
  const bodyStart = i;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(bodyStart, i + 1);
    }
  }
  throw new Error("could not locate end of executeCommitPost body");
}

describe("run-finalize retro/report commit scope (regression for issue #197)", () => {
  it("executeCommitPost does not stage all tracked changes with `git add -A`", () => {
    const source = readRunFinalizeSource();
    const body = extractExecuteCommitPost(source);
    assert.doesNotMatch(
      body,
      /runGit\(\s*\[\s*"add"\s*,\s*"-A"\s*\]/,
      "executeCommitPost must not use `git add -A`; it sweeps unrelated uncommitted changes into the retro/report commit",
    );
  });

  it("executeCommitPost stages paths scoped to the current spec directory", () => {
    const source = readRunFinalizeSource();
    const body = extractExecuteCommitPost(source);
    assert.match(body, /path\.posix\.join\(specDir,\s*p\)/);
    assert.match(body, /collectExistingPathspecs\(root,\s*durablePathspecs\)/);
  });

  it("collectExistingPathspecs filters missing artifact files before staging", () => {
    const tmp = createTmpDir();
    try {
      writeFile(tmp, "specs/001/report.json", "{}\n");
      assert.deepEqual(
        collectExistingPathspecs(tmp, [
          "specs/001/report.json",
          "specs/001/scenario-validity-result.json",
        ]),
        ["specs/001/report.json"],
      );
    } finally {
      removeTmpDir(tmp);
    }
  });
});
