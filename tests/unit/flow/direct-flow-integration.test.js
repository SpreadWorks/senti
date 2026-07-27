import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  getDirectFlowAction,
  runDirectFlowAction,
} from "../../../src/flow/lib/direct-flow-controller.js";
import { DirectAbortReceipt } from "../../../src/flow/lib/direct-completion.js";
import { FlowCompletion } from "../../../src/flow/lib/flow-completion.js";
import { DirectFlowSession } from "../../../src/flow/lib/direct-flow-session.js";
import { DirectResolutionPlan } from "../../../src/flow/lib/direct-resolution-plan.js";
import {
  FlowOutbox,
  finalizationOutboxIdentity,
} from "../../../src/flow/lib/flow-outbox.js";
import { FinalizeCleanupStateResolution } from "../../../src/flow/lib/finalize-cleanup-state.js";
import RunResumeCommand from "../../../src/flow/lib/run-resume.js";
import {
  ExternalBlockedOutcome,
  StepAttempt,
} from "../../../src/flow/lib/step-outcome.js";
import { flattenSteps } from "../../../src/flow/lib/step-tree.js";
import { container } from "../../../src/lib/container.js";
import {
  FlowManager,
  ParkedFlowIdentity,
} from "../../../src/lib/flow-manager.js";
import { RepositoryFlowOperationLock } from "../../../src/lib/repository-maintenance-lock.js";
import { makeFlowState } from "../../helpers/flow-setup.js";
import {
  createDirectFlowFixture,
  git,
} from "../../helpers/direct-flow-fixture.js";

function stepStatuses(state) {
  return flattenSteps(state.steps).map((step) => [step.id, step.status]);
}

function commitSpecArtifact(fixture, fileName, value, message) {
  const relativePath = path.posix.join("specs", fixture.specId, fileName);
  fs.writeFileSync(
    path.join(fixture.worktreePath, relativePath),
    `${JSON.stringify(value, null, 2)}\n`,
  );
  git(fixture.worktreePath, ["add", relativePath]);
  git(fixture.worktreePath, ["commit", "--quiet", "-m", message]);
}

async function confirmDirectImplementation(fixture, summary = null) {
  const spec = JSON.parse(fs.readFileSync(
    path.join(fixture.worktreePath, fixture.spec),
    "utf8",
  ));
  const requirementIds = (spec.requirements || [])
    .filter((requirement) => requirement.testable !== false)
    .map((requirement) => requirement.id);
  const evidence = summary || [
    "Completed the bounded direct implementation and inspected the product diff.",
    ...requirementIds.map((id) => `${id}: implemented the specified product behavior.`),
  ].join(" ");
  const confirmed = await runDirectFlowAction(fixture.context(), {
    action: "CONFIRM_DIRECT_IMPLEMENTATION",
    summary: evidence,
  });
  assert.equal(confirmed.code, "DIRECT_FIX");
  assert.ok(confirmed.directFlowSession.implementationProof);
  return confirmed;
}

async function prepareVerifiedDirectChange(fixture, {
  relativePath,
  contents,
  reason,
}) {
  await runDirectFlowAction(fixture.context(), {
    action: "SELECT_DIRECT_FIX",
    reason,
    scope: [relativePath],
    source: "manual",
  });
  const sourcePath = path.join(fixture.worktreePath, relativePath);
  fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
  fs.writeFileSync(sourcePath, contents);
  await confirmDirectImplementation(fixture);
  const verified = await runDirectFlowAction(fixture.context(), {
    action: "VERIFY_DIRECT",
    testCommand: "node -e \"process.exit(0)\"",
    timeoutMs: 10_000,
  });
  assert.equal(verified.code, "DIRECT_VERIFY_PASSED", JSON.stringify(verified));
}

function persistLegacyAbortAfterPreparedCleanup(fixture, reason) {
  const main = fixture.context({ fromMain: true });
  main.flowManager.mutate((state) => {
    const session = DirectFlowSession.fromStored(state.directFlowSession);
    const directPlan = DirectResolutionPlan.fromStored(state.directResolutionPlan);
    const abortReceipt = new DirectAbortReceipt({
      runId: state.runId,
      issue: state.issue ?? null,
      spec: state.spec,
      planId: directPlan.planId,
      planRevision: directPlan.revision,
      reason,
    });
    state.directFlowSession = session.transition("ABORTED", {
      completion: {
        completionMode: "aborted",
        success: false,
        receiptId: abortReceipt.receiptId,
        reason,
        recordedAt: abortReceipt.recordedAt,
      },
    }).toJSON();
    state.directAbortReceipt = abortReceipt.toJSON();
  });
}

function executableFromPath(name) {
  for (const directory of (process.env.PATH || "").split(path.delimiter)) {
    if (!directory) continue;
    const candidate = path.join(directory, name);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return fs.realpathSync(candidate);
    } catch {
      // Continue searching PATH.
    }
  }
  throw new Error(`${name} executable is unavailable`);
}

function installWorktreeRemovalResidue(fixture, {
  relativePath,
  contents,
}) {
  const originalPath = process.env.PATH;
  const realGit = executableFromPath("git");
  const wrapperRoot = fs.mkdtempSync(path.join(os.tmpdir(), "senti-git-wrapper-"));
  const wrapperPath = path.join(wrapperRoot, "git");
  fs.writeFileSync(wrapperPath, `#!${process.execPath}
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const args = process.argv.slice(2);
const result = spawnSync(${JSON.stringify(realGit)}, args, { encoding: "utf8" });
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
const worktreeIndex = args.indexOf("worktree");
if (
  result.status === 0
  && worktreeIndex >= 0
  && args[worktreeIndex + 1] === "remove"
  && args.includes(${JSON.stringify(fixture.worktreePath)})
) {
  const target = path.join(
    ${JSON.stringify(fixture.worktreePath)},
    ${JSON.stringify(relativePath)},
  );
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, ${JSON.stringify(contents)});
  fs.mkdirSync(
    path.join(${JSON.stringify(fixture.worktreePath)}, ".senti"),
    { recursive: true },
  );
}
process.exit(result.status == null ? 1 : result.status);
`);
  fs.chmodSync(wrapperPath, 0o755);
  process.env.PATH = `${wrapperRoot}${path.delimiter}${originalPath || ""}`;
  return () => {
    if (originalPath == null) delete process.env.PATH;
    else process.env.PATH = originalPath;
    fs.rmSync(wrapperRoot, { recursive: true, force: true });
  };
}

function assertReceiptlessReconcileRejected(fixture) {
  const inspected = getDirectFlowAction(fixture.context());
  assert.equal(
    inspected.actionPrompt.choices.some((entry) => (
      entry.actionId === "SELECT_DIRECT_RECONCILE"
    )),
    false,
  );
  assert.equal(inspected.evidence, null);
  assert.equal(inspected.actionPrompt.recommendedActionId, "SELECT_DIRECT_FIX");
}

