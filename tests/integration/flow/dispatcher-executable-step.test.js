import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildInitialNestedSteps,
  collectFlowLeafIds,
  collectTaskLeafIds,
  deriveNextAction,
  FlowNode,
  resolveDispatcherOwnedFlowAction,
} from "../../../src/flow/definition.js";
import {
  DispatcherOwnedFlowCommand,
  FlowDispatchAction,
} from "../../../src/flow/lib/run-dispatch.js";
import { flowCommands } from "../../../src/lib/command-registry.js";
import {
  AwaitDraftQuestionDirective,
  ExecuteStepDirective,
  NextActionDirective,
} from "../../../src/flow/lib/next-action-directive.js";
import {
  UserActionChoice,
  UserActionImpact,
  UserActionPrompt,
} from "../../../src/flow/lib/user-action-prompt.js";

test("definition lifecycle-owned steps expose their canonical CLI command", () => {
  const action = deriveNextAction({
    scope: "flow",
    stepId: "test-execute",
    context: { steps: buildInitialNestedSteps() },
  });

  assert.equal(action.executionCommand, "sennel flow run test-execute");
});

test("review steps declare complete phase-aware CLI commands", () => {
  const cases = [
    ["flow", "draft-questions-review", "sennel flow run review --phase draft"],
    ["flow", "draft-coverage-review", "sennel flow run review --phase draft"],
    ["flow", "spec-review", "sennel flow run review --phase spec"],
    ["flow", "test-review", "sennel flow run review --phase test"],
    ["flow", "impl-review", "sennel flow run review --phase impl"],
    ["task", "task-review", "sennel flow run review --phase impl"],
  ];

  for (const [scope, stepId, expected] of cases) {
    const action = deriveNextAction({ scope, stepId });
    assert.equal(action.action, "run-review", `${scope}.${stepId} semantic action`);
    assert.equal(action.executionCommand, expected, `${scope}.${stepId} execution command`);
  }
});

test("definition lifecycle-owned steps must declare their execution command", () => {
  assert.throws(
    () => new FlowNode({
      id: "example-run",
      label: "Example",
      action: "run-example",
      instructionsKey: "example.run",
      definitionLifecycleOwned: true,
    }),
    /must declare executionCommand/,
  );
});

test("execute-step directives preserve CLI-owned executable commands", () => {
  const directive = new ExecuteStepDirective({
    action: "run-test-execute",
    nextAction: "sennel flow run test-execute --expect-binding 'opaque'",
  });

  assert.deepEqual(
    NextActionDirective.fromStored(directive.toJSON()).toJSON(),
    directive.toJSON(),
  );
});

test("approval-bound execute-step directives preserve their user action prompt", () => {
  const directive = new ExecuteStepDirective({
    action: "await-approval",
    actionPrompt: new UserActionPrompt({
      question: "Review or approve the specification?",
      choices: [
        new UserActionChoice({
          actionId: "APPROVE_SPECIFICATION",
          stateTransition: "resume-current-approval-boundary",
          label: "Approve",
          impact: new UserActionImpact({ changes: ["approval authorization"] }),
        }),
        new UserActionChoice({
          actionId: "REVIEW_SPECIFICATION_SUMMARY",
          nextAction: "sennel flow get artifact spec.record --mode summary --expect-binding 'opaque'",
          label: "Review summary",
          impact: new UserActionImpact({ retains: ["current approval boundary"] }),
        }),
      ],
      recommendedActionId: "REVIEW_SPECIFICATION_SUMMARY",
      recommendationReason: "Review before approving.",
    }),
  });

  const restored = NextActionDirective.fromStored(directive.toJSON());

  assert.equal(restored.requiresUserAction, true);
  assert.deepEqual(restored.toJSON(), directive.toJSON());
});

test("draft question directives preserve the canonical question identity", () => {
  const directive = new AwaitDraftQuestionDirective({
    questionId: "q3",
    question: "Which public behavior should remain stable?",
  });

  const restored = NextActionDirective.fromStored(directive.toJSON());

  assert.equal(restored.requiresUserAction, true);
  assert.deepEqual(restored.toJSON(), directive.toJSON());
  assert.equal(new FlowDispatchAction({
    requires_approval: false,
    directive: directive.toJSON(),
  }).awaitsUserDecision, true);
});

test("agent-owned steps do not manufacture a CLI transition", () => {
  const action = deriveNextAction({
    scope: "flow",
    stepId: "implement",
    context: { steps: buildInitialNestedSteps() },
  });

  assert.equal(action.executionCommand, null);
});

test("dispatcher-owned commands retain tokenized definition arguments", () => {
  const definition = resolveDispatcherOwnedFlowAction({
    scope: "flow",
    stepId: "draft-questions-review",
  });

  assert.equal(definition.action, "run-review");
  assert.deepEqual(definition.executionCommand.runArguments(), ["review", "--phase", "draft"]);
  const command = new DispatcherOwnedFlowCommand({
    taskId: null,
    step: "draft-questions-review",
    action: "run-review",
  });
  assert.equal(command.commandName, "review");
  assert.deepEqual(command.command.runArguments(), ["review", "--phase", "draft"]);
});

test("dispatcher-owned commands reject a next-action whose semantic action disagrees with its definition", () => {
  assert.throws(
    () => new DispatcherOwnedFlowCommand({
      taskId: null,
      step: "draft-questions-review",
      action: "write-draft",
    }),
    /action mismatch/,
  );
});

test("every definition-owned lifecycle command resolves to one registered Flow run command", () => {
  for (const [scope, stepIds] of [
    ["flow", collectFlowLeafIds()],
    ["task", collectTaskLeafIds()],
  ]) {
    for (const stepId of stepIds) {
      const owned = resolveDispatcherOwnedFlowAction({ scope, stepId });
      if (owned === null) continue;
      assert.equal(owned.executionCommand.subcommand.length > 0, true, `${scope}.${stepId} command name`);
      assert.equal(owned.executionCommand.runArguments()[0], owned.executionCommand.subcommand);
      assert.equal(typeof flowCommands.run[owned.executionCommand.subcommand]?.command, "function", `${scope}.${stepId} registry command`);
    }
  }
});
