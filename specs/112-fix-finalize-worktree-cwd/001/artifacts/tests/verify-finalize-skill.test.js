import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const SKILL = path.join(ROOT, "src/templates/skills/sdd-forge.flow-finalize/SKILL.md");

describe("flow-finalize SKILL.md worktree instructions", () => {
  const content = fs.readFileSync(SKILL, "utf8");

  it("does NOT instruct to change cwd to main repo before finalize", () => {
    assert.ok(
      !content.includes("change the working directory to the main repository path"),
      "should not contain old instruction to cd to main repo"
    );
  });

  it("instructs to run finalize from worktree and cd back after", () => {
    assert.ok(
      content.includes("cd") && content.includes("mainRepoPath"),
      "should instruct to cd to mainRepoPath after finalize"
    );
  });

  it("instructs foreground execution", () => {
    assert.ok(
      content.toLowerCase().includes("foreground") || content.includes("Do NOT run in background"),
      "should instruct foreground execution"
    );
  });
});
