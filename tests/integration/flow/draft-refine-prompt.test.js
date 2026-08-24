import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";

const prompt = fs.readFileSync(
  path.resolve("src/flow/prompts/plan/draft-refine.md"),
  "utf8",
);

test("autoApprove draft refinement resolves non-destructive questions without stopping", () => {
  assert.match(prompt, /When `autoApprove: true`, do not ask the user or stop/);
  assert.match(prompt, /never describe an automatic resolution as a user selection/);
  assert.match(prompt, /Only an irreversible action or a choice that changes the user-requested goal or scope may remain blocked/);
});

test("manual draft refinement never moves the user boundary into its worker", () => {
  assert.match(
    prompt,
    /unresolved entries are a dispatcher\/worker contract violation/,
  );
  assert.match(prompt, /do not ask the user from this non-interactive worker/);
});
