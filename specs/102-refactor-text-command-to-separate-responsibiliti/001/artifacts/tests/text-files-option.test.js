import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../../tests/helpers/tmp-dir.js";

const CMD = join(process.cwd(), "src/docs/commands/text.js");

function makeEnv(tmp) {
  return { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp };
}

function setupProject(tmp, opts = {}) {
  writeJson(tmp, ".sdd-forge/config.json", {
    lang: "ja", type: "node-cli",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
    agent: {
      default: "echo-agent",
      providers: {
        "echo-agent": {
          name: "echo-agent",
          command: "echo",
          args: ["{{PROMPT}}"],
        },
      },
    },
    ...opts.config,
  });
  writeJson(tmp, "package.json", { name: "test-pkg", version: "1.0.0" });
  writeJson(tmp, ".sdd-forge/output/analysis.json", {
    analyzedAt: "2026-01-01",
    enrichedAt: "2026-01-01",
    extras: {},
    modules: {
      summary: { total: 1 },
      modules: [{ file: "src/main.js", summary: "Main entry" }],
    },
    ...opts.analysis,
  });
}

describe("text --files option", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("--files processes only specified files in dry-run", () => {
    tmp = createTmpDir();
    setupProject(tmp);
    writeFile(tmp, "docs/overview.md", [
      "# Overview",
      '<!-- {{text({prompt: "Describe overview"})}} -->',
      "<!-- {{/text}} -->",
    ].join("\n"));
    writeFile(tmp, "docs/cli_commands.md", [
      "# CLI",
      '<!-- {{text({prompt: "Describe CLI"})}} -->',
      "<!-- {{/text}} -->",
    ].join("\n"));

    const result = execFileSync("node", [CMD, "--dry-run", "--files", "overview.md"], {
      encoding: "utf8",
      env: makeEnv(tmp),
    });

    // overview.md should be processed
    assert.match(result, /overview\.md/);
    // cli_commands.md should NOT be processed
    assert.ok(!result.includes("cli_commands.md"), "cli_commands.md should not be processed");
  });

  it("--files with multiple comma-separated files", () => {
    tmp = createTmpDir();
    setupProject(tmp);
    writeFile(tmp, "docs/overview.md", [
      "# Overview",
      '<!-- {{text({prompt: "Describe overview"})}} -->',
      "<!-- {{/text}} -->",
    ].join("\n"));
    writeFile(tmp, "docs/cli_commands.md", [
      "# CLI",
      '<!-- {{text({prompt: "Describe CLI"})}} -->',
      "<!-- {{/text}} -->",
    ].join("\n"));
    writeFile(tmp, "docs/architecture.md", [
      "# Architecture",
      '<!-- {{text({prompt: "Describe arch"})}} -->',
      "<!-- {{/text}} -->",
    ].join("\n"));

    const result = execFileSync("node", [CMD, "--dry-run", "--files", "overview.md,cli_commands.md"], {
      encoding: "utf8",
      env: makeEnv(tmp),
    });

    assert.match(result, /overview\.md/);
    assert.match(result, /cli_commands\.md/);
    assert.ok(!result.includes("architecture.md"), "architecture.md should not be processed");
  });

  it("without --files, all chapter files are processed", () => {
    tmp = createTmpDir();
    setupProject(tmp);
    writeFile(tmp, "docs/overview.md", [
      "# Overview",
      '<!-- {{text({prompt: "Describe overview"})}} -->',
      "<!-- {{/text}} -->",
    ].join("\n"));
    writeFile(tmp, "docs/cli_commands.md", [
      "# CLI",
      '<!-- {{text({prompt: "Describe CLI"})}} -->',
      "<!-- {{/text}} -->",
    ].join("\n"));

    const result = execFileSync("node", [CMD, "--dry-run"], {
      encoding: "utf8",
      env: makeEnv(tmp),
    });

    // Both files should be processed
    assert.match(result, /overview\.md/);
    assert.match(result, /cli_commands\.md/);
  });
});

describe("resolveTargetFiles removal", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("text.js should not export resolveTargetFiles", async () => {
    const textModule = await import("../../../src/docs/commands/text.js");
    assert.strictEqual(textModule.resolveTargetFiles, undefined,
      "resolveTargetFiles should not be exported from text.js");
  });
});
