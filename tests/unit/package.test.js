import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "child_process";

describe("npm pack contents", () => {
  let packOutput;

  // Run npm pack --dry-run once for all tests (file listing goes to stderr)
  it("runs npm pack --dry-run successfully", () => {
    packOutput = execSync("npm pack --dry-run 2>&1", {
      encoding: "utf8",
      cwd: process.cwd(),
    });
    assert.ok(packOutput.length > 0, "pack output should not be empty");
  });

  it("includes package.json", () => {
    assert.ok(packOutput, "pack output required");
    assert.match(packOutput, /package\.json/);
  });

  it("includes src/ directory files", () => {
    assert.ok(packOutput, "pack output required");
    assert.match(packOutput, /src\/senti\.js/);
    assert.match(packOutput, /src\/lib\/i18n\.js/);
  });

  it("includes locale files", () => {
    assert.ok(packOutput, "pack output required");
    assert.match(packOutput, /src\/locale\//);
  });

  it("does NOT include tests/", () => {
    assert.ok(packOutput, "pack output required");
    assert.doesNotMatch(packOutput, /\btests\//);
  });

  it("does NOT include .senti/", () => {
    assert.ok(packOutput, "pack output required");
    assert.doesNotMatch(packOutput, /\.senti\//);
  });

  it("does NOT include top-level specs/ directory", () => {
    assert.ok(packOutput, "pack output required");
    // src/specs/ is expected (CLI commands), but top-level specs/ (project specs) should not be included
    const lines = packOutput.split("\n").filter((l) => l.includes("specs/"));
    const nonSrcSpecs = lines.filter((l) => !l.includes("src/specs/"));
    assert.strictEqual(nonSrcSpecs.length, 0, `unexpected specs/ entries: ${nonSrcSpecs.join(", ")}`);
  });
});
