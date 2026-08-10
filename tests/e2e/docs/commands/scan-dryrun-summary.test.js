import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { execFileSync, spawnSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../../helpers/tmp-dir.js";

const CMD = join(process.cwd(), "src/sennel.js");
const CMD_ARGS = ["docs", "scan"];

function baseConfig(extra = {}) {
  return {
    lang: "ja",
    type: "sample-node-command",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
    scan: { include: ["src/**/*.js"], exclude: [] },
    ...extra,
  };
}

describe("scan --dry-run summary output (spec 185)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("AC1+AC3: --dry-run outputs summary JSON (no analyzedAt) and skips file write", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sennel/config.json", baseConfig());
    writeFile(tmp, "src/index.js", 'export function hello() { return "hi"; }\n');
    fs.mkdirSync(join(tmp, ".sennel/output"), { recursive: true });

    const result = execFileSync("node", [CMD, ...CMD_ARGS, "--dry-run"], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp, SENNEL_SOURCE_ROOT: tmp },
    });

    const summary = JSON.parse(result);
    assert.equal(typeof summary, "object");
    assert.equal(summary.analyzedAt, undefined, "summary must not include analyzedAt");

    for (const [category, count] of Object.entries(summary)) {
      assert.equal(
        typeof count,
        "number",
        `${category} value must be a number, got ${typeof count}`,
      );
      assert.ok(Number.isInteger(count) && count >= 0, `${category} must be a non-negative integer`);
    }

    // The single source file is parsed by modules
    assert.equal(summary.modules, 1, "modules count should be 1");

    assert.ok(
      !fs.existsSync(join(tmp, ".sennel/output/analysis.json")),
      "analysis.json must NOT be written when --dry-run is used",
    );
  });

  it("AC2: --dry-run includes registered scan DataSources with zero matches as 0", () => {
    tmp = createTmpDir();
    // Use a glob that matches no files; modules DataSource is still loaded from preset chain
    writeJson(tmp, ".sennel/config.json", baseConfig({
      scan: { include: ["nonexistent/**/*.js"], exclude: [] },
    }));

    const result = execFileSync("node", [CMD, ...CMD_ARGS, "--dry-run"], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp, SENNEL_SOURCE_ROOT: tmp },
    });

    const summary = JSON.parse(result);
    assert.ok(
      Object.prototype.hasOwnProperty.call(summary, "modules"),
      "modules key should be present even with zero matches",
    );
    assert.equal(summary.modules, 0, "modules count should be 0 when no files match");
  });

  it("AC4: --stdout outputs full analysis JSON (regression of legacy contract)", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sennel/config.json", baseConfig());
    writeFile(tmp, "src/index.js", 'export function hello() { return "hi"; }\n');

    const result = execFileSync("node", [CMD, ...CMD_ARGS, "--stdout"], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp, SENNEL_SOURCE_ROOT: tmp },
    });

    const analysis = JSON.parse(result);
    assert.ok(analysis.analyzedAt, "--stdout must include analyzedAt");
    assert.ok(analysis.modules, "--stdout must include modules category");
    assert.ok(Array.isArray(analysis.modules.entries), "--stdout modules must have entries array");
    assert.ok(analysis.modules.summary, "--stdout modules must have summary object");
  });

  it("AC5: --stdout takes precedence over --dry-run when both are specified", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sennel/config.json", baseConfig());
    writeFile(tmp, "src/index.js", 'export function hello() { return "hi"; }\n');
    fs.mkdirSync(join(tmp, ".sennel/output"), { recursive: true });

    const result = execFileSync("node", [CMD, ...CMD_ARGS, "--stdout", "--dry-run"], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp, SENNEL_SOURCE_ROOT: tmp },
    });

    const analysis = JSON.parse(result);
    assert.ok(analysis.analyzedAt, "combined flags must produce full JSON (analyzedAt present)");
    assert.ok(analysis.modules?.entries, "combined flags must produce full structure");

    assert.ok(
      !fs.existsSync(join(tmp, ".sennel/output/analysis.json")),
      "analysis.json still must NOT be written",
    );
  });

  it("AC9: exit code is 0 on successful --dry-run and --stdout", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sennel/config.json", baseConfig());
    writeFile(tmp, "src/index.js", 'export function hello() { return "hi"; }\n');

    const dry = spawnSync("node", [CMD, ...CMD_ARGS, "--dry-run"], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp, SENNEL_SOURCE_ROOT: tmp },
    });
    assert.equal(dry.status, 0, `--dry-run exit code: stderr=${dry.stderr}`);

    const stdout = spawnSync("node", [CMD, ...CMD_ARGS, "--stdout"], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp, SENNEL_SOURCE_ROOT: tmp },
    });
    assert.equal(stdout.status, 0, `--stdout exit code: stderr=${stdout.stderr}`);
  });
});
