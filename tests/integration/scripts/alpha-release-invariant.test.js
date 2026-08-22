import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  AlphaReleasePreflight,
  AlphaReleaseSynchronizer,
  AlphaReleaseValidator,
} from "../../../scripts/alpha-release.js";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";

const validateScript = path.resolve("scripts/validate-alpha-version.js");
const preflightScript = path.resolve("scripts/release-preflight.js");
const projectPackage = path.resolve("package.json");

function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

function writePackage(root, version) {
  fs.writeFileSync(path.join(root, "package.json"), `${JSON.stringify({
    name: "alpha-release-fixture",
    version,
  }, null, 2)}\n`);
}

function initializeRepository(root, version) {
  git(root, ["init", "--quiet"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "Test User"]);
  writePackage(root, version);
  git(root, ["add", "package.json"]);
  git(root, ["commit", "--quiet", "-m", "initial package"]);
}

function withRepository(version, callback) {
  const root = createTmpDir("alpha-release-");
  try {
    initializeRepository(root, version);
    return callback(root);
  } finally {
    removeTmpDir(root);
  }
}

describe("alpha release version invariant", () => {
  it("exposes synchronization, validation, and preflight as package scripts", () => {
    const scripts = JSON.parse(fs.readFileSync(projectPackage, "utf8")).scripts;
    assert.equal(scripts["release:version:sync"], "node scripts/sync-alpha-version.js");
    assert.equal(scripts["release:version:validate"], "node scripts/validate-alpha-version.js");
    assert.equal(scripts["release:preflight"], "node scripts/release-preflight.js");
  });

  it("accepts only 0.1.0-alpha.N whose N equals the release HEAD count", () => {
    withRepository("0.1.0-alpha.1", (root) => {
      const invariant = new AlphaReleaseValidator(root).validate();
      assert.equal(invariant.version.toString(), "0.1.0-alpha.1");
      assert.equal(invariant.commitCount.value, 1);
    });
  });

  it("rejects malformed alpha versions and commit-count mismatches", () => {
    withRepository("0.1.0-alpha.1", (root) => {
      writePackage(root, "0.1.0");
      assert.throws(() => new AlphaReleaseValidator(root).validate(), /0\.1\.0-alpha\.N/);

      writePackage(root, "0.1.0-alpha.2");
      assert.throws(() => new AlphaReleaseValidator(root).validate(), /HEAD commit count 1/);
    });
  });

  it("release preflight invokes the same validator", () => {
    withRepository("0.1.0-alpha.1", (root) => {
      const invariant = new AlphaReleasePreflight(root).run();
      assert.equal(invariant.commitCount.value, 1);

      writePackage(root, "invalid");
      assert.throws(() => new AlphaReleasePreflight(root).run(), /0\.1\.0-alpha\.N/);
    });
  });

  it("synchronizes once for the dedicated final commit and then validates that HEAD", () => {
    withRepository("0.1.0-alpha.0", (root) => {
      const synchronized = new AlphaReleaseSynchronizer(root).synchronize();
      assert.equal(synchronized.status, "updated");
      assert.equal(synchronized.version.toString(), "0.1.0-alpha.2");
      assert.equal(git(root, ["status", "--short"]), "M package.json");

      git(root, ["add", "package.json"]);
      git(root, ["commit", "--quiet", "-m", "chore: synchronize alpha version"]);
      assert.equal(new AlphaReleaseValidator(root).validate().commitCount.value, 2);

      const repeated = new AlphaReleaseSynchronizer(root).synchronize();
      assert.equal(repeated.status, "already_synchronized");
      assert.equal(git(root, ["status", "--short"]), "");
    });
  });

  it("refuses synchronization when the release target worktree is dirty", () => {
    withRepository("0.1.0-alpha.0", (root) => {
      fs.writeFileSync(path.join(root, "unrelated.txt"), "dirty\n");
      assert.throws(() => new AlphaReleaseSynchronizer(root).synchronize(), /clean worktree/);
      assert.equal(JSON.parse(fs.readFileSync(path.join(root, "package.json"))).version, "0.1.0-alpha.0");
    });
  });

  it("exposes validation through release scripts", () => {
    withRepository("0.1.0-alpha.1", (root) => {
      const validate = spawnSync(process.execPath, [validateScript], { cwd: root, encoding: "utf8" });
      assert.equal(validate.status, 0, validate.stderr);

      const preflight = spawnSync(process.execPath, [preflightScript], { cwd: root, encoding: "utf8" });
      assert.equal(preflight.status, 0, preflight.stderr);

      writePackage(root, "0.1.0-alpha.999");
      const failed = spawnSync(process.execPath, [preflightScript], { cwd: root, encoding: "utf8" });
      assert.notEqual(failed.status, 0);
      assert.match(failed.stderr, /HEAD commit count 1/);
    });
  });
});
