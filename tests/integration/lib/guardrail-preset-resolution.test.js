import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { loadMergedGuardrails } from "../../../src/lib/guardrail.js";
import { createTmpDir, removeTmpDir, writeJson } from "../../support/builders/tmp-dir.js";

function installPresetPlugin(root) {
  writeJson(root, ".sennel/config.json", {
    lang: "en",
    type: ["node-cli", "greenfield", "document"],
    docs: { languages: ["en"], defaultLanguage: "en" },
    plugin: {
      sources: [{
        id: "official-presets",
        type: "git",
        url: "git@github.com:SpreadWorks/sennel-presets.git",
      }],
      packages: [{
        id: "official-presets",
        source: "official-presets",
        commit: "31bdd70fecfcde33c32bd75909218b744561c24e",
      }],
    },
  });
  writeJson(root, ".sennel/plugins/official-presets/plugin.json", {
    name: "official-presets",
    type: "preset",
    files: ["plugin.json", "presets/"],
    contributions: {
      presets: [
        { key: "cli", path: "presets/cli", parent: "base" },
        { key: "node-cli", path: "presets/node-cli", parent: "cli" },
        { key: "greenfield", path: "presets/greenfield", parent: "base" },
        { key: "document", path: "presets/document", parent: "base" },
      ],
    },
  });
  writeJson(root, ".sennel/plugins/official-presets/presets/cli/preset.json", {
    parent: "base",
    chapters: [],
  });
  writeJson(root, ".sennel/plugins/official-presets/presets/node-cli/preset.json", {
    parent: "cli",
    chapters: [],
  });
  for (const key of ["greenfield", "document"]) {
    writeJson(root, `.sennel/plugins/official-presets/presets/${key}/preset.json`, {
      parent: "base",
      chapters: [],
    });
  }
  writeJson(root, ".sennel/plugins/official-presets/presets/node-cli/guardrail.json", {
    guardrails: [{
      id: "plugin-preset-guardrail",
      title: "Plugin preset guardrail",
      body: "This guardrail is contributed by the enabled project plugin.",
      meta: { phase: ["spec"], category: "requirements" },
    }],
  });
}

describe("guardrail preset resolution", () => {
  let tmp;

  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  it("resolves configured plugin preset chains from the execution root", () => {
    tmp = createTmpDir("sennel-guardrail-preset-");
    installPresetPlugin(tmp);

    const guardrails = loadMergedGuardrails(tmp);

    assert.ok(
      guardrails.some((guardrail) => guardrail.id === "plugin-preset-guardrail"),
      "guardrails from the configured leaf preset must be loaded",
    );
  });
});
