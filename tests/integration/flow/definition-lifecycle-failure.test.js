import assert from "node:assert/strict";
import { test } from "node:test";

import { Command } from "../../../src/lib/command.js";
import { flowCommands } from "../../../src/lib/command-registry.js";
import { dispatch } from "../../../src/lib/dispatcher.js";
import { Envelope } from "../../../src/lib/flow-envelope.js";
import { FlowManager } from "../../../src/lib/flow-manager.js";
import { buildCurrentFlowDefinition, DEFINITION_FAILURE_OWNERS } from "../../../src/flow/definition.js";
import { CanonicalFlowFixture } from "../../support/infrastructure/flow-setup.js";
import { createTmpDir, removeTmpDir } from "../../support/builders/tmp-dir.js";

function commandContainer({ root, manager }) {
  const values = {
    paths: { root },
    flowManager: manager,
    mainRoot: root,
    config: null,
    inWorktree: false,
  };
  return {
    get(name) { return values[name] ?? null; },
    has(name) { return Object.hasOwn(values, name); },
  };
}

function hookContext({ root, manager, specId }) {
  return {
    root,
    mainRoot: root,
    executionRoot: root,
    flowManager: manager,
    flowState: manager.loadReadOnly(specId),
    specId,
    flowResolutionError: null,
  };
}

class ThrowingCommand extends Command {
  static outputMode = "envelope";
  static calls = 0;

  execute() {
    ThrowingCommand.calls += 1;
    const error = new Error("registry command fixture failed");
    error.code = "REGISTRY_COMMAND_FIXTURE_FAILED";
    throw error;
  }
}

async function dispatchRegistryCommand({ root, manager, specId, commandName, CommandClass = ThrowingCommand }) {
  const entry = flowCommands.run[commandName];
  const originalCommand = entry.command;
  const out = [];
  try {
    if (Object.hasOwn(CommandClass, "calls")) CommandClass.calls = 0;
    entry.command = async () => ({ default: CommandClass });
    await dispatch({
      container: commandContainer({ root, manager }),
      entry,
      argv: [],
      envelopeType: "run",
      envelopeKey: commandName,
      stdout: (chunk) => out.push(chunk),
      stderr: () => {},
      setExitCode: () => {},
      buildHookCtx: () => hookContext({ root, manager, specId }),
    });
  } finally {
    entry.command = originalCommand;
  }
  return JSON.parse(out.join(""));
}

async function dispatchRegistryFailure(input) {
  return dispatchRegistryCommand(input);
}

test("definition-owned registry command failures settle their exact active Attempt", async (t) => {
  for (const scenario of [
    { commandName: "scenario-validity", nodeId: "scenario-validity" },
    { commandName: "test-execute", nodeId: "test-execute" },
    { commandName: "test-result-review", nodeId: "test-result-review" },
    { commandName: "retro", nodeId: "retro" },
    { commandName: "acceptance-review", nodeId: "acceptance-review" },
    { commandName: "final-regression", nodeId: "final-regression" },
  ]) {
    await t.test(`${scenario.commandName} command failure`, async () => {
      const root = createTmpDir(`definition-lifecycle-${scenario.commandName}-`);
      try {
        const specId = `901-${scenario.commandName}`;
        const manager = new FlowManager({ root, mainRoot: root, inWorktree: false, specId });
        new CanonicalFlowFixture({
          flowManager: manager,
          specId,
          runId: `run-${scenario.commandName}`,
          execution: { mode: "direct", baseBranch: "main", featureBranch: null },
        }).create().registerActive().activate(scenario.nodeId);

        const envelope = await dispatchRegistryFailure({ root, manager, specId, commandName: scenario.commandName });
        const state = manager.canonicalState(specId);
        assert.equal(envelope.errors[0].code, "REGISTRY_COMMAND_FIXTURE_FAILED");
        assert.equal(ThrowingCommand.calls, 1, "the registry command executes exactly once");
        assert.equal(state.current.at(-1), scenario.nodeId);
        assert.equal(state.attempt.failure.code, "REGISTRY_COMMAND_FIXTURE_FAILED");
        assert.equal(state.attempt.failure.category, "tooling");
      } finally {
        removeTmpDir(root);
      }
    });
  }
});

