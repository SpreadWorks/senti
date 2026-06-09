// spec: R1 R2 R3 R6 R8
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import * as definitionModule from "../../../src/flow/definition.js";

const root = process.cwd();
const definitionPath = path.join(root, "src/flow/definition.js");
const stepTreePath = path.join(root, "src/flow/lib/step-tree.js");
const stepsUtilityNames = ["flattenSteps", "findStepById", "findFirstPendingLeaf", "findInProgressLeaf"];

function read(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function walkFiles(dir, predicate, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, predicate, acc);
    } else if (predicate(full)) {
      acc.push(full);
    }
  }
  return acc;
}

function createLifecycleRecorder() {
  const calls = [];
  return {
    calls,
    setStepStatus(step, status) {
      calls.push(["setStepStatus", step, status]);
    },
    keepInProgress(step) {
      calls.push(["keepInProgress", step]);
    },
    appendIssueLog(source) {
      calls.push(["appendIssueLog", source]);
    },
    incrementMetric(phase, counter) {
      calls.push(["incrementMetric", phase, counter]);
    },
    executeSideEffects() {
      calls.push(["executeSideEffects"]);
    },
    skipSteps(steps) {
      calls.push(["skipSteps", steps]);
    },
    resetSteps(steps) {
      calls.push(["resetSteps", steps]);
    },
    runLifecycleHook(module, handler) {
      calls.push(["runLifecycleHook", module, handler]);
    },
  };
}

function snapshotActions(actions) {
  assert.ok(Array.isArray(actions), "lifecycle resolution must return actions");
  return actions.map((action) => ({
    className: action.constructor.name,
    ...Object.fromEntries(Object.entries(action)),
  }));
}

