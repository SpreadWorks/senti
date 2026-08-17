// spec: R9
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import * as reviewCommand from "../../../src/flow/commands/review.js";

test("R9: default and configured review exclusions share one matcher before touched-file counting", () => {
  assert.equal(typeof reviewCommand.createReviewExcludeMatcher, "function");
  assert.equal(typeof reviewCommand.resolveReviewExcludePaths, "function");
  assert.equal(typeof reviewCommand.collectTouchedFiles, "function");
  assert.equal(typeof reviewCommand.prepareLoopReviewInputsWithExclusions, "function");

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "senti-review-exclude-"));
  const config = {
    flow: {
      review: {
        excludePaths: ["generated/", "snapshots/*.json"],
      },
    },
  };

  const exclusions = reviewCommand.resolveReviewExcludePaths(config);
  const matcher = reviewCommand.createReviewExcludeMatcher({ root, exclusions });
  const files = [
    "src/a.js",
    "docs/generated.md",
    "generated/client.js",
    "snapshots/state.json",
    "README.md",
  ];

  assert.equal(matcher.excludes("src/a.js"), false);
  assert.equal(matcher.excludes("docs/generated.md"), true);
  assert.equal(matcher.excludes("generated/client.js"), true);
  assert.equal(matcher.excludes("./generated/client.js"), true);
  assert.equal(matcher.excludes(path.join(root, "generated/client.js")), true);
  assert.equal(matcher.excludes("snapshots/state.json"), true);
  assert.equal(matcher.excludes("README.md"), true);
  assert.deepEqual(matcher.filter(files), ["src/a.js"]);

  const prepared = reviewCommand.prepareLoopReviewInputsWithExclusions({
    root,
    config,
    touchedFiles: new Set(files),
    perFileDiffs: new Map(files.map((file) => [file, `diff --git a/${file} b/${file}`])),
    fileToRequirements: new Map(files.map((file) => [file, ["R9"]])),
    maxLoopCalls: 4,
  });

  assert.deepEqual([...prepared.scopedTouchedFiles], ["src/a.js"]);
  assert.deepEqual([...prepared.rawPerFileDiffs.keys()], ["src/a.js"]);
  assert.deepEqual(prepared.groups.flatMap((entry) => entry.files), ["src/a.js"]);
  assert.deepEqual(prepared.reviewChunks.flat(2).flatMap((entry) => entry.files), ["src/a.js"]);
});
