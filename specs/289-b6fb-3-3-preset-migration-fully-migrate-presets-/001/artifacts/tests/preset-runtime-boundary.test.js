// spec: R1 R2 R5 R6 R7 R8
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createResolver } from "../../../src/docs/lib/resolver-factory.js";
import { createI18n } from "../../../src/lib/i18n.js";
import { loadSpecDrivenDevelopmentTemplate } from "../../../src/lib/agents-md.js";
import { resolveIncludes } from "../../../src/lib/include.js";
import { loadPluginRegistry } from "../../../src/lib/plugin-registry.js";
import { resolveChain } from "../../../src/lib/presets.js";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../tests/helpers/tmp-dir.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const SHA = "0123456789abcdef0123456789abcdef01234567";

function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
}

function walkFiles(dir, predicate = () => true) {
  const root = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(root)) return [];
  const out = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && predicate(full)) out.push(full);
    }
  };
  walk(root);
  return out;
}

function createProject(name) {
  const project = createTmpDir(`senti-289-runtime-${name}-`);
  writeJson(project, ".senti/config.json", {
    lang: "en",
    type: "child-preset",
    docs: { languages: ["en"], defaultLanguage: "en" },
    scan: { include: ["src"] },
    plugin: {
      sources: [{ id: "fixture-source", type: "local", path: "fixtures/preset-plugin" }],
      packages: [{ id: "fixture-presets", source: "fixture-source", commit: SHA }],
    },
  });
  writeInstalledPresetPlugin(project);
  return project;
}

function writeInstalledPresetPlugin(project) {
  writeJson(project, ".senti/plugins/fixture-presets/plugin.json", {
    name: "fixture-presets",
    type: "preset",
    files: ["plugin.json", "presets/"],
    contributions: {
      presets: [
        { key: "sample-preset", path: "presets/sample-preset", parent: "base" },
        { key: "child-preset", path: "presets/child-preset", parent: "sample-preset" },
        { key: "second-preset", path: "presets/second-preset", parent: "base" },
      ],
      dataSources: [
        {
          name: "child-preset/routes",
          path: "presets/child-preset/data/routes.js",
          category: "routes",
          methods: ["projectData"],
        },
      ],
    },
  });
  writeJson(project, ".senti/plugins/fixture-presets/presets/sample-preset/preset.json", {
    parent: "base",
    label: "Sample",
    chapters: [{ chapter: "sample.md" }],
  });
  writeJson(project, ".senti/plugins/fixture-presets/presets/child-preset/preset.json", {
    parent: "sample-preset",
    label: "Child",
    chapters: [{ chapter: "child.md" }],
  });
  writeJson(project, ".senti/plugins/fixture-presets/presets/second-preset/preset.json", {
    parent: "base",
    label: "Second",
    chapters: [{ chapter: "second.md" }],
  });
  writeFile(
    project,
    ".senti/plugins/fixture-presets/presets/sample-preset/templates/fragment.md",
    "from sample preset\n",
  );
  writeFile(
    project,
    ".senti/plugins/fixture-presets/presets/child-preset/templates/fragment.md",
    "from child preset\n",
  );
  writeFile(
    project,
    ".senti/plugins/fixture-presets/presets/second-preset/templates/fragment.md",
    "from second preset\n",
  );
  writeFile(
    project,
    ".senti/plugins/fixture-presets/presets/child-preset/templates/deep-1.md",
    '<!-- include("@presets/child-preset/templates/deep-2.md") -->\n',
  );
  for (let i = 2; i <= 9; i += 1) {
    writeFile(
      project,
      `.senti/plugins/fixture-presets/presets/child-preset/templates/deep-${i}.md`,
      `<!-- include("@presets/child-preset/templates/deep-${i + 1}.md") -->\n`,
    );
  }
  writeJson(project, ".senti/plugins/fixture-presets/presets/sample-preset/locale/en/ui.json", {
    fixture: { value: "sample locale" },
  });
  writeJson(project, ".senti/plugins/fixture-presets/presets/child-preset/locale/en/ui.json", {
    fixture: { value: "child locale" },
  });
  writeJson(project, ".senti/plugins/fixture-presets/presets/second-preset/locale/en/ui.json", {
    fixture: { value: "second locale" },
  });
  writeFile(
    project,
    ".senti/plugins/fixture-presets/presets/sample-preset/templates/en/AGENTS.senti.md",
    "sample agents\n",
  );
  writeFile(
    project,
    ".senti/plugins/fixture-presets/presets/child-preset/templates/en/AGENTS.senti.md",
    "child agents\n",
  );
  writeFile(
    project,
    ".senti/plugins/fixture-presets/presets/second-preset/templates/en/AGENTS.senti.md",
    "second agents\n",
  );
  writeFile(
    project,
    ".senti/plugins/fixture-presets/presets/unregistered-preset/templates/fragment.md",
    "unregistered include\n",
  );
  writeJson(project, ".senti/plugins/fixture-presets/presets/unregistered-preset/locale/en/ui.json", {
    fixture: { value: "unregistered locale" },
  });
  writeFile(
    project,
    ".senti/plugins/fixture-presets/presets/unregistered-preset/templates/en/AGENTS.senti.md",
    "unregistered agents\n",
  );
  writeFile(
    project,
    ".senti/plugins/fixture-presets/presets/child-preset/data/routes.js",
    "export default function register(container) {\n  const hasPathPrefix = container.get(\"pathMatch.hasPathPrefix\");\n  return class Routes {\n    init() {}\n    projectData() { return hasPathPrefix(\"src/app/controllers\", \"src/app\") ? \"public pathMatch\" : \"missing\"; }\n  };\n}\n",
  );
}

