import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "path";
import { mkdirSync } from "fs";
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
});
