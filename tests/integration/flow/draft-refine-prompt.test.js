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

test("manual draft refinement still surfaces genuine user judgment", () => {
  assert.match(
    prompt,
    /When `autoApprove` is not true and user judgment is required, ask the user/,
  );
});
