import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import {
  AlphaReleaseArguments,
  AlphaReleasePackInspection,
  AlphaReleasePackInspector,
  AlphaReleasePublisher,
  AlphaReleasePreflight,
  AlphaReleaseSynchronizer,
  AlphaReleaseValidator,
} from "../../../scripts/alpha-release.js";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";

const validateScript = path.resolve("scripts/validate-alpha-version.js");
const preflightScript = path.resolve("scripts/release-preflight.js");
const verifyScript = path.resolve("scripts/verify-alpha-release.js");
const packScript = path.resolve("scripts/inspect-alpha-pack.js");
const publishScript = path.resolve("scripts/publish-alpha-release.js");
const promoteScript = path.resolve("scripts/promote-alpha-release.js");
const projectPackage = path.resolve("package.json");

function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
}

function writePackage(root, version) {
  fs.writeFileSync(path.join(root, "package.json"), `${JSON.stringify({
    name: "sennel",
    version,
  }, null, 2)}\n`);
}

function initializeRepository(root, version) {
  git(root, ["init", "--quiet"]);
  git(root, ["config", "user.email", "test@example.com"]);
  git(root, ["config", "user.name", "Test User"]);
  writePackage(root, version);
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "src", "sennel.js"), "export const releaseFixture = true;\n");
  fs.writeFileSync(path.join(root, ".gitignore"), "bin/\nnpm.log\n");
  git(root, ["add", "package.json", "src/sennel.js", ".gitignore"]);
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

function packOutput(version = "0.1.0-alpha.1", files = [{ path: "src/sennel.js", size: 36, mode: 0o644 }], name = "sennel") {
  return JSON.stringify([{
    name,
    version,
    shasum: "0123456789abcdef0123456789abcdef01234567",
    integrity: "sha512-fixture-content-identity",
    files,
  }]);
}

function npmStub(root, { output = packOutput(), failPack = false } = {}) {
  const bin = path.join(root, "bin");
  const log = path.join(root, "npm.log");
  fs.mkdirSync(bin);
  fs.writeFileSync(path.join(bin, "npm"), "#!/bin/sh\nprintf '%s\\n' \"$*\" >> \"$SENNEL_NPM_LOG\"\nif [ \"$1\" = pack ]; then\n  if [ \"$SENNEL_NPM_PACK_FAIL\" = 1 ]; then exit 42; fi\n  printf '%s\\n' \"$SENNEL_NPM_PACK_OUTPUT\"\nfi\n", { mode: 0o755 });
  return {
    log,
    environment: {
      ...process.env,
      PATH: `${bin}${path.delimiter}${process.env.PATH}`,
      SENNEL_NPM_LOG: log,
      SENNEL_NPM_PACK_OUTPUT: output,
      SENNEL_NPM_PACK_FAIL: failPack ? "1" : "0",
    },
    calls: () => fs.existsSync(log) ? fs.readFileSync(log, "utf8").trim().split("\n") : [],
  };
}

