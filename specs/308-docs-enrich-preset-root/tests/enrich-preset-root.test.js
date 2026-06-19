// spec: R1 R2 R3
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { container } from "../../../src/lib/container.js";
import { resolveChaptersOrder } from "../../../src/docs/lib/template-merger.js";
import DocsEnrichCommand from "../../../src/docs/commands/enrich.js";
import DocsInitCommand from "../../../src/docs/commands/init.js";
import DocsReadmeCommand from "../../../src/docs/commands/readme.js";

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeFile(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, value);
}

function createRegistryPresetProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "senti-enrich-registry-"));
  writeJson(path.join(root, ".senti/config.json"), {
    lang: "en",
    type: ["registry-docs"],
    docs: { languages: ["en"], defaultLanguage: "en" },
    plugin: {
      packages: [{ id: "fixture-presets" }],
      sources: [],
      config: {},
    },
  });
  writeJson(path.join(root, ".senti/plugins/fixture-presets/plugin.json"), {
    name: "fixture-presets",
    type: "preset",
    files: ["plugin.json", "presets/"],
    contributions: {
      presets: [
        { key: "registry-docs", path: "presets/registry-docs", parent: "base" },
      ],
    },
  });
  writeJson(path.join(root, ".senti/plugins/fixture-presets/presets/registry-docs/preset.json"), {
    parent: "base",
    label: "Registry Docs",
    chapters: ["registry_overview.md", "registry_details.md"],
  });
  writeFile(
    path.join(root, ".senti/plugins/fixture-presets/presets/registry-docs/templates/en/registry_overview.md"),
    "# Registry Overview\n\nRegistry overview template.\n",
  );
  writeFile(
    path.join(root, ".senti/plugins/fixture-presets/presets/registry-docs/templates/en/registry_details.md"),
    "# Registry Details\n\nRegistry details template.\n",
  );
  writeFile(
    path.join(root, ".senti/plugins/fixture-presets/presets/registry-docs/templates/en/README.md"),
    "# Registry Docs\n\nRegistry README template.\n",
  );
  writeJson(path.join(root, ".senti/output/analysis.json"), {
    modules: {
      entries: [
        { file: "src/example.js", lines: 1 },
      ],
    },
  });
  writeFile(path.join(root, "src/example.js"), "export function example() { return true; }\n");
  return root;
}

function docsCtx(root, extra = {}) {
  return {
    root,
    sourceRoot: root,
    srcRoot: root,
    docsDir: path.join(root, "docs"),
    config: {
      lang: "en",
      type: ["registry-docs"],
      docs: { languages: ["en"], defaultLanguage: "en" },
      agent: { batchTokenLimit: 10000, retryCount: 0 },
      concurrency: 1,
    },
    type: ["registry-docs"],
    outputLang: "en",
    commandId: extra.commandId || "docs.enrich",
    dryRun: false,
    stdout: false,
    force: true,
    agent: null,
    t(key) {
      return key;
    },
    ...extra,
  };
}

async function captureStderr(fn) {
  const originalWrite = process.stderr.write;
  let output = "";
  process.stderr.write = function write(chunk, encoding, callback) {
    output += String(chunk);
    if (typeof callback === "function") callback();
    return true;
  };
  try {
    const value = await fn();
    return { value, stderr: output };
  } finally {
    process.stderr.write = originalWrite;
  }
}

async function runDocsEnrichWithRegistryProject() {
  const root = createRegistryPresetProject();
  const calls = [];
  const previousAgent = container.has("agent") ? container.get("agent") : null;
  container.set("agent", {
    resolve() {
      return { commandId: "docs.enrich" };
    },
    async call(prompt) {
      calls.push(prompt);
      return JSON.stringify({
        modules: [
          {
            index: 0,
            summary: "Example module",
            detail: "Example details",
            chapter: "registry_overview",
            role: "lib",
            keywords: ["registry", "preset"],
          },
        ],
      });
    },
  });

  try {
    const result = await captureStderr(async () => {
      await new DocsEnrichCommand().execute({
        docsCtx: {
          ...docsCtx(root, { commandId: "docs.enrich" }),
        },
        _rawArgs: [],
      });
    });
    const analysis = JSON.parse(fs.readFileSync(path.join(root, ".senti/output/analysis.json"), "utf8"));
    return { ...result, root, calls, analysis };
  } finally {
    if (previousAgent) {
      container.set("agent", previousAgent);
    } else {
      container.reset();
    }
  }
}

describe("docs enrich project-root preset resolution", () => {
  it("R1: docs enrich uses the current project root when building chapter prompts", async () => {
    const { root, calls } = await runDocsEnrichWithRegistryProject();
    try {
      assert.equal(calls.length, 1);
      assert.match(calls[0], /registry_overview/);
      assert.match(calls[0], /registry_details/);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("R2: docs enrich resolves valid registry presets without Preset not found warnings", async () => {
    const { root, stderr, analysis } = await runDocsEnrichWithRegistryProject();
    try {
      assert.doesNotMatch(stderr, /Preset not found: registry-docs/);
      assert.equal(analysis.modules.entries[0].chapter, "registry_overview");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("R3: root-aware enrich behavior coexists with existing resolver fallback", async () => {
    const { root, calls } = await runDocsEnrichWithRegistryProject();
    try {
      assert.match(calls[0], /registry_overview/);

      await new DocsInitCommand().execute({
        docsCtx: docsCtx(root, { commandId: "docs.init" }),
        _rawArgs: [],
      });
      assert.equal(
        fs.readFileSync(path.join(root, "docs/registry_overview.md"), "utf8"),
        "# Registry Overview\n\nRegistry overview template.\n",
      );

      await new DocsReadmeCommand().execute({
        docsCtx: docsCtx(root, { commandId: "docs.readme" }),
        _rawArgs: [],
      });
      assert.match(
        fs.readFileSync(path.join(root, "README.md"), "utf8"),
        /Registry README template/,
      );

      const fallback = await captureStderr(async () => resolveChaptersOrder("missing-registry-preset", undefined, root));
      assert.match(fallback.stderr, /Preset not found: missing-registry-preset/);
      assert.deepEqual(fallback.value, ["overview.md", "stack_and_ops.md", "project_structure.md", "development.md"]);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
