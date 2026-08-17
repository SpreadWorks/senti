// spec: R21 R22 R23 R49 R50
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

describe("skill template + existing test updates (251-ai-test-exec)", () => {
  it("R21: test-only auto skip path does not skip test-execute / test-result-review", () => {
    // test-only flow logic should permit skipping implement / gate-impl but always run test-execute / test-result-review
    const candidates = [
      path.join(REPO_ROOT, "src/flow/lib/run-impl-confirm.js"),
      path.join(REPO_ROOT, "src/flow/lib/test-only-skip.js"),
    ];
    let found = false;
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        found = true;
        const src = fs.readFileSync(p, "utf8");
        assert.ok(!/test-execute|test-result-review/.test(src) || /skip[\s\S]*?implement|skip[\s\S]*?gate-impl/.test(src),
          `${p} test-only skip path must not skip test-execute / test-result-review`);
      }
    }
    if (!found) {
      // implement.md prompt mentions test-only skip
      const promptPath = path.join(REPO_ROOT, "src/flow/prompts/impl/implement.md");
      const src = fs.readFileSync(promptPath, "utf8");
      assert.ok(!/test-only.*skip.*test-execute/i.test(src), "test-only skip path must not include test-execute");
    }
  });

  it("R22: skill template sdd-forge.flow/SKILL.md does not describe finalize post-hook running retro", () => {
    const p = path.join(REPO_ROOT, "src/templates/skills/sdd-forge.flow/SKILL.md");
    const src = fs.readFileSync(p, "utf8");
    assert.ok(!/post-hook runs retro|finalize.*retro.*report/i.test(src),
      "SKILL.md must not describe retro running in finalize post-hook");
  });

  it("R23: existing finalize-retro tests are updated for new behavior", () => {
    const p = path.join(REPO_ROOT, "tests/unit/flow/run-finalize-retro-invocation.test.js");
    if (!fs.existsSync(p)) return;
    const src = fs.readFileSync(p, "utf8");
    assert.ok(!/RetroCommand|RunRetroCommand/.test(src) || /\.skip|disabled/i.test(src),
      "run-finalize-retro-invocation.test.js must be updated (no RetroCommand assertion or disabled)");
  });

  it("R49: SKILL.md does not reference deprecated 'flow run tests' baseline", () => {
    const p = path.join(REPO_ROOT, "src/templates/skills/sdd-forge.flow/SKILL.md");
    const src = fs.readFileSync(p, "utf8");
    assert.ok(!/flow run tests/.test(src), "SKILL.md must not reference 'flow run tests'");
  });

  it("R50: e2e lifecycle whitelist tests are updated", () => {
    const candidates = [
      "tests/e2e/231-task-e2e-full-lifecycle.test.js",
      "tests/e2e/227-forest-e2e.test.js",
      "tests/e2e/flow/gate-impl-integration.test.js",
    ];
    for (const rel of candidates) {
      const p = path.join(REPO_ROOT, rel);
      if (!fs.existsSync(p)) continue;
      const src = fs.readFileSync(p, "utf8");
      assert.ok(/test-execute|test-result-review/.test(src),
        `${rel} must reference new step ids`);
    }
  });
});
