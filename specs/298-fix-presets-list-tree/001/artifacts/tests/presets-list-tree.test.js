// spec: R1 R2 R3 R4 R5 R6
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson } from "../../../tests/helpers/tmp-dir.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const CMD = path.join(ROOT, "src/senti.js");
const ACTUAL_OFFICIAL_PRESETS = path.join(ROOT, ".senti", "plugins", "official-presets");

function presetFixture() {
  return [
    {
      key: "webapp",
      parent: "base",
      label: "Web Application",
      aliases: ["web"],
      scan: { include: ["src/**/*.js"] },
      chapters: [],
    },
    {
      key: "js-webapp",
      parent: "webapp",
      label: "JavaScript Web Application",
      aliases: [],
      scan: {},
      chapters: [],
    },
    {
      key: "hono",
      parent: "js-webapp",
      label: "Hono",
      aliases: [],
      scan: {},
      chapters: [],
    },
    {
      key: "nextjs",
      parent: "js-webapp",
      label: "Next.js",
      aliases: ["next"],
      scan: { include: ["app/**/*"] },
      chapters: [],
    },
  ];
}

function installPluginPresets(root, presets = presetFixture(), pluginId = "official-presets") {
  const configType = presets.some((preset) => preset.key === "nextjs")
    ? "nextjs"
    : presets[0]?.key || "base";
  writeJson(root, ".senti/config.json", {
    lang: "en",
    type: configType,
    docs: { languages: ["en"], defaultLanguage: "en" },
    plugin: {
      sources: [{ id: pluginId, type: "local", path: `.senti/plugins/${pluginId}` }],
      packages: [{ id: pluginId, source: pluginId, commit: "0000000000000000000000000000000000000000" }],
    },
  });
  writeJson(root, `.senti/plugins/${pluginId}/plugin.json`, {
    name: pluginId,
    files: ["plugin.json", "presets/"],
    contributions: {
      presets: presets.map((preset) => ({ key: preset.key, path: `presets/${preset.key}` })),
    },
  });
  for (const preset of presets) {
    writeJson(root, `.senti/plugins/${pluginId}/presets/${preset.key}/preset.json`, {
      parent: preset.parent,
      label: preset.label,
      aliases: preset.aliases,
      scan: preset.scan,
      chapters: preset.chapters,
    });
  }
}

function installActualOfficialPresets(root) {
  if (!fs.existsSync(path.join(ACTUAL_OFFICIAL_PRESETS, "plugin.json"))) {
    throw new Error(`official-presets package fixture not found: ${ACTUAL_OFFICIAL_PRESETS}`);
  }
  const dest = path.join(root, ".senti", "plugins", "official-presets");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(ACTUAL_OFFICIAL_PRESETS, dest, { recursive: true });
  writeJson(root, ".senti/config.json", {
    lang: "en",
    type: "nextjs",
    docs: { languages: ["en"], defaultLanguage: "en" },
    plugin: {
      sources: [{ id: "official-presets", type: "local", path: ".senti/plugins/official-presets" }],
      packages: [{ id: "official-presets", source: "official-presets", commit: "0000000000000000000000000000000000000000" }],
    },
  });
}

function runPresetsList(cwd) {
  return spawnSync("node", [CMD, "presets", "list"], {
    cwd,
    encoding: "utf8",
    env: { ...process.env, SENTI_WORK_ROOT: cwd, SENTI_SOURCE_ROOT: cwd },
  });
}

function snapshotFiles(root) {
  const result = {};
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        result[path.relative(root, fullPath)] = fs.readFileSync(fullPath, "utf8");
      }
    }
  }
  walk(root);
  return result;
}

