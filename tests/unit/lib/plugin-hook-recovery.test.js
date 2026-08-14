import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  discoverFlowCommandHooks,
  runFlowCommandHooks,
} from "../../../src/lib/plugin-registry.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

function writeProject(root, { enabled = true, marker = "initial", failurePolicy = null } = {}) {
  const pluginRoot = path.join(root, ".sennel", "plugins", "workflow");
  fs.mkdirSync(path.join(pluginRoot, "hooks"), { recursive: true });
  fs.writeFileSync(path.join(root, ".sennel", "config.json"), `${JSON.stringify({
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    plugin: {
      sources: [{ id: "local", type: "local", path: "." }],
      packages: [{ id: "workflow", source: "local", commit: "0".repeat(40), enabled }],
    },
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(pluginRoot, "hooks", "finalize-cleanup.js"), `
    export default function register(api) {
      return class WorkflowFinalizeCleanupHook extends api.FlowCommandHook {
        static command = "finalize-cleanup";
        static hook = "post";
        static priority = 0;
        ${failurePolicy === null ? "" : `static failurePolicy = ${JSON.stringify(failurePolicy)};`}
        async run(context) {
          return context.envelope.ok("plugin-hook", "finalize-cleanup", { marker: ${JSON.stringify(marker)} });
        }
      };
    }
  `);
}

test("hook execution rejects plans whose current module omits required policy metadata", async () => {
  const root = createTmpDir("sennel-persisted-hook-policy-");
  try {
    writeProject(root);

    await assert.rejects(
      () => discoverFlowCommandHooks(root),
      /failure policy.*missing/i,
      "new hook discovery must continue to require explicit policy metadata",
    );

    await assert.rejects(
      () => runFlowCommandHooks(root, [{
        apiVersion: 1,
        pluginId: "workflow",
        module: "hooks/finalize-cleanup.js",
        className: "WorkflowFinalizeCleanupHook",
        command: "finalize-cleanup",
        hook: "post",
        priority: 0,
        failurePolicy: "required",
      }], {
        command: "finalize-cleanup",
        hook: "post",
        flow: { specId: "001-recovery" },
        result: { ok: true },
      }),
      /failure policy.*missing/i,
    );
  } finally {
    removeTmpDir(root);
  }
});

test("hook enablement and module updates apply on the next command discovery", async () => {
  const root = createTmpDir("sennel-current-hook-discovery-");
  const execute = async () => {
    const plans = await discoverFlowCommandHooks(root);
    if (plans.length === 0) return null;
    const result = await runFlowCommandHooks(root, plans, {
      command: "finalize-cleanup",
      hook: "post",
      flow: { specId: "001-current" },
      result: { ok: true },
    });
    return result.hookData[0].data.marker;
  };
  try {
    writeProject(root, { marker: "first", failurePolicy: "required" });
    assert.equal(await execute(), "first");

    writeProject(root, { marker: "updated", failurePolicy: "required" });
    assert.equal(await execute(), "updated");

    writeProject(root, { enabled: false, marker: "disabled", failurePolicy: "required" });
    assert.equal(await execute(), null);

    writeProject(root, { marker: "re-enabled", failurePolicy: "required" });
    assert.equal(await execute(), "re-enabled");
  } finally {
    removeTmpDir(root);
  }
});
