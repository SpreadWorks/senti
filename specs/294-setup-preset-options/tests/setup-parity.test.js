// spec: R6 R7 R10
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createI18n } from "../../../src/lib/i18n.js";
import { loadSpecDrivenDevelopmentTemplate } from "../../../src/lib/agents-md.js";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../../tests/helpers/tmp-dir.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const SENTI = path.join(ROOT, "src", "senti.js");
const SHA = "0123456789abcdef0123456789abcdef01234567";

function writeInstalledOfficialPlugin(root) {
  writeJson(root, ".senti/config.json", {
    lang: "en",
    type: "webapp",
    docs: { languages: ["en"], defaultLanguage: "en" },
    plugin: {
      sources: [{ id: "official-presets", type: "local", path: ".senti/plugins/official-presets" }],
      packages: [{ id: "official-presets", source: "official-presets", commit: SHA }],
    },
  });
  writeJson(root, ".senti/plugins/official-presets/plugin.json", {
    name: "official-presets",
    type: "preset",
    files: ["plugin.json", "presets/"],
    contributions: {
      presets: [{ key: "webapp", path: "presets/webapp", parent: "base" }],
    },
  });
  writeJson(root, ".senti/plugins/official-presets/presets/webapp/preset.json", {
    parent: "base",
    label: "Webapp",
    chapters: [],
  });
  writeFile(
    root,
    ".senti/plugins/official-presets/presets/webapp/templates/en/AGENTS.senti.md",
    "official webapp agents template\n",
  );
}

function writeOfficialSource(root) {
  writeJson(root, "plugin.json", {
    name: "official-presets",
    type: "preset",
    files: ["plugin.json", "presets/"],
    contributions: {
      presets: [{ key: "webapp", path: "presets/webapp", parent: "base" }],
    },
  });
  writeJson(root, "presets/webapp/preset.json", {
    parent: "base",
    label: "Webapp",
    chapters: [],
  });
  writeFile(
    root,
    "presets/webapp/templates/en/AGENTS.senti.md",
    "official webapp agents template\n",
  );
}

function writeInstalledParentChildPlugin(root) {
  writeJson(root, ".senti/config.json", {
    lang: "en",
    type: ["parent-preset", "child-preset"],
    docs: { languages: ["en"], defaultLanguage: "en" },
    plugin: {
      sources: [{ id: "fixture-presets", type: "local", path: ".senti/plugins/fixture-presets" }],
      packages: [{ id: "fixture-presets", source: "fixture-presets", commit: SHA }],
    },
  });
  writeJson(root, ".senti/plugins/fixture-presets/plugin.json", {
    name: "fixture-presets",
    type: "preset",
    files: ["plugin.json", "presets/"],
    contributions: {
      presets: [
        { key: "parent-preset", path: "presets/parent-preset", parent: "base" },
        { key: "child-preset", path: "presets/child-preset", parent: "parent-preset" },
      ],
    },
  });
  writeJson(root, ".senti/plugins/fixture-presets/presets/parent-preset/preset.json", {
    parent: "base",
    label: "Parent",
    chapters: [],
  });
  writeJson(root, ".senti/plugins/fixture-presets/presets/child-preset/preset.json", {
    parent: "parent-preset",
    label: "Child",
    chapters: [],
  });
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("setup retained behavior parity", () => {
  let tmp;

  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  it("R6: summary and agent template lookup use project-root-aware preset resolution", async () => {
    tmp = createTmpDir("senti-294-parity-");
    writeInstalledOfficialPlugin(tmp);

    const setup = await import(`../../../src/setup.js?spec294=${Date.now()}-${Math.random()}`);
    assert.equal(typeof setup.buildSetupSummaryLines, "function");
    const lines = setup.buildSetupSummaryLines({
      projectName: "demo",
      lang: "en",
      outputLangs: ["en"],
      outputDefault: "en",
      type: "webapp",
      additionalTypes: [],
      purpose: "developer-guide",
      tone: "formal",
      agent: "codex",
      agentFileMode: "generate",
    }, createI18n("en"), tmp);
    assert.ok(lines.some((line) => line.includes("webapp")));

    const template = loadSpecDrivenDevelopmentTemplate("en", {
      projectRoot: tmp,
      presetTypes: "webapp",
    });
    assert.match(template, /official webapp agents template/);
  });

  it("R6: existing defaults preserve installed plugin preset selections", async () => {
    tmp = createTmpDir("senti-294-defaults-");
    writeInstalledParentChildPlugin(tmp);

    const setup = await import(`../../../src/setup.js?spec294=${Date.now()}-${Math.random()}`);
    assert.equal(typeof setup.loadSetupDefaults, "function");
    const defaults = setup.loadSetupDefaults(tmp);
    assert.equal(defaults.type, "parent-preset");
    assert.deepEqual(defaults.additionalTypes, ["child-preset"]);
  });

  it("R6: non-interactive --type saves and validates an official preset", () => {
    tmp = createTmpDir("senti-294-noninteractive-");
    const sourceRoot = path.join(tmp, "source");
    const workRoot = path.join(tmp, "work");
    const officialRoot = path.join(tmp, "official-presets");
    fs.mkdirSync(sourceRoot, { recursive: true });
    fs.mkdirSync(officialRoot, { recursive: true });
    writeFile(sourceRoot, "src/index.js", "console.log('demo');\n");
    writeOfficialSource(officialRoot);

    const result = spawnSync(process.execPath, [
      SENTI,
      "setup",
      "--name", "demo",
      "--path", sourceRoot,
      "--work-root", workRoot,
      "--type", "webapp",
      "--purpose", "developer-guide",
      "--tone", "formal",
      "--agent", "codex",
      "--lang", "en",
    ], {
      cwd: ROOT,
      env: {
        ...process.env,
        SENTI_SOURCE_ROOT: ROOT,
        SENTI_WORK_ROOT: workRoot,
        SENTI_OFFICIAL_PRESETS_REPO: officialRoot,
      },
      encoding: "utf8",
    });

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    const config = JSON.parse(fs.readFileSync(path.join(workRoot, ".senti", "config.json"), "utf8"));
    assert.equal(config.type, "webapp");
    assert.match(fs.readFileSync(path.join(workRoot, "AGENTS.md"), "utf8"), /official webapp agents template/);
  });

  it("R6: type minimization uses project-root-aware preset chains", async () => {
    tmp = createTmpDir("senti-294-type-min-");
    writeInstalledParentChildPlugin(tmp);

    const setup = await import(`../../../src/setup.js?spec294=${Date.now()}-${Math.random()}`);
    assert.equal(typeof setup.resolveSetupLeafTypes, "function");
    assert.deepEqual(
      setup.resolveSetupLeafTypes("parent-preset", ["child-preset"], tmp),
      ["child-preset"],
    );
  });

  it("R7: setup no longer renders preset candidates from the core-only PRESETS constant", () => {
    const setupSource = read("src/setup.js");
    assert.doesNotMatch(setupSource, /buildTreeItems\(PRESETS\)/);
    assert.match(setupSource, /listSetupPresetCandidates|buildSetupPresetTreeItems/);
  });

  it("R10: spec-local tests declare requirement coverage headers", () => {
    const expected = new Map([
      ["preset-candidates.test.js", "// spec: R1 R2 R5 R9"],
      ["official-state.test.js", "// spec: R3 R4 R8"],
      ["setup-parity.test.js", "// spec: R6 R7 R10"],
    ]);
    for (const [file, header] of expected) {
      const text = fs.readFileSync(path.join(__dirname, file), "utf8");
      assert.ok(text.startsWith(header), `${file} must start with ${header}`);
    }
  });
});
