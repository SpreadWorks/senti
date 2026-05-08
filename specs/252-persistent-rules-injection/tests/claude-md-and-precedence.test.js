// spec: R14 R15
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");

test("R14: project CLAUDE.md contains the AI 協働原則 section with 6 exact sub-headings", () => {
  const claudeMd = path.join(repoRoot, "CLAUDE.md");
  if (!fs.existsSync(claudeMd)) {
    assert.fail("CLAUDE.md does not exist at project root");
  }
  const content = fs.readFileSync(claudeMd, "utf8");
  const headingIdx = content.indexOf("## AI との協働原則");
  assert.ok(headingIdx >= 0, "CLAUDE.md must contain the literal heading `## AI との協働原則`");
  const after = content.slice(headingIdx);
  const expectedSubs = [
    "### 一貫したコミュニケーション",
    "### 独立分析",
    "### AI 判断権の限界",
    "### ファシリテートのキャッチボール",
    "### 過去判断の推測禁止",
    "### 指示なしに行動しない",
  ];
  for (const sub of expectedSubs) {
    assert.match(after, new RegExp(sub.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")), `missing sub-heading: ${sub}`);
  }
  const subCount = (after.match(/^### /gm) || []).length;
  assert.equal(subCount, 6, `expected exactly 6 ### sub-headings under the section, got ${subCount}`);
});

test("R15: partials/core-principle.md contains the skill > memory precedence statement", () => {
  const partial = path.join(repoRoot, "src/templates/partials/core-principle.md");
  const content = fs.readFileSync(partial, "utf8");
  assert.match(content, /\*\*MUST: When a rule in this skill conflicts with a memory entry/);
  assert.match(content, /the skill rule takes precedence/);
});
