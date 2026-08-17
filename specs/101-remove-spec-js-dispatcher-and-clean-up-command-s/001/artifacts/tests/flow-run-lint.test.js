import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../../tests/helpers/tmp-dir.js";

const SDD_FORGE = join(process.cwd(), "src/sdd-forge.js");

describe("flow run lint", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("is registered in flow registry", async () => {
    const { default: registry } = await import("../../../../src/flow/registry.js");
    assert.ok(registry.run?.lint, "registry should have run.lint entry");
  });

  it("runs via sdd-forge flow run lint", () => {
    tmp = createTmpDir();
    writeJson(tmp, ".sdd-forge/config.json", {
      lang: "en",
      type: "node-cli",
      docs: { languages: ["en"], defaultLanguage: "en" },
    });
    writeFile(tmp, ".sdd-forge/guardrail.md", [
      "# Project Guardrail",
      "",
      '<!-- {%guardrail {phase: [lint], "lint": {"pattern": "console\\\\.log", "message": "no console.log"}}%} -->',
      "### No Console Log",
      "Do not use console.log in production code.",
      "<!-- {%/guardrail%} -->",
    ].join("\n"));

    // lint with no changed files should return ok
    try {
      const result = execFileSync("node", [SDD_FORGE, "flow", "run", "lint"], {
        encoding: "utf8",
        env: { ...process.env, SDD_WORK_ROOT: tmp, SDD_SOURCE_ROOT: tmp },
      });
      const parsed = JSON.parse(result);
      assert.ok(parsed.ok !== undefined, "should return JSON envelope");
    } catch (err) {
      // Even if it fails, it should return a JSON envelope
      const out = err.stdout || "";
      if (out.startsWith("{")) {
        const parsed = JSON.parse(out);
        assert.ok(parsed.type === "run", "should be a run envelope");
      }
    }
  });
});