test("R1: definition exposes APIs instead of raw definition data", () => {
  const source = read(definitionPath);

  assert.doesNotMatch(source, /export\s+const\s+FLOW_DEFINITION\b/);
  assert.doesNotMatch(source, /export\s+const\s+TASK_DEFINITION\b/);
  assert.equal(Object.hasOwn(definitionModule, "FLOW_DEFINITION"), false);
  assert.equal(Object.hasOwn(definitionModule, "TASK_DEFINITION"), false);

  for (const api of [
    "getFlowNode",
    "getTaskNode",
    "collectFlowLeafIds",
    "deriveFlowPhaseMap",
    "getFlowDefinitionOrder",
    "findActiveNode",
    "deriveNextAction",
    "resolveMaxAttempts",
    "resolveSideEffects",
    "resolveRuntimeStep",
    "resolveLifecycle",
  ]) {
    assert.equal(typeof definitionModule[api], "function", `${api} must be exported as a function`);
  }

  assert.equal(definitionModule.getFlowNode("draft")?.id, "draft");
  assert.equal(definitionModule.getTaskNode("task-gate")?.id, "task-gate");
  assert.deepEqual(definitionModule.collectFlowLeafIds().slice(0, 5), [
    "branch",
    "prepare-spec",
    "draft",
    "draft-questions-review",
    "draft-questions-triage",
  ]);
  assert.ok(definitionModule.collectFlowLeafIds().includes("finalize-cleanup"));
  assert.deepEqual({
    branch: definitionModule.deriveFlowPhaseMap().branch,
    "spec-review": definitionModule.deriveFlowPhaseMap()["spec-review"],
    "impl-gate": definitionModule.deriveFlowPhaseMap()["impl-gate"],
    "finalize-merge": definitionModule.deriveFlowPhaseMap()["finalize-merge"],
  }, {
    branch: "plan",
    "spec-review": "plan",
    "impl-gate": "impl",
    "finalize-merge": "finalize",
  });
  assert.deepEqual(definitionModule.getFlowDefinitionOrder().slice(0, 3), ["branch", "prepare-spec", "draft"]);
  assert.ok(
    definitionModule.getFlowDefinitionOrder().indexOf("test-execute")
      < definitionModule.getFlowDefinitionOrder().indexOf("finalize-cleanup"),
  );
  assert.deepEqual(definitionModule.findActiveNode({
    steps: [
      {
        id: "plan",
        status: "pending",
        children: [
          { id: "draft", status: "in_progress" },
          { id: "test-review", status: "in_progress" },
        ],
      },
      {
        id: "impl",
        status: "pending",
        children: [{ id: "implement", status: "pending" }],
      },
    ],
    tasks: [],
    currentTaskId: null,
  }), { scope: "flow", taskId: null, stepId: "test-review" });
  assert.deepEqual(definitionModule.findActiveNode({
    steps: [],
    tasks: [
      {
        id: "T-1",
        steps: [
          { id: "task-impl", status: "pending" },
          { id: "task-gate", status: "in_progress" },
        ],
      },
    ],
    currentTaskId: "T-1",
  }), { scope: "task", taskId: "T-1", stepId: "task-gate" });
  assert.deepEqual(definitionModule.deriveNextAction({
    scope: "flow",
    stepId: "approval",
    context: { autoApprove: false },
  }), {
    action: "await-approval",
    instructionsKey: "plan.approval",
    contextKinds: ["spec"],
    outputSchemaRef: "next-action/approval.schema.json",
    requiresApproval: true,
    maxAttempts: 1,
    sideEffects: ["syncSpecTasks", "autoUpgradeReeval"],
  });
  assert.deepEqual(definitionModule.deriveNextAction({
    scope: "task",
    stepId: "task-gate",
    context: { autoApprove: true },
  }), {
    action: "run-gate",
    instructionsKey: "impl.impl-gate",
    contextKinds: ["task_spec", "guardrail"],
    outputSchemaRef: "next-action/gate.schema.json",
    requiresApproval: false,
    maxAttempts: 5,
    sideEffects: ["completeTask", "promoteNextTask", "mergeOverview"],
  });
  assert.equal(definitionModule.resolveMaxAttempts({ scope: "flow", stepId: "draft-gate" }), 5);
  assert.equal(definitionModule.resolveMaxAttempts({
    scope: "flow",
    stepId: "spec-review",
    context: { autoApprove: false },
  }), 4);
  assert.equal(definitionModule.resolveMaxAttempts({
    scope: "flow",
    stepId: "draft-questions-review",
    context: { autoApprove: true },
  }), 1);
  assert.deepEqual(definitionModule.resolveSideEffects({ scope: "flow", stepId: "impl-gate" }), [
    "completeTask",
    "promoteNextTask",
    "mergeOverview",
  ]);
  assert.deepEqual(definitionModule.resolveSideEffects({ scope: "task", stepId: "task-gate" }), [
    "completeTask",
    "promoteNextTask",
    "mergeOverview",
  ]);
  assert.equal(definitionModule.resolveSideEffects({ scope: "flow", stepId: "draft-gate" }), null);
  assert.match(source, /getFlowNode|flowDefinition\s*=\s*new|flowDefinition\s*=\s*Object\.freeze/s);
  assert.match(source, /getTaskNode|taskDefinition\s*=\s*new|taskDefinition\s*=\s*Object\.freeze/s);
  assert.match(source, /getFlowDefinitionOrder|definitionOrder/i);
  assert.match(source, /resolveMaxAttempts|maxAttempts/i);
  assert.match(source, /resolveSideEffects|sideEffects/i);
  assert.match(source, /resolveRuntimeStep|runtimeStep/i);
  assert.match(source, /resolveLifecycle|lifecycle/i);
});

test("R2: steps-array utilities live in a dedicated step-tree module", () => {
  assert.equal(fs.existsSync(stepTreePath), true, "src/flow/lib/step-tree.js must exist");
  const stepTree = read(stepTreePath);
  const definition = read(definitionPath);

  for (const name of stepsUtilityNames) {
    assert.match(stepTree, new RegExp(`export\\s+function\\s+${name}\\b|export\\s*\\{[^}]*\\b${name}\\b`, "s"));
    assert.doesNotMatch(definition, new RegExp(`export\\s+function\\s+${name}\\b`));
    assert.doesNotMatch(definition, new RegExp(`export\\s+(?:const|let|var|class)\\s+${name}\\b`));
    assert.doesNotMatch(definition, new RegExp(`export\\s*\\{[^}]*\\b${name}\\b`, "s"));
    assert.doesNotMatch(definition, new RegExp(`function\\s+${name}\\b`));
    assert.doesNotMatch(definition, new RegExp(`(?:const|let|var)\\s+${name}\\b`));
  }
});

