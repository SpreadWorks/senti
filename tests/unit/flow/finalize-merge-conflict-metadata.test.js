import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";
import { execFileSync } from "node:child_process";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { CanonicalFlowFixture, makeFlowManager } from "../../helpers/flow-setup.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { FlowOutboxStore, finalizationOutboxIdentity } from "../../../src/flow/lib/flow-outbox.js";

let root;

afterEach(() => root && removeTmpDir(root));

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function setupFixture() {
  root = createTmpDir("finalize-merge-conflict-metadata-");
  git("init", "--quiet", root);
  git("-C", root, "config", "user.email", "test@example.com");
  git("-C", root, "config", "user.name", "Test User");
  const manager = makeFlowManager(root);
  const fixture = new CanonicalFlowFixture({ flowManager: manager, specId: "test-spec" })
    .create().registerActive().activate("finalize-merge");
  const state = fixture.state();
  git("-C", root, "add", ".");
  git("-C", root, "commit", "--quiet", "-m", "test: initial flow");
  return { manager, state, specId: "test-spec" };
}

test("persists only active-spec metadata after finalize-merge conflict", async () => {
  const { manager, state, specId } = setupFixture();
  new FlowOutboxStore(manager).begin(finalizationOutboxIdentity(state, "finalize-merge"));

  await FLOW_COMMANDS.run["finalize-merge"].onError({
    flowManager: manager,
    flowState: manager.load(),
    root,
    specId,
  }, new Error("pre-merge conflict"));

  const files = git("-C", root, "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD")
    .trim().split("\n").filter(Boolean).sort();
  assert.deepEqual(files, [
    "specs/test-spec/001/activities.jsonl",
    "specs/test-spec/001/artifact-catalog.json",
    "specs/test-spec/001/flow.json",
    "specs/test-spec/001/issue-log.json",
  ]);
  assert.equal(git("-C", root, "status", "--porcelain").trim(), "");
});

test("records the finalize-merge outbox before merge execution", async () => {
  const { manager, state, specId } = setupFixture();

  await FLOW_COMMANDS.run["finalize-merge"].pre({
    flowManager: manager,
    flowState: state,
    root,
    specId,
  });

  const entry = new FlowOutboxStore(manager).status(finalizationOutboxIdentity(manager.loadReadOnly(), "finalize-merge"));
  assert.equal(entry?.status, "pending");
});

test("external dirtiness prevents finalize-merge outbox mutation", async () => {
  const { manager, state, specId } = setupFixture();
  fs.mkdirSync(path.join(root, "src"), { recursive: true });
  fs.writeFileSync(path.join(root, "src", "external.js"), "external\n");
  const before = manager.load();

  await assert.rejects(
    () => FLOW_COMMANDS.run["finalize-merge"].pre({
      flowManager: manager,
      flowState: state,
      root,
      specId,
    }),
    /src\/external\.js[\s\S]*sennel flow run finalize-merge/,
  );
  assert.equal(new FlowOutboxStore(manager).status(finalizationOutboxIdentity(manager.loadReadOnly(), "finalize-merge")), null);
  assert.deepEqual(manager.loadReadOnly().steps, before.steps);
});

test("Flow-owned analysis output remains deferred without blocking finalize-merge", async () => {
  const { manager, state, specId } = setupFixture();
  fs.mkdirSync(path.join(root, ".sennel", "output"), { recursive: true });
  fs.writeFileSync(path.join(root, ".sennel", "output", "analysis.json"), "{\"entries\":[]}\n");

  await FLOW_COMMANDS.run["finalize-merge"].pre({
    flowManager: manager,
    flowState: state,
    root,
    specId,
  });

  const entry = new FlowOutboxStore(manager).status(finalizationOutboxIdentity(manager.loadReadOnly(), "finalize-merge"));
  assert.equal(entry?.status, "pending");
  assert.equal(fs.existsSync(path.join(root, ".sennel", "output", "analysis.json")), true);
  assert.match(
    git("-C", root, "status", "--porcelain", "--untracked-files=all"),
    /\.sennel\/output\/analysis\.json/,
  );
});
