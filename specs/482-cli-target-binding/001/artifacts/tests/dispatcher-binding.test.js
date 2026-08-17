// spec: R3 R6 R7 R11
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { afterEach, test } from "node:test";

import { FlowTargetBinding } from "../../../src/lib/flow-target-guard.js";
import {
  ExecuteCommandDirective,
  ExecuteStepDirective,
} from "../../../src/flow/lib/next-action-directive.js";
import {
  FlowDispatchAction,
  FlowDispatchWork,
} from "../../../src/flow/lib/run-dispatch.js";
import {
  createTmpDir,
  removeTmpDir,
} from "../../../tests/helpers/tmp-dir.js";
import { stripDataMarkers } from "../../../src/docs/lib/directive-parser.js";
import { resolveIncludes } from "../../../src/lib/include.js";
import { expandSkillRulesDirectives, loadRules } from "../../../src/lib/skill-rules.js";

const roots = [];

afterEach(() => {
  for (const root of roots.splice(0)) removeTmpDir(root);
});

function fixture() {
  const root = createTmpDir("spec-482-dispatch-binding-");
  roots.push(root);
  const flowState = {
    runId: "dispatch-binding-run",
    issue: 483,
    spec: "specs/482-cli-target-binding/spec.json",
    featureBranch: "feature/482-cli-target-binding",
    baseBranch: "main",
    worktree: false,
  };
  const target = {
    flowState,
    mode: "branch",
    mainRoot: root,
    authorityRoot: root,
    invocationRoot: root,
  };
  return { root, flowState, target, binding: FlowTargetBinding.capture(target) };
}

function actionFor(directive) {
  return new FlowDispatchAction({
    taskId: null,
    step: "spec-review",
    action: "run-review",
    requires_approval: false,
    directive: directive.toJSON(),
  });
}

test("R3: CLI-generated command directives carry the complete opaque binding", () => {
  const { binding } = fixture();
  const directive = new ExecuteCommandDirective({
    actionId: "RETRY_REVIEW",
    nextAction: binding.guardCommand("senti flow run review --phase spec"),
    instruction: "Execute the command as returned.",
    reason: "Fresh provider retry.",
  });

  assert.match(directive.toJSON().nextAction, /--expect-binding '[A-Za-z0-9_-]+'/);
  assert.doesNotMatch(directive.toJSON().nextAction, /--expect-run-id|--expect-issue|--expect-spec/);
});

test("R6: a resumed dispatcher reacquires authority instead of reusing stale binding text", () => {
  const { target, binding } = fixture();
  const resumed = FlowTargetBinding.capture({
    ...target,
    flowState: {
      ...target.flowState,
      featureBranch: "feature/rebound",
    },
  });

  assert.notEqual(resumed.digest, binding.digest);
  assert.throws(
    () => binding.assertCurrent({
      ...target,
      flowState: {
        ...target.flowState,
        featureBranch: "feature/rebound",
      },
    }),
    (error) => error.code === "ACTIVE_FLOW_MISMATCH",
  );
});

test("R7: worker prompt receives an opaque binding environment without guard transcription", () => {
  const { binding } = fixture();
  const action = actionFor(new ExecuteStepDirective({ action: "write-tests" }));
  const dispatchInvocationId = "dispatch-invocation-r7";
  const work = new FlowDispatchWork({ action, binding, dispatchInvocationId });
  const prompt = work.prompt();

  assert.doesNotMatch(prompt, /targetGuardArgs|Use these exact target guards|--expect-run-id|dispatch-binding-run/);
  assert.deepEqual(work.executionEnvironment(), {
    SENTI_FLOW_TARGET_BINDING: binding.serialize(),
    SENTI_FLOW_DISPATCH_INVOCATION_ID: dispatchInvocationId,
  });
});

test("R11: worker prompt preserves the CLI-returned executable command as-is", () => {
  const { binding } = fixture();
  const command = binding.guardCommand("senti flow run test-execute");
  const directive = new ExecuteStepDirective({
    action: "run-test-execute",
    nextAction: command,
  });
  const work = new FlowDispatchWork({
    action: actionFor(directive),
    binding,
    dispatchInvocationId: "dispatch-invocation-r11",
  });

  assert.match(work.prompt(), /execute that exact CLI-generated/);
  assert.match(work.prompt(), /Do not construct or append target identity arguments/);
  assert.match(work.prompt(), new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

function expectedDeployedFlowSkill(root) {
  const sourcePath = path.join(root, "src/skills/senti.flow/SKILL.md");
  const source = fs.readFileSync(sourcePath, "utf8");
  const included = resolveIncludes(source, {
    baseDir: path.dirname(sourcePath),
    pkgDir: path.join(root, "src"),
    skillsDir: path.join(root, "src/skills"),
    presetsDir: path.join(root, "src/presets"),
    sourceFile: sourcePath,
  });
  return stripDataMarkers(expandSkillRulesDirectives(included, loadRules()));
}

test("R11: deployed senti.flow skill matches source and omits the retired transcription contract", () => {
  const root = path.resolve(import.meta.dirname, "../../..");
  const expected = expectedDeployedFlowSkill(root);
  const agents = fs.readFileSync(path.join(root, ".agents/skills/senti.flow/SKILL.md"), "utf8");
  const claude = fs.readFileSync(path.join(root, ".claude/skills/senti.flow/SKILL.md"), "utf8");

  assert.equal(agents, expected);
  assert.equal(claude, expected);
  assert.doesNotMatch(expected, /targetGuardArgs|retype|transcri(?:be|ption)/i);
  assert.match(expected, /senti flow run dispatch --expect-binding <token>/);
});