test("direct fix persists its plan before changes and completes through shared teardown", async () => {
  const fixture = createDirectFlowFixture();
  try {
    container.register("config", { commands: { gh: "disable" } });
    const initial = fixture.context().flowState;
    const initialSteps = stepStatuses(initial);
    const selection = getDirectFlowAction(fixture.context());

    assert.equal(selection.code, "DIRECT_SELECTION_REQUIRED");
    assert.equal(selection.yieldsControl, true);
    assert.deepEqual(
      selection.actionPrompt.choices.map((entry) => entry.actionId),
      ["SELECT_DIRECT_FIX", "CONTINUE_NORMAL_FLOW"],
    );
    assert.equal(
      selection.actionPrompt.choices
        .find((entry) => entry.actionId === "SELECT_DIRECT_FIX")
        .nextAction.includes("<paths>"),
      false,
    );
    assert.equal(selection.autoApproveSelectedDirect, false);

    const selected = await runDirectFlowAction(fixture.context(), {
      action: "SELECT_DIRECT_FIX",
      reason: "Apply only the bounded direct fixture change.",
      scope: ["src/direct-fixture.js"],
      source: "manual",
    });
    assert.equal(selected.code, "DIRECT_IMPLEMENTATION_REQUIRED");
    assert.equal(selected.requiresUserAction, false);

    const plannedState = fixture.context().flowState;
    const session = DirectFlowSession.fromStored(plannedState.directFlowSession);
    const plan = DirectResolutionPlan.fromStored(plannedState.directResolutionPlan);
    assert.equal(session.phase, "DIRECT_FIX");
    assert.equal(session.planId, plan.planId);
    assert.equal(session.planRevision, plan.revision);
    assert.equal(plan.selectionSource, "manual");
    assert.equal(plan.adoptedActionId, "SELECT_DIRECT_FIX");
    assert.deepEqual(stepStatuses(plannedState), initialSteps);
    assert.ok(fs.existsSync(path.join(fixture.worktreePath, "specs", fixture.specId, "issue-log.json")));

    const sourcePath = path.join(fixture.worktreePath, "src", "direct-fixture.js");
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, "export const directFixture = true;\n");

    await confirmDirectImplementation(fixture);
    const verified = await runDirectFlowAction(fixture.context(), {
      action: "VERIFY_DIRECT",
      testCommand: "node -e \"process.exit(0)\"",
      timeoutMs: 10_000,
    });
    assert.equal(verified.code, "DIRECT_VERIFY_PASSED");
    assert.equal(verified.yieldsControl, true);
    assert.equal(
      verified.actionPrompt.choices.some((entry) => entry.actionId === "FINALIZE_DIRECT"),
      true,
    );

    const verifiedState = fixture.context().flowState;
    assert.equal(verifiedState.directFlowSession.phase, "DIRECT_VERIFY");
    assert.equal(verifiedState.directFlowSession.verification.status, "passed");
    assert.deepEqual(stepStatuses(verifiedState), initialSteps);

    const finalized = await runDirectFlowAction(fixture.context(), {
      action: "FINALIZE_DIRECT",
    });
    assert.equal(finalized.ok, true);
    assert.equal(finalized.data.status, "done");
    assert.equal(finalized.data.completionMode, "direct");
    assert.equal(finalized.data.mergeDisposition, "merged");
    assert.ok(finalized.data.receiptId);

    assert.equal(fs.existsSync(fixture.worktreePath), false);
    assert.equal(git(fixture.root, ["branch", "--list", fixture.featureBranch]), "");
    assert.equal(
      fs.readFileSync(path.join(fixture.root, ".senti", "last-finalized-spec"), "utf8"),
      `${fixture.spec}\n`,
    );

    const main = fixture.context({ fromMain: true });
    const completedState = main.flowState;
    const completion = new FlowCompletion(completedState);
    const completionReceipt = completedState.directCompletionReceipt;
    assert.equal(completion.complete, true);
    assert.equal(completion.completionMode, "direct");
    assert.equal(completionReceipt.status, "completed");
    assert.equal(completionReceipt.completionMode, "direct");
    assert.equal(completionReceipt.mergeDisposition, "merged");
    assert.equal(completionReceipt.sourceStep, "implement");
    assert.equal(completionReceipt.gitEvidence.kind, "integration-receipt");
    assert.equal(completionReceipt.gitEvidence.receiptKey, completedState.directIntegrationReceipt.receiptId);
    assert.equal(completionReceipt.gitEvidence.receiptCommit, completionReceipt.gitEvidence.mainHead);
    assert.equal(completionReceipt.minimalValidation.status, "passed");
    assert.equal(completionReceipt.reconciledAt, null);
    assert.ok(completionReceipt.completedAt);
    assert.ok(completionReceipt.externalUpdateKey);
    assert.equal(completionReceipt.skippedSteps.length > 0, true);
    assert.equal(
      completionReceipt.skippedSteps.every((step) => (
        step.reason === "direct-limited-completion: normal post-impl step was not executed or credited"
      )),
      true,
    );
    assert.equal(
      completionReceipt.summary.includes("mode=direct; merge=merged; sourceStep=implement"),
      true,
    );
    assert.deepEqual(stepStatuses(completedState), initialSteps);
    assert.equal(
      main.flowManager.snapshotActiveFlows().entries.some((entry) => entry.spec === fixture.specId),
      false,
    );

    const finalQuery = getDirectFlowAction(main);
    assert.equal(finalQuery.code, "COMPLETED_DIRECT");
    assert.equal(finalQuery.yieldsControl, false);
    assert.equal(finalQuery.completion.status, "completed");

    const issueLog = JSON.parse(fs.readFileSync(
      path.join(fixture.root, "specs", fixture.specId, "issue-log.json"),
      "utf8",
    ));
    const directEntries = issueLog.entries.filter((entry) => (
      ["direct-handoff-preflight", "direct-completion"].includes(entry.step)
    ));
    assert.equal(directEntries.filter((entry) => entry.step === "direct-handoff-preflight").length, 1);
    assert.equal(directEntries.filter((entry) => entry.step === "direct-completion").length, 1);
  } finally {
    container.reset();
    fixture.cleanup();
  }
});

test("direct finalize revalidates a rebased pending receipt and resumes integration", async () => {
  const fixture = createDirectFlowFixture({ specId: "476-rebased-pending-receipt" });
  try {
    container.register("config", {
      commands: { gh: "disable" },
      flow: { push: { remote: "missing-direct-remote" } },
    });
    await prepareVerifiedDirectChange(fixture, {
      relativePath: "src/rebased-direct.js",
      contents: "export const rebasedDirect = true;\n",
      reason: "Verify pending integration recovery after a feature rebase.",
    });

    const interrupted = await runDirectFlowAction(fixture.context(), {
      action: "FINALIZE_DIRECT",
    });
    assert.equal(interrupted.ok, false, JSON.stringify(interrupted));
    assert.equal(interrupted.errors[0].code, "DIRECT_MERGE_FAILED");
    const pending = fixture.context().flowState;
    const originalPlanRevision = pending.directResolutionPlan.revision;
    assert.equal(pending.directFlowSession.phase, "MERGE_ONLY_FINALIZE");
    assert.equal(pending.directIntegrationReceipt.status, "pending");
    assert.equal(pending.directCompletionReceipt, undefined);

    fs.writeFileSync(path.join(fixture.root, "base-after-verification.txt"), "new base\n");
    git(fixture.root, ["add", "base-after-verification.txt"]);
    git(fixture.root, ["commit", "--quiet", "-m", "advance base before direct retry"]);
    git(fixture.root, ["push", "--quiet", "origin", "master"]);
    git(fixture.worktreePath, ["rebase", "master"]);
    fs.writeFileSync(
      path.join(fixture.worktreePath, "src", "rebased-direct.js"),
      "export const rebasedDirect = \"resolved-after-rebase\";\n",
    );
    git(fixture.worktreePath, ["add", "src/rebased-direct.js"]);
    git(fixture.worktreePath, [
      "commit",
      "--quiet",
      "-m",
      "resolve direct content after rebase",
    ]);
    const rebasedHead = git(fixture.worktreePath, ["rev-parse", "HEAD"]);
    assert.notEqual(rebasedHead, pending.directIntegrationReceipt.featureHead);

    const suspended = await runDirectFlowAction(fixture.context(), {
      action: "SUSPEND_DIRECT",
      reason: "Exercise recovery after an operator suspended the stale integration receipt.",
    });
    assert.equal(suspended.code, "SUSPENDED_PENDING_INTEGRATION");
    assert.equal(suspended.requiresUserAction, false);
    assert.equal(suspended.continuation.actionId, "RESUME_DIRECT");

    const resumed = await runDirectFlowAction(fixture.context(), {
      action: "RESUME_DIRECT",
    });
    assert.equal(resumed.code, "MERGE_ONLY_FINALIZE");
    assert.equal(resumed.requiresUserAction, false);
    assert.equal(resumed.actionPrompt, undefined);
    assert.equal(resumed.continuation.actionId, "FINALIZE_DIRECT");

    container.register("config", {
      commands: { gh: "disable" },
      flow: { push: { remote: "origin" } },
    });
    const finalized = await runDirectFlowAction(fixture.context(), {
      action: "FINALIZE_DIRECT",
    });
    assert.equal(finalized.ok, true, JSON.stringify(finalized));
    assert.equal(finalized.data.status, "done");

    const completed = fixture.context({ fromMain: true }).flowState;
    assert.equal(completed.directFlowSession.phase, "COMPLETED_DIRECT");
    assert.equal(
      completed.directResolutionPlan.revision,
      originalPlanRevision + 1,
    );
    assert.equal(completed.directCompletionReceipt.minimalValidation.status, "passed");
    assert.equal(
      completed.directCompletionReceipt.minimalValidation.testCommand,
      "node -e \"process.exit(0)\"",
    );
    assert.equal(
      git(fixture.root, ["show", "master:src/rebased-direct.js"]),
      "export const rebasedDirect = \"resolved-after-rebase\";",
    );
    assert.equal(fs.existsSync(fixture.worktreePath), false);
  } finally {
    container.reset();
    fixture.cleanup();
  }
});

test("direct finalize revalidates an internal pre-merge rebase before integrating", async () => {
  const fixture = createDirectFlowFixture({ specId: "476-premerge-revalidation" });
  try {
    container.register("config", { commands: { gh: "disable" } });
    await prepareVerifiedDirectChange(fixture, {
      relativePath: "src/premerge-revalidation.js",
      contents: "export const premergeRevalidation = true;\n",
      reason: "Revalidate a feature after finalize synchronizes an advanced base.",
    });
    const beforeFinalize = fixture.context().flowState;
    const originalVerifiedAt = beforeFinalize.directFlowSession.verification.verifiedAt;

    fs.writeFileSync(path.join(fixture.root, "base-before-finalize.txt"), "advanced base\n");
    git(fixture.root, ["add", "base-before-finalize.txt"]);
    git(fixture.root, ["commit", "--quiet", "-m", "advance base before finalize"]);
    git(fixture.root, ["push", "--quiet", "origin", "master"]);

    const finalized = await runDirectFlowAction(fixture.context(), {
      action: "FINALIZE_DIRECT",
    });
    assert.equal(finalized.ok, true, JSON.stringify(finalized));
    const completed = fixture.context({ fromMain: true }).flowState;
    assert.equal(completed.directFlowSession.phase, "COMPLETED_DIRECT");
    assert.equal(completed.directResolutionPlan.revision, 2);
    assert.equal(completed.directCompletionReceipt.minimalValidation.status, "passed");
    assert.notEqual(
      completed.directCompletionReceipt.minimalValidation.verifiedAt,
      originalVerifiedAt,
    );
    assert.equal(
      git(fixture.root, ["show", "master:base-before-finalize.txt"]),
      "advanced base",
    );
  } finally {
    container.reset();
    fixture.cleanup();
  }
});

