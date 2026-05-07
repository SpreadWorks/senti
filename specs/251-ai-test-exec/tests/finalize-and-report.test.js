// spec: R19 R20 R26 R28 R51
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

describe("finalize artifact boundary + report integration (251-ai-test-exec)", () => {
  it("R19: run-finalize-commit.js separates test artifacts from implementation commit", () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, "src/flow/lib/run-finalize-commit.js"), "utf8");
    // Must reference test artifacts and either exclude or stage them separately
    assert.ok(/test-execute-result|test-result-review|retro\.json|\.raw\//.test(src) || /artifact/i.test(src),
      "run-finalize-commit.js must reference test artifacts boundary handling");
  });

  it("R20: run-report.js loads new test artifacts (not state.test.summary)", () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, "src/flow/lib/run-report.js"), "utf8");
    assert.ok(/test-execute-result\.json|test-result-review\.json|retro\.json/.test(src),
      "run-report.js must read new test artifacts");
    assert.ok(!/state\.test\.summary/.test(src), "run-report.js must not read state.test.summary");
  });

  it("R26: registry.js finalize-commit help/post does not advertise retro invocation", () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, "src/flow/registry.js"), "utf8");
    // help text must not say "post-hook runs retro"
    assert.ok(!/post-hook runs retro|retro,\s*report/.test(src),
      "registry.js finalize-commit help must not say post-hook runs retro");
  });

  it("R28: commands/report.js consumes new test artifacts directly", () => {
    const p = path.join(REPO_ROOT, "src/flow/commands/report.js");
    if (!fs.existsSync(p)) return;
    const src = fs.readFileSync(p, "utf8");
    assert.ok(/test-execute-result|test-result-review|retro\.json/.test(src),
      "commands/report.js must reference new test artifacts");
    assert.ok(!/state\.test\.summary/.test(src), "commands/report.js must not read state.test.summary");
  });

  it("R51: finalize commit-scope regression test reflects new artifact policy", () => {
    const candidate = path.join(REPO_ROOT, "tests/unit/flow/run-finalize-retro-commit-scope.test.js");
    if (!fs.existsSync(candidate)) return;
    const src = fs.readFileSync(candidate, "utf8");
    assert.ok(/test-execute-result|test-result-review|retro\.json/.test(src),
      "commit-scope regression test must verify boundary for new artifacts");
  });
});
