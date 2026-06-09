/**
 * tests/unit/flow/run-finalize-pointer.test.js
 *
 * Covers AC4 of spec 211: finalize cleanup writes the latest finalized spec
 * path to `.senti/last-finalized-spec` in the main repo.
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

  it("writes pointer with trailing newline under .senti/", () => {
    tmp = createTmpDir("senti-finalize-ptr-");
    const specRel = "specs/042-example-feature/spec.json";

    writeLastFinalizedPointer(tmp, specRel);

    const pointerPath = path.join(tmp, ".senti", "last-finalized-spec");
    assert.ok(fs.existsSync(pointerPath));
    assert.equal(fs.readFileSync(pointerPath, "utf8"), specRel + "\n");
  });

  it("creates .senti/ when missing", () => {
    tmp = createTmpDir("senti-finalize-ptr-mkdir-");
    assert.ok(!fs.existsSync(path.join(tmp, ".senti")));

    writeLastFinalizedPointer(tmp, "specs/001-x/spec.json");

    assert.ok(fs.existsSync(path.join(tmp, ".senti", "last-finalized-spec")));
  });

  it("overwrites previous pointer on subsequent finalize runs", () => {
    tmp = createTmpDir("senti-finalize-ptr-overwrite-");
    writeLastFinalizedPointer(tmp, "specs/001-old/spec.json");
    writeLastFinalizedPointer(tmp, "specs/002-new/spec.json");

    const pointerPath = path.join(tmp, ".senti", "last-finalized-spec");
    assert.equal(
      fs.readFileSync(pointerPath, "utf8"),
      "specs/002-new/spec.json\n",
    );
  });

  it("is a no-op when targetRoot or specPath is missing", () => {
    tmp = createTmpDir("senti-finalize-ptr-noop-");
    writeLastFinalizedPointer("", "specs/001/spec.json");
    writeLastFinalizedPointer(tmp, "");
    assert.ok(!fs.existsSync(path.join(tmp, ".senti", "last-finalized-spec")));
  });
});