test("direct finalize ignores a deletion already committed on the feature branch", async () => {
  const fixture = createDirectFlowFixture({ specId: "476-committed-deletion" });
  try {
    container.register("config", { commands: { gh: "disable" } });
    const deletedRel = "src/retired-direct.js";
    const deletedMainPath = path.join(fixture.root, deletedRel);
    fs.mkdirSync(path.dirname(deletedMainPath), { recursive: true });
    fs.writeFileSync(deletedMainPath, "export const retired = true;\n");
    git(fixture.root, ["add", deletedRel]);
    git(fixture.root, ["commit", "--quiet", "-m", "add file retired by direct fix"]);
    git(fixture.worktreePath, ["rebase", "master"]);

    fs.unlinkSync(path.join(fixture.worktreePath, deletedRel));
    git(fixture.worktreePath, ["add", "-A", "--", deletedRel]);
    git(fixture.worktreePath, ["commit", "--quiet", "-m", "remove retired direct file"]);

    await runDirectFlowAction(fixture.context(), {
      action: "SELECT_DIRECT_FIX",
      reason: "Finalize a bounded deletion that is already committed on the feature branch.",
      scope: [deletedRel],
      source: "manual",
    });
    await confirmDirectImplementation(fixture);
    const verified = await runDirectFlowAction(fixture.context(), {
      action: "VERIFY_DIRECT",
      testCommand: "node -e \"process.exit(0)\"",
      timeoutMs: 10_000,
    });
    assert.equal(verified.code, "DIRECT_VERIFY_PASSED", JSON.stringify(verified));

    const finalized = await runDirectFlowAction(fixture.context(), {
      action: "FINALIZE_DIRECT",
    });

    assert.equal(finalized.ok, true, JSON.stringify(finalized));
    assert.equal(finalized.data.status, "done");
    assert.equal(git(fixture.root, ["ls-tree", "--name-only", "HEAD", deletedRel]), "");
    assert.equal(fs.existsSync(fixture.worktreePath), false);
    assert.equal(git(fixture.root, ["branch", "--list", fixture.featureBranch]), "");
  } finally {
    container.reset();
    fixture.cleanup();
  }
});

test("passing tests cannot be run or finalized before implementation completion is recorded", async () => {
  const fixture = createDirectFlowFixture({ specId: "476-implementation-proof" });
  try {
    await runDirectFlowAction(fixture.context(), {
      action: "SELECT_DIRECT_FIX",
      reason: "Keep implementation and verification as separate direct recovery decisions.",
      scope: ["src/implementation-proof.js"],
      source: "manual",
    });
    const sourcePath = path.join(fixture.worktreePath, "src", "implementation-proof.js");
    const testSentinel = path.join(fixture.worktreePath, "verification-ran.txt");
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, "export const implementationProof = true;\n");

    const before = getDirectFlowAction(fixture.context());
    assert.equal(before.code, "DIRECT_IMPLEMENTATION_REQUIRED");
    assert.equal(before.requiresUserAction, false);
    assert.equal(before.actionPrompt, undefined);

    const blocked = await runDirectFlowAction(fixture.context(), {
      action: "VERIFY_DIRECT",
      testCommand: "node -e \"require('fs').writeFileSync('verification-ran.txt', 'yes')\"",
      timeoutMs: 10_000,
    });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.errors[0].code, "DIRECT_IMPLEMENTATION_NOT_READY");
    assert.equal(fs.existsSync(testSentinel), false);
    assert.equal(fixture.context().flowState.directFlowSession.phase, "DIRECT_FIX");
    assert.equal(fixture.context().flowState.directFlowSession.verification, null);

    await confirmDirectImplementation(fixture);
    const verified = await runDirectFlowAction(fixture.context(), {
      action: "VERIFY_DIRECT",
      testCommand: "node -e \"process.exit(0)\"",
      timeoutMs: 10_000,
    });
    assert.equal(verified.code, "DIRECT_VERIFY_PASSED");
    assert.equal(
      fixture.context().flowState.directFlowSession.verification.checks
        .find((check) => check.id === "implementation-readiness").passed,
      true,
    );
  } finally {
    fixture.cleanup();
  }
});

test("direct cleanup recovers a missing worktree binding from durable finalize authority", async () => {
  const fixture = createDirectFlowFixture({ specId: "476-missing-binding-cleanup" });
  try {
    container.register("config", { commands: { gh: "disable" } });
    const pluginId = "remove-binding-during-cleanup";
    const pluginRoot = path.join(fixture.worktreePath, ".senti", "plugins", pluginId);
    fs.mkdirSync(path.join(pluginRoot, "hooks"), { recursive: true });
    fs.writeFileSync(
      path.join(fixture.worktreePath, ".senti", "config.json"),
      `${JSON.stringify({
        lang: "en",
        type: "base",
        commands: { gh: "disable" },
        docs: { languages: ["en"], defaultLanguage: "en" },
        plugin: { packages: [{ id: pluginId }] },
      }, null, 2)}\n`,
    );
    fs.writeFileSync(path.join(pluginRoot, "hooks", "finalize.js"), `
      import fs from "node:fs";
      import path from "node:path";

      export default function register(api) {
        return class RemoveBindingDuringCleanup extends api.FlowCommandHook {
          static command = "finalize-cleanup";
          static hook = "pre";
          static failurePolicy = "required";
          async run(context) {
            fs.unlinkSync(path.join(context.project.root, ".senti", "flow-identity.json"));
            return context.envelope.ok("plugin-hook", "finalize-cleanup", {});
          }
        };
      }
    `);
    fixture.context().flowManager.mutate((state) => {
      state.plugins = { flowCommandHooks: [{
        apiVersion: 1,
        pluginId,
        module: "hooks/finalize.js",
        className: "RemoveBindingDuringCleanup",
        command: "finalize-cleanup",
        hook: "pre",
        priority: 0,
        failurePolicy: "required",
      }] };
    });
    git(fixture.worktreePath, ["add", ".senti", `specs/${fixture.specId}/flow.json`]);
    git(fixture.worktreePath, ["commit", "--quiet", "-m", "add binding cleanup fixture"]);

    await runDirectFlowAction(fixture.context(), {
      action: "SELECT_DIRECT_FIX",
      reason: "Exercise durable direct cleanup after the worktree binding disappears.",
      scope: ["src/missing-binding-cleanup.js"],
      source: "manual",
    });
    const sourcePath = path.join(fixture.worktreePath, "src", "missing-binding-cleanup.js");
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, "export const missingBindingCleanup = true;\n");
    await confirmDirectImplementation(fixture);
    await runDirectFlowAction(fixture.context(), {
      action: "VERIFY_DIRECT",
      testCommand: "node -e \"process.exit(0)\"",
      timeoutMs: 10_000,
    });

    const finalized = await runDirectFlowAction(fixture.context(), {
      action: "FINALIZE_DIRECT",
    });
    assert.equal(finalized.ok, true, JSON.stringify(finalized));
    assert.equal(finalized.data.status, "done");
    assert.equal(fs.existsSync(fixture.worktreePath), false);
    assert.equal(git(fixture.root, ["branch", "--list", fixture.featureBranch]), "");
  } finally {
    container.reset();
    fixture.cleanup();
  }
});

test("direct cleanup preserves and removes runtime-only residue recreated after worktree removal", async () => {
  const fixture = createDirectFlowFixture({ specId: "476-runtime-residue-cleanup" });
  try {
    container.register("config", { commands: { gh: "disable" } });
    await prepareVerifiedDirectChange(fixture, {
      relativePath: "src/runtime-residue-cleanup.js",
      contents: "export const runtimeResidueCleanup = true;\n",
      reason: "Exercise direct cleanup after runtime logging recreates the removed worktree.",
    });
    const restoreGit = installWorktreeRemovalResidue(fixture, {
      relativePath: ".tmp/logs/recreated.log",
      contents: "preserved runtime evidence\n",
    });
    let finalized;
    try {
      finalized = await runDirectFlowAction(fixture.context(), {
        action: "FINALIZE_DIRECT",
      });
    } finally {
      restoreGit();
    }

    assert.equal(finalized.ok, true, JSON.stringify(finalized));
    assert.equal(fs.existsSync(fixture.worktreePath), false);
    assert.equal(git(fixture.root, ["branch", "--list", fixture.featureBranch]), "");
    const recoveryRoot = path.join(
      fixture.root,
      ".senti",
      "recovery",
      "finalize-cleanup-residue",
    );
    const recoveryEntries = fs.readdirSync(recoveryRoot);
    assert.equal(recoveryEntries.length, 1);
    assert.equal(
      fs.readFileSync(path.join(
        recoveryRoot,
        recoveryEntries[0],
        ".tmp",
        "logs",
        "recreated.log",
      ), "utf8"),
      "preserved runtime evidence\n",
    );
  } finally {
    container.reset();
    fixture.cleanup();
  }
});

test("direct cleanup refuses to remove unexpected files recreated after worktree removal", async () => {
  const fixture = createDirectFlowFixture({ specId: "476-unsafe-residue-cleanup" });
  try {
    container.register("config", { commands: { gh: "disable" } });
    await prepareVerifiedDirectChange(fixture, {
      relativePath: "src/unsafe-residue-cleanup.js",
      contents: "export const unsafeResidueCleanup = true;\n",
      reason: "Exercise the fail-closed boundary for recreated worktree content.",
    });
    const restoreGit = installWorktreeRemovalResidue(fixture, {
      relativePath: "src/unexpected.js",
      contents: "export const unexpected = true;\n",
    });
    let stopped;
    try {
      stopped = await runDirectFlowAction(fixture.context(), {
        action: "FINALIZE_DIRECT",
      });
    } finally {
      restoreGit();
    }

    assert.equal(stopped.ok, false, JSON.stringify(stopped));
    assert.equal(stopped.errors[0].code, "WORKTREE_RUNTIME_RESIDUE_RECOVERY_FAILED");
    assert.equal(
      fs.readFileSync(
        path.join(fixture.worktreePath, "src", "unexpected.js"),
        "utf8",
      ),
      "export const unexpected = true;\n",
    );
    assert.equal(
      fs.existsSync(path.join(
        fixture.root,
        ".senti",
        "recovery",
        "finalize-cleanup-residue",
      )),
      false,
    );
  } finally {
    container.reset();
    fixture.cleanup();
  }
});

