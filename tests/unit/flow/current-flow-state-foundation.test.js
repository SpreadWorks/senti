import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, it } from "node:test";

import { ProcessIdentitySource } from "../../../src/lib/process-identity.js";
import { buildCurrentFlowDefinition, getFlowNode } from "../../../src/flow/definition.js";
import {
  ActivityTransition,
  CurrentAttempt,
  CurrentFlowDefinition,
  CurrentFlowState,
  CurrentFlowStateAdoptionBoundary,
  CurrentFlowStateConflictError,
  CurrentFlowStateInvariantError,
  CurrentFlowStateStore,
  FlowActivity,
  FlowActivityJournal,
  FlowDefinitionNode,
  TaskNode,
} from "../../../src/flow/lib/current-flow-state.js";
import { createTmpDir, removeTmpDir } from "../../helpers/tmp-dir.js";

const NOW = "2026-08-07T00:00:00.000Z";
const LATER = "2026-08-07T00:01:00.000Z";

function definition() {
  return buildCurrentFlowDefinition();
}

function passedResult(summary = "Confirmed.") {
  return { outcome: "passed", summary, confirmedAt: LATER, artifactRefs: ["artifact-1"] };
}

function skippedResult(summary = "Skipped.") {
  return { outcome: "skipped", summary, confirmedAt: LATER, artifactRefs: ["skipped-artifact"] };
}

function attemptFor(state, currentPath, id, number = 1, {
  tooling = 0,
  blocker = null,
  incomplete = [],
  operationClaims = null,
} = {}) {
  const contract = state.definition.contractFor(currentPath.at(-1), state.root);
  return new CurrentAttempt({
    id,
    number,
    startedAt: NOW,
    consumption: { semantic: number - 1 - tooling, tooling },
    blocker,
    incomplete,
    operationClaims: operationClaims ?? [{
      operation: "execute",
      resources: [...contract.resourceContract.required],
    }],
  });
}

function startDescriptor(state, id, options = {}) {
  const descriptor = state.nextAction();
  assert.ok(descriptor, "expected a definition-owned next action");
  const attempt = attemptFor(state, descriptor.path, id, 1, options);
  if (descriptor.operation === "start") {
    return state.startAttempt({ path: descriptor.path, attempt });
  }
  if (descriptor.operation === "recover") {
    return state.recover({ path: descriptor.path, attempt });
  }
  throw new Error(`cannot start an already-resumable action: ${descriptor.nodeId}`);
}

function completeNext(state, id, { status = "done", summary = id } = {}) {
  const active = startDescriptor(state, id);
  return active.confirmCurrentAttempt({
    status,
    result: status === "done" ? passedResult(summary) : skippedResult(summary),
  });
}

function advanceUntil(state, targetId, prefix = "advance") {
  let next = state.nextAction();
  let count = 0;
  while (next?.nodeId !== targetId) {
    if (next === null) throw new Error(`target ${targetId} is not in the definition order`);
    state = completeNext(state, `${prefix}-${count}`);
    next = state.nextAction();
    count += 1;
    if (count > 100) throw new Error("definition traversal did not converge");
  }
  return state;
}

function flowActivity({
  id,
  state,
  currentPath,
  confirmationOrder,
  operation,
  attempt = null,
  task = null,
  status = null,
  result = null,
  failure = null,
}) {
  const node = state.findNode(currentPath.at(-1));
  const activityAttempt = operation === "retry_attempt" ? state.attempt : attempt ?? state.attempt;
  const type = {
    add_task: "task_added",
    start_attempt: "attempt_started",
    retry_attempt: "attempt_retried",
    update_attempt: "attempt_updated",
    confirm_attempt: "result_confirmed",
    rewind: "recovery",
    recover_attempt: "recovery",
  }[operation];
  return new FlowActivity({
    id,
    nodeId: node.id,
    nodeKey: node.key,
    attemptId: activityAttempt?.id ?? null,
    sequence: activityAttempt?.number ?? null,
    confirmationOrder,
    type,
    transition: new ActivityTransition({ operation, path: currentPath, task, attempt, status }),
    result,
    timing: { startedAt: NOW, finishedAt: LATER, durationMs: 60000 },
    failure,
    provider: "provider",
    model: "model",
    effort: "standard",
    usage: { inputTokens: 11, outputTokens: 7, cacheReadTokens: 2, cost: 0 },
    references: {
      evaluations: [{ id: "evaluation-1", label: null }],
      findings: [{ id: "finding-1", label: null }],
      repairs: [{ id: "repair-1", label: null }],
      artifacts: [{ id: "artifact-1", label: null }],
    },
  });
}

