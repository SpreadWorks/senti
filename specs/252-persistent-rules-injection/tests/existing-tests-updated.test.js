// spec: R21
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..", "..");

test("R21: existing next-action tests no longer require byte-equality of instructions.content against the prompt file when rules match", () => {
  const targets = ["tests/unit/flow/get-next-action.test.js", "tests/unit/flow/instructions-content.test.js"];
  for (const rel of targets) {
    const file = path.join(repoRoot, rel);
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, "utf8");
    const hasOldEquality = /assert\.equal\([^,]+\.instructions\.content,\s*readFileSync/.test(content);
    assert.ok(!hasOldEquality, `${rel} still asserts byte-equal against on-disk prompt; must use endsWith / suffix`);
  }
});