test("prepared direct cleanup resumes mechanically across a retained legacy abort", async () => {
  const fixture = createDirectFlowFixture({ specId: "476-aborted-prepared-cleanup" });
  try {
    container.register("config", { commands: { gh: "disable" } });
    await prepareVerifiedDirectChange(fixture, {
      relativePath: "src/aborted-prepared-cleanup.js",
      contents: "export const abortedPreparedCleanup = true;\n",
      reason: "Exercise cleanup after an aborted direct completion.",
    });
    const restoreGit = installWorktreeRemovalResidue(fixture, {
      relativePath: "src/unexpected.js",
      contents: "export const unexpected = true;\n",
    });
    let stopped;
    try {
      stopped = await runDirectFlowAction(fixture.context(), {
        action: "FINALIZE_DIRECT",
      });
    } finally {
      restoreGit();
    }
    assert.equal(stopped.errors[0].code, "WORKTREE_RUNTIME_RESIDUE_RECOVERY_FAILED");

    const main = fixture.context({ fromMain: true });
    const abortReason = "Retain a legacy abort recorded after completion preparation.";
    await assert.rejects(
      runDirectFlowAction(main, {
        action: "ABORT_DIRECT",
        reason: abortReason,
      }),
      (error) => error?.code === "DIRECT_FINALIZATION_ALREADY_STARTED",
    );
    assert.equal(
      main.flowManager.load(fixture.specId).directFlowSession.phase,
      "MERGE_ONLY_FINALIZE",
    );
    assert.equal(main.flowManager.load(fixture.specId).directCompletionReceipt.status, "prepared");
    persistLegacyAbortAfterPreparedCleanup(fixture, abortReason);
    const continuation = getDirectFlowAction(fixture.context({ fromMain: true }));
    assert.equal(continuation.code, "DIRECT_PREPARED_CLEANUP");
    assert.equal(continuation.yieldsControl, false);
    assert.equal(continuation.requiresUserAction, false);
    assert.equal(continuation.actionPrompt, undefined);
    assert.equal(continuation.continuation.actionId, "FINALIZE_DIRECT");
    assert.equal(continuation.preparedCleanup.interruptedPhase, "ABORTED");
    fs.rmSync(path.join(fixture.worktreePath, "src"), { recursive: true, force: true });

    const resumed = await runDirectFlowAction(fixture.context({ fromMain: true }), {
      action: "FINALIZE_DIRECT",
    });
    assert.equal(resumed.ok, true, JSON.stringify(resumed));
    assert.equal(resumed.data.status, "done");
    const completed = fixture.context({ fromMain: true }).flowState;
    assert.equal(completed.directFlowSession.phase, "COMPLETED_DIRECT");
    assert.equal(completed.directCompletionReceipt.status, "completed");
    assert.equal(completed.directAbortReceipt, undefined);
    assert.equal(completed.directAbortHistory.receipts.length, 1);
    assert.equal(completed.directAbortHistory.receipts[0].reason, abortReason);
    assert.equal(fs.existsSync(fixture.worktreePath), false);
    assert.equal(git(fixture.root, ["branch", "--list", fixture.featureBranch]), "");
    assert.equal(fs.readFileSync(path.join(fixture.root, ".senti", "last-finalized-spec"), "utf8").trim(), fixture.spec);
    assert.equal(fixture.context({ fromMain: true }).flowManager.snapshotActiveFlows().entries.some((entry) => (
      entry.spec === fixture.specId
    )), false);
    const issueLog = JSON.parse(fs.readFileSync(
      path.join(fixture.root, "specs", fixture.specId, "issue-log.json"),
      "utf8",
    ));
    assert.equal(issueLog.entries.some((entry) => entry.step === "direct-completion"), true);
  } finally {
    container.reset();
    fixture.cleanup();
  }
});

test("direct fix derives its scope and verification command from Flow evidence", async () => {
  const fixture = createDirectFlowFixture({ specId: "476-derived-direct-inputs" });
  try {
    commitSpecArtifact(fixture, "test-execute-result.json", {
      summary: [
        { evidence: { command: "node -e \"process.exit(0)\"" } },
        { evidence: { command: "node -e \"process.exit(0)\"" } },
      ],
    }, "record direct verification command");
    const sourcePath = path.join(fixture.worktreePath, "src", "derived-direct-inputs.js");
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, "export const derivedDirectInputs = true;\n");

    const selected = await runDirectFlowAction(fixture.context(), {
      action: "SELECT_DIRECT_FIX",
      reason: "Continue the explicitly requested direct repair.",
      source: "manual",
    });
    assert.equal(selected.code, "DIRECT_IMPLEMENTATION_REQUIRED");
    assert.equal(
      selected.verificationCommand.command,
      "node -e \"process.exit(0)\"",
    );

    const plan = DirectResolutionPlan.fromStored(
      fixture.context().flowState.directResolutionPlan,
    );
    assert.equal(plan.scopePaths.includes("src/derived-direct-inputs.js"), true);

    await confirmDirectImplementation(fixture);
    const verified = await runDirectFlowAction(fixture.context(), {
      action: "VERIFY_DIRECT",
      timeoutMs: 10_000,
    });
    assert.equal(verified.code, "DIRECT_VERIFY_PASSED");
    assert.equal(
      fixture.context().flowState.directFlowSession.verification.testCommand,
      "node -e \"process.exit(0)\"",
    );
  } finally {
    fixture.cleanup();
  }
});

test("direct suspend resumes the exact phase and abort retains Git state", async () => {
  const fixture = createDirectFlowFixture({ specId: "476-suspend" });
  try {
    const initialSteps = stepStatuses(fixture.context().flowState);
    await runDirectFlowAction(fixture.context(), {
      action: "SELECT_DIRECT_FIX",
      reason: "Prepare the bounded fix before an intentional suspension.",
      scope: ["src/suspended-fix.js"],
      source: "manual",
    });

    const suspended = await runDirectFlowAction(fixture.context(), {
      action: "SUSPEND_DIRECT",
      reason: "Pause while retaining the exact direct target.",
    });
    assert.equal(suspended.code, "SUSPENDED");
    assert.equal(suspended.directFlowSession.suspendedFrom, "DIRECT_FIX");
    assert.equal(
      fixture.context().flowManager.snapshotActiveFlows().entries.some((entry) => (
        entry.spec === fixture.specId
      )),
      false,
    );
    assert.equal(fs.existsSync(fixture.worktreePath), true);

    const resumed = await runDirectFlowAction(fixture.context(), {
      action: "RESUME_DIRECT",
    });
    assert.equal(resumed.code, "DIRECT_IMPLEMENTATION_REQUIRED");
    assert.equal(resumed.directFlowSession.phase, "DIRECT_FIX");
    assert.equal(
      fixture.context().flowManager.snapshotActiveFlows().entries.some((entry) => (
        entry.spec === fixture.specId && entry.mode === "worktree"
      )),
      true,
    );

    const aborted = await runDirectFlowAction(fixture.context(), {
      action: "ABORT_DIRECT",
      reason: "Retain this incomplete direct target for manual inspection.",
    });
    assert.equal(aborted.code, "ABORTED");
    assert.equal(aborted.directFlowSession.phase, "ABORTED");
    const abortedState = fixture.context().flowState;
    assert.equal(abortedState.directAbortReceipt.status, "aborted");
    assert.equal(abortedState.directAbortReceipt.completionMode, "aborted");
    assert.equal(new FlowCompletion(abortedState).success, false);
    assert.deepEqual(stepStatuses(abortedState), initialSteps);
    assert.equal(fs.existsSync(fixture.worktreePath), true);
    assert.notEqual(git(fixture.root, ["branch", "--list", fixture.featureBranch]), "");
    const prompt = getDirectFlowAction(fixture.context());
    assert.equal(prompt.actionPrompt.recommendedActionId, "REOPEN_ABORTED_DIRECT");
    assert.equal(
      prompt.actionPrompt.choices[0].actionId,
      "REOPEN_ABORTED_DIRECT",
    );
    const resume = new RunResumeCommand().execute(fixture.context());
    assert.equal(resume.completion.completionMode, "aborted");
    assert.equal(resume.directFlowSession.phase, "ABORTED");
    assert.equal(resume.recommendedSkill, "senti.flow-direct");
  } finally {
    fixture.cleanup();
  }
});