function identitySource(bootIdentity) {
  return new ProcessIdentitySource({
    platform: "linux",
    pid: process.pid,
    readBootIdentity: () => bootIdentity,
    readProcessStartFingerprint: () => "100",
  });
}

function tinyAction(id) {
  return {
    action: `run-${id}`,
    instructionsKey: `tiny.${id}`,
    contextKinds: [],
    outputSchemaRef: null,
    requiresApproval: false,
    autoApproveChoiceId: null,
    maxAttempts: 1,
    sideEffects: null,
    failurePolicy: null,
    executionCommand: null,
  };
}

function tinyDefinition() {
  return new CurrentFlowDefinition({
    root: new FlowDefinitionNode({
      kind: "flow",
      id: "flow",
      key: "flow",
      steps: [
        new FlowDefinitionNode({
          id: "phase",
          key: "phase",
          steps: [
            new FlowDefinitionNode({ id: "first", key: "first", action: tinyAction("first") }),
            new FlowDefinitionNode({ id: "second", key: "second", action: tinyAction("second") }),
          ],
        }),
        new FlowDefinitionNode({
          id: "impl",
          key: "impl",
          steps: [
            new FlowDefinitionNode({ id: "implement", key: "implement", action: tinyAction("implement") }),
            new FlowDefinitionNode({ id: "after", key: "after", action: tinyAction("after") }),
          ],
        }),
      ],
    }),
    taskTemplate: new FlowDefinitionNode({
      kind: "task",
      id: "task",
      key: "task",
      steps: [new FlowDefinitionNode({ id: "task-work", key: "task-work", action: tinyAction("task-work") })],
    }),
    dynamicTaskContainerId: "impl",
    dynamicTaskInsertionAfterId: "implement",
  });
}