test("failed envelope records tooling failure for a dispatcher-primary command", async () => {
  const root = createTmpDir("definition-lifecycle-envelope-");
  const entry = flowCommands.run["scenario-validity"];
  const originalCommand = entry.command;
  try {
    const specId = "902-scenario-envelope";
    const manager = new FlowManager({ root, mainRoot: root, inWorktree: false, specId });
    new CanonicalFlowFixture({
      flowManager: manager,
      specId,
      runId: "run-scenario-envelope",
      execution: { mode: "direct", baseBranch: "main", featureBranch: null },
    }).create().registerActive().activate("scenario-validity");
    class FailedEnvelopeCommand extends Command {
      static outputMode = "envelope";
      execute() { return Envelope.fail("run", "scenario-validity", "SCENARIO_ENVELOPE_FAILED", "scenario envelope failed"); }
    }
    entry.command = async () => ({ default: FailedEnvelopeCommand });
    const out = [];
    await dispatch({
      container: commandContainer({ root, manager }), entry, argv: [], envelopeType: "run", envelopeKey: "scenario-validity",
      stdout: (chunk) => out.push(chunk), stderr: () => {}, setExitCode: () => {},
      buildHookCtx: () => hookContext({ root, manager, specId }),
    });
    assert.equal(JSON.parse(out.join("")).errors[0].code, "SCENARIO_ENVELOPE_FAILED");
    assert.equal(manager.canonicalState(specId).attempt.failure.retryKind, null);
  } finally {
    entry.command = originalCommand;
    removeTmpDir(root);
  }
});

test("command-primary fallback does not overwrite a command-recorded review or gate failure", async (t) => {
  for (const scenario of [
    { commandName: "review", nodeId: "draft-questions-review", category: "semantic", retryKind: "semantic" },
    { commandName: "gate", nodeId: "draft-gate", category: "tooling", retryKind: "tooling" },
  ]) {
    await t.test(scenario.commandName, async () => {
      const root = createTmpDir(`definition-lifecycle-self-recorded-${scenario.commandName}-`);
      const entry = flowCommands.run[scenario.commandName];
      const originalCommand = entry.command;
      try {
        const specId = `903-self-recorded-${scenario.commandName}`;
        const manager = new FlowManager({ root, mainRoot: root, inWorktree: false, specId });
        new CanonicalFlowFixture({
          flowManager: manager,
          specId,
          runId: `run-self-recorded-${scenario.commandName}`,
          execution: { mode: "direct", baseBranch: "main", featureBranch: null },
        }).create().registerActive().activate(scenario.nodeId);
        class SelfRecordingCommand extends Command {
          static outputMode = "envelope";
          execute() {
            manager.failCurrentAttempt({
              specId,
              failure: { category: scenario.category, code: "COMMAND_OWNED_FAILURE", message: "command recorded its failure", retryable: true, retryKind: scenario.retryKind },
              result: { outcome: "failed", summary: "command recorded its failure", confirmedAt: new Date().toISOString(), artifactRefs: [] },
            });
            throw Object.assign(new Error("after recording"), { code: "AFTER_COMMAND_RECORD" });
          }
        }
        entry.command = async () => ({ default: SelfRecordingCommand });
        await dispatch({
          container: commandContainer({ root, manager }), entry, argv: [], envelopeType: "run", envelopeKey: scenario.commandName,
          stdout: () => {}, stderr: () => {}, setExitCode: () => {},
          buildHookCtx: () => hookContext({ root, manager, specId }),
        });
        const failures = manager.activityLedger(specId).filter((activity) => activity.type === "attempt_failed");
        assert.equal(failures.length, 1);
        assert.equal(manager.canonicalState(specId).attempt.failure.code, "COMMAND_OWNED_FAILURE");
      } finally {
        entry.command = originalCommand;
        removeTmpDir(root);
      }
    });
  }
});

