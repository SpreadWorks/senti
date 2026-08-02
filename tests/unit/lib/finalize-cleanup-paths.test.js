import assert from "node:assert/strict";
import { test } from "node:test";

import { FinalizeCleanupRoute } from "../../../src/lib/finalize-cleanup-paths.js";

test("finalize cleanup command and dispatcher share one destructive route contract", () => {
  assert.equal(
    FinalizeCleanupRoute
      .fromCliArgs(["flow", "run", "finalize-cleanup"])
      .removesManagedWorktree,
    true,
  );
  assert.equal(
    FinalizeCleanupRoute.fromDispatch({ envelopeKey: "finalize-cleanup" }).removesManagedWorktree,
    true,
  );
});
