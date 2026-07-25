// spec: R7
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const SENTI = join(process.cwd(), "src/senti.js");

test("R7: parked resume shared help retains its no-discovery guarantee and guards", () => {
  const help = execFileSync(
    process.execPath,
    [SENTI, "flow", "resume", "--help"],
    { encoding: "utf8" },
  );

  assert.match(help, /Usage: senti flow resume/);
  assert.match(
    help,
    /--parked restores one exact inactive managed-worktree pointer with no discovery/i,
  );
  assert.match(help, /--expect-run-id/);
  assert.match(help, /--expect-spec/);
  assert.match(help, /--expect-issue|--expect-no-issue/);
});
