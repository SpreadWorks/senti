import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { pathToFileURL } from "node:url";

import { AtomicFile } from "../../../src/lib/atomic-file.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

describe("AtomicFile", () => {
  it("keeps the old visible bytes and removes temporary files for pre-commit faults", () => {
    for (const phase of ["before-file-temp-write", "before-file-fsync", "before-file-rename"]) {
      const root = createTmpDir(`atomic-file-${phase}-`);
      try {
        const file = path.join(root, "state.bin");
        fs.writeFileSync(file, "old-complete");

        assert.throws(
          () => new AtomicFile(file, {
            faultInjector(event) {
              if (event.phase === phase) throw new Error(`fault at ${phase}`);
            },
          }).write(Buffer.from("new-complete")),
          new RegExp(`fault at ${phase}`),
        );

        assert.equal(fs.readFileSync(file, "utf8"), "old-complete", phase);
        assert.deepEqual(fs.readdirSync(root), ["state.bin"], phase);
      } finally {
        removeTmpDir(root);
      }
    }
  });

  it("publishes complete bytes and reports durability uncertainty after rename", () => {
    const root = createTmpDir("atomic-file-durability-");
    try {
      const file = path.join(root, "state.bin");
      fs.writeFileSync(file, "old-complete");

      assert.throws(
        () => new AtomicFile(file, {
          faultInjector(event) {
            if (event.phase === "before-file-directory-fsync") {
              throw new Error("directory sync fault");
            }
          },
        }).write(Buffer.from("new-complete")),
        (error) => error.code === "ATOMIC_FILE_DURABILITY_UNCERTAIN" && error.committed === true,
      );

      assert.equal(fs.readFileSync(file, "utf8"), "new-complete");
      assert.deepEqual(fs.readdirSync(root), ["state.bin"]);
    } finally {
      removeTmpDir(root);
    }
  });

  it("leaves either the old or new complete visible bytes across process kill boundaries", () => {
    const moduleUrl = pathToFileURL(path.resolve("src/lib/atomic-file.js")).href;
    for (const [phase, expected] of [
      ["before-file-rename", "old-complete"],
      ["before-file-directory-fsync", "new-complete"],
    ]) {
      const root = createTmpDir(`atomic-file-kill-${phase}-`);
      try {
        const file = path.join(root, "state.bin");
        fs.writeFileSync(file, "old-complete");
        const child = spawnSync(process.execPath, ["--input-type=module", "-e", `
          import { AtomicFile } from ${JSON.stringify(moduleUrl)};
          new AtomicFile(${JSON.stringify(file)}, {
            faultInjector(event) {
              if (event.phase === ${JSON.stringify(phase)}) process.kill(process.pid, "SIGKILL");
            },
          }).write(Buffer.from("new-complete"));
        `], { encoding: "utf8" });

        assert.equal(child.signal, "SIGKILL", child.stderr);
        assert.equal(fs.readFileSync(file, "utf8"), expected, phase);
      } finally {
        removeTmpDir(root);
      }
    }
  });
});
