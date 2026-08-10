import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  WORKTREE_FLOW_BINDING_FILE,
  WORKTREE_FLOW_BINDING_PUBLICATION_TEMP_FILE,
  WorktreeFlowBinding,
  WorktreeFlowBindingStore,
  WorktreeFlowIdentity,
  WorktreeFlowIssueTransition,
} from "../../../src/lib/worktree-flow-binding.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const fixtureRoot = path.join(repoRoot, ".tmp", "issue-440-binding-unit");
const roots = [];

function createWorktreeRoot() {
  fs.mkdirSync(fixtureRoot, { recursive: true });
  const root = fs.mkdtempSync(path.join(fixtureRoot, "worktree-"));
  roots.push(root);
  return root;
}

function identityInput(root, issue = 440) {
  return {
    runId: "run-440",
    issue,
    specId: "321-fix-worktree-flow-identity",
    worktreePath: root,
  };
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("WorktreeFlowIdentity", () => {
  it("round-trips positive-Issue and explicit no-Issue identities", () => {
    for (const issue of [440, null]) {
      const root = createWorktreeRoot();
      const identity = new WorktreeFlowIdentity(identityInput(root, issue));
      const binding = WorktreeFlowBinding.fromJSON(new WorktreeFlowBinding(identity).toJSON());

      assert.equal(binding.identity.issue, issue);
      assert.deepEqual(binding.toJSON(), {
        version: 2,
        ...identityInput(fs.realpathSync(root), issue),
      });
    }
  });

  it("rejects missing and invalid identity fields", () => {
    const root = createWorktreeRoot();
    const valid = identityInput(root);
    const cases = [
      { ...valid, runId: "" },
      { ...valid, runId: " run-440" },
      { ...valid, runId: "run 440" },
      { ...valid, runId: `run-${"x".repeat(200)}` },
      { runId: valid.runId, issue: valid.issue, worktreePath: valid.worktreePath },
      { ...valid, issue: 0 },
      { ...valid, issue: -1 },
      { ...valid, issue: 1.5 },
      { ...valid, issue: "440" },
      { ...valid, specId: "../321-fix-worktree-flow-identity" },
      { ...valid, specId: "specs\\321-fix-worktree-flow-identity\\spec.json" },
      { ...valid, specId: "specs/321-fix-worktree-flow-identity/spec.json" },
      { ...valid, worktreePath: "relative/path" },
      { ...valid, worktreePath: `${root}${path.sep}.` },
    ];

    for (const value of cases) {
      assert.throws(() => new WorktreeFlowIdentity(value));
    }
  });

  it("requires the exact current binding schema", () => {
    const root = createWorktreeRoot();
    const valid = { version: 2, ...identityInput(root) };
    for (const value of [
      { ...valid, version: 1 },
      { ...valid, extra: true },
      { version: 2, runId: valid.runId },
      [valid],
      null,
    ]) {
      assert.throws(() => WorktreeFlowBinding.fromJSON(value));
    }
  });

  it("requires exact nested identities in the current Issue transition schema", () => {
    const root = createWorktreeRoot();
    const original = identityInput(root, null);
    const next = identityInput(root, 440);
    const valid = {
      version: 1,
      transitionId: "11111111-1111-4111-8111-111111111111",
      writerOwnerToken: "44444444-4444-4444-8444-444444444444",
      writerOwnerTempName: ".flow.json.writer.44444444-4444-4444-8444-444444444444.owner.tmp",
      original,
      next,
    };

    assert.equal(WorktreeFlowIssueTransition.fromJSON(valid).transitionId, valid.transitionId);
    for (const value of [
      { ...valid, writerOwnerToken: undefined },
      { ...valid, writerOwnerTempName: ".flow.json.writer.foreign.owner.tmp" },
      { ...valid, extra: true },
    ]) {
      assert.throws(() => WorktreeFlowIssueTransition.fromJSON(value));
    }
    for (const value of [
      { ...valid, original: { ...original, extra: true } },
      { ...valid, original: { runId: original.runId, issue: original.issue, specId: original.specId } },
      { ...valid, next: { ...next, extra: true } },
      { ...valid, next: { runId: next.runId, issue: next.issue, specId: next.specId } },
    ]) {
      assert.throws(
        () => WorktreeFlowIssueTransition.fromJSON(value),
        /identity fields must be exactly/i,
      );
    }
  });
});

describe("WorktreeFlowBindingStore", () => {
  it("atomically persists one regular-file binding and reads it back", () => {
    const root = createWorktreeRoot();
    const identity = new WorktreeFlowIdentity(identityInput(root, null));
    const store = new WorktreeFlowBindingStore({ worktreePath: root });

    store.save(identity);

    assert.equal(store.path, path.join(root, WORKTREE_FLOW_BINDING_FILE));
    assert.equal(fs.lstatSync(store.path).isFile(), true);
    assert.equal(fs.lstatSync(store.path).isSymbolicLink(), false);
    assert.equal(store.load().equals(identity), true);
    assert.deepEqual(
      fs.readdirSync(path.dirname(store.path)).filter((name) => name.includes(".tmp")),
      [],
    );
  });

  it("adopts only the receipt-bound stale temp after SIGKILL in initial publication", () => {
    const root = createWorktreeRoot();
    const moduleUrl = pathToFileURL(path.join(repoRoot, "src/lib/worktree-flow-binding.js")).href;
    const script = `
      import { WorktreeFlowBindingStore, WorktreeFlowIdentity } from ${JSON.stringify(moduleUrl)};
      const root = process.argv[1];
      const identity = new WorktreeFlowIdentity(${JSON.stringify(identityInput(root, null))});
      const store = new WorktreeFlowBindingStore({
        worktreePath: root,
        faultInjector: ({ phase }) => {
          if (phase === "before-binding-temp-unlink") process.kill(process.pid, "SIGKILL");
        },
      });
      store.save(identity);
    `;

    const stopped = spawnSync(process.execPath, ["--input-type=module", "-e", script, root]);
    assert.equal(stopped.signal, "SIGKILL");

    const store = new WorktreeFlowBindingStore({ worktreePath: root });
    const directory = path.dirname(store.path);
    const tempPath = path.join(root, WORKTREE_FLOW_BINDING_PUBLICATION_TEMP_FILE);
    assert.equal(fs.lstatSync(store.path).nlink, 2);
    assert.equal(fs.lstatSync(tempPath).nlink, 2);
    assert.equal(fs.lstatSync(store.path).ino, fs.lstatSync(tempPath).ino);
    assert.equal(fs.existsSync(path.join(directory, ".flow-identity.publication.json")), true);

    assert.equal(store.load().equals(new WorktreeFlowIdentity(identityInput(root, null))), true);
    assert.equal(fs.lstatSync(store.path).nlink, 1);
    assert.deepEqual(
      fs.readdirSync(directory).filter((name) => name.includes("publication") || name.endsWith(".tmp")),
      [],
    );
  });

  for (const phase of [
    "before-binding-publication-receipt-temp-open",
    "before-binding-publication-receipt-temp-write",
    "before-binding-publication-receipt-fsync",
    "before-binding-publication-receipt-temp-close",
    "before-binding-publication-receipt-rename",
    "before-binding-publication-receipt-directory-fsync",
  ]) {
    it(`restarts without unauthenticated binding temp after SIGKILL at ${phase}`, () => {
      const root = createWorktreeRoot();
      const moduleUrl = pathToFileURL(path.join(repoRoot, "src/lib/worktree-flow-binding.js")).href;
      const script = `
        import { WorktreeFlowBindingStore, WorktreeFlowIdentity } from ${JSON.stringify(moduleUrl)};
        const [root, phase] = process.argv.slice(1);
        const store = new WorktreeFlowBindingStore({
          worktreePath: root,
          faultInjector: (event) => {
            if (event.phase === phase) process.kill(process.pid, "SIGKILL");
          },
        });
        store.save(new WorktreeFlowIdentity(${JSON.stringify(identityInput(root, null))}));
      `;
      const stopped = spawnSync(process.execPath, [
        "--input-type=module",
        "-e",
        script,
        root,
        phase,
      ]);
      assert.equal(stopped.signal, "SIGKILL");

      const directory = path.join(root, ".sennel");
      const tempNames = fs.readdirSync(directory).filter((name) => name.endsWith(".tmp"));
      assert.equal(tempNames.includes(".flow-identity.publication.binding.tmp"), false, phase);
      if (tempNames.length > 0) {
        assert.equal(fs.existsSync(path.join(directory, ".flow-identity.publication.intent")), true, phase);
        assert.deepEqual(tempNames, [".flow-identity.publication.receipt.tmp"], phase);
      }
      const store = new WorktreeFlowBindingStore({ worktreePath: root });
      const identity = new WorktreeFlowIdentity(identityInput(root, null));
      assert.equal(store.save(identity).equals(identity), true);
      assert.deepEqual(
        fs.readdirSync(directory).filter((name) => (
          name.startsWith(".flow-identity.publication") || name.endsWith(".tmp")
        )),
        [],
      );
    });
  }

  it("durably publishes the receipt intent before opening the binding temp", () => {
    const root = createWorktreeRoot();
    const moduleUrl = pathToFileURL(path.join(repoRoot, "src/lib/worktree-flow-binding.js")).href;
    const script = `
      import { WorktreeFlowBindingStore, WorktreeFlowIdentity } from ${JSON.stringify(moduleUrl)};
      const root = process.argv[1];
      const store = new WorktreeFlowBindingStore({
        worktreePath: root,
        faultInjector: ({ phase }) => {
          if (phase === "before-binding-temp-open") process.kill(process.pid, "SIGKILL");
        },
      });
      store.save(new WorktreeFlowIdentity(${JSON.stringify(identityInput(root, null))}));
    `;
    const stopped = spawnSync(process.execPath, ["--input-type=module", "-e", script, root]);
    assert.equal(stopped.signal, "SIGKILL");
    assert.equal(
      fs.existsSync(path.join(root, ".sennel", ".flow-identity.publication.json")),
      true,
    );
    assert.equal(
      fs.existsSync(path.join(root, ".sennel", ".flow-identity.publication.binding.tmp")),
      false,
    );

    const store = new WorktreeFlowBindingStore({ worktreePath: root });
    assert.equal(store.save(new WorktreeFlowIdentity(identityInput(root, null))).issue, null);
  });

  for (const phase of ["before-binding-temp-write", "after-binding-temp-partial-write"]) {
    it(`recovers the receipt-bound incomplete binding temp after SIGKILL at ${phase}`, () => {
      const root = createWorktreeRoot();
      const moduleUrl = pathToFileURL(path.join(repoRoot, "src/lib/worktree-flow-binding.js")).href;
      const script = `
        import { WorktreeFlowBindingStore, WorktreeFlowIdentity } from ${JSON.stringify(moduleUrl)};
        const [root, phase] = process.argv.slice(1);
        const store = new WorktreeFlowBindingStore({
          worktreePath: root,
          faultInjector: (event) => {
            if (event.phase === phase) process.kill(process.pid, "SIGKILL");
          },
        });
        store.save(new WorktreeFlowIdentity(${JSON.stringify(identityInput(root, null))}));
      `;
      const stopped = spawnSync(process.execPath, ["--input-type=module", "-e", script, root, phase]);
      assert.equal(stopped.signal, "SIGKILL");

      const store = new WorktreeFlowBindingStore({ worktreePath: root });
      const identity = new WorktreeFlowIdentity(identityInput(root, null));
      assert.equal(store.save(identity).equals(identity), true);
      assert.equal(fs.existsSync(path.join(root, WORKTREE_FLOW_BINDING_PUBLICATION_TEMP_FILE)), false);
      assert.equal(fs.existsSync(store.publicationReceiptPath), false);
    });
  }

  it("fails stopped when the receipt-bound temp is swapped before cleanup CAS", () => {
    const root = createWorktreeRoot();
    const moduleUrl = pathToFileURL(path.join(repoRoot, "src/lib/worktree-flow-binding.js")).href;
    const script = `
      import { WorktreeFlowBindingStore, WorktreeFlowIdentity } from ${JSON.stringify(moduleUrl)};
      const root = process.argv[1];
      const store = new WorktreeFlowBindingStore({
        worktreePath: root,
        faultInjector: ({ phase }) => {
          if (phase === "before-binding-temp-write") process.kill(process.pid, "SIGKILL");
        },
      });
      store.save(new WorktreeFlowIdentity(${JSON.stringify(identityInput(root, null))}));
    `;
    assert.equal(
      spawnSync(process.execPath, ["--input-type=module", "-e", script, root]).signal,
      "SIGKILL",
    );
    const tempPath = path.join(root, WORKTREE_FLOW_BINDING_PUBLICATION_TEMP_FILE);
    const displacedPath = path.join(root, "displaced-binding-temp");
    const foreignBytes = Buffer.from("foreign swapped binding temp\n");
    let swapped = false;
    const store = new WorktreeFlowBindingStore({
      worktreePath: root,
      faultInjector: ({ phase }) => {
        if (phase !== "before-binding-publication-temp-cleanup-cas" || swapped) return;
        swapped = true;
        fs.renameSync(tempPath, displacedPath);
        fs.writeFileSync(tempPath, foreignBytes);
      },
    });

    assert.throws(() => store.load(), /changed|authority|CAS/i);
    assert.equal(swapped, true);
    assert.deepEqual(fs.readFileSync(tempPath), foreignBytes);
    assert.equal(fs.existsSync(store.publicationReceiptPath), true);
  });

  it("fails stopped when the receipt is swapped before cleanup CAS", () => {
    const root = createWorktreeRoot();
    const moduleUrl = pathToFileURL(path.join(repoRoot, "src/lib/worktree-flow-binding.js")).href;
    const script = `
      import { WorktreeFlowBindingStore, WorktreeFlowIdentity } from ${JSON.stringify(moduleUrl)};
      const root = process.argv[1];
      const store = new WorktreeFlowBindingStore({
        worktreePath: root,
        faultInjector: ({ phase }) => {
          if (phase === "before-binding-temp-open") process.kill(process.pid, "SIGKILL");
        },
      });
      store.save(new WorktreeFlowIdentity(${JSON.stringify(identityInput(root, null))}));
    `;
    assert.equal(
      spawnSync(process.execPath, ["--input-type=module", "-e", script, root]).signal,
      "SIGKILL",
    );
    const foreignBytes = Buffer.from("foreign swapped receipt\n");
    const store = new WorktreeFlowBindingStore({
      worktreePath: root,
      faultInjector: ({ phase }) => {
        if (phase !== "before-binding-publication-receipt-unlink") return;
        fs.renameSync(store.publicationReceiptPath, path.join(root, "displaced-receipt"));
        fs.writeFileSync(store.publicationReceiptPath, foreignBytes);
      },
    });

    assert.throws(() => store.save(new WorktreeFlowIdentity(identityInput(root, null))), /changed|authority|CAS/i);
    assert.deepEqual(fs.readFileSync(store.publicationReceiptPath), foreignBytes);
    assert.equal(fs.existsSync(store.path), false);
  });

  it("rejects a receipt-less foreign hardlink without removing either name", () => {
    const root = createWorktreeRoot();
    const store = new WorktreeFlowBindingStore({ worktreePath: root });
    store.save(new WorktreeFlowIdentity(identityInput(root)));
    const foreign = path.join(root, "foreign-binding-link.json");
    fs.linkSync(store.path, foreign);

    assert.throws(() => store.load(), /non-hardlinked authority/i);
    assert.equal(fs.existsSync(store.path), true);
    assert.equal(fs.existsSync(foreign), true);
    assert.equal(fs.lstatSync(store.path).nlink, 2);
  });

  it("preserves a receipt-less foreign fixed binding temp on publication collision", () => {
    const root = createWorktreeRoot();
    const store = new WorktreeFlowBindingStore({ worktreePath: root });
    const tempPath = path.join(root, WORKTREE_FLOW_BINDING_PUBLICATION_TEMP_FILE);
    const foreignBytes = Buffer.from("foreign fixed binding temp\n");
    fs.writeFileSync(tempPath, foreignBytes);

    assert.throws(() => store.save(new WorktreeFlowIdentity(identityInput(root, null))));
    assert.deepEqual(fs.readFileSync(tempPath), foreignBytes);
    assert.equal(fs.existsSync(store.path), false);
    assert.equal(fs.existsSync(store.publicationReceiptPath), false);
  });

  it("rejects a foreign third hardlink during receipt-bound publication recovery", () => {
    const root = createWorktreeRoot();
    const moduleUrl = pathToFileURL(path.join(repoRoot, "src/lib/worktree-flow-binding.js")).href;
    const script = `
      import { WorktreeFlowBindingStore, WorktreeFlowIdentity } from ${JSON.stringify(moduleUrl)};
      const root = process.argv[1];
      const store = new WorktreeFlowBindingStore({
        worktreePath: root,
        faultInjector: ({ phase }) => {
          if (phase === "before-binding-temp-unlink") process.kill(process.pid, "SIGKILL");
        },
      });
      store.save(new WorktreeFlowIdentity(${JSON.stringify(identityInput(root, null))}));
    `;
    const stopped = spawnSync(process.execPath, ["--input-type=module", "-e", script, root]);
    assert.equal(stopped.signal, "SIGKILL");

    const store = new WorktreeFlowBindingStore({ worktreePath: root });
    const foreign = path.join(root, "foreign-publication-link.json");
    fs.linkSync(store.path, foreign);
    assert.equal(fs.lstatSync(store.path).nlink, 3);

    assert.throws(() => store.load(), /exact two-link authority/i);
    assert.equal(fs.existsSync(store.path), true);
    assert.equal(fs.existsSync(foreign), true);
    assert.equal(fs.existsSync(store.publicationReceiptPath), true);
    assert.equal(fs.lstatSync(store.path).nlink, 3);
  });

  it("rejects malformed, mismatched, symlinked, and conflicting bindings", () => {
    const root = createWorktreeRoot();
    const other = createWorktreeRoot();
    const store = new WorktreeFlowBindingStore({ worktreePath: root });
    fs.mkdirSync(path.dirname(store.path), { recursive: true });

    fs.writeFileSync(store.path, "{not-json\n");
    assert.throws(() => store.load(), /JSON/i);

    fs.writeFileSync(store.path, JSON.stringify({ version: 2, ...identityInput(other) }));
    assert.throws(() => store.load(), /path mismatch/i);

    fs.rmSync(store.path);
    const target = path.join(root, "binding-target.json");
    fs.writeFileSync(target, JSON.stringify({ version: 2, ...identityInput(root) }));
    fs.symlinkSync(target, store.path);
    assert.throws(() => store.load(), /regular file/i);

    fs.rmSync(store.path);
    store.save(new WorktreeFlowIdentity(identityInput(root)));
    assert.throws(
      () => store.save(new WorktreeFlowIdentity({ ...identityInput(root), runId: "other-run" })),
      /conflicting/i,
    );
  });
});
