import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";
import { execFileSync } from "node:child_process";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";
import { makeFlowManager, setupFlow } from "../../helpers/flow-setup.js";
import { FLOW_COMMANDS } from "../../../src/flow/registry.js";
import { FlowOutbox, FlowOutboxStore, finalizationOutboxIdentity } from "../../../src/flow/lib/flow-outbox.js";
import { flattenSteps } from "../../../src/flow/lib/step-tree.js";

let root;

afterEach(() => root && removeTmpDir(root));

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" });
}

function activateFinalizeMerge(manager) {
  manager.mutate((state) => {
    let active = false;
    for (const step of flattenSteps(state.steps)) {
      if (step.id === "finalize-merge") {
        step.status = "in_progress";
        active = true;
      } else {
        step.status = active ? "pending" : "done";
      }
    }
  });
  return manager.load();
}

function setupFixture() {
  root = createTmpDir("finalize-merge-conflict-metadata-");
  git("init", "--quiet", root);
  git("-C", root, "config", "user.email", "test@example.com");
  git("-C", root, "config", "user.name", "Test User");
  const state = setupFlow(root, { specId: "test-spec" });
  git("-C", root, "add", ".");
  git("-C", root, "commit", "--quiet", "-m", "test: initial flow");
  const manager = makeFlowManager(root);
  const activeState = activateFinalizeMerge(manager);
  return { manager, state: activeState, specId: "test-spec" };
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
  assert.deepEqual(files, ["specs/test-spec/flow.json", "specs/test-spec/issue-log.json"]);
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

  const entry = new FlowOutbox(manager.load().outbox)
    .find(finalizationOutboxIdentity(manager.load(), "finalize-merge"));
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
    /src\/external\.js[\s\S]*senrail flow run finalize-merge/,
  );
  assert.deepEqual(manager.load().outbox, before.outbox);
  assert.deepEqual(manager.load().steps, before.steps);
});

test("Flow-owned analysis output remains deferred without blocking finalize-merge", async () => {
  const { manager, state, specId } = setupFixture();
  fs.mkdirSync(path.join(root, ".senrail", "output"), { recursive: true });
  fs.writeFileSync(path.join(root, ".senrail", "output", "analysis.json"), "{\"entries\":[]}\n");

  await FLOW_COMMANDS.run["finalize-merge"].pre({
    flowManager: manager,
    flowState: state,
    root,
    specId,
  });

  const entry = new FlowOutbox(manager.load().outbox)
    .find(finalizationOutboxIdentity(manager.load(), "finalize-merge"));
  assert.equal(entry?.status, "pending");
  assert.equal(fs.existsSync(path.join(root, ".senrail", "output", "analysis.json")), true);
  assert.match(
    git("-C", root, "status", "--porcelain", "--untracked-files=all"),
    /\.senrail\/output\/analysis\.json/,
  );
});
