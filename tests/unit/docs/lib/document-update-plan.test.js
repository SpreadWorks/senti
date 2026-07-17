import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  DocumentUpdatePlan,
  DocumentUpdateTransaction,
  DocumentValidationResult,
} from "../../../../src/docs/lib/document-update-plan.js";
import { createTmpDir, removeTmpDir } from "../../../helpers/tmp-dir.js";

function plan(filePath, before, after, validationResult = DocumentValidationResult.accepted()) {
  return new DocumentUpdatePlan({
    filePath,
    originalBytes: Buffer.from(before),
    proposedBytes: Buffer.from(after),
    validationResult,
  });
}

describe("DocumentUpdateTransaction", () => {
  it("retains immutable before/proposed bytes and validation", () => {
    const update = plan("/tmp/example.md", "before", "after");
    const original = update.originalBytes;
    original.fill(0);

    assert.equal(update.originalBytes.toString(), "before");
    assert.equal(update.proposedBytes.toString(), "after");
    assert.equal(update.validationResult.ok, true);
  });

  it("rolls every document back to byte-identical input when a later commit fails", () => {
    const root = createTmpDir("document-update-rollback-");
    try {
      const first = path.join(root, "first.md");
      const second = path.join(root, "second.md");
      fs.writeFileSync(first, "first-before\n");
      fs.writeFileSync(second, "second-before\n");
      const transaction = new DocumentUpdateTransaction([
        plan(first, "first-before\n", "first-after\n"),
        plan(second, "second-before\n", "second-after\n"),
      ], {
        faultInjector(event) {
          if (event.filePath === second && event.phase === "before-file-rename") {
            throw new Error("second commit failed");
          }
        },
      });

      assert.throws(() => transaction.commit(), /second commit failed/);
      assert.equal(fs.readFileSync(first, "utf8"), "first-before\n");
      assert.equal(fs.readFileSync(second, "utf8"), "second-before\n");
      assert.deepEqual(fs.readdirSync(root).sort(), ["first.md", "second.md"]);
    } finally {
      removeTmpDir(root);
    }
  });

  it("rejects the whole transaction before writing when validation fails", () => {
    const root = createTmpDir("document-update-validation-");
    try {
      const first = path.join(root, "first.md");
      const second = path.join(root, "second.md");
      fs.writeFileSync(first, "first-before\n");
      fs.writeFileSync(second, "second-before\n");
      const transaction = new DocumentUpdateTransaction([
        plan(first, "first-before\n", "first-after\n"),
        plan(
          second,
          "second-before\n",
          "second-after\n",
          DocumentValidationResult.rejected("invalid agent response"),
        ),
      ]);

      assert.throws(() => transaction.commit(), /invalid agent response/);
      assert.equal(fs.readFileSync(first, "utf8"), "first-before\n");
      assert.equal(fs.readFileSync(second, "utf8"), "second-before\n");
    } finally {
      removeTmpDir(root);
    }
  });
});
