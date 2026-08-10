import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../../helpers/tmp-dir.js";

const CMD = join(process.cwd(), "src/sennel.js");
const CMD_ARGS = ["docs", "agents"];

describe("agents CLI", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("creates AGENTS.md from template when missing", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sennel/config.json", { lang: "ja", type: "sample-command", docs: { languages: ["ja"], defaultLanguage: "ja" } });
    writeJson(tmp, ".sennel/output/analysis.json", { analyzedAt: "2026-01-01" });
    writeJson(tmp, "package.json", { name: "test-pkg", version: "1.0.0" });

    assert.ok(!fs.existsSync(join(tmp, "AGENTS.md")), "AGENTS.md should not exist before");
    execFileSync("node", [CMD, ...CMD_ARGS], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp, SENNEL_SOURCE_ROOT: tmp },
    });
    assert.ok(fs.existsSync(join(tmp, "AGENTS.md")), "AGENTS.md should be created");
    const content = fs.readFileSync(join(tmp, "AGENTS.md"), "utf8");
    assert.ok(content.includes("Spec-Driven Development"), "should contain Spec-Driven Development section");
  });

  it("exits non-zero when analysis.json is missing", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sennel/config.json", { lang: "ja", type: "sample-command", docs: { languages: ["ja"], defaultLanguage: "ja" } });
    writeFile(tmp, "AGENTS.md", [
      '<!-- {{data("base.agents.flow")}} -->',
      '<!-- {{/data}} -->',
    ].join("\n"));

    try {
      execFileSync("node", [CMD, ...CMD_ARGS], {
        encoding: "utf8",
        env: { ...process.env, SENNEL_WORK_ROOT: tmp, SENNEL_SOURCE_ROOT: tmp },
      });
      assert.fail("should exit non-zero");
    } catch (err) {
      assert.match(err.stderr, /analysis\.json/);
    }
  });

  it("exits non-zero when no agent configured (for project directive)", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sennel/config.json", { lang: "ja", type: "sample-command", docs: { languages: ["ja"], defaultLanguage: "ja" } });
    writeJson(tmp, ".sennel/output/analysis.json", {
      analyzedAt: "2026-01-01",
      files: { summary: { total: 5 } },
    });
    writeFile(tmp, "AGENTS.md", [
      '<!-- {{data("base.agents.flow")}} -->',
      '<!-- {{/data}} -->',
      '',
      '<!-- {{data("base.agents.project")}} -->',
      '<!-- {{/data}} -->',
    ].join("\n"));

    try {
      execFileSync("node", [CMD, ...CMD_ARGS], {
        encoding: "utf8",
        env: { ...process.env, SENNEL_WORK_ROOT: tmp, SENNEL_SOURCE_ROOT: tmp },
      });
      assert.fail("should exit non-zero");
    } catch (err) {
      assert.match(err.stderr, /default agent/i);
    }

    // File should remain unchanged (write only happens on success)
    const content = fs.readFileSync(join(tmp, "AGENTS.md"), "utf8");
    assert.match(content, /agents\.flow/);
  });

  it("resolves the flow directive when no project directive exists", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sennel/config.json", { lang: "ja", type: "sample-command", docs: { languages: ["ja"], defaultLanguage: "ja" } });
    writeJson(tmp, ".sennel/output/analysis.json", {
      analyzedAt: "2026-01-01",
      files: { summary: { total: 5 } },
    });
    writeFile(tmp, "AGENTS.md", [
      '<!-- {{data("base.agents.flow")}} -->',
      '<!-- {{/data}} -->',
      '',
      'Custom content below',
    ].join("\n"));

    // No project directive = no AI needed = should succeed without agent
    execFileSync("node", [CMD, ...CMD_ARGS], {
      encoding: "utf8",
      env: { ...process.env, SENNEL_WORK_ROOT: tmp, SENNEL_SOURCE_ROOT: tmp },
    });

    const content = fs.readFileSync(join(tmp, "AGENTS.md"), "utf8");
    // Spec-Driven Development template should be resolved
    assert.match(content, /## Sennel Flow/);
    // Custom content should remain
    assert.match(content, /Custom content below/);
    // Directive tags should still be present
    assert.match(content, /agents\.flow/);
  });
});