test("direct abort can reopen the retained target and complete with archived abort evidence", async () => {
  const fixture = createDirectFlowFixture({ specId: "476-reopen-aborted" });
  try {
    container.register("config", { commands: { gh: "disable" } });
    const initialSteps = stepStatuses(fixture.context().flowState);
    await runDirectFlowAction(fixture.context(), {
      action: "SELECT_DIRECT_FIX",
      reason: "Prepare the bounded target before exercising abort recovery.",
      scope: ["src/reopened-direct.js"],
      source: "manual",
    });
    const sourcePath = path.join(fixture.worktreePath, "src", "reopened-direct.js");
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, "export const reopenedDirect = true;\n");

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await confirmDirectImplementation(fixture);
      const failed = await runDirectFlowAction(fixture.context(), {
        action: "VERIFY_DIRECT",
        testCommand: "node -e \"process.exit(1)\"",
        timeoutMs: 10_000,
      });
      assert.equal(
        ["DIRECT_VERIFY_STOPPED", "DIRECT_VERIFICATION_LIMIT"].includes(failed.code),
        true,
      );
      if (attempt < 2) {
        const returned = await runDirectFlowAction(fixture.context(), {
          action: "RETURN_TO_DIRECT_FIX",
        });
        assert.equal(returned.code, "DIRECT_IMPLEMENTATION_REQUIRED");
      }
    }

    const aborted = await runDirectFlowAction(fixture.context(), {
      action: "ABORT_DIRECT",
      reason: "Retain the failed target until its deterministic fixture is corrected.",
    });
    assert.equal(aborted.code, "ABORTED");
    const abortedState = fixture.context().flowState;
    const abortReceiptId = abortedState.directAbortReceipt.receiptId;
    const originalPlanRevision = abortedState.directResolutionPlan.revision;

    const reopened = await runDirectFlowAction(fixture.context(), {
      action: "REOPEN_ABORTED_DIRECT",
      reason: "Continue the retained target after correcting its deterministic fixture.",
    });
    assert.equal(reopened.code, "DIRECT_IMPLEMENTATION_REQUIRED");
    const reopenedState = fixture.context().flowState;
    assert.equal(reopenedState.directFlowSession.phase, "DIRECT_FIX");
    assert.equal(reopenedState.directFlowSession.verificationAttempts, 0);
    assert.equal(reopenedState.directFlowSession.verification.status, "failed");
    assert.equal(reopenedState.directFlowSession.completion, null);
    assert.equal(reopenedState.directAbortReceipt, undefined);
    assert.equal(reopenedState.directAbortHistory.receipts.length, 1);
    assert.equal(reopenedState.directAbortHistory.receipts[0].receiptId, abortReceiptId);
    assert.equal(reopenedState.directResolutionPlan.revision, originalPlanRevision + 1);
    assert.deepEqual(stepStatuses(reopenedState), initialSteps);

    await confirmDirectImplementation(fixture);
    const verified = await runDirectFlowAction(fixture.context(), {
      action: "VERIFY_DIRECT",
      testCommand: "node -e \"process.exit(0)\"",
      timeoutMs: 10_000,
    });
    assert.equal(verified.code, "DIRECT_VERIFY_PASSED");
    assert.equal(fixture.context().flowState.directFlowSession.verificationAttempts, 1);

    const finalized = await runDirectFlowAction(fixture.context(), {
      action: "FINALIZE_DIRECT",
    });
    assert.equal(finalized.ok, true, JSON.stringify(finalized));
    assert.equal(finalized.data.status, "done");
    const completed = fixture.context({ fromMain: true }).flowState;
    assert.equal(completed.directFlowSession.phase, "COMPLETED_DIRECT");
    assert.equal(completed.directAbortHistory.receipts[0].receiptId, abortReceiptId);
  } finally {
    container.reset();
    fixture.cleanup();
  }
});

test("direct suspend resumes a finalized normal Flow without parking its active entry", async () => {
  const fixture = createDirectFlowFixture({ specId: "476-finalized-suspend" });
  try {
    await runDirectFlowAction(fixture.context(), {
      action: "SELECT_DIRECT_FIX",
      reason: "Prepare the direct target before suspending finalized normal state.",
      scope: ["src/finalized-suspend.js"],
      source: "manual",
    });
    fixture.context().flowManager.mutate((state) => {
      state.state = { ...(state.state || {}), finalizedAt: new Date().toISOString() };
    });

    const suspended = await runDirectFlowAction(fixture.context(), {
      action: "SUSPEND_DIRECT",
      reason: "Pause the direct target while retaining finalized normal state.",
    });
    assert.equal(suspended.code, "SUSPENDED");
    assert.equal(
      fixture.context().flowManager.snapshotActiveFlows().entries.some((entry) => (
        entry.spec === fixture.specId && entry.mode === "worktree"
      )),
      true,
    );

    const resumed = await runDirectFlowAction(fixture.context(), {
      action: "RESUME_DIRECT",
    });
    assert.equal(resumed.code, "DIRECT_IMPLEMENTATION_REQUIRED");
    assert.equal(resumed.directFlowSession.phase, "DIRECT_FIX");
  } finally {
    fixture.cleanup();
  }
});

test("direct inspection returns a safe handoff while a repository Flow operation is active", () => {
  const fixture = createDirectFlowFixture({ specId: "476-concurrency" });
  const operation = new RepositoryFlowOperationLock({ mainRoot: fixture.root });
  const ownerToken = operation.acquire();
  try {
    assert.ok(ownerToken);
    const inspected = getDirectFlowAction(fixture.context());
    assert.equal(inspected.code, "REPOSITORY_FLOW_OPERATION_BUSY");
    assert.equal(inspected.yieldsControl, true);
    assert.equal(inspected.actionPrompt.recommendedActionId, "RETRY_DIRECT_HANDOFF");
    assert.equal(
      inspected.actionPrompt.choices.some((entry) => (
        entry.actionId === "RETRY_DIRECT_HANDOFF"
          && entry.impact.retains.includes("Flow state")
      )),
      true,
    );
    assert.equal(fixture.context().flowState.directFlowSession, undefined);
  } finally {
    operation.release();
    fixture.cleanup();
  }
});

test("direct inspection is repeatable and a parked Flow remains unchanged and unsupported", async () => {
  const fixture = createDirectFlowFixture({ specId: "476-read-only" });
  try {
    const flowPath = path.join(
      fixture.worktreePath,
      "specs",
      fixture.specId,
      "flow.json",
    );
    const bindingPath = path.join(
      fixture.worktreePath,
      ".senti",
      "flow-identity.json",
    );
    const registryPath = path.join(fixture.root, ".senti", ".active-flow");
    const snapshot = () => ({
      flow: fs.readFileSync(flowPath),
      binding: fs.readFileSync(bindingPath),
      registry: fs.existsSync(registryPath) ? fs.readFileSync(registryPath) : null,
      head: git(fixture.worktreePath, ["rev-parse", "HEAD"]),
      status: git(fixture.worktreePath, ["status", "--porcelain=v1"]),
    });

    const before = snapshot();
    assert.equal(getDirectFlowAction(fixture.context()).code, "DIRECT_SELECTION_REQUIRED");
    assert.equal(getDirectFlowAction(fixture.context()).code, "DIRECT_SELECTION_REQUIRED");
    assert.deepEqual(snapshot(), before);

    fixture.context().flowManager.parkActiveFlow(new ParkedFlowIdentity({
      expectRunId: fixture.runId,
      expectSpec: fixture.spec,
      expectIssue: fixture.issue,
    }));
    const parked = snapshot();
    const inspected = getDirectFlowAction(fixture.context());
    assert.equal(inspected.code, "DIRECT_MODE_UNSUPPORTED");
    assert.equal(inspected.yieldsControl, false);
    assert.equal(inspected.requiresUserAction, false);
    assert.equal(inspected.continuation.actionId, "CONTINUE_NORMAL_FLOW");
    assert.equal(Object.hasOwn(inspected, "actionPrompt"), false);
    assert.deepEqual(snapshot(), parked);

    const rejected = await runDirectFlowAction(fixture.context(), {
      action: "SELECT_DIRECT_FIX",
      reason: "A parked target must remain outside direct mutation scope.",
      source: "manual",
    });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.errors[0].code, "DIRECT_MODE_UNSUPPORTED");
    assert.deepEqual(snapshot(), parked);
  } finally {
    fixture.cleanup();
  }
});

test("autoApprove and non-manual provenance never select direct mode", async () => {
  const fixture = createDirectFlowFixture({ specId: "476-explicit-selection" });
  try {
    fixture.context().flowManager.mutate((state) => {
      state.autoApprove = true;
    });

    const inspected = getDirectFlowAction(fixture.context());
    assert.equal(inspected.code, "DIRECT_SELECTION_REQUIRED");
    assert.equal(inspected.autoApproveSelectedDirect, false);
    assert.equal(fixture.context().flowState.directFlowSession, undefined);

    const rejected = await runDirectFlowAction(fixture.context(), {
      action: "SELECT_DIRECT_FIX",
      reason: "This must not be adopted without explicit user provenance.",
      source: "auto",
    });
    assert.equal(rejected.ok, false);
    assert.equal(rejected.errors[0].code, "DIRECT_EXPLICIT_SELECTION_REQUIRED");
    assert.equal(rejected.data.yieldsControl, true);
    assert.equal(
      rejected.data.actionPrompt.choices.some((entry) => (
        entry.actionId === "SELECT_DIRECT_FIX"
      )),
      true,
    );
    assert.equal(fixture.context().flowState.directFlowSession, undefined);
    assert.equal(fixture.context().flowState.directResolutionPlan, undefined);
  } finally {
    fixture.cleanup();
  }
});

