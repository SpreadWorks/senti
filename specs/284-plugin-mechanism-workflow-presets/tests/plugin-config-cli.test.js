// spec: R1 R2 R3 R9
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../../../src/lib/config.js";
import { createTmpDir, removeTmpDir, writeJson } from "../../../tests/helpers/tmp-dir.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..");
const SENTI = path.join(ROOT, "src", "senti.js");

function baseConfig(overrides = {}) {
  return {
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    ...overrides,
  };
}

function runCli(root, args) {
  try {
    const stdout = execFileSync(process.execPath, [SENTI, ...args], {
      cwd: ROOT,
      env: { ...process.env, SENTI_WORK_ROOT: root, SENTI_SOURCE_ROOT: ROOT },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    return {
      status: err.status ?? 1,
      stdout: err.stdout?.toString() ?? "",
      stderr: err.stderr?.toString() ?? "",
    };
  }
}

describe("plugin config and CLI surface", () => {
  let tmp;
  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  it("R1: loadConfig accepts plugin.repos and commit-pinned plugin.packages", () => {
    tmp = createTmpDir("senti-plugin-config-");
    writeJson(tmp, ".senti/config.json", baseConfig({
      plugin: {
        repos: [
          { id: "local-presets", source: "../senti-presets" },
          { id: "workflow", source: "git@github.com:example/senti-workflow-plugin.git", ref: "main" },
        ],
        packages: [
          { id: "official-presets", repo: "local-presets", commit: "0123456789abcdef0123456789abcdef01234567" },
          { id: "workflow", repo: "workflow", ref: "main", commit: "fedcba9876543210fedcba9876543210fedcba98" },
        ],
      },
    }));

    const config = loadConfig(tmp);

    assert.equal(config.plugin.repos[0].id, "local-presets");
    assert.equal(config.plugin.repos[0].source, "../senti-presets");
    assert.equal(config.plugin.repos[1].id, "workflow");
    assert.equal(config.plugin.repos[1].ref, "main");
    assert.equal(config.plugin.packages[0].id, "official-presets");
    assert.equal(config.plugin.packages[0].repo, "local-presets");
    assert.equal(config.plugin.packages[1].commit, "fedcba9876543210fedcba9876543210fedcba98");
    assert.equal(config.plugin.packages[1].ref, "main");
  });

  it("R2: plugin repo help exposes git URL and local path repository management", () => {
    tmp = createTmpDir("senti-plugin-help-");
    writeJson(tmp, ".senti/config.json", baseConfig());

    const result = runCli(tmp, ["plugin", "repo", "--help"]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /repo add/i);
    assert.match(result.stdout, /repo update/i);
    assert.match(result.stdout, /repo list/i);
    assert.match(result.stdout, /git URL|local path/i);
  });

  it("R3: plugin help exposes install list enable disable update and sync commands", () => {
    tmp = createTmpDir("senti-plugin-lifecycle-help-");
    writeJson(tmp, ".senti/config.json", baseConfig());

    const result = runCli(tmp, ["plugin", "--help"]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    for (const word of ["install", "list", "enable", "disable", "update-all", "sync"]) {
      assert.match(result.stdout, new RegExp(`\\b${word}\\b`, "i"), `missing plugin ${word} help`);
    }
    assert.match(result.stdout, /commit/i);
  });

  it("R9: core dispatcher no longer hardcodes workflow and unavailable plugin commands fail non-zero", () => {
    tmp = createTmpDir("senti-plugin-dispatch-");
    writeJson(tmp, ".senti/config.json", baseConfig({ plugin: { repos: [], packages: [] } }));

    const source = fs.readFileSync(SENTI, "utf8");
    assert.doesNotMatch(source, /workflow\s*:\s*["']workflow\/index["']/);

    const result = runCli(tmp, ["workflow", "--help"]);
    assert.notEqual(result.status, 0, "workflow must be unavailable when the workflow plugin is disabled");
    assert.match(`${result.stdout}\n${result.stderr}`, /unavailable|plugin|enable|upgrade/i);
  });
});