describe("spec 298: presets list project tree", () => {
  let tmp;
  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  it("R1: reads enabled project plugin presets in presets list", () => {
    tmp = createTmpDir("senti-spec-298-plugin-");
    installActualOfficialPresets(tmp);

    const result = runPresetsList(tmp);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /base\/\s+\(Base \(shared\)\)/);
    assert.match(result.stdout, /webapp\/\s+\(Web Application/);
    assert.match(result.stdout, /js-webapp\/\s+\(JavaScript Web Application/);
    assert.match(result.stdout, /nextjs\/\s+\(Next\.js/);
  });

  it("R1: reads unique presets from the current project plugin registry", () => {
    tmp = createTmpDir("senti-spec-298-project-plugin-");
    installPluginPresets(tmp, [
      {
        key: "project-only-preset",
        parent: "base",
        label: "Project Only Preset",
        aliases: ["project-only"],
        scan: {},
        chapters: [],
      },
    ], "project-only-presets");

    const result = runPresetsList(tmp);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /base\/\s+\(Base \(shared\)\)/);
    assert.match(result.stdout, /project-only-preset\/\s+\(Project Only Preset, aliases: project-only\)/);
  });

  it("R2: renders nextjs under js-webapp under webapp", () => {
    tmp = createTmpDir("senti-spec-298-chain-");
    installActualOfficialPresets(tmp);

    const result = runPresetsList(tmp);

    assert.equal(result.status, 0, result.stderr);
    const webapp = result.stdout.indexOf("webapp/");
    const jsWebapp = result.stdout.indexOf("js-webapp/");
    const nextjs = result.stdout.indexOf("nextjs/");
    assert.ok(webapp >= 0, result.stdout);
    assert.ok(jsWebapp > webapp, result.stdout);
    assert.ok(nextjs > jsWebapp, result.stdout);
    assert.match(result.stdout, /^(?:├──|└──) webapp\/\s+\(Web Application/m);
    assert.match(result.stdout, /^    ├── js-webapp\/\s+\(JavaScript Web Application/m);
    assert.match(result.stdout, /^    │   └── nextjs\/\s+\(Next\.js/m);
  });

  it("R3: keeps base-only fallback when no plugin registry is available", () => {
    tmp = createTmpDir("senti-spec-298-base-");
    writeJson(tmp, ".senti/config.json", {
      lang: "en",
      type: "base",
      docs: { languages: ["en"], defaultLanguage: "en" },
    });

    const result = runPresetsList(tmp);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^base\/\s+\(Base \(shared\)\)/);
    assert.doesNotMatch(result.stdout, /nextjs\//);
  });

  it("R3: falls back to base-only output when plugin registry loading fails", () => {
    tmp = createTmpDir("senti-spec-298-registry-failure-");
    writeJson(tmp, ".senti/config.json", {
      lang: "en",
      type: "nextjs",
      docs: { languages: ["en"], defaultLanguage: "en" },
      plugin: {
        sources: [{ id: "broken-presets", type: "local", path: ".senti/plugins/broken-presets" }],
        packages: [{ id: "broken-presets", source: "broken-presets", commit: "0000000000000000000000000000000000000000" }],
      },
    });

    const result = runPresetsList(tmp);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^base\/\s+\(Base \(shared\)\)/);
    assert.doesNotMatch(result.stdout, /nextjs\//);
  });

  it("R4: preserves renderer output surfaces", async () => {
    tmp = createTmpDir("senti-spec-298-render-");
    const { formatPresetTree } = await import("../../../src/presets-cmd.js");
    const templateDir = path.join(tmp, "base", "templates");
    fs.mkdirSync(templateDir, { recursive: true });
    const presets = [
      {
        key: "base",
        parent: null,
        label: "Base",
        aliases: [],
        scan: {},
        dir: path.join(tmp, "base"),
      },
      {
        key: "zeta",
        parent: "base",
        label: "Zeta",
        aliases: ["z"],
        scan: { include: ["z/**"] },
        dir: path.join(tmp, "zeta"),
      },
      {
        key: "alpha",
        parent: "base",
        label: "Alpha",
        aliases: [],
        scan: {},
        dir: path.join(tmp, "alpha"),
      },
    ];

    const output = formatPresetTree(presets);

    assert.match(output, /^base\/\s+\(Base\)$/m);
    assert.match(output, /├── alpha\/\s+\(Alpha\)\s+\[no templates\]/);
    assert.match(output, /└── zeta\/\s+\(Zeta, aliases: z, scan: \[include\]\)\s+\[no templates\]/);
    assert.ok(output.indexOf("alpha/") < output.indexOf("zeta/"), output);
  });

  it("R4: preserves missing-base fallback output", async () => {
    const { formatPresetTree } = await import("../../../src/presets-cmd.js");
    const output = formatPresetTree([
      {
        key: "orphan",
        parent: null,
        label: "Orphan",
        aliases: [],
        scan: {},
        dir: "/tmp/orphan",
      },
    ]);

    assert.equal(output.trim(), "(no base preset found)");
  });

  it("R5: leaves setup candidate and resolver ownership outside presets list", () => {
    tmp = createTmpDir("senti-spec-298-setup-");
    writeJson(tmp, "package.json", { name: "test-proj" });
    installActualOfficialPresets(tmp);
    const pluginPath = path.join(tmp, ".senti", "plugins", "official-presets", "plugin.json");
    const pluginBefore = fs.readFileSync(pluginPath, "utf8");
    const packageBefore = snapshotFiles(path.join(tmp, ".senti", "plugins", "official-presets"));

    const listResult = runPresetsList(tmp);
    const setupResult = spawnSync("node", [
      CMD,
      "setup",
      "--name",
      "test-proj",
      "--type",
      "base",
      "--purpose",
      "developer-guide",
      "--tone",
      "polite",
      "--agent",
      "codex",
      "--lang",
      "en",
    ], {
      cwd: tmp,
      encoding: "utf8",
      timeout: 10000,
      env: { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp },
    });

    assert.equal(listResult.status, 0, listResult.stderr);
    assert.match(listResult.stdout, /nextjs\//);
    assert.equal(fs.readFileSync(pluginPath, "utf8"), pluginBefore);
    assert.deepEqual(snapshotFiles(path.join(tmp, ".senti", "plugins", "official-presets")), packageBefore);
    assert.equal(setupResult.status, 0, setupResult.stderr);
    const config = JSON.parse(fs.readFileSync(path.join(tmp, ".senti", "config.json"), "utf8"));
    assert.equal(config.type, "base");
  });

  it("R5: presets list does not install missing official-presets packages", () => {
    tmp = createTmpDir("senti-spec-298-no-install-");
    writeJson(tmp, ".senti/config.json", {
      lang: "en",
      type: "base",
      docs: { languages: ["en"], defaultLanguage: "en" },
      plugin: {
        sources: [{ id: "official-presets", type: "local", path: ".senti/plugins/official-presets" }],
        packages: [{ id: "official-presets", source: "official-presets", commit: "0000000000000000000000000000000000000000" }],
      },
    });

    const result = runPresetsList(tmp);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^base\/\s+\(Base \(shared\)\)/);
    assert.equal(fs.existsSync(path.join(tmp, ".senti", "plugins", "official-presets")), false);
  });

  it("R5: preserves setup candidate and resolver semantics for official-presets", async () => {
    tmp = createTmpDir("senti-spec-298-resolver-");
    installActualOfficialPresets(tmp);
    const [{ resolveChain }, setup] = await Promise.all([
      import("../../../src/lib/presets.js"),
      import("../../../src/setup.js"),
    ]);

    const candidates = setup.listSetupWizardPresetCandidates(tmp, {
      defaultOfficialPresetSource: {
        id: "official-presets",
        type: "local",
        path: path.join(tmp, ".senti", "plugins", "official-presets"),
      },
    });
    const candidateKeys = candidates.map((candidate) => candidate.key);
    const chain = resolveChain("nextjs", tmp).map((preset) => preset.key);

    assert.ok(candidateKeys.includes("nextjs"));
    assert.deepEqual(chain, ["base", "webapp", "js-webapp", "nextjs"]);
  });

  it("R6: bounds renderer preset count, depth, and cycles", async () => {
    const { formatPresetTree } = await import("../../../src/presets-cmd.js");
    const tooMany = Array.from({ length: 513 }, (_, index) => ({
      key: index === 0 ? "base" : `p-${index}`,
      parent: index === 0 ? null : "base",
      label: `Preset ${index}`,
      aliases: [],
      scan: {},
      dir: `/tmp/nonexistent-${index}`,
    }));
    const deep = [
      { key: "base", parent: null, label: "Base", aliases: [], scan: {}, dir: "/tmp/base" },
      ...Array.from({ length: 18 }, (_, index) => ({
        key: `d-${index + 1}`,
        parent: index === 0 ? "base" : `d-${index}`,
        label: `Depth ${index + 1}`,
        aliases: [],
        scan: {},
        dir: `/tmp/d-${index + 1}`,
      })),
    ];
    const reachableCycle = [
      { key: "base", parent: null, label: "Base", aliases: [], scan: {}, dir: "/tmp/base" },
      { key: "a", parent: "base", label: "A", aliases: [], scan: {}, dir: "/tmp/a1" },
      { key: "b", parent: "a", label: "B", aliases: [], scan: {}, dir: "/tmp/b" },
      { key: "a", parent: "b", label: "A duplicate", aliases: [], scan: {}, dir: "/tmp/a2" },
    ];

    assert.throws(() => formatPresetTree(tooMany), /512/);
    const deepOutput = formatPresetTree(deep);
    assert.match(deepOutput, /d-16\//);
    assert.doesNotMatch(deepOutput, /d-17\//);
    const cycleOutput = formatPresetTree(reachableCycle);
    const visitsToA = cycleOutput.match(/a\//g) || [];
    assert.equal(visitsToA.length, 1, cycleOutput);
  });

  it("R6: bounds command inventory loading before rendering", () => {
    tmp = createTmpDir("senti-spec-298-too-many-cli-");
    const presets = Array.from({ length: 513 }, (_, index) => ({
      key: `bulk-${index}`,
      parent: "base",
      label: `Bulk ${index}`,
      aliases: [],
      scan: {},
      chapters: [],
    }));
    writeJson(tmp, ".senti/config.json", {
      lang: "en",
      type: "base",
      docs: { languages: ["en"], defaultLanguage: "en" },
      plugin: {
        sources: [{ id: "bulk-presets", type: "local", path: ".senti/plugins/bulk-presets" }],
        packages: [{ id: "bulk-presets", source: "bulk-presets", commit: "0000000000000000000000000000000000000000" }],
      },
    });
    writeJson(tmp, ".senti/plugins/bulk-presets/plugin.json", {
      name: "bulk-presets",
      files: ["plugin.json", "presets/"],
      contributions: {
        presets: presets.map((preset) => ({ key: preset.key, path: `presets/${preset.key}` })),
      },
    });
    for (const preset of presets.slice(0, 512)) {
      writeJson(tmp, `.senti/plugins/bulk-presets/presets/${preset.key}/preset.json`, {
        parent: preset.parent,
        label: preset.label,
        aliases: preset.aliases,
        scan: preset.scan,
        chapters: preset.chapters,
      });
    }

    const result = runPresetsList(tmp);

    assert.notEqual(result.status, 0, result.stdout);
    assert.match(`${result.stdout}\n${result.stderr}`, /512/);
    assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /bulk-512|not found|ENOENT/i);
  });
});
