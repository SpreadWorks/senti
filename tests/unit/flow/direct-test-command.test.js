import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runDirectTestCommand } from "../../../src/flow/lib/direct-test-command.js";

describe("direct deterministic test diagnostics", () => {
  it("retains both stderr and stdout when a command fails", () => {
    const command = [
      "node -e",
      JSON.stringify(
        "process.stdout.write('actual assertion failure\\n');"
        + "process.stderr.write('wrapper failure\\n');"
        + "process.exit(1);",
      ),
    ].join(" ");
    const result = runDirectTestCommand(process.cwd(), command, 10_000);

    assert.equal(result.status, "failed");
    assert.match(result.detail, /stderr:\nwrapper failure/);
    assert.match(result.detail, /stdout:\nactual assertion failure/);
  });
});
