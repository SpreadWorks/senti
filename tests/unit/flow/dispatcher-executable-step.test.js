import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildInitialNestedSteps,
  deriveNextAction,
  FlowNode,
} from "../../../src/flow/definition.js";
import {
  ExecuteStepDirective,
  NextActionDirective,
} from "../../../src/flow/lib/next-action-directive.js";

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

test("agent-owned steps do not manufacture a CLI transition", () => {
  const action = deriveNextAction({
    scope: "flow",
    stepId: "implement",
    context: { steps: buildInitialNestedSteps() },
  });

  assert.equal(action.executionCommand, null);
});
