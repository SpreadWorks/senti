import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PARTIAL_PATH = path.resolve(
  __dirname,
  "../../../src/templates/partials/ai-question-style.md",
);

describe("templates/partials/ai-question-style.md — recommended option placement", () => {
  const text = fs.readFileSync(PARTIAL_PATH, "utf8");

  it("has a § 3 Choice Presentation section", () => {
    assert.match(text, /###\s*3\.\s*選択肢提示/);
  });

  it("R1: requires the recommended option at [1] when one exists", () => {
    // Rule fires only when a recommendation exists, and mandates id [1].
    // Must mention [1] and the recommendation condition.
    assert.match(
      text,
      /推奨案.*\[1\]|`\[1\]`.*推奨/s,
      "partial must state that the recommended option is placed at [1]",
    );
  });

  it("R2: addresses the tie case and requires one tied top to be at [1]", () => {
    assert.match(
      text,
      /同率|僅差|tie/,
      "partial must mention the tie case for top recommendations",
    );
  });

  it("R3: the placement rule is conditional on a recommendation existing", () => {
    // Conditional phrasing: "推奨案がある場合" / "when a recommendation exists" etc.
    assert.match(
      text,
      /推奨案がある場合|推奨が(?:ある|存在する)場合|when\s+a\s+recommend/i,
      "partial must express the rule conditionally on having a recommendation",
    );
  });
});
