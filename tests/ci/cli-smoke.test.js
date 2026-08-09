import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const run = (args) => spawnSync("node", args, { cwd: new URL("../..", import.meta.url), encoding: "utf8" });

test("CLI help, version, and selected test listing are available without credentials", () => {
  for (const args of [["src/senrail.js", "--help"], ["src/senrail.js", "docs", "--help"], ["tests/run.js", "--help"]]) {
    const result = run(args);
    assert.equal(result.status, 0);
  }
  const version = run(["src/senrail.js", "--version"]);
  assert.equal(version.status, 0);
  assert.match(version.stdout, /^0\.1\.0-alpha\.\d+\s*$/);
  const listing = run(["tests/run.js", "--list", "--json", "--scope", "unit"]);
  assert.equal(listing.status, 0);
  assert.equal(JSON.parse(listing.stdout).version, 1);
});
