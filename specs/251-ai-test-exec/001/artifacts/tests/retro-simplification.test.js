// spec: R5 R6 R25 R37
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

describe("retro simplification (251-ai-test-exec)", () => {
  it("R5: run-retro.js no longer invokes execFileSync('node --test') or TAP helpers", () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, "src/flow/lib/run-retro.js"), "utf8");
    assert.ok(!/execFileSync\([^)]*node[^)]*--test/.test(src), "run-retro.js must not invoke node --test via execFileSync");
    assert.ok(!/parseTapOutput|extractReqResults|evaluateReqByResults/.test(src), "run-retro.js must not reference TAP helper functions");
    assert.ok(!/\.test\.js|\.spec\.js|\.mjs/.test(src), "run-retro.js must not have JS-extension filter");
  });

  it("R6: run-finalize.js no longer invokes RetroCommand from post-commit hook", () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, "src/flow/lib/run-finalize.js"), "utf8");
    assert.ok(!/RunRetroCommand|RetroCommand/.test(src), "run-finalize.js must not reference RetroCommand (retro is mainline now)");
  });

  it("R25: impl/retro.md prompt exists with required content", () => {
    const p = path.join(REPO_ROOT, "src/flow/prompts/impl/retro.md");
    assert.ok(fs.existsSync(p), "impl/retro.md must exist");
    const src = fs.readFileSync(p, "utf8");
    assert.ok(/sdd-forge flow run retro/.test(src), "retro.md must instruct flow run retro invocation");
    assert.ok(/結果ファイル|read-only|read only/i.test(src), "retro.md must mention read-only artifact policy");
  });

  it("R37: finalize-commit post-hook keeps report but drops retro", () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, "src/flow/lib/run-finalize.js"), "utf8");
    assert.ok(/report/i.test(src), "finalize must still wire report generation in post-hook");
    assert.ok(!/RetroCommand|RunRetroCommand/.test(src), "finalize must not call retro");
  });
});
