import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { FileTreeWalker, ScanPolicy } from "../../../src/lib/file-tree-walker.js";
import { createTmpDir, removeTmpDir, writeFile } from "../../helpers/tmp-dir.js";

describe("FileTreeWalker", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("uses an immutable scan policy", () => {
    const policy = new ScanPolicy({ maxDepth: 4, maxDirectoryEntries: 8, maxFiles: 2 });
    assert.equal(Object.isFrozen(policy), true);
    assert.throws(() => { policy.maxFiles = 3; }, TypeError);
  });

  it("reports an empty tree as complete", () => {
    tmp = createTmpDir();
    const result = new FileTreeWalker(new ScanPolicy({ maxFiles: 2 })).walk(tmp);
    assert.deepEqual(result.files, []);
    assert.equal(result.complete, true);
  });

  it("remains complete immediately before and exactly at the file limit", () => {
    tmp = createTmpDir();
    writeFile(tmp, "a.js", "a");
    const walker = new FileTreeWalker(new ScanPolicy({ maxFiles: 2 }));
    assert.equal(walker.walk(tmp).complete, true);

    writeFile(tmp, "b.js", "b");
    const atLimit = walker.walk(tmp);
    assert.deepEqual(atLimit.files, ["a.js", "b.js"]);
    assert.equal(atLimit.complete, true);
  });

  it("reports indeterminate immediately after the file limit", () => {
    tmp = createTmpDir();
    writeFile(tmp, "a.js", "a");
    writeFile(tmp, "b.js", "b");
    writeFile(tmp, "c.js", "c");
    const result = new FileTreeWalker(new ScanPolicy({ maxFiles: 2 })).walk(tmp);

    assert.deepEqual(result.files, ["a.js", "b.js"]);
    assert.equal(result.complete, false);
    assert.match(result.describeLimits(), /files limit 2/);
  });
});
