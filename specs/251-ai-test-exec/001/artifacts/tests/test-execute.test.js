// spec: R2 R12 R15 R47
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

describe("test-execute step (251-ai-test-exec)", () => {
  it("R2: run-test-execute.js exists and writes test-execute-result.json + spec-local raw output", () => {
    const p = path.join(REPO_ROOT, "src/flow/lib/run-test-execute.js");
    assert.ok(fs.existsSync(p), "run-test-execute.js must exist");
    const src = fs.readFileSync(p, "utf8");
    assert.ok(/test-execute-result\.json/.test(src), "run-test-execute.js must reference test-execute-result.json");
    assert.ok(/tests\/\.raw|test-execution\.log/.test(src), "run-test-execute.js must reference spec-local raw output path");
  });

  it("R12: test-execute prompt instructs test command discovery and verbose execution", () => {
    const p = path.join(REPO_ROOT, "src/flow/prompts/impl/test-execute.md");
    assert.ok(fs.existsSync(p), "test-execute.md prompt must exist");
    const src = fs.readFileSync(p, "utf8");
    assert.ok(/package\.json|scripts\.test|test command/i.test(src), "test-execute.md must instruct test command discovery");
    assert.ok(/verbose|raw output|要約禁止/i.test(src), "test-execute.md must instruct verbose execution and forbid summarization");
  });

  it("R15: test-execute uses ensureAgent('flow.test.execute')", () => {
    const p = path.join(REPO_ROOT, "src/flow/lib/run-test-execute.js");
    const src = fs.readFileSync(p, "utf8");
    assert.ok(/ensureAgent\(["']flow\.test\.execute["']\)/.test(src), "run-test-execute.js must call ensureAgent('flow.test.execute')");
  });

  it("R47: test-execute overwrites its artifacts unconditionally on each invocation", () => {
    const p = path.join(REPO_ROOT, "src/flow/lib/run-test-execute.js");
    const src = fs.readFileSync(p, "utf8");
    assert.ok(/writeFileSync|fs\.write/.test(src), "run-test-execute.js must write result file (unconditional overwrite)");
    assert.ok(!/--force|cached/i.test(src), "run-test-execute.js must not have caching/force-flag logic (always overwrite)");
  });
});
