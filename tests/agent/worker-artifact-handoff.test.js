import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { createInitialDraftArtifactRevision } from "../../src/flow/lib/draft-artifact-promotion.js";
import GetNextActionCommand from "../../src/flow/lib/get-next-action.js";
import RunDispatchCommand from "../../src/flow/lib/run-dispatch.js";
import { findStepById } from "../../src/flow/lib/step-tree.js";
import { WorkerArtifactHandoffCoordinator } from "../../src/flow/lib/worker-artifact-handoff.js";
import { Agent } from "../../src/lib/agent.js";
import { FlowManager } from "../../src/lib/flow-manager.js";
import { Logger } from "../../src/lib/log.js";
import { ProviderRegistry } from "../../src/lib/provider.js";
import { makeFlowState, moveFlowToStep } from "../helpers/flow-setup.js";
import { commitAll, initGitRepo } from "../helpers/git-repo.js";
import { createTmpDir, removeTmpDir } from "../helpers/tmp-dir.js";

const SENTI = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../src/senti.js");

function action(stepId) {
  if (stepId == null) {
    return {
      taskId: null,
      step: null,
      action: "completed",
      instructions: null,
      context: null,
      output_schema: null,
      requires_approval: false,
      directive: { kind: "completed", terminal: true, requiresUserAction: false },
    };
  }
  const instruction = stepId === "draft-questions-triage"
    ? [
        "Use only the immutable handoff input snapshots.",
        "Write the declared draft-questions-triage.json payload with exactly this JSON shape:",
        '{"version":1,"phase":"draft-questions-triage","sourceReview":"draft-review-questions.json",',
        '"summary":"Apply the parent publication repair.","items":[{"title":"Publish through the parent",',
        '"target":"goal","decision":"apply","rationale":"The review target is valid.",',
        '"evidence":"The parent owns canonical publication."}]}',
        "Do not rename or omit items. Then seal the handoff exactly once.",
      ].join(" ")
    : [
        "Use only the immutable handoff input snapshots and write both declared payloads.",
        "Write the declared draft-questions-repair.json payload with exactly this JSON shape:",
        '{"version":1,"phase":"draft-questions-repair","sourceTriage":"draft-questions-triage.json",',
        '"summary":"Applied the parent publication repair.","items":[{"title":"Publish through the parent",',
        '"target":"goal","rationale":"The repair uses the guarded handoff.",',
        '"evidence":"The parent publishes the sealed bytes.","changedFieldPaths":["goal"]}]}',
        'Write the declared draft.json payload as {"goal":"Parent publication is canonical."}.',
        "Do not rename or omit items. Then seal the handoff exactly once.",
      ].join(" ");
  return {
    taskId: null,
    step: stepId,
    action: "write-draft",
    instructions: {
      key: `plan.${stepId}`,
      content: instruction,
    },
    context: { workerArtifactHandoff: { required: true } },
    output_schema: {},
    requires_approval: false,
    maxAttempts: 1,
    directive: { kind: "execute_step", terminal: false, requiresUserAction: false, action: "write-draft" },
  };
}

