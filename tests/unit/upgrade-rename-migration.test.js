import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { RenameMigration } from "../../src/upgrade.js";
import { createTmpDir, removeTmpDir, writeFile } from "../helpers/tmp-dir.js";

describe("RenameMigration", () => {
  it("skips nested node_modules directories", () => {
    const tmp = createTmpDir("senti-upgrade-rename-");
    try {
      const dependencyFile = "src/frontend/node_modules/pkg/sdd-forge-note.js";
      const projectFile = "src/app/sdd-forge-note.js";
      writeFile(tmp, dependencyFile, "const name = 'sdd-forge';\n");
      writeFile(tmp, projectFile, "const name = 'sdd-forge';\n");

      const changed = new RenameMigration(tmp).run();

      assert.equal(fs.existsSync(path.join(tmp, dependencyFile)), true);
      assert.equal(
        fs.readFileSync(path.join(tmp, dependencyFile), "utf8"),
        "const name = 'sdd-forge';\n",
      );
      assert.equal(fs.existsSync(path.join(tmp, "src/app/senti-note.js")), true);
      assert.equal(
        fs.readFileSync(path.join(tmp, "src/app/senti-note.js"), "utf8"),
        "const name = 'senti';\n",
      );
      assert.equal(changed.includes("src/app/senti-note.js"), true);
      assert.equal(changed.some((rel) => rel.includes("node_modules")), false);
    } finally {
      removeTmpDir(tmp);
    }
  });
});