describe("alpha release version invariant", () => {
  it("exposes the alpha release procedure as package scripts", () => {
    const scripts = JSON.parse(fs.readFileSync(projectPackage, "utf8")).scripts;
    assert.equal(scripts["release:version:sync"], "node scripts/sync-alpha-version.js");
    assert.equal(scripts["release:version:validate"], "node scripts/validate-alpha-version.js");
    assert.equal(scripts["release:preflight"], "node scripts/release-preflight.js");
    assert.equal(scripts["release:verify"], "node scripts/verify-alpha-release.js");
    assert.equal(scripts["release:pack"], "node scripts/inspect-alpha-pack.js");
    assert.equal(scripts["release:publish"], "node scripts/publish-alpha-release.js");
    assert.equal(scripts["release:promote"], "node scripts/promote-alpha-release.js");
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

  it("rejects missing or malformed pack proofs before package inspection", () => {
    withRepository("0.1.0-alpha.1", (root) => {
      const stub = npmStub(root);
      for (const argumentsList of [[], ["--intent", "final", "--pack-proof", "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"], ["--intent", "alpha"], ["--intent", "alpha", "--pack-proof", "not-a-proof"]]) {
        const result = spawnSync(process.execPath, [publishScript, ...argumentsList], {
          cwd: root,
          encoding: "utf8",
          env: stub.environment,
        });
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /--intent alpha|pack proof/);
      }
      assert.deepEqual(stub.calls(), []);
    });
  });

  it("rejects invariant mismatches before any pack or publish command", () => {
    withRepository("0.1.0-alpha.1", (root) => {
      const stub = npmStub(root);
      writePackage(root, "0.1.0-alpha.999");
      git(root, ["add", "package.json"]);
      git(root, ["commit", "--amend", "--no-edit", "--quiet"]);
      const mismatch = spawnSync(process.execPath, [publishScript, "--intent", "alpha", "--pack-proof", "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"], {
        cwd: root,
        encoding: "utf8",
        env: stub.environment,
      });
      assert.notEqual(mismatch.status, 0);
      assert.match(mismatch.stderr, /HEAD commit count 1/);
      assert.deepEqual(stub.calls(), []);
    });
  });

  it("publishes only after a clean target, a matching re-inspected proof, and a final invariant validation", () => {
    withRepository("0.1.0-alpha.1", (root) => {
      const calls = [];
      const productionValidator = new AlphaReleaseValidator(root);
      const validator = {
        validate: () => {
          calls.push("validate invariant");
          return productionValidator.validate();
        },
        assertClean: (operation) => {
          calls.push(`clean ${operation}`);
          productionValidator.assertClean(operation);
        },
      };
      const output = packOutput();
      const inspection = new AlphaReleasePackInspection(productionValidator.validate(), output);
      const npm = { run: (args) => { calls.push(`npm ${args.join(" ")}`); return args[0] === "pack" ? output : ""; } };
      const packInspector = new AlphaReleasePackInspector(root, { validator, npm });
      const argumentsList = new AlphaReleaseArguments(["--intent", "alpha", "--pack-proof", inspection.proof.toString()], { requiresPackProof: true });
      new AlphaReleasePublisher(root, { validator, packInspector, npm })
        .publish(argumentsList.intent, argumentsList.packProof);
      assert.deepEqual(calls, [
        "validate invariant",
        "clean alpha pack inspection",
        "npm pack --dry-run --json",
        "clean alpha publish",
        "validate invariant",
        "npm publish --tag alpha",
      ]);
    });
  });

  it("prints a complete pack file list and the proof-required publish command", () => {
    withRepository("0.1.0-alpha.1", (root) => {
      const stub = npmStub(root, {
        output: packOutput("0.1.0-alpha.1", [
          { path: "src/sennel.js", size: 36, mode: 0o644 },
          { path: "src/release-proof.js", size: 42, mode: 0o644 },
        ]),
      });
      const pack = spawnSync(process.execPath, [packScript], { cwd: root, encoding: "utf8", env: stub.environment });
      assert.equal(pack.status, 0, pack.stderr);
      assert.match(pack.stdout, /src\/sennel\.js/);
      assert.match(pack.stdout, /src\/release-proof\.js/);
      assert.match(pack.stdout, /Confirmation proof: sha256:[0-9a-f]{64}/);
      assert.match(pack.stdout, /release:publish -- --intent alpha --pack-proof sha256:[0-9a-f]{64}/);
      assert.deepEqual(stub.calls(), ["pack --dry-run --json"]);
    });
  });

  it("rejects a well-formed proof that does not match the fresh package inspection", () => {
    withRepository("0.1.0-alpha.1", (root) => {
      const stub = npmStub(root);
      const result = spawnSync(process.execPath, [publishScript, "--intent", "alpha", "--pack-proof", "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"], {
        cwd: root,
        encoding: "utf8",
        env: stub.environment,
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /contents changed since inspection/);
      assert.deepEqual(stub.calls(), ["pack --dry-run --json"]);
    });
  });

  it("rejects pack metadata for a package other than sennel without publishing", () => {
    withRepository("0.1.0-alpha.1", (root) => {
      const stub = npmStub(root, { output: packOutput("0.1.0-alpha.1", undefined, "not-sennel") });
      const result = spawnSync(process.execPath, [publishScript, "--intent", "alpha", "--pack-proof", "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"], {
        cwd: root,
        encoding: "utf8",
        env: stub.environment,
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /package must be sennel/);
      assert.deepEqual(stub.calls(), ["pack --dry-run --json"]);
    });
  });

  it("refuses to emit a pack proof from a dirty release target", () => {
    withRepository("0.1.0-alpha.1", (root) => {
      const stub = npmStub(root);
      fs.writeFileSync(path.join(root, "src", "unreviewed.js"), "export const unreviewed = true;\n");
      const result = spawnSync(process.execPath, [packScript], {
        cwd: root,
        encoding: "utf8",
        env: stub.environment,
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /alpha pack inspection requires a clean worktree/);
      assert.deepEqual(stub.calls(), []);
    });
  });

  it("rejects a dirty release target before pack or publish", () => {
    withRepository("0.1.0-alpha.1", (root) => {
      const stub = npmStub(root);
      fs.writeFileSync(path.join(root, "src", "added-after-inspection.js"), "export const unsafe = true;\n");
      const result = spawnSync(process.execPath, [publishScript, "--intent", "alpha", "--pack-proof", "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"], {
        cwd: root,
        encoding: "utf8",
        env: stub.environment,
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /clean worktree/);
      assert.deepEqual(stub.calls(), []);
    });
  });

  it("rejects changed package contents by comparing a real npm pack proof before publishing", () => {
    withRepository("0.1.0-alpha.1", (root) => {
      const original = new AlphaReleasePackInspector(root).inspect();
      fs.writeFileSync(path.join(root, "src", "added-after-inspection.js"), "export const reviewedLater = true;\n");
      git(root, ["add", "src/added-after-inspection.js"]);
      git(root, ["commit", "--amend", "--no-edit", "--quiet"]);

      const current = new AlphaReleasePackInspector(root).inspect();
      assert.notEqual(current.proof.toString(), original.proof.toString());
      const calls = [];
      const npm = { run: (args) => { calls.push(args.join(" ")); return ""; } };
      const publisher = new AlphaReleasePublisher(root, { npm });
      assert.throws(
        () => publisher.publish(new AlphaReleaseArguments(["--intent", "alpha", "--pack-proof", original.proof.toString()], { requiresPackProof: true }).intent, original.proof),
        /contents changed since inspection/,
      );
      assert.deepEqual(calls, []);
    });
  });

  it("fails closed on invalid pack output or pack failure without publishing", () => {
    for (const options of [{ output: "not-json" }, { failPack: true }]) {
      withRepository("0.1.0-alpha.1", (root) => {
        const proof = "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        const stub = npmStub(root, options);
        const result = spawnSync(process.execPath, [publishScript, "--intent", "alpha", "--pack-proof", proof], {
          cwd: root,
          encoding: "utf8",
          env: stub.environment,
        });
        assert.notEqual(result.status, 0);
        assert.deepEqual(stub.calls(), ["pack --dry-run --json"]);
      });
    }
  });

  it("promotes an explicitly supplied version independently and without publishing", () => {
    withRepository("0.1.0-alpha.1", (root) => {
      const stub = npmStub(root);

      for (const argumentsList of [
        ["--intent", "alpha"],
        ["--intent", "final", "--version", "0.1.0-alpha.1"],
        ["--intent", "alpha", "--version", "not-an-alpha-version"],
      ]) {
        const rejected = spawnSync(process.execPath, [promoteScript, ...argumentsList], {
          cwd: root,
          encoding: "utf8",
          env: stub.environment,
        });
        assert.notEqual(rejected.status, 0);
      }
      assert.deepEqual(stub.calls(), []);

      const promote = spawnSync(process.execPath, [promoteScript, "--intent", "alpha", "--version", "0.1.0-alpha.1"], {
        cwd: root,
        encoding: "utf8",
        env: stub.environment,
      });
      assert.equal(promote.status, 0, promote.stderr);
      assert.deepEqual(stub.calls(), ["dist-tag add sennel@0.1.0-alpha.1 latest"]);
    });
  });

  it("runs verification as an independent release command", () => {
    withRepository("0.1.0-alpha.1", (root) => {
      const stub = npmStub(root);
      const verify = spawnSync(process.execPath, [verifyScript], { cwd: root, encoding: "utf8", env: stub.environment });
      assert.equal(verify.status, 0, verify.stderr);
      assert.deepEqual(stub.calls(), ["test"]);
    });
  });
});
