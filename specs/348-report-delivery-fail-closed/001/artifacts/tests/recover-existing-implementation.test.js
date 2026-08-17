// spec: R6
// The recovery transition refreshes evidence before the report-binding
// freshness requirement is revalidated by the governed implementation path.
import assert from "node:assert/strict";
import { test } from "node:test";

import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import "../../../tests/unit/flow/recover-existing-implementation.test.js";

test("R6: recovery is registered for fresh post-implementation verification", () => {
  assert.ok(FLOW_COMMANDS.run["recover-existing-implementation"]);
});
