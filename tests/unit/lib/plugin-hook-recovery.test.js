import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  discoverFlowCommandHooks,
  runFlowCommandHooks,
} from "../../../src/lib/plugin-registry.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

function writeProject(root) {
  const pluginRoot = path.join(root, ".sennel", "plugins", "workflow");
  fs.mkdirSync(path.join(pluginRoot, "hooks"), { recursive: true });
  fs.writeFileSync(path.join(root, ".sennel", "config.json"), `${JSON.stringify({
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    plugin: {
      sources: [{ id: "local", type: "local", path: "." }],
      packages: [{ id: "workflow", source: "local", commit: "0".repeat(40) }],
    },
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(pluginRoot, "hooks", "finalize-cleanup.js"), `
    export default function register(api) {
      return class WorkflowFinalizeCleanupHook extends api.FlowCommandHook {
        static command = "finalize-cleanup";
        static hook = "post";
        static priority = 0;
        async run(context) {
          return context.envelope.ok("plugin-hook", "finalize-cleanup", { recovered: true });
        }
      };
    }
  `);
}

test("persisted hook policy resumes cleanup when the installed hook predates policy metadata", async () => {
  const root = createTmpDir("sennel-persisted-hook-policy-");
  try {
    writeProject(root);

    await assert.rejects(
      () => discoverFlowCommandHooks(root),
      /failure policy.*missing/i,
      "new hook discovery must continue to require explicit policy metadata",
    );

    const result = await runFlowCommandHooks(root, [{
      apiVersion: 1,
      pluginId: "workflow",
      module: "hooks/finalize-cleanup.js",
      className: "WorkflowFinalizeCleanupHook",
      command: "finalize-cleanup",
      hook: "post",
      priority: 0,
    }], {
      command: "finalize-cleanup",
      hook: "post",
      flow: { specId: "001-recovery" },
      result: { ok: true },
    });

    assert.equal(result.ok, true);
    assert.equal(result.hookData[0].data.recovered, true);
  } finally {
    removeTmpDir(root);
  }
});
