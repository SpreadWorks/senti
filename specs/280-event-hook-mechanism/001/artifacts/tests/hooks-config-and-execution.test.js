// spec: R1 R2 R5
import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../../../src/lib/config.js";
import { createTmpDir, removeTmpDir, writeJson } from "../../../tests/helpers/tmp-dir.js";

const HOOKS_MODULE_PATH = path.join(process.cwd(), "src/lib/hooks.js");

function baseConfig(overrides = {}) {
  return {
    lang: "en",
    type: "node-cli",
    docs: { languages: ["en"], defaultLanguage: "en" },
    ...overrides,
  };
}

function writeConfig(root, config) {
  writeJson(root, ".sdd-forge/config.json", config);
}

async function importHooksModule() {
  assert.ok(fs.existsSync(HOOKS_MODULE_PATH), "src/lib/hooks.js must exist");
  return import("../../../src/lib/hooks.js");
}

async function captureWarnings(fn) {
  const warnings = [];
  const originalWarn = console.warn;
  const originalStderrWrite = process.stderr.write;
  console.warn = (...args) => warnings.push(args.join(" "));
  process.stderr.write = function(chunk, encoding, cb) {
    warnings.push(String(chunk));
    if (typeof cb === "function") cb();
    return true;
  };
  try {
    const result = await fn();
    return { result, warnings: warnings.join("\n") };
  } finally {
    console.warn = originalWarn;
    process.stderr.write = originalStderrWrite;
  }
}

describe("280 hooks config and execution", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("R5: hook execution regression exposes PostWorktree metadata and onHook", async () => {
    const hooksModule = await importHooksModule();

    assert.equal(typeof hooksModule.onHook, "function");
    assert.equal(hooksModule.HOOKS[0].name, "PostWorktree");
    assert.deepEqual([...hooksModule.HOOKS[0].placeholders], ["CWD"]);
  });

  it("R1: config schema accepts flow.hooks string values and rejects non-string values", () => {
    tmp = createTmpDir("sdd-hooks-config-");
    writeConfig(tmp, baseConfig({
      flow: {
        hooks: {
          PostWorktree: "printf ok",
          CustomHook: "printf custom",
        },
      },
    }));

    const valid = loadConfig(tmp);
    assert.equal(valid.flow.hooks.PostWorktree, "printf ok");
    assert.equal(valid.flow.hooks.CustomHook, "printf custom");

    writeConfig(tmp, baseConfig({
      flow: {
        hooks: {
          CustomHook: ["printf", "ok"],
        },
      },
    }));

    assert.throws(
      () => loadConfig(tmp),
      /flow\.hooks\.CustomHook: must be string/,
    );

    writeConfig(tmp, baseConfig({
      flow: {
        hooks: "printf invalid",
      },
    }));

    assert.throws(
      () => loadConfig(tmp),
      /flow\.hooks: must be object/,
    );
  });

  it("R2: onHook returns a successful no-op envelope when PostWorktree is not configured", async () => {
    tmp = createTmpDir("sdd-hooks-noop-");
    writeConfig(tmp, baseConfig());
    const { onHook } = await importHooksModule();

    const result = await onHook("PostWorktree", { CWD: tmp });

    assert.equal(result.ok, true);
    assert.equal(result.output, "");
    assert.equal(result.stderr, "");
    assert.equal(result.status, 0);
  });

  it("R2: onHook replaces placeholders, executes shell syntax in CWD, and returns stdout", async () => {
    tmp = createTmpDir("sdd-hooks-success-");
    writeConfig(tmp, baseConfig({
      flow: {
        hooks: {
          PostWorktree: "printf '{{CWD}}' && pwd > hook.cwd",
        },
      },
    }));
    const { onHook } = await importHooksModule();

    const result = await onHook("PostWorktree", { CWD: tmp });

    assert.equal(result.ok, true);
    assert.equal(result.output, tmp);
    assert.equal(result.stderr, "");
    assert.equal(result.status, 0);
    assert.equal(fs.readFileSync(path.join(tmp, "hook.cwd"), "utf8").trim(), tmp);
  });

  it("R2: onHook passes context CWD and the 600000 ms timeout to the shell execution path", async () => {
    tmp = createTmpDir("sdd-hooks-options-");
    writeConfig(tmp, baseConfig({
      flow: {
        hooks: {
          PostWorktree: "printf timeout",
        },
      },
    }));
    const { onHook } = await importHooksModule();
    const originalSpawnSync = childProcess.spawnSync;
    let captured;
    childProcess.spawnSync = (command, args, options) => {
      captured = { command, args, options };
      return { status: 0, stdout: "timeout", stderr: "" };
    };

    try {
      const result = await onHook("PostWorktree", { CWD: tmp });

      assert.equal(result.ok, true);
      assert.equal(captured.command, "printf timeout");
      assert.deepEqual(captured.args, []);
      assert.equal(captured.options.cwd, tmp);
      assert.equal(captured.options.timeout, 600000);
      assert.equal(captured.options.shell, true);
    } finally {
      childProcess.spawnSync = originalSpawnSync;
    }
  });

  it("R2: onHook leaves missing placeholders unchanged and emits a warning", async () => {
    tmp = createTmpDir("sdd-hooks-missing-placeholder-");
    writeConfig(tmp, baseConfig({
      flow: {
        hooks: {
          PostWorktree: "printf '{{MISSING}}'",
        },
      },
    }));
    const { onHook } = await importHooksModule();

    const { result, warnings } = await captureWarnings(() => onHook("PostWorktree", { CWD: tmp }));

    assert.equal(result.ok, true);
    assert.equal(result.output, "{{MISSING}}");
    assert.equal(result.stderr, "");
    assert.equal(result.status, 0);
    assert.match(warnings, /MISSING/);
  });

  it("R2: onHook reports non-zero shell exits without throwing", async () => {
    tmp = createTmpDir("sdd-hooks-failure-");
    writeConfig(tmp, baseConfig({
      flow: {
        hooks: {
          PostWorktree: "node -e \"process.stderr.write('hook failed'); process.exit(7)\"",
        },
      },
    }));
    const { onHook } = await importHooksModule();

    const { result, warnings } = await captureWarnings(() => onHook("PostWorktree", { CWD: tmp }));

    assert.equal(result.ok, false);
    assert.equal(result.status, 7);
    assert.equal(result.output, "");
    assert.match(result.stderr, /hook failed/);
    assert.match(warnings, /PostWorktree/);
  });
});
