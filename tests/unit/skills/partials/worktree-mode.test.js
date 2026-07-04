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

  it("R5: allows only explicitly targeted parallel prelude during an active worktree flow", () => {
    assert.match(
      text,
      /does not prohibit main-repo prelude commands for a different flow/,
      "partial must allow a separate prelude when the target is explicit",
    );
    assert.match(
      text,
      /explicitly `runId`-targeted/,
      "partial must require explicit runId targeting for parallel prelude",
    );
    assert.match(
      text,
      /Never use implicit current-context flow commands/,
      "partial must still prohibit implicit current-context commands",
    );
  });
});