describe("real agent worker artifact handoff", { timeout: 480_000 }, () => {
  it("has a real Codex CLI worker hand off triage and repair to a downstream command", async () => {
    const mainRoot = createTmpDir("worker-handoff-agent-main-");
    const originalPath = process.env.PATH;
    try {
      const executionRoot = path.join(mainRoot, "execution");
      const binDir = path.join(executionRoot, ".test-bin");
      fs.mkdirSync(binDir, { recursive: true });
      initGitRepo(executionRoot);
      fs.writeFileSync(path.join(executionRoot, "README.md"), "worker handoff fixture\n");
      commitAll(executionRoot, "worker handoff fixture");
      const wrapper = path.join(binDir, "senti");
      fs.writeFileSync(wrapper, [
        "#!/bin/sh",
        `exec ${JSON.stringify(process.execPath)} ${JSON.stringify(SENTI)} \"$@\"`,
        "",
      ].join("\n"), { mode: 0o755 });
      process.env.PATH = `${binDir}${path.delimiter}${originalPath}`;

      const specId = "500-worker-handoff-agent";
      const canonicalSpecDir = path.join(mainRoot, "specs", specId);
      fs.mkdirSync(canonicalSpecDir, { recursive: true });
      const draftPath = path.join(canonicalSpecDir, "draft.json");
      fs.writeFileSync(draftPath, `${JSON.stringify({ goal: "Repair the worker handoff." }, null, 2)}\n`);
      const state = moveFlowToStep(makeFlowState({
        specId,
        runId: "run-worker-handoff-agent",
        worktree: true,
        request: "Exercise the real agent worker handoff.",
      }), "draft-questions-triage");
      state.draftArtifactRevision = createInitialDraftArtifactRevision({ state, draftPath }).toJSON();
      state.draftArtifactRevision.sourceStepId = "draft";
      fs.writeFileSync(path.join(canonicalSpecDir, "draft-review-questions.json"), `${JSON.stringify({
        version: 2,
        phase: "draft-questions",
        sourceDraft: "draft.json",
        sourceDraftRevision: state.draftArtifactRevision,
        generatedAt: "2026-08-04T00:00:00.000Z",
        verdict: "ADVISORY",
        summary: "One repair is required.",
        blockingFindings: [],
        advisoryFindings: [],
        repairTargets: [{
          title: "Publish through the parent",
          target: "goal",
          rationale: "The worker cannot write canonical artifacts.",
          evidence: "The handoff contract assigns publication to the parent.",
          classification: "repair_target",
        }],
      }, null, 2)}\n`);
      const flowManager = new FlowManager({ root: executionRoot, mainRoot, inWorktree: true, specId });
      flowManager.create(state);
      const config = {
        agent: {
          default: "codex/gpt-5.4",
          timeout: 240,
          retryCount: 0,
        },
      };
      const agent = new Agent({
        config,
        paths: { root: mainRoot, agentWorkDir: path.join(executionRoot, ".tmp") },
        registry: new ProviderRegistry(),
        logger: new Logger({ logDir: path.join(executionRoot, ".tmp", "logs"), enabled: false }),
        flowManager,
      });
      const dispatcher = new RunDispatchCommand({
        nextAction: {
          async run() {
            const current = flowManager.load();
            if (findStepById(current.steps, "draft-questions-triage").status !== "done") {
              return action("draft-questions-triage");
            }
            if (findStepById(current.steps, "draft-questions-repair").status !== "done") {
              return action("draft-questions-repair");
            }
            return action(null);
          },
        },
        agent,
        repositoryFingerprint: () => "real-agent-handoff",
        leaseFactory: () => ({ acquire() {}, release() {} }),
      });
      dispatcher.container = {};

      const result = await dispatcher.execute({
        root: executionRoot,
        executionRoot,
        mainRoot,
        specId,
        flowManager,
        flowState: flowManager.load(),
        expectRunId: state.runId,
        expectSpec: specId,
        _envelopeType: "run",
        _envelopeKey: "dispatch",
      });

      assert.equal(result.dispatch?.boundary, "completed", JSON.stringify(result, null, 2));
      assert.equal(result.dispatch.dispatchCount, 2);
      const completed = flowManager.load();
      assert.equal(findStepById(completed.steps, "draft-questions-triage").status, "done");
      assert.equal(findStepById(completed.steps, "draft-questions-repair").status, "done");
      assert.equal(completed.draftArtifactRevision.sourceStepId, "draft-questions-repair");
      assert.equal(completed.workerArtifactReceipts?.length, 2);
      assert.equal(
        JSON.parse(fs.readFileSync(path.join(canonicalSpecDir, "draft-questions-triage.json"), "utf8")).items[0].decision,
        "apply",
      );
      assert.equal(
        JSON.parse(fs.readFileSync(path.join(canonicalSpecDir, "draft-questions-repair.json"), "utf8")).items[0].target,
        "goal",
      );
      const downstream = await new GetNextActionCommand().execute({
        root: executionRoot,
        executionRoot,
        mainRoot,
        specId,
        flowManager,
        flowState: completed,
      });
      assert.equal(downstream.step, "draft-refine");
      assert.equal(downstream.context.workerArtifactHandoff.required, true);
      const downstreamRequest = new WorkerArtifactHandoffCoordinator().createRequest({
        ctx: { root: executionRoot, executionRoot, mainRoot, specId, flowManager },
        state: completed,
        invocation: {
          id: "downstream-draft-refine",
          target: { digest: "e".repeat(64) },
          action: { digest: "d".repeat(64), nextAction: { step: downstream.step } },
        },
      });
      assert.deepEqual(
        downstreamRequest.inputs[0].document,
        JSON.parse(fs.readFileSync(path.join(canonicalSpecDir, "draft.json"), "utf8")),
      );
    } finally {
      process.env.PATH = originalPath;
      removeTmpDir(mainRoot);
    }
  });
});
