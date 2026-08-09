import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { deployPresetCopies } from "../../../src/lib/preset-deploy.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

test("deployPresetCopies writes bundled base artifacts under the canonical managed directory", () => {
  const root = createTmpDir("senrail-preset-deploy-");
  try {
    const copied = deployPresetCopies(root);
    const destination = path.join(root, ".senrail", "presets", "base");

    assert.deepEqual(copied.sort(), [
      path.join(destination, "guardrail-rewrite-rubric.md"),
      path.join(destination, "guardrail.json"),
    ].sort());
    assert.equal(fs.existsSync(path.join(destination, "guardrail.json")), true);
    assert.equal(fs.existsSync(path.join(destination, "guardrail-rewrite-rubric.md")), true);
    assert.equal(fs.existsSync(path.join(root, `.${"sen" + "ti"}`)), false);
  } finally {
    removeTmpDir(root);
  }
});
