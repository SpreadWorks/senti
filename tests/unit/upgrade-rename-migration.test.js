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
      const legacyName = ["senti", "forge"].join("-");
      const currentName = "senti";
      const dependencyFile = `src/frontend/node_modules/pkg/${legacyName}-note.js`;
      const projectFile = `src/app/${legacyName}-note.js`;
      const migratedProjectFile = `src/app/${currentName}-note.js`;
      writeFile(tmp, dependencyFile, `const name = '${legacyName}';\n`);
      writeFile(tmp, projectFile, `const name = '${legacyName}';\n`);

      const changed = new RenameMigration(tmp).run();

      assert.equal(fs.existsSync(path.join(tmp, dependencyFile)), true);
      assert.equal(
        fs.readFileSync(path.join(tmp, dependencyFile), "utf8"),
        `const name = '${legacyName}';\n`,
      );
      assert.equal(fs.existsSync(path.join(tmp, migratedProjectFile)), true);
      assert.equal(
        fs.readFileSync(path.join(tmp, migratedProjectFile), "utf8"),
        `const name = '${currentName}';\n`,
      );
      assert.equal(changed.includes(migratedProjectFile), true);
      assert.equal(changed.some((rel) => rel.includes("node_modules")), false);
    } finally {
      removeTmpDir(tmp);
    }
  });
});
