import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { Envelope } from "../../../src/lib/flow-envelope.js";
import { RunReviewCommand } from "../../../src/flow/lib/run-review.js";
import { CanonicalSpecReview } from "../../../src/flow/lib/spec-review-artifacts.js";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";

const roots = [];
afterEach(() => {
  while (roots.length > 0) removeTmpDir(roots.pop());
});

class BlockingReviewCommand extends RunReviewCommand {
  constructor() {
    super();
    this.calls = 0;
    this.entered = new Promise((resolve) => { this.notifyEntered = resolve; });
    this.release = new Promise((resolve) => { this.unblock = resolve; });
  }

  async executeCanonical() {
    this.calls += 1;
    if (this.calls === 1) {
      this.notifyEntered();
      await this.release;
    }
    return Envelope.ok("run", "review", { providerExecution: this.calls });
  }
}

function reviewContext(root) {
  const review = new CanonicalSpecReview({
    version: 2,
    identity: { specId: "review-admission-spec", revision: 1, digest: "a".repeat(64), byteLength: 0 },
    generation: 0,
    findings: [],
    audit: [],
  });
  const bytes = Buffer.from(`${JSON.stringify(review.toJSON(), null, 2)}\n`, "utf8");
  const state = {
    runId: "review-admission-run",
    current: ["spec-review"],
    attempt: { id: "spec-review-attempt-1", failure: null },
  };
  const flowState = {
    schemaRevision: 3,
    specId: "review-admission-spec",
    currentNodeId: "spec-review",
    currentTaskId: null,
  };
  return {
    root,
    mainRoot: root,
    executionRoot: root,
    phase: "spec",
    specId: "review-admission-spec",
    flowState,
    flowManager: {
      canonicalState: () => state,
      loadReadOnly: () => flowState,
      activityLedger: () => [],
      readCurrentSpecReview: () => ({
        revision: 1,
        review,
        bytes,
        descriptor: { logicalKey: "spec.review", relativePath: "revisions/001/review.json", hash: review.digest, size: bytes.length },
      }),
      readArtifact: () => null,
      readProducerArtifact: () => null,
      publishArtifacts: () => { throw new Error("admission must not publish artifacts"); },
    },
  };
}

describe("RunReviewCommand execution admission", () => {
  it("admits one provider execution when direct and dispatcher review calls overlap", async () => {
    const root = createTmpDir("run-review-execution-admission-");
    roots.push(root);
    const command = new BlockingReviewCommand();
    const direct = command.execute(reviewContext(root));
    await command.entered;

    // Dispatch resolves the same registered run-review command, so its call
    // must share the direct command's run/node/Attempt lease.
    const dispatched = await command.execute(reviewContext(root));
    assert.equal(dispatched.ok, false);
    assert.equal(dispatched.errors[0].code, "REVIEW_EXECUTION_BUSY");
    assert.equal(command.calls, 1);

    command.unblock();
    const completed = await direct;
    assert.equal(completed.ok, true);
    assert.equal(command.calls, 1);
  });
});