function writeBadPathMatchPlugin(project) {
  writeJson(project, ".senti/plugins/bad-presets/plugin.json", {
    name: "bad-presets",
    type: "preset",
    files: ["plugin.json", "presets/"],
    contributions: {
      presets: [{ key: "bad-preset", path: "presets/bad-preset", parent: "base" }],
      dataSources: [
        {
          name: "bad-preset/paths",
          path: "presets/bad-preset/data/paths.js",
          category: "paths",
          methods: ["projectData"],
        },
      ],
    },
  });
  writeJson(project, ".senti/plugins/bad-presets/presets/bad-preset/preset.json", {
    parent: "base",
    label: "Bad",
  });
  writeFile(
    project,
    ".senti/plugins/bad-presets/presets/bad-preset/data/paths.js",
    "import { hasPathPrefix } from '../../../../../../src/presets/lib/path-match.js';\nexport default class Paths { projectData() { return hasPathPrefix; } }\n",
  );
  const config = JSON.parse(fs.readFileSync(path.join(project, ".senti", "config.json"), "utf8"));
  config.plugin.packages.push({ id: "bad-presets", source: "fixture-source", commit: SHA });
  writeJson(project, ".senti/config.json", config);
}

describe("preset runtime boundary migration", () => {
  let tmp;
  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  it("R1: main package contains no bundled official preset plugin copy", () => {
    assert.equal(
      fs.existsSync(path.join(REPO_ROOT, "src/official-plugins/senti-presets")),
      false,
      "src/official-plugins/senti-presets must be removed from the main package",
    );
    const presetEntries = fs.readdirSync(path.join(REPO_ROOT, "src/presets"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    assert.deepEqual(presetEntries, ["base"], "src/presets must contain only builtin base");

    const checkedFiles = [
      ...walkFiles("src", (file) => file.endsWith(".js")),
      ...walkFiles("tests", (file) => file.endsWith(".js")),
    ];
    const bundledReferenceOffenders = [];
    const nonBaseBuiltinOffenders = [];
    for (const file of checkedFiles) {
      const rel = path.relative(REPO_ROOT, file);
      const text = fs.readFileSync(file, "utf8");
      if (/src[\\/]+official-plugins[\\/]+senti-presets|official-plugins[\\/]+senti-presets/.test(text)) {
        bundledReferenceOffenders.push(rel);
      }
      if (/src[\\/]+presets[\\/]+(?!base\b)[a-z0-9._-]+/.test(text)) {
        nonBaseBuiltinOffenders.push(rel);
      }
    }
    assert.deepEqual(bundledReferenceOffenders, [], "runtime source and main tests must not reference bundled official preset content");
    assert.deepEqual(nonBaseBuiltinOffenders, [], "runtime source and main tests must not require non-base builtin preset content");
  });

  it("R2: resolveChain uses enabled plugin registry entries and rejects unregistered presets", () => {
    tmp = createProject("chain");
    const registry = loadPluginRegistry(tmp);

    assert.equal(registry.resolvePreset("child-preset").providerId, "fixture-presets");
    assert.deepEqual(
      resolveChain("child-preset", tmp).map((preset) => preset.key),
      ["base", "sample-preset", "child-preset"],
    );
    assert.throws(
      () => resolveChain("unregistered-preset", tmp),
      /Preset not found: unregistered-preset/,
      "runtime must not fall back to bundled official preset content",
    );
  });

  it("R5: @presets includes resolve through project root, config type order, and leaf-to-root chain order", () => {
    tmp = createProject("include");
    writeFile(tmp, ".senti/templates/presets/child-preset/templates/fragment.md", "from project template\n");
    const expanded = resolveIncludes('<!-- include("@presets/sample-preset/templates/fragment.md") -->', {
      baseDir: tmp,
      projectRoot: tmp,
      presetTypes: ["child-preset"],
      sourceFile: "fixture.md",
    });

    assert.equal(expanded.trim(), "from sample preset");
    assert.equal(resolveIncludes('<!-- include("@presets/child-preset/templates/fragment.md") -->', {
      baseDir: tmp,
      projectRoot: tmp,
      presetTypes: ["sample-preset", "child-preset"],
      sourceFile: "fixture.md",
    }).trim(), "from project template");
    assert.equal(resolveIncludes('<!-- include("@presets/second-preset/templates/fragment.md") -->', {
      baseDir: tmp,
      projectRoot: tmp,
      presetTypes: ["second-preset", "child-preset"],
      sourceFile: "fixture.md",
    }).trim(), "from second preset");
    assert.throws(
      () => resolveIncludes('<!-- include("@presets/unregistered-preset/templates/fragment.md") -->', {
        baseDir: tmp,
        projectRoot: tmp,
        presetTypes: ["child-preset"],
        sourceFile: "fixture.md",
      }),
      /unregistered|Preset not found|Include not found/i,
      "unregistered preset keys must not resolve by scanning installed plugin presets",
    );
    writeFile(tmp, ".senti/templates/presets/unregistered-preset/templates/fragment.md", "project-local unregistered include\n");
    assert.throws(
      () => resolveIncludes('<!-- include("@presets/unregistered-preset/templates/fragment.md") -->', {
        baseDir: tmp,
        projectRoot: tmp,
        presetTypes: ["child-preset"],
        sourceFile: "fixture.md",
      }),
      /unregistered|Preset not found|Include not found/i,
      "unregistered preset keys must not resolve from project-local preset template roots",
    );
  });

  it("R5: locale and AGENTS templates resolve through the enabled preset chain", () => {
    tmp = createProject("locale-agents");

    const chainTranslator = createI18n("en", {
      domain: "ui",
      projectRoot: tmp,
      presetTypes: ["child-preset"],
    });
    const chainAgents = loadSpecDrivenDevelopmentTemplate("en", {
      projectRoot: tmp,
      presetTypes: ["child-preset"],
    });

    assert.equal(chainTranslator("fixture.value"), "child locale");
    assert.equal(chainAgents.trim(), "child agents");

    const orderedTranslator = createI18n("en", {
      domain: "ui",
      projectRoot: tmp,
      presetTypes: ["second-preset", "child-preset"],
    });
    const orderedAgents = loadSpecDrivenDevelopmentTemplate("en", {
      projectRoot: tmp,
      presetTypes: ["second-preset", "child-preset"],
    });

    assert.equal(orderedTranslator("fixture.value"), "second locale");
    assert.equal(orderedAgents.trim(), "second agents");

    writeJson(tmp, ".senti/locale/en/ui.json", { fixture: { value: "project locale" } });
    writeFile(tmp, ".senti/templates/en/AGENTS.senti.md", "project agents\n");
    const projectTranslator = createI18n("en", {
      domain: "ui",
      projectRoot: tmp,
      presetTypes: ["child-preset"],
    });
    const projectAgents = loadSpecDrivenDevelopmentTemplate("en", {
      projectRoot: tmp,
      presetTypes: ["child-preset"],
    });

    assert.equal(projectTranslator("fixture.value"), "project locale");
    assert.equal(projectAgents.trim(), "project agents");

    assert.throws(
      () => createI18n("en", {
        domain: "ui",
        projectRoot: tmp,
        presetTypes: ["unregistered-preset"],
      }),
      /unregistered-preset|Preset not found/i,
      "unregistered preset locale must not resolve by scanning installed plugin presets",
    );
    fs.rmSync(path.join(tmp, ".senti", "templates", "en", "AGENTS.senti.md"));
    assert.throws(
      () => loadSpecDrivenDevelopmentTemplate("en", {
        projectRoot: tmp,
        presetTypes: ["unregistered-preset"],
      }),
      /unregistered-preset|Preset not found/i,
      "unregistered AGENTS template must not resolve by scanning installed plugin presets",
    );
  });

  it("R5: include expansion enforces max chain depth, recursive depth, and total include count", () => {
    tmp = createProject("include-limits");
    const includeLines = Array.from({ length: 33 }, () => '<!-- include("@presets/sample-preset/templates/fragment.md") -->');

    assert.throws(
      () => resolveChain("child-preset", tmp, { maxDepth: 1 }),
      /depth|1/i,
    );
    assert.throws(
      () => resolveIncludes('<!-- include("@presets/child-preset/templates/deep-1.md") -->', {
        baseDir: tmp,
        projectRoot: tmp,
        presetTypes: ["child-preset"],
        sourceFile: "deep-root.md",
      }),
      /depth|8/i,
    );
    assert.throws(
      () => resolveIncludes(includeLines.join("\n"), {
        baseDir: tmp,
        projectRoot: tmp,
        presetTypes: ["child-preset"],
        sourceFile: "many-includes.md",
      }),
      /include count|32/i,
    );
  });

  it("R6: plugin preset DataSources use public pathMatch container APIs", async () => {
    tmp = createProject("good-pathmatch");
    const resolver = await createResolver("child-preset", tmp, {});

    assert.equal(
      resolver.resolve("child-preset", "routes", "projectData", {}, []),
      "public pathMatch",
    );
  });

  it("R6: plugin preset DataSources cannot import main package internal preset helpers", () => {
    tmp = createProject("bad-pathmatch");
    writeBadPathMatchPlugin(tmp);

    assert.throws(
      () => loadPluginRegistry(tmp),
      /bad-presets.*path-match|core internal|src\/presets\/lib/i,
    );
    const container = read("src/lib/container.js");
    assert.match(container, /container\.register\("pathMatch\.hasPathPrefix"/);
    assert.match(container, /container\.register\("pathMatch\.hasSegmentPath"/);
    assert.match(container, /container\.register\("pathMatch\.hasAnyPathPrefix"/);
  });

  it("R7: main test runner discovery excludes bundled and external official preset tests", () => {
    const run = read("tests/run.js");
    const helper = read("tests/helpers/test-runner-search-dirs.js");
    assert.ok(!/OFFICIAL_PRESETS_DIR|src[\\/"]\s*,\s*["']official-plugins/.test(run),
      "tests/run.js must not discover bundled official preset tests");
    assert.ok(!/src\/presets\/\*|src\/presets/.test(helper),
      "default/scope search dirs must not depend on src/presets detailed tests");
  });

  it("R8: main contract tests avoid actual official preset names as implementation fixtures", () => {
    const forbiddenWords = [
      [99, 97, 107, 101, 112, 104, 112, 50],
      [108, 97, 114, 97, 118, 101, 108],
      [115, 121, 109, 102, 111, 110, 121],
      [110, 101, 120, 116, 106, 115],
      [103, 105, 116, 104, 117, 98, 45, 97, 99, 116, 105, 111, 110, 115],
      [112, 104, 112, 45, 119, 101, 98, 97, 112, 112],
      [119, 101, 98, 97, 112, 112],
      [119, 111, 114, 107, 101, 114, 115],
      [100, 114, 105, 122, 122, 108, 101],
      [112, 111, 115, 116, 103, 114, 101, 115],
    ].map((codes) => String.fromCharCode(...codes));
    const forbidden = new RegExp(`\\b(${forbiddenWords.join("|")})\\b`);
    const checkedFiles = walkFiles("tests", (file) => file.endsWith(".test.js"))
      .filter((file) => !file.includes(`${path.sep}acceptance${path.sep}`));
    const offenders = [];
    for (const file of checkedFiles) {
      const rel = path.relative(REPO_ROOT, file);
      const text = fs.readFileSync(file, "utf8");
      if (forbidden.test(text)) offenders.push(rel);
    }
    assert.deepEqual(offenders, [], "main tests must use generic preset fixture names");
  });
});
