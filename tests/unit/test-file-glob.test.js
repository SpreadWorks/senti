import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { globFilesSync } from "../helpers/test-file-glob.js";

describe("globFilesSync", () => {
  let root;

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true });
    root = null;
  });

  function fixture() {
    root = mkdtempSync(join(tmpdir(), "senti-test-glob-"));
    mkdirSync(join(root, "nested"), { recursive: true });
    writeFileSync(join(root, "top.test.js"), "");
    writeFileSync(join(root, "top.txt"), "");
    writeFileSync(join(root, "nested", "deep.test.js"), "");
  }

  it("returns repository-relative matches for a relative double-star pattern", () => {
    fixture();
    assert.deepEqual(
      globFilesSync("**/*.test.js", { cwd: root }),
      ["nested/deep.test.js", "top.test.js"],
    );
  });

  it("returns absolute matches for an absolute pattern", () => {
    fixture();
    assert.deepEqual(
      globFilesSync(join(root, "*.test.js"), { cwd: root }),
      [join(root, "top.test.js")],
    );
  });

  it("returns an empty list when the static traversal root does not exist", () => {
    fixture();
    assert.deepEqual(globFilesSync("missing/*.test.js", { cwd: root }), []);
  });

  it("fails closed when the traversal entry bound is exceeded", () => {
    fixture();
    assert.throws(
      () => globFilesSync("**/*.test.js", { cwd: root, maxEntries: 1 }),
      /glob traversal entry limit exceeded/,
    );
  });
});
