import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(__dirname, "../../../src");

describe("upgrade experimental skill template path", () => {
  it("expDir should be resolved relative to PKG_DIR, not project root", () => {
    const upgradeSource = fs.readFileSync(path.join(SRC_DIR, "upgrade.js"), "utf8");

    // The path must NOT use `root` as base for experimental templates
    assert.ok(
      !upgradeSource.includes('path.join(root, "experimental"'),
      "expDir should not be resolved relative to project root"
    );
  });

  it("expDir target directory should exist in the package", () => {
    // PKG_DIR is src/ directory. Resolve the real path to handle worktree symlinks.
    const realSrcDir = fs.realpathSync(SRC_DIR);
    const expDir = path.join(realSrcDir, "..", "experimental", "workflow", "templates", "skills");
    assert.ok(
      fs.existsSync(expDir),
      `experimental skill templates directory should exist at: ${expDir}`
    );
  });

  it("PKG_DIR should be imported in upgrade.js", () => {
    const upgradeSource = fs.readFileSync(path.join(SRC_DIR, "upgrade.js"), "utf8");
    assert.ok(
      upgradeSource.includes("PKG_DIR"),
      "upgrade.js should import PKG_DIR from lib/cli.js"
    );
  });
});