describe("Current Flow state foundation", () => {
  let tmp = null;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("adapts every production leaf with normalized definition metadata and inserts dynamic Tasks before test execution", () => {
    const state = CurrentFlowState.create({ definition: definition(), execution: { mode: "worktree" } });
    const withFirst = state.addTask({ id: "task-1", key: "first-task" });
    const withBoth = withFirst.addTask({ id: "task-2", key: "second-task" });
    assert.deepEqual(
      withBoth.findNode("impl").steps.map((node) => node.id),
      ["implement", "task-1", "task-2", "test-execute", "test-result-review", "impl-review", "impl-triage", "impl-repair", "impl-gate", "retro", "acceptance-review", "acceptance-decision", "final-regression", "report", "finalize"],
    );
    assert.ok(withBoth.findNode("task-1") instanceof TaskNode);
    assert.deepEqual(withBoth.findNode("task-1").steps.map((step) => step.id), ["task-1/task-impl", "task-1/task-review", "task-1/task-gate"]);
    const action = withBoth.definition.actionFor("task-1/task-review", withBoth.root);
    assert.deepEqual(action.toJSON(), {
      action: "run-review",
      instructionsKey: "task.task-review",
      contextKinds: ["task_spec", "diff", "testlog"],
      outputSchemaRef: "next-action/review.schema.json",
      requiresApproval: false,
      autoApproveChoiceId: null,
      maxAttempts: 4,
      sideEffects: null,
      failurePolicy: "retry",
      executionCommand: "senti flow run review --phase impl",
    });
    assert.deepEqual(
      withBoth.definition.contractFor("task-1/task-review", withBoth.root).resourceContract.required,
      ["task_spec", "diff", "testlog"],
    );
    const leaves = [];
    const collect = (node) => {
      if (node.steps.length === 0) leaves.push(node);
      else node.steps.forEach(collect);
    };
    collect(withBoth.definition.root);
    withBoth.definition.taskTemplate.steps.forEach(collect);
    for (const leaf of leaves) {
      const metadata = leaf.action.toJSON();
      assert.ok(Object.values(metadata).every((value) => value !== undefined), `adapter must normalize ${leaf.id}`);
      assert.deepEqual(leaf.contract.resourceContract.required, metadata.contextKinds);
    }
    assert.equal(getFlowNode("impl").children[1].id, "test-execute");
  });

  it("rejects out-of-order starts and exposes one definition-owned flow/task frontier", () => {
    let state = CurrentFlowState.create({ definition: definition() })
      .addTask({ id: "task-1", key: "first" })
      .addTask({ id: "task-2", key: "second" });
    const taskPath = ["flow", "impl", "task-1", "task-1/task-impl"];
    assert.equal(state.nextAction().nodeId, "branch");
    assert.throws(
      () => state.startAttempt({ path: taskPath, attempt: attemptFor(state, taskPath, "too-early") }),
      /definition-owned next executable leaf/,
    );
    state = advanceUntil(state, "task-1/task-impl");
    assert.equal(state.nextAction().nodeId, "task-1/task-impl");
    state = completeNext(state, "task-1-impl");
    assert.equal(state.nextAction().nodeId, "task-1/task-review");
    state = completeNext(state, "task-1-review");
    state = completeNext(state, "task-1-gate");
    assert.equal(state.nextAction().nodeId, "task-2/task-impl");
    state = completeNext(state, "task-2-impl");
    state = completeNext(state, "task-2-review");
    state = completeNext(state, "task-2-gate");
    assert.equal(state.nextAction().nodeId, "test-execute");
  });

  it("keeps active facts in an immutable typed Attempt replacement and covers required resources with claims or incomplete work", () => {
    let state = CurrentFlowState.create({ definition: definition() }).addTask({ id: "task-1", key: "first" });
    state = advanceUntil(state, "task-1/task-review");
    const pathToReview = state.nextAction().path;
    const initial = attemptFor(state, pathToReview, "review-1", 1, {
      blocker: { code: "waiting", message: "Waiting for evidence." },
      incomplete: [{
        code: "testlog_pending",
        message: "The test log is not available yet.",
        operation: "collect-testlog",
        resources: ["testlog"],
      }],
      operationClaims: [{ operation: "load-context", resources: ["task_spec", "diff"] }],
    });
    state = state.startAttempt({ path: pathToReview, attempt: initial });
    const replacement = initial.replaceFacts({
      blocker: { code: "resolved", message: "Evidence is now available." },
      incomplete: [],
      operationClaims: [{ operation: "load-context", resources: ["task_spec", "diff", "testlog"] }],
    });
    state = state.replaceCurrentAttempt({ attempt: replacement });
    assert.equal(state.attempt.id, "review-1");
    assert.equal(state.attempt.number, 1);
    assert.equal(state.attempt.blocker.code, "resolved");
    assert.equal(initial.blocker.code, "waiting");
    assert.equal(state.retryEligibility().semanticRemaining, 3);
    assert.equal(state.retryEligibility().toolingRemaining, 1);
    assert.throws(
      () => state.replaceCurrentAttempt({ attempt: replacement.replaceFacts({ operationClaims: [{ operation: "bad", resources: ["unknown"] }] }) }),
      /exceeds definition contract/,
    );
    assert.throws(
      () => state.replaceCurrentAttempt({ attempt: new CurrentAttempt({
        ...replacement.toJSON(),
        id: "review-other",
      }) }),
      /preserve attempt identity/,
    );
    assert.throws(
      () => state.replaceCurrentAttempt({ attempt: replacement.replaceFacts({
        incomplete: [{
          code: "duplicate",
          message: "Duplicate coverage.",
          operation: "again",
          resources: ["task_spec"],
        }],
      }) }),
      /duplicates or conflicts/,
    );
    const activeReview = state;
    state = state.retryCurrentAttempt({
      attempt: attemptFor(state, pathToReview, "review-2", 2),
      kind: "semantic",
    });
    assert.equal(state.attempt.id, "review-2");
    assert.equal(state.attempt.consumption.semantic, 1);
    assert.throws(
      () => state.retryCurrentAttempt({
        attempt: attemptFor(state, pathToReview, "review-gap", 4),
        kind: "semantic",
      }),
      /immediately follow/,
    );
    assert.throws(
      () => state.retryCurrentAttempt({
        attempt: attemptFor(state, pathToReview, "review-wrong-kind", 3),
        kind: "tooling",
      }),
      /tooling retry must increment only tooling/,
    );
    assert.throws(
      () => new CurrentAttempt({
        ...state.attempt.toJSON(),
        id: "review-wrong-number",
        number: 3,
      }),
      /number must equal/,
    );

    let semanticLimit = state;
    semanticLimit = semanticLimit.retryCurrentAttempt({
      attempt: attemptFor(semanticLimit, pathToReview, "review-3", 3),
      kind: "semantic",
    });
    semanticLimit = semanticLimit.retryCurrentAttempt({
      attempt: attemptFor(semanticLimit, pathToReview, "review-4", 4),
      kind: "semantic",
    });
    assert.throws(
      () => semanticLimit.retryCurrentAttempt({
        attempt: attemptFor(semanticLimit, pathToReview, "review-semantic-over", 5),
        kind: "semantic",
      }),
      /semanticRetryLimit/,
    );

    const toolingAttempt = attemptFor(activeReview, pathToReview, "review-tooling-2", 2, { tooling: 1 });
    const toolingLimit = activeReview.retryCurrentAttempt({ attempt: toolingAttempt, kind: "tooling" });
    assert.equal(toolingLimit.attempt.consumption.tooling, 1);
    assert.throws(
      () => toolingLimit.retryCurrentAttempt({
        attempt: attemptFor(toolingLimit, pathToReview, "review-tooling-over", 3, { tooling: 2 }),
        kind: "tooling",
      }),
      /toolingRetryLimit/,
    );

    let implementation = CurrentFlowState.create({ definition: definition() })
      .addTask({ id: "task-no-tooling", key: "no-tooling" });
    implementation = advanceUntil(implementation, "task-no-tooling/task-impl", "no-tooling-prelude");
    const implementationPath = implementation.nextAction().path;
    implementation = implementation.startAttempt({
      path: implementationPath,
      attempt: attemptFor(implementation, implementationPath, "impl-1"),
    });
    assert.throws(
      () => implementation.retryCurrentAttempt({
        attempt: attemptFor(implementation, implementationPath, "impl-tooling", 2, { tooling: 1 }),
        kind: "tooling",
      }),
      /tooling consumption is not authorized/,
    );
  });

  it("rejects malformed lifecycle JSON while preserving valid parent results through a rewind", () => {
    const tiny = tinyDefinition();
    let state = CurrentFlowState.create({ definition: tiny });
    state = completeNext(state, "first");
    state = completeNext(state, "second", { status: "skipped" });
    assert.equal(state.findNode("phase").status, "done");
    assert.equal(state.findNode("phase").result.outcome, "skipped");
    const valid = state.toJSON();
    const pendingBeforeDone = structuredClone(valid);
    pendingBeforeDone.steps[0].steps[0].status = "pending";
    pendingBeforeDone.steps[0].steps[0].result = null;
    pendingBeforeDone.steps[0].status = "in_progress";
    assert.throws(
      () => new CurrentFlowState(pendingBeforeDone, { definition: tiny }),
      /execution frontier/,
    );
    const badParent = structuredClone(valid);
    badParent.steps[0].status = "pending";
    badParent.steps[0].result = null;
    assert.throws(
      () => new CurrentFlowState(badParent, { definition: tiny }),
      /pending branch/,
    );
    const wrongLeafOutcome = structuredClone(valid);
    wrongLeafOutcome.steps[0].steps[0].result = skippedResult("wrong leaf outcome");
    assert.throws(
      () => new CurrentFlowState(wrongLeafOutcome, { definition: tiny }),
      /done leaf requires a passed result/,
    );
    const skippedPath = ["flow", "phase", "second"];
    state = state.rewind({ path: skippedPath, attempt: attemptFor(state, skippedPath, "second-rewind") });
    assert.equal(state.current.at(-1), "second");
    assert.equal(state.findNode("second").result, null);
    assert.equal(state.findNode("phase").status, "in_progress");
    assert.equal(state.findNode("phase").result.outcome, "skipped");
    const activeResult = state.toJSON();
    activeResult.steps[0].steps[1].result = passedResult("corrupt active");
    assert.throws(
      () => new CurrentFlowState(activeResult, { definition: tiny }),
      /in_progress leaf must not retain a result/,
    );
    const nonLeafCursor = state.toJSON();
    nonLeafCursor.current = ["flow", "phase"];
    assert.throws(
      () => new CurrentFlowState(nonLeafCursor, { definition: tiny }),
      /execution frontier active leaf must match current path/,
    );
  });

  it("uses recovery Activities for invalidated next leaves and never lets start bypass recovery", () => {
    let state = CurrentFlowState.create({ definition: definition() });
    state = advanceUntil(state, "prepare-spec");
    state = completeNext(state, "prepare-spec");
    const rewindPath = ["flow", "plan", "branch"];
    state = state.rewind({ path: rewindPath, attempt: attemptFor(state, rewindPath, "branch-rewind") });
    assert.throws(
      () => state.addTask({ id: "late-task", key: "late" }),
      /insertion is closed/,
    );
    state = state.confirmCurrentAttempt({ result: passedResult("branch repaired") });
    const recovered = state.nextAction();
    assert.equal(recovered.operation, "recover");
    assert.equal(recovered.nodeId, "prepare-spec");
    assert.throws(
      () => state.startAttempt({ path: recovered.path, attempt: attemptFor(state, recovered.path, "bypass") }),
      /definition-owned next executable leaf/,
    );
    assert.equal(state.recoveryTarget(recovered.path).operation, "recover");
    state = state.recover({ path: recovered.path, attempt: attemptFor(state, recovered.path, "prepare-recovery") });
    assert.equal(state.current.at(-1), "prepare-spec");
    assert.equal(state.findNode("prepare-spec").status, "in_progress");
  });

  it("resolves next action, artifact sources, and recovery legality from current state plus definition without Activity history", () => {
    let state = CurrentFlowState.create({ definition: definition(), execution: { mode: "branch" } });
    state = completeNext(state, "branch", { summary: "branch-artifact" });
    state = completeNext(state, "prepare", { summary: "prepare-artifact" });
    state = completeNext(state, "draft", { summary: "draft-artifact" });
    const authority = state.artifactAuthority();
    assert.equal(state.nextAction().nodeId, "draft-questions-review");
    assert.deepEqual(authority.requiredResources, ["draft", "issue"]);
    assert.deepEqual(authority.sources.map((source) => source.nodeId), ["branch", "prepare-spec", "draft"]);
    tmp = createTmpDir("current-flow-read-api-");
    const store = new CurrentFlowStateStore({ directory: tmp, definition: definition() });
    // Simulate a durably persisted current state with unrelated historical
    // JSONL. Loading a resume descriptor must not treat that history as
    // control input.
    fs.writeFileSync(store.statePath, `${JSON.stringify(state.toJSON())}\n`);
    const unrelated = flowActivity({
      id: "unapplied-history",
      state,
      currentPath: state.nextAction().path,
      confirmationOrder: 1,
      operation: "start_attempt",
      attempt: attemptFor(state, state.nextAction().path, "unapplied-attempt"),
    });
    fs.writeFileSync(path.join(tmp, "activities.jsonl"), `${JSON.stringify(unrelated.toJSON())}\n`);
    assert.deepEqual(store.load().nextAction().toJSON(), state.nextAction().toJSON());
    assert.deepEqual(store.load().artifactAuthority().toJSON(), authority.toJSON());
    const rewindPath = ["flow", "plan", "prepare-spec"];
    state = state.rewind({ path: rewindPath, attempt: attemptFor(state, rewindPath, "prepare-rewind") });
    const duringRewind = state.artifactAuthority();
    assert.deepEqual(duringRewind.sources.map((source) => source.nodeId), ["branch"]);
    assert.equal(state.findNode("draft").status, "invalidated");
    assert.equal(duringRewind.sources.some((source) => source.nodeId === "draft"), false);
    assert.equal(state.recoveryTarget(["flow", "plan", "draft"]).legal, false);
  });

  it("uses typed update Activity and a JSONL-derived Markdown view without reading activities.md as control input", () => {
    tmp = createTmpDir("current-flow-activity-view-");
    const initial = CurrentFlowState.create({ definition: definition() });
    const store = new CurrentFlowStateStore({ directory: tmp, definition: definition() });
    store.create(initial);
    const branchPath = ["flow", "plan", "branch"];
    const startAttempt = attemptFor(initial, branchPath, "branch-1", 1, {
      incomplete: [{ code: "waiting", message: "Need an external value.", operation: null, resources: [] }],
    });
    const started = store.apply({ activity: flowActivity({
      id: "a1",
      state: initial,
      currentPath: branchPath,
      confirmationOrder: 1,
      operation: "start_attempt",
      attempt: startAttempt,
    }) });
    const updatedAttempt = startAttempt.replaceFacts({
      blocker: { code: "ready", message: "The value arrived." },
      incomplete: [],
    });
    const updated = store.apply({ activity: flowActivity({
      id: "a2",
      state: started,
      currentPath: branchPath,
      confirmationOrder: 2,
      operation: "update_attempt",
      attempt: updatedAttempt,
    }) });
    assert.equal(updated.attempt.blocker.code, "ready");
    assert.deepEqual(store.journal.read().map((entry) => entry.type), ["attempt_started", "attempt_updated"]);
    const view = store.writeActivitiesView();
    assert.match(view.toMarkdown(), /attempt_updated/);
    assert.throws(() => store.writeActivitiesView(store.journal.filePath), /must not replace/);
    assert.throws(() => store.writeActivitiesView(store.statePath), /must not replace/);
    assert.throws(() => store.journal.writeMarkdown(store.journal.filePath), /must not replace/);
    assert.throws(() => store.journal.writeMarkdown(store.statePath), /must not replace/);
    const markdownPath = path.join(tmp, "activities.md");
    fs.writeFileSync(markdownPath, "corrupt prose must not control state\n");
    assert.equal(store.load().attempt.id, "branch-1");
    assert.equal(store.load().resumeDescriptor().operation, "resume");
    const afterMarkdown = store.apply({ activity: flowActivity({
      id: "a3",
      state: updated,
      currentPath: branchPath,
      confirmationOrder: 3,
      operation: "update_attempt",
      attempt: updatedAttempt.replaceFacts({ blocker: { code: "complete", message: "State persisted." } }),
    }) });
    assert.equal(afterMarkdown.attempt.blocker.code, "complete");
    store.writeActivitiesView();
    assert.match(fs.readFileSync(markdownPath, "utf8"), /generated from `activities\.jsonl`/);
  });

  it("recovers idempotently from a journal-first crash and exposes the deferred conversion adoption boundary", () => {
    tmp = createTmpDir("current-flow-crash-");
    const boundary = new CurrentFlowStateAdoptionBoundary({ definition: definition() });
    const initial = boundary.createFresh();
    const store = boundary.openStore({ directory: tmp });
    store.create(initial);
    const branchPath = ["flow", "plan", "branch"];
    const entry = flowActivity({
      id: "activity-start",
      state: initial,
      currentPath: branchPath,
      confirmationOrder: 1,
      operation: "start_attempt",
      attempt: attemptFor(initial, branchPath, "branch-1"),
    });
    const crashing = boundary.openStore({
      directory: tmp,
      faultInjector({ phase }) { if (phase === "activity-appended") throw new Error("crash after durable journal append"); },
    });
    assert.throws(() => crashing.apply({ activity: entry }), /crash after durable/);
    assert.equal(store.load().confirmationOrder, 0);
    const started = store.apply({ activity: entry });
    assert.equal(started.confirmationOrder, 1);
    assert.equal(store.apply({ activity: entry }).confirmationOrder, 1);
    assert.equal(store.journal.read().length, 1);
    assert.throws(
      () => store.apply({ activity: new FlowActivity({ ...entry.toJSON(), provider: "different" }) }),
      (error) => error instanceof CurrentFlowStateConflictError,
    );
    const confirmed = flowActivity({
      id: "activity-confirm",
      state: started,
      currentPath: branchPath,
      confirmationOrder: 2,
      operation: "confirm_attempt",
      status: "done",
      result: passedResult("branch confirmed"),
    });
    const afterStateWrite = boundary.openStore({
      directory: tmp,
      faultInjector({ phase }) { if (phase === "state-written") throw new Error("crash after state CAS"); },
    });
    assert.throws(() => afterStateWrite.apply({ activity: confirmed }), /crash after state CAS/);
    assert.equal(store.load().confirmationOrder, 2);
    assert.equal(store.apply({ activity: confirmed }).confirmationOrder, 2);
    assert.equal(store.journal.read().length, 2);
    const plan = boundary.conversionPlan({ sourceFormat: "legacy-flow-json", targetDirectory: tmp });
    assert.deepEqual(plan.toJSON(), {
      sourceFormat: "legacy-flow-json",
      targetDirectory: tmp,
      targetSchemaRevision: 1,
      freshStateOnly: true,
      conversionImplemented: false,
      legacyRead: "deferred",
      runtimeSwitch: "deferred",
      doubleWrite: "forbidden",
    });
    assert.throws(() => plan.assertCurrentStateOnly({}), /conversion is deferred/);
  });

  it("rejects a partial Activity journal tail rather than treating it as control input", () => {
    tmp = createTmpDir("current-flow-partial-journal-");
    const journalPath = path.join(tmp, "activities.jsonl");
    fs.writeFileSync(journalPath, "{\"id\":\"partial\"");
    assert.throws(() => new FlowActivityJournal(journalPath).read(), /partial line/);
  });

  it("derives append order from the durable journal instead of caller-supplied entries", () => {
    tmp = createTmpDir("current-flow-journal-order-");
    const initial = CurrentFlowState.create({ definition: definition() });
    const branchPath = ["flow", "plan", "branch"];
    const journal = new FlowActivityJournal(path.join(tmp, "activities.jsonl"));
    journal.append(flowActivity({
      id: "first",
      state: initial,
      currentPath: branchPath,
      confirmationOrder: 1,
      operation: "start_attempt",
      attempt: attemptFor(initial, branchPath, "branch-first"),
    }));
    assert.throws(
      () => journal.append(flowActivity({
        id: "duplicate-order",
        state: initial,
        currentPath: branchPath,
        confirmationOrder: 1,
        operation: "start_attempt",
        attempt: attemptFor(initial, branchPath, "branch-second"),
      }), []),
      /confirmationOrder must follow/,
    );
    assert.equal(journal.read().length, 1);
  });

  it("creates only fresh state against an absent or empty Activity journal", () => {
    tmp = createTmpDir("current-flow-fresh-create-");
    const initial = CurrentFlowState.create({ definition: definition() });
    const branchPath = ["flow", "plan", "branch"];
    const active = initial.startAttempt({
      path: branchPath,
      attempt: attemptFor(initial, branchPath, "branch-1"),
    });
    const activeStore = new CurrentFlowStateStore({ directory: path.join(tmp, "active"), definition: definition() });
    assert.throws(() => activeStore.create(active), /requires a fresh state/);
    const completed = completeNext(initial, "branch-done");
    const completedStore = new CurrentFlowStateStore({ directory: path.join(tmp, "completed"), definition: definition() });
    assert.throws(() => completedStore.create(completed), /fresh materialized state/);
    const withTask = initial.addTask({ id: "task-1", key: "first" });
    const taskStore = new CurrentFlowStateStore({ directory: path.join(tmp, "task"), definition: definition() });
    assert.throws(() => taskStore.create(withTask), /fresh materialized state/);
    const journalStore = new CurrentFlowStateStore({ directory: path.join(tmp, "journal"), definition: definition() });
    const historical = flowActivity({
      id: "existing-activity",
      state: initial,
      currentPath: branchPath,
      confirmationOrder: 1,
      operation: "start_attempt",
      attempt: attemptFor(initial, branchPath, "branch-history"),
    });
    fs.writeFileSync(journalStore.journal.filePath, `${JSON.stringify(historical.toJSON())}\n`);
    assert.throws(() => journalStore.create(initial), /requires an absent or empty Activity journal/);
  });

  it("reclaims a process-identified stale lock before replaying the same typed Activity", () => {
    tmp = createTmpDir("current-flow-stale-lock-");
    const initial = CurrentFlowState.create({ definition: definition() });
    const store = new CurrentFlowStateStore({ directory: tmp, definition: definition() });
    store.create(initial);
    const branchPath = ["flow", "plan", "branch"];
    const entry = flowActivity({
      id: "stale-lock-start",
      state: initial,
      currentPath: branchPath,
      confirmationOrder: 1,
      operation: "start_attempt",
      attempt: attemptFor(initial, branchPath, "branch-1"),
    });
    const stranded = new CurrentFlowStateStore({
      directory: tmp,
      definition: definition(),
      processIdentitySource: identitySource("owner-boot"),
    });
    stranded.lock.acquire();
    const recovering = new CurrentFlowStateStore({
      directory: tmp,
      definition: definition(),
      processIdentitySource: identitySource("recovery-boot"),
    });
    assert.equal(recovering.apply({ activity: entry }).confirmationOrder, 1);
  });

  it("rejects forbidden legacy fields and malformed typed incomplete claims at the deserialization boundary", () => {
    const clean = CurrentFlowState.create({ definition: definition() }).toJSON();
    for (const field of ["currentTaskId", "childId", "runtimeLog", "metrics", "notes", "stepAttempts", "workerArtifactReceipts", "reviewConvergence", "reviewRecoveryBaselines", "testReviewRepairHistory", "expandedPluginHooks"]) {
      assert.throws(
        () => new CurrentFlowState({ ...clean, [field]: [] }, { definition: definition() }),
        (error) => error instanceof CurrentFlowStateInvariantError && error.message.includes(field),
      );
    }
    assert.throws(
      () => new CurrentAttempt({
        id: "bad",
        number: 1,
        startedAt: NOW,
        consumption: { semantic: 0, tooling: 0 },
        blocker: null,
        incomplete: [{ code: "bad", message: "Bad resource.", operation: null, resources: ["spec"] }],
        operationClaims: [],
      }),
      /resources requires an operation/,
    );
  });
});
