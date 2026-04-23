/**
 * Tests for spec 217 (Issue #225 follow-up): the sdd-forge.flow skill template
 * must carry a MUST-level instruction to run `sdd-forge flow report show` after
 * finalize completes. Without this, AI clients that read the skill directly —
 * bypassing the dispatcher prompt (`src/flow/prompts/impl/finalize.md`) — lose
 * the Report display step.
 *
 * REQ-1: The skill template at src/templates/skills/sdd-forge.flow/SKILL.md
 *        contains the literal string `sdd-forge flow report show`.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SKILL_PATH = path.join(
  process.cwd(),
  "src/templates/skills/sdd-forge.flow/SKILL.md",
);

describe("sdd-forge.flow skill — report-show wiring (spec 217 REQ-1)", () => {
  it("SKILL.md template exists", () => {
    assert.ok(fs.existsSync(SKILL_PATH), `SKILL.md must exist at ${SKILL_PATH}`);
  });

  it("SKILL.md mentions `sdd-forge flow report show` at least once", () => {
    const text = fs.readFileSync(SKILL_PATH, "utf8");
    const matches = text.match(/sdd-forge flow report show/g) || [];
    assert.ok(
      matches.length >= 1,
      `SKILL.md must reference \`sdd-forge flow report show\` at least once (found ${matches.length})`,
    );
  });

  it("the report-show reference is anchored to the Worktree boundary section", () => {
    const text = fs.readFileSync(SKILL_PATH, "utf8");
    // Extract Worktree boundary section: from "### Worktree boundary" up to
    // the next "### " heading (or end of file).
    const match = text.match(/### Worktree boundary\b[\s\S]*?(?=\n### |\Z)/);
    assert.ok(match, "SKILL.md must contain a '### Worktree boundary' section");
    assert.match(
      match[0],
      /sdd-forge flow report show/,
      "Worktree boundary section must reference `sdd-forge flow report show`",
    );
  });

  it("the report-show instruction is framed as a MUST", () => {
    const text = fs.readFileSync(SKILL_PATH, "utf8");
    // The line (or bullet) that mentions `sdd-forge flow report show` must be
    // within a block introduced by **MUST** so AI clients treat it as mandatory.
    // Accept MUST either on the same line or on an immediately preceding bullet.
    const lines = text.split("\n");
    const reportLines = lines
      .map((l, i) => ({ l, i }))
      .filter((x) => /sdd-forge flow report show/.test(x.l));
    assert.ok(reportLines.length >= 1, "expected at least one matching line");
    const anyMust = reportLines.some(({ i }) => {
      // search the line itself plus the 3 lines before it for **MUST**
      const start = Math.max(0, i - 3);
      const windowText = lines.slice(start, i + 1).join("\n");
      return /\*\*MUST\*?\*?/.test(windowText) || /\bMUST\b/.test(windowText);
    });
    assert.ok(
      anyMust,
      "report-show reference in SKILL.md must be framed as MUST (either inline or on a preceding bullet)",
    );
  });
});
