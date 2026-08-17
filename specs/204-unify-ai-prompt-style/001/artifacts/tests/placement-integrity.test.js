/**
 * specs/204-unify-ai-prompt-style/tests/placement-integrity.test.js
 *
 * Verifies that the shared ai-question-style partial is wired into every
 * SKILL.md under src/templates/skills/. The skill is always loaded first
 * when Claude Code enters a flow, so the partial delivered via SKILL.md
 * is sufficient to cover all user-facing questions / choices produced by
 * the skill's step instructions.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "../../../../");
const PARTIAL_REL = "src/templates/partials/ai-question-style.md";
const PARTIAL_INCLUDE = '<!-- include("@templates/partials/ai-question-style.md") -->';

const SKILL_FILES = [
  "src/templates/skills/sdd-forge.flow-plan/SKILL.md",
  "src/templates/skills/sdd-forge.flow-impl/SKILL.md",
  "src/templates/skills/sdd-forge.flow-finalize/SKILL.md",
];

describe("spec 204: ai-question-style partial placement", () => {
  it("partial file exists", () => {
    const abs = path.join(REPO_ROOT, PARTIAL_REL);
    assert.ok(fs.existsSync(abs), `expected partial at ${PARTIAL_REL}`);
    const body = fs.readFileSync(abs, "utf8");
    assert.ok(body.length > 0, "partial must be non-empty");
  });

  describe("SKILL.md files include the partial", () => {
    for (const rel of SKILL_FILES) {
      it(rel, () => {
        const abs = path.join(REPO_ROOT, rel);
        const body = fs.readFileSync(abs, "utf8");
        assert.ok(
          body.includes(PARTIAL_INCLUDE),
          `${rel} must contain the include directive for ai-question-style.md`,
        );
      });
    }
  });

  it("partial covers required rule categories with good/bad examples", () => {
    const abs = path.join(REPO_ROOT, PARTIAL_REL);
    const body = fs.readFileSync(abs, "utf8");
    for (const keyword of ["文体", "前提知識", "選択肢"]) {
      assert.ok(body.includes(keyword), `partial must mention category "${keyword}"`);
    }
    assert.ok(/bad|悪い例/i.test(body), "partial must include bad example marker");
    assert.ok(/good|良い例/i.test(body), "partial must include good example marker");
  });
});
