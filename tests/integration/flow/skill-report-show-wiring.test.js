/**
 * Tests for spec 251: finalize is self-contained — the AI no longer runs
 * a separate post-cleanup report command. The cleanup envelope embeds the
 * Report directly via `data.report.text` and the SKILL.md Worktree boundary
 * section instructs the dispatcher to read that field.
 *
 * Replaces the spec 217 wiring tests, which required the legacy multi-step
 * post-cleanup choreography. The legacy MUST line is now removed.
 *
 * Property checked:
 *   1. SKILL.md does NOT carry the legacy report-streaming instruction.
 *   2. Worktree boundary section points the AI at `data.report.text` /
 *      `data.report` for displaying the finalize Report.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SKILL_PATH = path.join(
  process.cwd(),
  "src/skills/sennel.flow/SKILL.md",
);

const LEGACY_INSTRUCTION_PATTERN = /sennel flow report show/;

describe("sennel.flow skill — cleanup envelope wiring (spec 251)", () => {
  const text = fs.readFileSync(SKILL_PATH, "utf8");

  it("SKILL.md does not carry the legacy post-cleanup streaming instruction", () => {
    assert.equal(
      LEGACY_INSTRUCTION_PATTERN.test(text),
      false,
      "legacy report-streaming instruction must be removed from SKILL.md (spec 251 R7 / R14)",
    );
  });

  it("Worktree boundary section directs the AI at the cleanup envelope's report field", () => {
    const match = text.match(/### Worktree boundary\b[\s\S]*?(?=\n### |$)/);
    assert.ok(match, "SKILL.md must contain a '### Worktree boundary' section");
    assert.match(
      match[0],
      /data\.report\.text|data\.report\b/,
      "Worktree boundary section must point the AI at the cleanup envelope's data.report / data.report.text field",
    );
  });
});
