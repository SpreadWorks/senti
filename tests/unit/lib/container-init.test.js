import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { mkdirSync, readFileSync } from "fs";
import { container, initContainer } from "../../../src/lib/container.js";
import { createTmpDir, removeTmpDir, writeJson } from "../../helpers/tmp-dir.js";

describe("initContainer — config registration contract (R1, #175)", () => {
  let tmp;
  let savedEnv;

  beforeEach(() => {
    tmp = createTmpDir();
    savedEnv = { ...process.env };
    process.env.SDD_FORGE_WORK_ROOT = tmp;
    delete process.env.SDD_FORGE_SOURCE_ROOT;
    container.reset();
  });

  afterEach(() => {
    container.reset();
    removeTmpDir(tmp);
    process.env = savedEnv;
  });

  it("registers null for config when .sdd-forge/config.json is missing", () => {
    initContainer();
    assert.strictEqual(container.get("config"), null);
  });

  it("registers the loaded config object when .sdd-forge/config.json exists", () => {
    mkdirSync(join(tmp, ".sdd-forge"), { recursive: true });
    const validConfig = {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
    };
    writeJson(tmp, ".sdd-forge/config.json", validConfig);
    initContainer();
    const got = container.get("config");
    assert.notStrictEqual(got, null);
    assert.equal(got.lang, "ja");
    assert.equal(got.type, "node-cli");
  });

  it("never registers an empty object `{}` for missing config (explicit null, not silent fallback)", () => {
    initContainer();
    const got = container.get("config");
    assert.strictEqual(got, null, "config must be null (not {}) when missing");
    assert.notDeepEqual(got, {}, "config must not be an empty object");
  });

  it("registers Renderable base class and concrete classes for preset use", () => {
    initContainer();
    for (const name of [
      "base.Renderable",
      "base.Table",
      "base.BulletList",
      "base.OrderedList",
      "base.Paragraph",
      "base.CodeBlock",
      "base.Blockquote",
      "base.Heading",
      "base.Fragment",
    ]) {
      const cls = container.get(name);
      assert.equal(typeof cls, "function", `${name} should be a class`);
    }
  });

  it("uses agentWorkDirOverride for agent work dir and default log dir", () => {
    mkdirSync(join(tmp, ".sdd-forge"), { recursive: true });
    writeJson(tmp, ".sdd-forge/config.json", {
      lang: "ja",
      type: "node-cli",
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      agent: { workDir: ".tmp" },
    });

    initContainer({ agentWorkDirOverride: ".agent-run" });

    const paths = container.get("paths");
    assert.equal(paths.agentWorkDir, join(tmp, ".agent-run"));
    assert.equal(paths.logDir, join(tmp, ".agent-run", "logs"));
  });

  it("CLI entrypoint pre-scans flow run --agent-work-dir before initContainer", () => {
    const source = readFileSync(join(process.cwd(), "src/sdd-forge.js"), "utf8");
    assert.match(source, /let agentWorkDirOverride = null/, "entrypoint must have early flow-run scanner state");
    assert.match(source, /agentWorkDirOverride,/, "initContainer must receive the override");
    assert.match(source, /subCmd\s*===\s*"flow"\s*&&\s*rest\[0\]\s*===\s*"run"/, "scanner must be scoped to flow run");
  });
});
