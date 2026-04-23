/**
 * Spec 221 — `flow run finalize` の `--mode` 既定値 `all` 挙動検証。
 *
 * AC1 (REQ-1/REQ-2): `ctx.mode` が undefined / 空文字のとき、`"all"` に defaulting される。
 * AC2 (REQ-3): 無効値および `--mode select` で `--steps` 欠落時のエラーは維持。
 * AC4 (REQ-5): `src/flow/registry.js` の finalize help に `default: all` を含む。
 * AC5 (REQ-6): `src/flow/prompts/impl/finalize.md` の通常完了パスから `--mode all` が削除されている。
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { RunFinalizeCommand } from "../../../src/flow/lib/run-finalize.js";

function createFinalizeCtx(overrides = {}) {
  return {
    root: process.cwd(),
    dryRun: true,
    flowState: {
      baseBranch: "main",
      featureBranch: "feature/x",
      spec: "specs/x/spec.md",
      worktree: false,
      requirements: [],
    },
    flowManager: {
      resolveWorktreePaths: () => ({
        worktreePath: process.cwd(),
        mainRepoPath: process.cwd(),
      }),
    },
    ...overrides,
  };
}

async function captureExecuteErrorMessage(ctxOverrides) {
  const cmd = new RunFinalizeCommand();
  try {
    await cmd.execute(createFinalizeCtx(ctxOverrides));
  } catch (err) {
    return err.message;
  }
  return null;
}

function assertNotValidationError(message, pattern, description) {
  if (message === null) return;
  assert.doesNotMatch(message, pattern, description);
}

describe("run-finalize — --mode defaults to 'all' (spec 221)", () => {
  it("AC1: ctx.mode = undefined does NOT trigger '--mode must be...' validation error", async () => {
    const message = await captureExecuteErrorMessage({ mode: undefined });
    assertNotValidationError(
      message,
      /--mode must be 'all' or 'select'/,
      "ctx.mode = undefined should default to 'all' and bypass --mode validation",
    );
  });

  it("AC1: ctx.mode = '' (empty string) does NOT trigger '--mode must be...' validation error", async () => {
    const message = await captureExecuteErrorMessage({ mode: "" });
    assertNotValidationError(
      message,
      /--mode must be 'all' or 'select'/,
      "ctx.mode = '' should default to 'all' and bypass --mode validation",
    );
  });

  it("AC1: ctx.mode = undefined defaults to 'all' (not 'select'), so --steps is NOT required", async () => {
    const message = await captureExecuteErrorMessage({ mode: undefined, steps: "" });
    assertNotValidationError(
      message,
      /--steps required when mode is 'select'/,
      "ctx.mode = undefined must default to 'all' (all-mode never requires --steps)",
    );
  });
});

describe("run-finalize — invalid --mode and missing --steps still error (spec 221)", () => {
  it("AC2: ctx.mode = 'foo' throws \"--mode must be 'all' or 'select'\"", async () => {
    const cmd = new RunFinalizeCommand();
    await assert.rejects(
      () => cmd.execute(createFinalizeCtx({ mode: "foo" })),
      (err) => /^--mode must be 'all' or 'select'$/.test(err.message),
      "invalid --mode must still raise the mode-required error",
    );
  });

  it("AC2: ctx.mode = 'select' without --steps throws \"--steps required when mode is 'select'\"", async () => {
    const cmd = new RunFinalizeCommand();
    await assert.rejects(
      () => cmd.execute(createFinalizeCtx({ mode: "select", steps: "" })),
      (err) => /^--steps required when mode is 'select'$/.test(err.message),
      "--mode select without --steps must still raise the steps-required error",
    );
  });
});

describe("run-finalize — documentation alignment (spec 221)", () => {
  it("AC4 (REQ-5): registry finalize help documents 'default: all' for --mode", () => {
    const registryPath = path.resolve(process.cwd(), "src/flow/registry.js");
    const source = fs.readFileSync(registryPath, "utf8");
    assert.match(
      source,
      /--mode[^\n]*default:\s*all/,
      "finalize --mode help line must include 'default: all' so ヘルプ出力が既定値挙動と整合する",
    );
  });

  it("AC5 (REQ-6): prompts/impl/finalize.md's normal-completion path no longer includes '--mode all'", () => {
    const promptPath = path.resolve(
      process.cwd(),
      "src/flow/prompts/impl/finalize.md",
    );
    const source = fs.readFileSync(promptPath, "utf8");
    assert.doesNotMatch(
      source,
      /sdd-forge flow run finalize --mode all\b/,
      "normal-completion path should omit '--mode all' (既定値で足りる)",
    );
    assert.match(
      source,
      /sdd-forge flow run finalize --mode select --steps/,
      "the select-mode example must still appear (selective path requires --mode select)",
    );
  });
});