test("a blocked impl target preserves its stop reason through direct preflight", async () => {
  const fixture = createDirectFlowFixture({ specId: "476-blocked" });
  try {
    fixture.context().flowManager.mutate((state) => {
      state.stepAttempts = [
        ...(state.stepAttempts || []),
        new StepAttempt({
          runId: state.runId,
          stepId: "implement",
          attempt: 1,
          outcome: new ExternalBlockedOutcome({
            reason: "implementation provider remained unavailable",
            resumeInstruction: "Retry implementation after provider recovery.",
          }),
        }).toJSON(),
      ];
    });
    const initialSteps = stepStatuses(fixture.context().flowState);

    const inspected = getDirectFlowAction(fixture.context());
    assert.equal(inspected.code, "DIRECT_SELECTION_REQUIRED");
    assert.equal(inspected.stopReason, "implementation provider remained unavailable");

    const selected = await runDirectFlowAction(fixture.context(), {
      action: "SELECT_DIRECT_FIX",
      reason: "Use bounded direct handling without resolving the provider outage.",
      scope: ["src/blocked-direct.js"],
      source: "manual",
    });
    assert.equal(selected.code, "DIRECT_IMPLEMENTATION_REQUIRED");
    const state = fixture.context().flowState;
    assert.equal(
      state.directResolutionPlan.routingFailure,
      "implementation provider remained unavailable",
    );
    assert.deepEqual(stepStatuses(state), initialSteps);
  } finally {
    fixture.cleanup();
  }
});

test("manual direct preflight stops for semantic decisions and resumes the same plan", async () => {
  const fixture = createDirectFlowFixture({ specId: "476-manual-decision" });
  try {
    commitSpecArtifact(fixture, "acceptance-review.json", {
      verdict: "user_decision_required",
      userDecision: null,
      findings: [],
    }, "record pending acceptance decision");
    const initialSteps = stepStatuses(fixture.context().flowState);

    const waiting = await runDirectFlowAction(fixture.context(), {
      action: "SELECT_DIRECT_FIX",
      reason: "Resolve the recorded semantic decision before changing code.",
      scope: ["src/manual-decision.js"],
      source: "manual",
    });

    assert.equal(waiting.code, "DIRECT_USER_DECISION_REQUIRED");
    assert.equal(waiting.yieldsControl, true);
    assert.equal(waiting.actionPrompt.recommendedActionId, "ADOPT_RECOMMENDED_RESOLUTION");
    const waitingState = fixture.context().flowState;
    const waitingSession = DirectFlowSession.fromStored(waitingState.directFlowSession);
    const waitingPlan = DirectResolutionPlan.fromStored(waitingState.directResolutionPlan);
    assert.equal(waitingSession.phase, "DIRECT_HANDOFF_PREFLIGHT");
    assert.equal(waitingPlan.unresolvedDecisions.length, 1);
    assert.equal(waitingPlan.findings[0].classification, "USER_DECISION_REQUIRED");
    assert.equal(waitingPlan.findings[0].selectedResolution, null);
    assert.deepEqual(stepStatuses(waitingState), initialSteps);

    const resumed = await runDirectFlowAction(fixture.context(), {
      action: "RESOLVE_DIRECT_DECISION",
      findingId: "acceptance-review:user-decision",
      resolution: "Proceed with the bounded behavior described by the approved spec.",
    });

    assert.equal(resumed.code, "DIRECT_IMPLEMENTATION_REQUIRED");
    const resumedState = fixture.context().flowState;
    const resumedSession = DirectFlowSession.fromStored(resumedState.directFlowSession);
    const resumedPlan = DirectResolutionPlan.fromStored(resumedState.directResolutionPlan);
    assert.equal(resumedSession.phase, "DIRECT_FIX");
    assert.equal(resumedPlan.planId, waitingPlan.planId);
    assert.equal(resumedPlan.revision, waitingPlan.revision + 1);
    assert.equal(
      resumedPlan.findings[0].selectedResolution,
      "Proceed with the bounded behavior described by the approved spec.",
    );
    assert.deepEqual(stepStatuses(resumedState), initialSteps);

    const issueLog = JSON.parse(fs.readFileSync(
      path.join(fixture.worktreePath, "specs", fixture.specId, "issue-log.json"),
      "utf8",
    ));
    assert.equal(
      issueLog.entries.filter((entry) => entry.step === "direct-handoff-preflight").length,
      2,
    );
  } finally {
    fixture.cleanup();
  }
});

test("autoApprove adopts safe preflight recommendations only after explicit direct selection", async () => {
  const fixture = createDirectFlowFixture({ specId: "476-safe-recommendation" });
  try {
    commitSpecArtifact(fixture, "impl-review.json", {
      verdict: "fail",
      findings: [{
        id: "bounded-fix",
        disposition: "blocking",
        summary: "The bounded fixture change remains required.",
        file: "src/safe-recommendation.js",
      }],
    }, "record safe direct recommendation");
    fixture.context().flowManager.mutate((state) => {
      state.autoApprove = true;
    });

    const beforeSelection = getDirectFlowAction(fixture.context());
    assert.equal(beforeSelection.code, "DIRECT_SELECTION_REQUIRED");
    assert.equal(beforeSelection.autoApproveSelectedDirect, false);

    const selected = await runDirectFlowAction(fixture.context(), {
      action: "SELECT_DIRECT_FIX",
      reason: "Explicitly enter direct mode and adopt only safe internal recommendations.",
      scope: ["src/safe-recommendation.js"],
      source: "manual",
    });

    assert.equal(selected.code, "DIRECT_IMPLEMENTATION_REQUIRED");
    const state = fixture.context().flowState;
    const plan = DirectResolutionPlan.fromStored(state.directResolutionPlan);
    assert.equal(plan.selectionSource, "manual");
    assert.equal(plan.findings.length, 1);
    assert.equal(plan.findings[0].classification, "FIX_REQUIRED");
    assert.equal(
      plan.findings[0].selectedResolution,
      "Apply the finding's bounded fix before direct verification.",
    );
    assert.deepEqual(plan.findings[0].changeTargets, ["src/safe-recommendation.js"]);
    assert.equal(plan.unresolvedDecisions.length, 0);
  } finally {
    fixture.cleanup();
  }
});

test("direct verification is bounded and risk acceptance cannot credit normal steps", async () => {
  const fixture = createDirectFlowFixture({ specId: "476-risk" });
  try {
    const initialSteps = stepStatuses(fixture.context().flowState);
    await runDirectFlowAction(fixture.context(), {
      action: "SELECT_DIRECT_FIX",
      reason: "Exercise bounded deterministic verification.",
      scope: ["src/risk-fixture.js"],
      source: "manual",
    });

    await confirmDirectImplementation(fixture);
    let result;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      result = await runDirectFlowAction(fixture.context(), {
        action: "VERIFY_DIRECT",
        testCommand: "node -e \"process.exit(1)\"",
        timeoutMs: 10_000,
      });
    }
    assert.equal(result.code, "DIRECT_VERIFICATION_LIMIT");
    assert.equal(result.attempts, 3);
    assert.equal(
      result.actionPrompt.choices.some((entry) => entry.actionId === "ACCEPT_DIRECT_RISK"),
      true,
    );

    const fourth = await runDirectFlowAction(fixture.context(), {
      action: "VERIFY_DIRECT",
      testCommand: "node -e \"process.exit(0)\"",
      timeoutMs: 10_000,
    });
    assert.equal(fourth.ok, false);
    assert.equal(fourth.errors[0].code, "DIRECT_VERIFICATION_LIMIT");

    const accepted = await runDirectFlowAction(fixture.context(), {
      action: "ACCEPT_DIRECT_RISK",
      reason: "The deterministic fixture failure is explicitly accepted.",
    });
    assert.equal(accepted.code, "DIRECT_VERIFY_PASSED");
    const state = fixture.context().flowState;
    assert.equal(state.directFlowSession.verification.status, "passed");
    assert.equal(state.directFlowSession.verification.riskAccepted, true);
    assert.equal(state.directFlowSession.verificationAttempts, 3);
    assert.equal(
      state.directResolutionPlan.findings.some((entry) => (
        entry.classification === "RISK_ACCEPTED"
      )),
      true,
    );
    assert.deepEqual(stepStatuses(state), initialSteps);
  } finally {
    fixture.cleanup();
  }
});

test("direct reconcile prioritizes a normal finalize integration receipt over squash shape", async () => {
  const fixture = createDirectFlowFixture({ specId: "476-receipt-reconcile" });
  try {
    container.register("config", { commands: { gh: "disable" } });
    const worktreeState = fixture.context().flowState;
    const featureHead = git(fixture.root, ["rev-parse", fixture.featureBranch]);
    const identity = finalizationOutboxIdentity(worktreeState, "finalize-merge");

    git(fixture.root, ["merge", "--squash", fixture.featureBranch]);
    git(fixture.root, [
      "commit",
      "--quiet",
      "-m",
      `integrate normal finalize result\n\nsenti-outbox: ${identity.idempotencyKey}`,
    ]);
    const receiptCommit = git(fixture.root, ["rev-parse", "master"]);
    const main = fixture.context({ fromMain: true });
    main.flowManager.mutate((state) => {
      const outbox = new FlowOutbox(state.outbox || []);
      outbox.begin(identity);
      outbox.complete(identity, {
        status: "done",
        strategy: "squash",
        mergedFromSha: featureHead,
      });
      state.outbox = outbox.toJSON();
    });

    const inspected = getDirectFlowAction(fixture.context());
    assert.equal(inspected.evidence.kind, "integration-receipt");
    assert.equal(inspected.evidence.receiptKey, identity.idempotencyKey);
    assert.equal(inspected.evidence.receiptCommit, receiptCommit);
    assert.equal(
      inspected.actionPrompt.choices.some((entry) => (
        entry.actionId === "SELECT_DIRECT_RECONCILE"
      )),
      true,
    );

    const selected = await runDirectFlowAction(fixture.context(), {
      action: "SELECT_DIRECT_RECONCILE",
      reason: "Adopt the durable normal finalize receipt without a second merge.",
      source: "manual",
    });
    assert.equal(selected.code, "DIRECT_RECONCILE");

    const finalized = await runDirectFlowAction(fixture.context({ fromMain: true }), {
      action: "FINALIZE_DIRECT_RECONCILE",
      testCommand: "node -e \"process.exit(0)\"",
      timeoutMs: 10_000,
    });
    assert.equal(finalized.ok, true);
    assert.equal(finalized.data.mergeDisposition, "already-merged");

    const completed = fixture.context({ fromMain: true }).flowState;
    assert.equal(completed.directCompletionReceipt.gitEvidence.kind, "integration-receipt");
    assert.equal(
      completed.directCompletionReceipt.gitEvidence.receiptKey,
      identity.idempotencyKey,
    );
    assert.equal(
      completed.directCompletionReceipt.gitEvidence.receiptCommit,
      receiptCommit,
    );
  } finally {
    container.reset();
    fixture.cleanup();
  }
});