test("every definition-owned parent command declares exactly one typed failure owner", () => {
  const definition = buildCurrentFlowDefinition();
  const owners = [];
  const visit = (node) => {
    if (node.action?.executionCommand != null) {
      owners.push({ id: node.id, owner: node.action.failureOwnership, executionCommand: node.action.executionCommand });
    }
    node.steps.forEach(visit);
  };
  visit(definition.root);
  definition.taskTemplate.steps.forEach(visit);
  assert.ok(owners.length > 0);
  for (const entry of owners) {
    assert.ok(DEFINITION_FAILURE_OWNERS.some((owner) => owner.equals(entry.owner)), `${entry.id} owner`);
    const commandName = entry.executionCommand.split(/\s+/)[3];
    assert.ok(flowCommands.run[commandName]?.failureOwnership.equals(entry.owner), `${entry.id} registry owner`);
  }
  assert.deepEqual(
    owners.filter((entry) => entry.owner.toJSON() === "dispatcher-primary").map((entry) => entry.id),
    ["scenario-validity", "test-execute", "test-result-review", "retro"],
  );
});

test("command-primary fallback preserves a command-recorded semantic failure", async (t) => {
  for (const scenario of [
    { commandName: "acceptance-review", nodeId: "acceptance-review" },
    { commandName: "final-regression", nodeId: "final-regression" },
  ]) {
    await t.test(scenario.commandName, async () => {
      const root = createTmpDir(`definition-lifecycle-fallback-${scenario.commandName}-`);
      const entry = flowCommands.run[scenario.commandName];
      const originalCommand = entry.command;
      try {
        const specId = `905-${scenario.commandName}`;
        const manager = new FlowManager({ root, mainRoot: root, inWorktree: false, specId });
        new CanonicalFlowFixture({
          flowManager: manager,
          specId,
          runId: `run-${scenario.commandName}-fallback`,
          execution: { mode: "direct", baseBranch: "main", featureBranch: null },
        }).create().registerActive().activate(scenario.nodeId);
        class SelfRecordingCommand extends Command {
          static outputMode = "envelope";
          execute() {
            manager.failCurrentAttempt({
              specId,
              failure: {
                category: "semantic",
                code: "COMMAND_PRIMARY_SEMANTIC_FAILURE",
                message: "command recorded its semantic failure",
                retryable: false,
                retryKind: null,
              },
              result: {
                outcome: "failed",
                summary: "command recorded its semantic failure",
                confirmedAt: new Date().toISOString(),
                artifactRefs: [],
              },
            });
            throw Object.assign(new Error("after command failure record"), { code: "FALLBACK_MUST_NOT_OVERWRITE" });
          }
        }
        entry.command = async () => ({ default: SelfRecordingCommand });
        await dispatch({
          container: commandContainer({ root, manager }), entry, argv: [], envelopeType: "run", envelopeKey: scenario.commandName,
          stdout: () => {}, stderr: () => {}, setExitCode: () => {},
          buildHookCtx: () => hookContext({ root, manager, specId }),
        });
        const failures = manager.activityLedger(specId).filter((activity) => activity.type === "attempt_failed");
        assert.equal(failures.length, 1);
        assert.equal(manager.canonicalState(specId).attempt.failure.code, "COMMAND_PRIMARY_SEMANTIC_FAILURE");
      } finally {
        entry.command = originalCommand;
        removeTmpDir(root);
      }
    });
  }
});