test("R2: consumers import step-tree utilities from the step-tree module", () => {
  const files = [
    ...walkFiles(path.join(root, "src"), (file) => file.endsWith(".js")),
    ...walkFiles(path.join(root, "tests"), (file) => file.endsWith(".js")),
  ];

  const offenders = [];
  for (const file of files) {
    const source = read(file);
    const imports = source.matchAll(/import\s+\{([^}]+)\}\s+from\s+["']([^"']*flow\/definition\.js|[^"']*\.\.\/definition\.js)["']/g);
    for (const match of imports) {
      const names = match[1].split(",").map((part) => part.trim().split(/\s+as\s+/)[0]);
      const migratedUtilities = names.filter((name) => stepsUtilityNames.includes(name));
      if (migratedUtilities.length > 0) {
        offenders.push(`${path.relative(root, file)} imports ${migratedUtilities.join(", ")}`);
      }
    }

    const namespaceImports = source.matchAll(/import\s+\*\s+as\s+(\w+)\s+from\s+["']([^"']*flow\/definition\.js|[^"']*\.\.\/definition\.js)["']/g);
    for (const match of namespaceImports) {
      const namespaceName = match[1];
      const leakedUtilities = stepsUtilityNames.filter((name) => {
        return new RegExp(`\\b${namespaceName}\\.${name}\\b`).test(source);
      });
      if (leakedUtilities.length > 0) {
        offenders.push(`${path.relative(root, file)} accesses ${namespaceName}.${leakedUtilities.join(`/${namespaceName}.`)}`);
      }
    }
  }

  assert.deepEqual(offenders, []);
});

test("R3: lifecycle actions are dedicated classes with invariants", () => {
  const source = read(definitionPath);

  assert.equal(typeof definitionModule.SetStepStatus, "function");
  assert.equal(typeof definitionModule.KeepInProgress, "function");
  assert.equal(typeof definitionModule.IncrementMetric, "function");
  assert.equal(typeof definitionModule.AppendIssueLog, "function");
  assert.equal(typeof definitionModule.ExecuteSideEffects, "function");
  assert.equal(typeof definitionModule.SkipSteps, "function");
  assert.equal(typeof definitionModule.ResetSteps, "function");
  assert.equal(typeof definitionModule.RunLifecycleHook, "function");

  const recorder = createLifecycleRecorder();
  new definitionModule.SetStepStatus({ step: "self", status: "done" }).apply(recorder);
  new definitionModule.KeepInProgress({ step: "self" }).apply(recorder);
  new definitionModule.IncrementMetric({ phase: "test", counter: "reviewRetry" }).apply(recorder);
  new definitionModule.AppendIssueLog({ source: "gate-result" }).apply(recorder);
  new definitionModule.ExecuteSideEffects().apply(recorder);
  new definitionModule.SkipSteps({ steps: ["finalize-sync"] }).apply(recorder);
  new definitionModule.ResetSteps({ steps: ["test-execute"] }).apply(recorder);
  new definitionModule.RunLifecycleHook({ module: "finalize", handler: "recordMergeOutcome" }).apply(recorder);
  assert.deepEqual(recorder.calls, [
    ["setStepStatus", "self", "done"],
    ["keepInProgress", "self"],
    ["incrementMetric", "test", "reviewRetry"],
    ["appendIssueLog", "gate-result"],
    ["executeSideEffects"],
    ["skipSteps", ["finalize-sync"]],
    ["resetSteps", ["test-execute"]],
    ["runLifecycleHook", "finalize", "recordMergeOutcome"],
  ]);

  assert.throws(() => new definitionModule.SetStepStatus({ step: "", status: "done" }));
  assert.throws(() => new definitionModule.SetStepStatus({ step: "self", status: "invalid" }));
  assert.throws(() => new definitionModule.KeepInProgress({ step: "" }));
  assert.throws(() => new definitionModule.IncrementMetric({ phase: "", counter: "reviewRetry" }));
  assert.throws(() => new definitionModule.IncrementMetric({ phase: "test", counter: "" }));
  assert.throws(() => new definitionModule.AppendIssueLog({ source: "" }));
  assert.throws(() => new definitionModule.SkipSteps({ steps: [] }));
  assert.throws(() => new definitionModule.ResetSteps({ steps: [] }));
  assert.throws(() => new definitionModule.RunLifecycleHook({ module: "", handler: "recordMergeOutcome" }));

  const lifecycleInput = {
    event: "review:post",
    command: "run-review",
    phase: "draft",
    currentStepId: "draft-questions-review",
    result: {
      artifacts: {
        verdict: "PASS",
        retryPhase: "draft-questions",
      },
    },
  };
  const node = definitionModule.getFlowNode("draft-questions-review");
  assert.equal(typeof node.resolveLifecycle, "function");
  assert.deepEqual(
    snapshotActions(node.resolveLifecycle(lifecycleInput)),
    snapshotActions(definitionModule.resolveLifecycle(lifecycleInput)),
  );

  assert.match(source, /class\s+\w*StepStatus\w*\s*\{/);
  assert.match(source, /class\s+\w*KeepInProgress\w*\s*\{|class\s+\w*InProgress\w*\s*\{/);
  assert.match(source, /class\s+\w*Metric\w*\s*\{/);
  assert.match(source, /class\s+\w*IssueLog\w*\s*\{/);
  assert.match(source, /class\s+\w*SideEffects\w*\s*\{|class\s+\w*ExecuteSideEffects\w*\s*\{/);
  assert.match(source, /class\s+\w*Skip\w*Steps\w*\s*\{|class\s+\w*Skip\w*\s*\{/);
  assert.match(source, /class\s+\w*Reset\w*Steps\w*\s*\{|class\s+\w*Reset\w*\s*\{/);
  assert.match(source, /class\s+\w*LifecycleHook\w*\s*\{/);
  assert.match(source, /constructor\s*\([^)]*\)\s*\{[^}]*throw\s+new\s+Error/s);
});

test("R6: production, helper, and shared tests do not import raw definition data", () => {
  const files = [
    ...walkFiles(path.join(root, "src"), (file) => file.endsWith(".js")),
    ...walkFiles(path.join(root, "tests"), (file) => file.endsWith(".js")),
  ];
  const rawImportPattern = /import\s+\{[^}]*\b(FLOW_DEFINITION|TASK_DEFINITION)\b[^}]*\}\s+from\s+["'][^"']*flow\/definition\.js["']/;

  const offenders = files
    .filter((file) => file !== definitionPath)
    .filter((file) => {
      const source = read(file);
      if (rawImportPattern.test(source)) return true;
      const namespaceImports = source.matchAll(/import\s+\*\s+as\s+(\w+)\s+from\s+["']([^"']*flow\/definition\.js|[^"']*\.\.\/definition\.js)["']/g);
      for (const match of namespaceImports) {
        const namespaceName = match[1];
        if (new RegExp(`\\b${namespaceName}\\.(FLOW_DEFINITION|TASK_DEFINITION)\\b`).test(source)) {
          return true;
        }
      }
      return false;
    })
    .map((file) => path.relative(root, file));

  assert.deepEqual(offenders, []);
});

test("R8: spec-local coverage observes the definition boundary requirements", () => {
  const testsDir = path.join(root, "specs/283-flow-definition-lifecycle/tests");
  const files = walkFiles(testsDir, (file) => file.endsWith(".js"));
  const combined = files.map(read).join("\n");

  for (const requirement of ["R1:", "R2:", "R3:", "R6:"]) {
    assert.match(combined, new RegExp(requirement.replace(":", "\\:")));
  }
  assert.equal(fs.existsSync(stepTreePath), true);
  assert.doesNotMatch(read(definitionPath), /export\s+const\s+FLOW_DEFINITION\b/);
});
