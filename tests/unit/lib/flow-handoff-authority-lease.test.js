import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

import { FlowHandoffAuthorityLease } from "../../../src/lib/flow-handoff-authority-lease.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const LEASE_MODULE_PATH = fileURLToPath(new URL("../../../src/lib/flow-handoff-authority-lease.js", import.meta.url));

function spawnLeaseOwner(root, afterAcquire) {
  return spawn(process.execPath, [
    "--input-type=module",
    "--eval",
    [
      `import { FlowHandoffAuthorityLease } from ${JSON.stringify(LEASE_MODULE_PATH)};`,
      `const lease = new FlowHandoffAuthorityLease({ mainRoot: ${JSON.stringify(root)}, executionRoot: ${JSON.stringify(root)} });`,
      "lease.acquire();",
      "process.stdout.write('locked\\n');",
      afterAcquire,
    ].join("\n"),
  ], { stdio: ["ignore", "pipe", "pipe"] });
}

describe("FlowHandoffAuthorityLease", () => {
  it("keeps unrelated worktree Flow handoffs independent and releases cleanly", () => {
    const root = createTmpDir("flow-handoff-authority-");
    try {
      fs.mkdirSync(`${root}/.sennel`);
      const worktree = path.join(root, "worktree-one"); fs.mkdirSync(worktree);
      const otherWorktree = path.join(root, "worktree-two"); fs.mkdirSync(otherWorktree);
      const first = new FlowHandoffAuthorityLease({ mainRoot: root, executionRoot: worktree });
      const sameFlow = new FlowHandoffAuthorityLease({ mainRoot: root, executionRoot: worktree });
      const otherFlow = new FlowHandoffAuthorityLease({ mainRoot: root, executionRoot: otherWorktree });
      first.acquire();
      assert.throws(
        () => sameFlow.acquire(),
        (error) => error.code === "FLOW_HANDOFF_AUTHORITY_BUSY",
      );
      assert.throws(
        () => sameFlow.acquire({ wait: true, timeoutMs: 0 }),
        (error) => error.code === "FLOW_HANDOFF_AUTHORITY_WAIT_TIMEOUT",
      );
      otherFlow.acquire();
      otherFlow.release();
      first.release();

      sameFlow.acquire();
      sameFlow.release();
    } finally {
      removeTmpDir(root);
    }
  });

  it("serializes distinct direct Flow runs that share one checkout", () => {
    const root = createTmpDir("flow-handoff-authority-direct-");
    try {
      fs.mkdirSync(`${root}/.sennel`);
      const first = new FlowHandoffAuthorityLease({ mainRoot: root, executionRoot: root });
      const second = new FlowHandoffAuthorityLease({ mainRoot: root, executionRoot: root });
      first.acquire();
      assert.throws(
        () => second.acquire(),
        (error) => error.code === "FLOW_HANDOFF_AUTHORITY_BUSY",
      );
      first.release();
      second.acquire();
      second.release();
    } finally {
      removeTmpDir(root);
    }
  });

  it("waits for an already-held Flow lease and then acquires it without a timeout", async () => {
    const root = createTmpDir("flow-handoff-authority-wait-");
    try {
      fs.mkdirSync(`${root}/.sennel`);
      const child = spawnLeaseOwner(root, "setTimeout(() => { lease.release(); }, 100);");
      await once(child.stdout, "data");

      const waiting = new FlowHandoffAuthorityLease({ mainRoot: root, executionRoot: root });
      const startedAt = Date.now();
      waiting.acquire({ wait: true });
      assert.ok(Date.now() - startedAt >= 50, "the second holder waits for the first holder to release");
      waiting.release();
      const [code] = await once(child, "exit");
      assert.equal(code, 0);
    } finally {
      removeTmpDir(root);
    }
  });

  it("fails closed immediately when a prior checkout lease owner is stale", async () => {
    const root = createTmpDir("flow-handoff-authority-stale-");
    try {
      fs.mkdirSync(`${root}/.sennel`);
      const child = spawnLeaseOwner(root, "process.exit(0);");
      const exited = once(child, "exit");
      await once(child.stdout, "data");
      const [code] = await exited;
      assert.equal(code, 0);

      const lease = new FlowHandoffAuthorityLease({ mainRoot: root, executionRoot: root });
      const startedAt = Date.now();
      assert.throws(
        () => lease.acquire({ wait: true }),
        (error) => error.code === "FLOW_HANDOFF_AUTHORITY_LOCK_STALE" && error.lockPath.endsWith(".lock"),
      );
      assert.ok(Date.now() - startedAt < 1_000, "a stale owner must not enter the live-owner wait loop");
    } finally {
      removeTmpDir(root);
    }
  });
});
