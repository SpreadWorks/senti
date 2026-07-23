/**
 * src/flow/lib/run-resume.js
 *
 * Resume command — recovery discovery and explicit target handoff.
 * Normal flow continuation stays owned by resolveActiveFlow(); this command
 * only inventories recovery candidates and returns guarded continuation data.
 */

import { FlowCommand } from "./base-command.js";
import { buildResolvedFlowContext } from "./resolve-context-envelope.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { specIdFromPath } from "../../lib/flow-helpers.js";
import { ParkedFlowIdentity } from "../../lib/flow-manager.js";

function tryBuildActiveContext(ctx) {
  try {
    return buildResolvedFlowContext(ctx);
  } catch {
    return {};
  }
}

function buildContinuationGuidance(candidate) {
  if (!candidate.continuable) {
    return {
      safeStop: true,
      reason: candidate.blockReason,
      message: `safe-stop: ${candidate.specId} is ${candidate.blockReason || "blocked"} and cannot be continued by resume.`,
    };
  }
  return {
    safeStop: false,
    executionRoot: candidate.executionRoot,
    continueFrom: [
      `cd ${candidate.executionRoot}`,
      `senti flow get status --expect-run-id ${candidate.runId}`,
      `senti flow get next-action --expect-run-id ${candidate.runId}`,
    ].join("\n"),
  };
}

function selectedPayload(candidate) {
  return {
    specId: candidate.specId,
    spec: candidate.flowState?.spec || `specs/${candidate.specId}/spec.json`,
    runId: candidate.runId,
    executionRoot: candidate.executionRoot,
    worktreePath: candidate.state === "orphan-worktree" || candidate.mode === "worktree"
      ? candidate.executionRoot
      : null,
    state: candidate.state,
  };
}

export default class RunResumeCommand extends FlowCommand {
  constructor() {
    super({ requiresFlow: false });
  }

  async run(container, input = {}) {
    if (input.parked === true) {
      // Parked recovery must not run ambient flow discovery or reconcile a
      // pending worktree identity transition before the owned validation.
      this.container = container;
      return this.execute({ ...input, flowManager: container.get("flowManager") });
    }
    return super.run(container, input);
  }

  execute(ctx) {
    if (ctx.parked === true) {
      const identity = new ParkedFlowIdentity(ctx);
      return ctx.flowManager.resumeParkedFlow(identity).toJSON();
    }

    const base = tryBuildActiveContext(ctx);
    const { discovery, candidates } = ctx.flowManager.discoverRecoveryFlows();
    const recoveryCandidates = candidates.map((candidate) => candidate.toJSON());
    const activeRunId = candidates.find((candidate) => candidate.state === "active")?.runId || ctx.flowState?.runId || null;

    if (ctx.spec) {
      const selectedSpecId = specIdFromPath(ctx.spec);
      const candidate = candidates.find((item) => item.specId === selectedSpecId);
      const data = { ...base, discovery, recoveryCandidates };
      if (!candidate) {
        return Envelope.fail(
          "run",
          "resume",
          "RESUME_TARGET_NOT_FOUND",
          `safe-stop: no recovery candidate found for ${selectedSpecId}.`,
          data,
        );
      }
      if (!candidate.continuable) {
        return Envelope.fail(
          "run",
          "resume",
          "RESUME_TARGET_NOT_CONTINUABLE",
          [
            `safe-stop: ${selectedSpecId} is ${candidate.blockReason || "blocked"} and cannot be continued by resume.`,
            "A resume target must have both runId and execution root, and it must not be finalized or display-only.",
          ],
          {
            ...data,
            selected: selectedPayload(candidate),
            guidance: buildContinuationGuidance(candidate),
          },
        );
      }
      return {
        ...data,
        selected: selectedPayload(candidate),
        guidance: buildContinuationGuidance(candidate),
      };
    }

    return {
      ...base,
      runId: activeRunId,
      discovery,
      recoveryCandidates,
    };
  }
}
