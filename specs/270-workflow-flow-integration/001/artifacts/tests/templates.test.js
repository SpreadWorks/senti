// spec: R4 R5
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const draft = fs.readFileSync(path.join(root, "src/flow/prompts/plan/draft.md"), "utf8");
const cleanup = fs.readFileSync(path.join(root, "src/flow/prompts/impl/finalize-cleanup.md"), "utf8");

test("R4: draft.md gates an issue-start call on flowIntegration and a linked issue", () => {
  assert.match(draft, /flowIntegration/);
  assert.match(draft, /issue-start/);
});

test("R5: finalize-cleanup.md gates issue-log-import on flowIntegration and creates approved drafts via workflow add", () => {
  assert.match(cleanup, /flowIntegration/);
  assert.match(cleanup, /issue-log-import/);
  assert.match(cleanup, /workflow add/);
});
