import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildInitialNestedSteps,
  deriveNextAction,
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

  assert.equal(action.executionCommand, "senti flow run test-execute");
});

test("execute-step directives preserve CLI-owned executable commands", () => {
  const directive = new ExecuteStepDirective({
    action: "run-test-execute",
    nextAction: "senti flow run test-execute --expect-binding 'opaque'",
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
