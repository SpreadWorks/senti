import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PARTIAL_PATH = path.resolve(
  __dirname,
  "../../../../src/skills/partials/worktree-mode.md",
);

describe("skills/partials/worktree-mode.md — Edit/Write absolute path guard", () => {
  const text = fs.readFileSync(PARTIAL_PATH, "utf8");

  it("R1: contains a MUST line prohibiting main repo absolute paths in Edit/Write", () => {
    assert.match(
      text,
      /\*\*MUST[^*]*main repo[^*]*Edit\/Write[^*]*\*\*|\*\*MUST[^*]*Edit\/Write[^*]*main repo[^*]*\*\*/,
      "partial must state that main repo absolute paths are forbidden in Edit/Write tool calls",
    );
  });

  it("R2: names `worktreePath` from `flow get resolve-context` as the allowed absolute-path source", () => {
    assert.match(
      text,
      /worktreePath/,
      "partial must mention the worktreePath obtained via flow get resolve-context",
    );
    assert.match(
      text,
      /resolve-context/,
      "partial must reference `senti flow get resolve-context` as the source of worktreePath",
    );
  });

  it("R2: names the worktree cwd relative path as an allowed alternative", () => {
    assert.match(
      text,
      /相対パス|relative path/i,
      "partial must mention a worktree-cwd relative path as an allowed alternative",
    );
  });

  it("R4: preserves the three existing MUST lines (cd / git stash / baseline)", () => {
    assert.match(text, /cd/, "existing cd-prohibition MUST line must remain");
    assert.match(
      text,
      /git stash/,
      "existing git-stash-prohibition MUST line must remain",
    );
    assert.match(
      text,
      /detached worktree/,
      "existing baseline-comparison MUST line must remain",
    );
  });

  it("R5: prohibits starting a different flow during an active worktree flow", () => {
    assert.match(
      text,
      /different Issue\/spec flow/,
      "partial must prohibit starting another target while a worktree flow is active",
    );
    assert.match(
      text,
      /senti flow prepare --run-id <runId>/,
      "partial must name runId-based prepare as unsafe during active worktree flow",
    );
  });
});
