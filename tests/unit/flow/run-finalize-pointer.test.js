/**
 * tests/unit/flow/run-finalize-pointer.test.js
 *
 * Covers AC4 of spec 211: finalize cleanup writes the latest finalized spec
 * ID to `.sennel/last-finalized-spec` in the main repo.
 */

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { writeLastFinalizedPointer } from "../../../src/flow/lib/run-finalize.js";

describe("flow finalize — last-finalized-spec pointer (AC4)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("writes pointer with trailing newline under .sennel/", () => {
    tmp = createTmpDir("sennel-finalize-ptr-");
    const specId = "042-example-feature";

    writeLastFinalizedPointer(tmp, specId);

    const pointerPath = path.join(tmp, ".sennel", "last-finalized-spec");
    assert.ok(fs.existsSync(pointerPath));
    assert.equal(fs.readFileSync(pointerPath, "utf8"), specId + "\n");
  });

  it("creates .sennel/ when missing", () => {
    tmp = createTmpDir("sennel-finalize-ptr-mkdir-");
    assert.ok(!fs.existsSync(path.join(tmp, ".sennel")));

    writeLastFinalizedPointer(tmp, "001-x");

    assert.ok(fs.existsSync(path.join(tmp, ".sennel", "last-finalized-spec")));
  });

  it("overwrites previous pointer on subsequent finalize runs", () => {
    tmp = createTmpDir("sennel-finalize-ptr-overwrite-");
    writeLastFinalizedPointer(tmp, "001-old");
    writeLastFinalizedPointer(tmp, "002-new");

    const pointerPath = path.join(tmp, ".sennel", "last-finalized-spec");
    assert.equal(
      fs.readFileSync(pointerPath, "utf8"),
      "002-new\n",
    );
  });

  it("is a no-op when targetRoot or specId is missing", () => {
    tmp = createTmpDir("sennel-finalize-ptr-noop-");
    writeLastFinalizedPointer("", "001");
    writeLastFinalizedPointer(tmp, "");
    assert.ok(!fs.existsSync(path.join(tmp, ".sennel", "last-finalized-spec")));
  });
});