test("review and gate registry post failures settle the bound Attempt", async (t) => {
  for (const scenario of [
    { commandName: "review", nodeId: "draft-questions-review" },
    { commandName: "gate", nodeId: "draft-gate" },
  ]) {
    await t.test(scenario.commandName, async () => {
      const root = createTmpDir(`definition-lifecycle-${scenario.commandName}-post-`);
      const entry = flowCommands.run[scenario.commandName];
      const originalPost = entry.post;
      try {
        const specId = `906-${scenario.commandName}-post`;
        const manager = new FlowManager({ root, mainRoot: root, inWorktree: false, specId });
        new CanonicalFlowFixture({
          flowManager: manager,
          specId,
          runId: `run-${scenario.commandName}-post`,
          execution: { mode: "direct", baseBranch: "main", featureBranch: null },
        }).create().registerActive().activate(scenario.nodeId);
        class PassingCommand extends Command {
          static outputMode = "envelope";
          static calls = 0;
          execute() {
            PassingCommand.calls += 1;
            return { result: "pass" };
          }
        }
        entry.post = () => {
          throw Object.assign(new Error(`${scenario.commandName} registry post failed`), {
            code: `${scenario.commandName.toUpperCase()}_POST_FIXTURE_FAILED`,
          });
        };
        const envelope = await dispatchRegistryCommand({
          root,
          manager,
          specId,
          commandName: scenario.commandName,
          CommandClass: PassingCommand,
        });
        const failure = manager.canonicalState(specId).attempt.failure;
        assert.equal(PassingCommand.calls, 1, "the producer command returns before its registry post failure");
        assert.equal(envelope.ok, true, "the established post-hook envelope contract remains a warning");
        assert.equal(envelope.errors.some((error) => error.level === "warn" && error.code === "POST_HOOK_FAILED"), true);
        assert.equal(failure.category, "tooling");
        assert.equal(failure.code, `${scenario.commandName.toUpperCase()}_POST_FIXTURE_FAILED`);
        assert.equal(manager.activityLedger(specId).filter((activity) => activity.type === "attempt_failed").length, 1);
      } finally {
        entry.post = originalPost;
        removeTmpDir(root);
      }
    });
  }
});

test("pre, post, and onError hook failures preserve the original failure and settle the bound Attempt", async (t) => {
  for (const scenario of [
    {
      name: "pre",
      install(entry) {
        const original = entry.pre;
        entry.pre = () => { throw Object.assign(new Error("pre failed"), { code: "PRE_FIXTURE_FAILED" }); };
        return () => { entry.pre = original; };
      },
      expectedCode: "PRE_FIXTURE_FAILED",
      expectedCalls: 0,
    },
    {
      name: "post",
      install(entry) {
        const original = entry.post;
        entry.post = () => { throw Object.assign(new Error("post failed"), { code: "POST_FIXTURE_FAILED" }); };
        return () => { entry.post = original; };
      },
      expectedCode: "POST_FIXTURE_FAILED",
      expectedCalls: 1,
    },
    {
      name: "onError",
      install(entry) {
        const original = entry.onError;
        entry.onError = () => { throw Object.assign(new Error("onError failed"), { code: "ON_ERROR_FIXTURE_FAILED" }); };
        return () => { entry.onError = original; };
      },
      expectedCode: "COMMAND_FIXTURE_FAILED",
      expectedCalls: 1,
      commandFails: true,
    },
  ]) {
    await t.test(`${scenario.name} hook`, async () => {
      const root = createTmpDir(`definition-lifecycle-${scenario.name}-hook-`);
      const entry = flowCommands.run["test-execute"];
      const originalCommand = entry.command;
      let restoreHook = () => {};
      try {
        const specId = `904-${scenario.name}-hook`;
        const manager = new FlowManager({ root, mainRoot: root, inWorktree: false, specId });
        new CanonicalFlowFixture({
          flowManager: manager,
          specId,
          runId: `run-${scenario.name}-hook`,
          execution: { mode: "direct", baseBranch: "main", featureBranch: null },
        }).create().registerActive().activate("test-execute");
        let calls = 0;
        class HookCommand extends Command {
          static outputMode = "envelope";
          execute() {
            calls += 1;
            if (scenario.commandFails) throw Object.assign(new Error("command failed"), { code: "COMMAND_FIXTURE_FAILED" });
            return { result: "fixture" };
          }
        }
        entry.command = async () => ({ default: HookCommand });
        restoreHook = scenario.install(entry);
        await dispatch({
          container: commandContainer({ root, manager }), entry, argv: [], envelopeType: "run", envelopeKey: "test-execute",
          stdout: () => {}, stderr: () => {}, setExitCode: () => {},
          buildHookCtx: () => hookContext({ root, manager, specId }),
        });
        assert.equal(calls, scenario.expectedCalls);
        assert.equal(manager.canonicalState(specId).attempt.failure.code, scenario.expectedCode);
      } finally {
        restoreHook();
        entry.command = originalCommand;
        removeTmpDir(root);
      }
    });
  }
});
