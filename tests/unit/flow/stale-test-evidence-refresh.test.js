import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";

import { StaleTestEvidenceRefresh } from "../../../src/flow/lib/stale-test-evidence-refresh.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../helpers/tmp-dir.js";

let tmp;

afterEach(() => {
  if (tmp) removeTmpDir(tmp);
  tmp = null;
});

test("stale evidence refresh rejects additional artifact paths outside the spec directory", () => {
  tmp = createTmpDir("stale-test-evidence-refresh-");
  const specDir = path.join(tmp, "specs", "demo");
  const outsidePath = path.join(tmp, "outside.json");
  writeFile(tmp, "outside.json", "{}\n");
  const refresh = new StaleTestEvidenceRefresh({
    previousFingerprint: "a".repeat(64),
    currentFingerprint: "b".repeat(64),
  });
  const flowManager = {
    mutate() {
      assert.fail("invalid additional artifacts must be rejected before flow mutation");
    },
  };

  for (const relativePath of ["../../outside.json", outsidePath]) {
    assert.throws(
      () => refresh.recover({
        specDir,
        flowManager,
        reason: "test stale evidence",
        additionalArtifacts: [relativePath],
      }),
      /additionalArtifacts\[0\] must (?:be relative to|stay inside) the spec directory/,
    );
    assert.equal(fs.existsSync(outsidePath), true);
  }
});