test("direct reconcile accepts exact ancestry and completes without a second merge", async () => {
  const fixture = createDirectFlowFixture({ specId: "476-reconcile" });
  try {
    container.register("config", { commands: { gh: "disable" } });
    git(fixture.root, [
      "merge",
      "--quiet",
      "--no-ff",
      fixture.featureBranch,
      "-m",
      "integrate feature outside flow",
    ]);
    const integratedHead = git(fixture.root, ["rev-parse", "master"]);
    const main = fixture.context({ fromMain: true });
    const prIdentity = finalizationOutboxIdentity(main.flowState, "finalize-merge");
    main.flowManager.mutate((state) => {
      const outbox = new FlowOutbox(state.outbox || []);
      outbox.begin(prIdentity);
      outbox.complete(prIdentity, {
        status: "done",
        strategy: "pr",
        mergedFromSha: null,
      });
      state.outbox = outbox.toJSON();
    });
    const inspected = getDirectFlowAction(fixture.context());
    assert.equal(
      inspected.actionPrompt.choices.some((entry) => entry.actionId === "SELECT_DIRECT_RECONCILE"),
      true,
    );
    assert.equal(inspected.evidence.kind, "exact-ancestry");

    const selected = await runDirectFlowAction(fixture.context(), {
      action: "SELECT_DIRECT_RECONCILE",
      reason: "Adopt the exact ancestry proof without re-merging.",
      source: "manual",
    });
    assert.equal(selected.code, "DIRECT_RECONCILE");

    const resolved = new FlowManager({
      root: fixture.root,
      mainRoot: fixture.root,
      inWorktree: false,
      specId: fixture.specId,
    }).resolveActiveFlow(null, {
      selectRunId: fixture.runId,
      selectIssue: fixture.issue,
      selectSpecId: fixture.spec,
    });
    assert.equal(resolved.state.directFlowSession.phase, "DIRECT_RECONCILE");
    assert.equal(resolved.worktreePath, null);

    const finalized = await runDirectFlowAction(fixture.context({ fromMain: true }), {
      action: "FINALIZE_DIRECT_RECONCILE",
      testCommand: "node -e \"process.exit(0)\"",
      timeoutMs: 10_000,
    });
    assert.equal(finalized.ok, true);
    assert.equal(finalized.data.completionMode, "direct");
    assert.equal(finalized.data.mergeDisposition, "already-merged");

    const completedState = fixture.context({ fromMain: true }).flowState;
    const receipt = completedState.directCompletionReceipt;
    assert.equal(completedState.directIntegrationReceipt.strategy, "already-merged");
    assert.equal(completedState.directIntegrationReceipt.featureHead, (
      git(fixture.root, ["rev-parse", `${integratedHead}^2`])
    ));
    assert.equal(receipt.completionMode, "direct");
    assert.equal(receipt.mergeDisposition, "already-merged");
    assert.equal(receipt.status, "completed");
    assert.equal(receipt.sourceStep, "implement");
    assert.equal(receipt.gitEvidence.kind, "exact-ancestry");
    assert.equal(receipt.gitEvidence.mainHead, integratedHead);
    assert.equal(receipt.gitEvidence.receiptKey, null);
    assert.equal(receipt.gitEvidence.receiptCommit, null);
    assert.equal(receipt.minimalValidation.status, "passed");
    assert.equal(receipt.skippedSteps.length > 0, true);
    assert.equal(
      receipt.skippedSteps.every((step) => (
        step.reason === "direct-limited-completion: normal post-impl step was not executed or credited"
      )),
      true,
    );
    assert.ok(receipt.reconciledAt);
    assert.ok(receipt.completedAt);
    assert.equal(
      fs.readFileSync(path.join(fixture.root, ".senti", "last-finalized-spec"), "utf8"),
      `${fixture.spec}\n`,
    );
    assert.equal(fs.existsSync(fixture.worktreePath), false);
    assert.equal(git(fixture.root, ["branch", "--list", fixture.featureBranch]), "");
  } finally {
    container.reset();
    fixture.cleanup();
  }
});

test("direct reconcile is not offered while implementation changes remain uncommitted", () => {
  const fixture = createDirectFlowFixture({ specId: "476-dirty-reconcile" });
  try {
    git(fixture.root, [
      "merge",
      "--quiet",
      "--no-ff",
      fixture.featureBranch,
      "-m",
      "integrate committed feature history",
    ]);
    const sourcePath = path.join(fixture.worktreePath, "src", "not-integrated.js");
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, "export const notIntegrated = true;\n");

    assertReceiptlessReconcileRejected(fixture);
  } finally {
    fixture.cleanup();
  }
});

test("direct reconcile uses the main plugin snapshot for teardown", async () => {
  const fixture = createDirectFlowFixture({ specId: "476-reconcile-plugin-snapshot" });
  try {
    git(fixture.root, [
      "merge",
      "--quiet",
      "--no-ff",
      fixture.featureBranch,
      "-m",
      "integrate feature outside flow",
    ]);
    const selected = await runDirectFlowAction(fixture.context(), {
      action: "SELECT_DIRECT_RECONCILE",
      reason: "Adopt exact ancestry before testing teardown state selection.",
      source: "manual",
    });
    assert.equal(selected.code, "DIRECT_RECONCILE");

    const main = fixture.context({ fromMain: true });
    main.flowManager.mutate((state) => {
      state.plugins = {
        flowCommandHooks: [{
          pluginId: "workflow",
          module: "hooks/finalize-cleanup.js",
          className: "WorkflowFinalizeCleanupHook",
          command: "finalize-cleanup",
          hook: "post",
          priority: 0,
          failurePolicy: "advisory",
        }],
      };
    });
    const resolution = FinalizeCleanupStateResolution.resolve({
      ...main,
      flowState: main.flowManager.loadReadOnly(fixture.specId),
    });

    assert.deepEqual(resolution.state.plugins, main.flowManager.loadReadOnly(fixture.specId).plugins);
  } finally {
    fixture.cleanup();
  }
});

test("direct reconcile rejects receiptless squash tree equivalence", () => {
  const fixture = createDirectFlowFixture({ specId: "476-squash-equivalent" });
  try {
    git(fixture.root, ["merge", "--squash", fixture.featureBranch]);
    git(fixture.root, ["commit", "--quiet", "-m", "apply equivalent tree without receipt"]);

    assertReceiptlessReconcileRejected(fixture);
  } finally {
    fixture.cleanup();
  }
});

test("direct reconcile rejects a receiptless cherry-pick", () => {
  const fixture = createDirectFlowFixture({ specId: "476-cherry-equivalent" });
  try {
    fs.writeFileSync(path.join(fixture.root, "main-sentinel.txt"), "advance main\n");
    git(fixture.root, ["add", "main-sentinel.txt"]);
    git(fixture.root, ["commit", "--quiet", "-m", "advance main before cherry-pick"]);
    git(fixture.root, ["cherry-pick", fixture.featureBranch]);

    assertReceiptlessReconcileRejected(fixture);
  } finally {
    fixture.cleanup();
  }
});

test("direct reconcile rejects receiptless patch equivalence", () => {
  const fixture = createDirectFlowFixture({ specId: "476-patch-equivalent" });
  try {
    const patch = spawnSync(
      "git",
      ["-C", fixture.root, "diff", `master...${fixture.featureBranch}`],
      { encoding: "utf8" },
    );
    assert.equal(patch.status, 0, patch.stderr);
    const applied = spawnSync(
      "git",
      ["-C", fixture.root, "apply", "--index", "-"],
      { encoding: "utf8", input: patch.stdout },
    );
    assert.equal(applied.status, 0, applied.stderr);
    git(fixture.root, ["commit", "--quiet", "-m", "apply equivalent patch without receipt"]);

    assertReceiptlessReconcileRejected(fixture);
  } finally {
    fixture.cleanup();
  }
});

