import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";
import { assertGitWriteAccess } from "../../../src/flow/lib/run-finalize.js";

describe("run-finalize preflight", () => {
  it("assertGitWriteAccess succeeds when git dir is writable", async () => {
    const tmp = createTmpDir("finalize-preflight-ok-");
    try {
      await assertGitWriteAccess(tmp);
    } finally {
      removeTmpDir(tmp);
    }
  });

  it("assertGitWriteAccess throws help message when git dir is not writable", async () => {
    const tmp = createTmpDir("finalize-preflight-ro-");
    try {
      fs.chmodSync(tmp, 0o555);
      await assert.rejects(
        assertGitWriteAccess(tmp),
        (err) => {
          assert.equal(err.code, "FINALIZE_PREFLIGHT_FAILED");
          assert.match(err.message, /Help:/);
          assert.match(err.message, /flow run finalize-commit --help/);
          return true;
        },
      );
    } finally {
      fs.chmodSync(tmp, 0o755);
      removeTmpDir(tmp);
    }
  });

  it("run-finalize execute uses preflight before step execution", () => {
    const file = path.join(process.cwd(), "src/flow/lib/run-finalize.js");
    const source = fs.readFileSync(file, "utf8");
    assert.match(source, /runFinalizePreflight\(root\)/);
  });
});
