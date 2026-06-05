import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { createTmpDir, removeTmpDir, writeJson } from "../../helpers/tmp-dir.js";
import { onHook } from "../../../src/lib/hooks.js";

function baseConfig(command) {
  return {
    lang: "en",
    type: "node-cli",
    docs: { languages: ["en"], defaultLanguage: "en" },
    flow: command == null ? {} : {
      hooks: {
        PostWorktree: command,
      },
    },
  };
}

function writeConfig(root, command) {
  writeJson(root, ".sdd-forge/config.json", baseConfig(command));
}

async function captureWarnings(fn) {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    const result = await fn();
    return { result, warnings: warnings.join("\n") };
  } finally {
    console.warn = originalWarn;
  }
}

describe("flow hooks", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns a no-op envelope when PostWorktree is not configured", async () => {
    tmp = createTmpDir("sdd-hooks-unit-noop-");
    writeConfig(tmp);

    const result = await onHook("PostWorktree", { CWD: tmp });

    assert.deepEqual(result, { ok: true, output: "", stderr: "", status: 0 });
  });

  it("executes configured hook commands with placeholders, cwd, shell, and timeout", async () => {
    tmp = createTmpDir("sdd-hooks-unit-exec-");
    writeConfig(tmp, "printf '{{CWD}}'");
    const originalSpawnSync = childProcess.spawnSync;
    let captured;
    childProcess.spawnSync = (command, args, options) => {
      captured = { command, args, options };
      return { status: 0, stdout: tmp, stderr: "" };
    };

    try {
      const result = await onHook("PostWorktree", { CWD: tmp });

      assert.equal(result.ok, true);
      assert.equal(result.output, tmp);
      assert.equal(captured.command, `printf '${tmp}'`);
      assert.deepEqual(captured.args, []);
      assert.equal(captured.options.cwd, tmp);
      assert.equal(captured.options.shell, true);
      assert.equal(captured.options.timeout, 600000);
    } finally {
      childProcess.spawnSync = originalSpawnSync;
    }
  });

  it("leaves missing placeholders unchanged and warns", async () => {
    tmp = createTmpDir("sdd-hooks-unit-missing-");
    writeConfig(tmp, "printf '{{MISSING}}'");

    const { result, warnings } = await captureWarnings(() => onHook("PostWorktree", { CWD: tmp }));

    assert.equal(result.ok, true);
    assert.equal(result.output, "{{MISSING}}");
    assert.match(warnings, /MISSING/);
  });

  it("returns ok:false without throwing when the shell command fails", async () => {
    tmp = createTmpDir("sdd-hooks-unit-failure-");
    writeConfig(tmp, "node -e \"process.stderr.write('hook failed'); process.exit(7)\"");

    const { result, warnings } = await captureWarnings(() => onHook("PostWorktree", { CWD: tmp }));

    assert.equal(result.ok, false);
    assert.equal(result.status, 7);
    assert.match(result.stderr, /hook failed/);
    assert.match(warnings, /PostWorktree/);
  });
});