test("direct finalize stops without cleanup when verified content changes", async () => {
  const fixture = createDirectFlowFixture({ specId: "476-dirty-after-verify" });
  try {
    container.register("config", { commands: { gh: "disable" } });
    await runDirectFlowAction(fixture.context(), {
      action: "SELECT_DIRECT_FIX",
      reason: "Verify an exact bounded content snapshot before finalize.",
      scope: ["src/mutable-direct.js"],
      source: "manual",
    });
    const sourcePath = path.join(fixture.worktreePath, "src", "mutable-direct.js");
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, "export const version = 1;\n");
    await confirmDirectImplementation(fixture);
    await runDirectFlowAction(fixture.context(), {
      action: "VERIFY_DIRECT",
      testCommand: "node -e \"process.exit(0)\"",
      timeoutMs: 10_000,
    });

    fs.writeFileSync(sourcePath, "export const version = 2;\n");
    const stopped = await runDirectFlowAction(fixture.context(), {
      action: "FINALIZE_DIRECT",
    });
    assert.equal(stopped.ok, false);
    assert.equal(stopped.errors[0].code, "DIRECT_CHANGE_SET_CHANGED");
    assert.equal(stopped.data.yieldsControl, true);
    assert.equal(fs.existsSync(fixture.worktreePath), true);
    assert.notEqual(git(fixture.root, ["branch", "--list", fixture.featureBranch]), "");
    assert.equal(
      fixture.context().flowManager.snapshotActiveFlows().entries.some((entry) => (
        entry.spec === fixture.specId
      )),
      true,
    );
    assert.equal(
      fs.existsSync(path.join(fixture.root, "specs", fixture.specId, "flow.json")),
      false,
    );
  } finally {
    container.reset();
    fixture.cleanup();
  }
});

test("direct cleanup preserves required-hook, dirty, and orphaned-commit failures", async () => {
  const fixture = createDirectFlowFixture({ specId: "476-required-hook" });
  try {
    container.register("config", { commands: { gh: "disable" } });
    const pluginId = "direct-finalize-required-failure";
    const pluginRoot = path.join(
      fixture.worktreePath,
      ".senti",
      "plugins",
      pluginId,
    );
    fs.mkdirSync(path.join(pluginRoot, "hooks"), { recursive: true });
    fs.writeFileSync(
      path.join(fixture.worktreePath, ".senti", "config.json"),
      `${JSON.stringify({
        lang: "en",
        type: "base",
        commands: { gh: "disable" },
        docs: { languages: ["en"], defaultLanguage: "en" },
        plugin: { packages: [{ id: pluginId }] },
      }, null, 2)}\n`,
    );
    fs.writeFileSync(path.join(pluginRoot, "hooks", "finalize.js"), `
      export default function register(api) {
        return class DirectFinalizeRequiredFailure extends api.FlowCommandHook {
          static command = "finalize-cleanup";
          static hook = "pre";
          static failurePolicy = "required";
          async run(context) {
            await context.artifacts.writeText("partial.txt", "must be discarded");
            throw new Error("injected direct required hook failure");
          }
        };
      }
    `);
    fixture.context().flowManager.mutate((state) => {
      state.plugins = { flowCommandHooks: [{
        apiVersion: 1,
        pluginId,
        module: "hooks/finalize.js",
        className: "DirectFinalizeRequiredFailure",
        command: "finalize-cleanup",
        hook: "pre",
        priority: 0,
        failurePolicy: "required",
      }] };
    });
    git(fixture.worktreePath, ["add", ".senti", `specs/${fixture.specId}/flow.json`]);
    git(fixture.worktreePath, ["commit", "--quiet", "-m", "add required finalize hook"]);

    await runDirectFlowAction(fixture.context(), {
      action: "SELECT_DIRECT_FIX",
      reason: "Exercise the required cleanup hook fail-stop boundary.",
      scope: ["src/required-hook.js"],
      source: "manual",
    });
    const sourcePath = path.join(fixture.worktreePath, "src", "required-hook.js");
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, "export const requiredHook = true;\n");
    await confirmDirectImplementation(fixture);
    await runDirectFlowAction(fixture.context(), {
      action: "VERIFY_DIRECT",
      testCommand: "node -e \"process.exit(0)\"",
      timeoutMs: 10_000,
    });

    const stopped = await runDirectFlowAction(fixture.context(), {
      action: "FINALIZE_DIRECT",
    });

    assert.equal(stopped.ok, false, JSON.stringify(stopped));
    assert.equal(stopped.errors[0].code, "PLUGIN_HOOK_REQUIRED_FAILED");
    assert.equal(stopped.data.yieldsControl, true);
    assert.deepEqual(
      stopped.data.actionPrompt.choices
        .map((entry) => entry.actionId)
        .filter((actionId) => [
          "RETRY_DIRECT_FINALIZE",
          "SUSPEND_DIRECT",
          "ABORT_DIRECT",
        ].includes(actionId)),
      ["RETRY_DIRECT_FINALIZE", "SUSPEND_DIRECT"],
    );
    assert.equal(fs.existsSync(fixture.worktreePath), true);
    assert.notEqual(git(fixture.root, ["branch", "--list", fixture.featureBranch]), "");
    assert.equal(
      fixture.context({ fromMain: true }).flowState.directCompletionReceipt.status,
      "prepared",
    );
    assert.equal(
      fixture.context().flowManager.snapshotActiveFlows().entries.some((entry) => (
        entry.spec === fixture.specId
      )),
      true,
    );
    assert.equal(
      fs.existsSync(path.join(
        fixture.worktreePath,
        "specs",
        fixture.specId,
        "plugin-artifacts",
      )),
      false,
    );
    const recoveryRoot = path.join(
      fixture.root,
      ".senti",
      "recovery",
      "finalize-cleanup",
    );
    assert.deepEqual(
      fs.readdirSync(recoveryRoot).filter((entry) => entry.endsWith(".json")),
      [],
    );

    const dirtyPath = path.join(fixture.worktreePath, "src", "after-integration.js");
    fs.writeFileSync(dirtyPath, "export const afterIntegration = true;\n");
    const dirtyStopped = await runDirectFlowAction(
      fixture.context({ fromMain: true }),
      { action: "FINALIZE_DIRECT" },
    );
    assert.equal(dirtyStopped.ok, false, JSON.stringify(dirtyStopped));
    assert.equal(dirtyStopped.errors[0].code, "DIRECT_TEARDOWN_DIRTY");
    assert.equal(dirtyStopped.data.yieldsControl, true);
    assert.equal(fs.existsSync(fixture.worktreePath), true);
    assert.notEqual(git(fixture.root, ["branch", "--list", fixture.featureBranch]), "");

    git(fixture.worktreePath, ["add", "src/after-integration.js"]);
    git(fixture.worktreePath, ["commit", "--quiet", "-m", "record unapplied direct commit"]);
    const orphanStopped = await runDirectFlowAction(
      fixture.context({ fromMain: true }),
      { action: "FINALIZE_DIRECT" },
    );
    assert.equal(orphanStopped.ok, false, JSON.stringify(orphanStopped));
    assert.equal(orphanStopped.errors[0].code, "DIRECT_TEARDOWN_CAS_CONFLICT");
    assert.equal(orphanStopped.data.yieldsControl, true);
    assert.equal(fs.existsSync(fixture.worktreePath), true);
    assert.notEqual(git(fixture.root, ["branch", "--list", fixture.featureBranch]), "");
    assert.equal(
      fixture.context({ fromMain: true }).flowState.directCompletionReceipt.status,
      "prepared",
    );
  } finally {
    container.reset();
    fixture.cleanup();
  }
});

test("direct cleanup removes only the target active-flow entry", async () => {
  const fixture = createDirectFlowFixture({ specId: "476-target-only" });
  try {
    container.register("config", { commands: { gh: "disable" } });
    const otherSpecId = "999-other-flow";
    const otherSpec = `specs/${otherSpecId}/spec.json`;
    const otherBranch = "feature/999-other-flow";
    const otherState = makeFlowState({
      runId: "run-999-other-flow",
      issue: 999,
      spec: otherSpec,
      baseBranch: "master",
      featureBranch: otherBranch,
      worktree: false,
    });
    const manager = new FlowManager({
      root: fixture.root,
      mainRoot: fixture.root,
      inWorktree: false,
    });
    manager.create(otherState);
    manager.addActiveFlow(otherSpecId, "branch");
    git(fixture.root, ["branch", otherBranch]);
    git(fixture.root, ["add", `specs/${otherSpecId}/flow.json`]);
    git(fixture.root, ["commit", "--quiet", "-m", "add unrelated active flow"]);
    git(fixture.root, ["push", "--quiet", "origin", "master"]);

    await runDirectFlowAction(fixture.context(), {
      action: "SELECT_DIRECT_FIX",
      reason: "Complete only the explicitly selected target Flow.",
      scope: ["src/target-only.js"],
      source: "manual",
    });
    const sourcePath = path.join(fixture.worktreePath, "src", "target-only.js");
    fs.mkdirSync(path.dirname(sourcePath), { recursive: true });
    fs.writeFileSync(sourcePath, "export const targetOnly = true;\n");
    await confirmDirectImplementation(fixture);
    await runDirectFlowAction(fixture.context(), {
      action: "VERIFY_DIRECT",
      testCommand: "node -e \"process.exit(0)\"",
      timeoutMs: 10_000,
    });
    const finalized = await runDirectFlowAction(fixture.context(), {
      action: "FINALIZE_DIRECT",
    });
    assert.equal(finalized.ok, true);

    const entries = new FlowManager({
      root: fixture.root,
      mainRoot: fixture.root,
      inWorktree: false,
    }).snapshotActiveFlows().entries;
    assert.equal(entries.some((entry) => entry.spec === fixture.specId), false);
    assert.equal(
      entries.some((entry) => entry.spec === otherSpecId && entry.mode === "branch"),
      true,
    );
    assert.notEqual(git(fixture.root, ["branch", "--list", otherBranch]), "");
  } finally {
    container.reset();
    fixture.cleanup();
  }
});
