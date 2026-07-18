import fs from "node:fs";
import path from "node:path";
import { FlowCommand } from "./base-command.js";
import { resolveSpecDir } from "../../lib/spec-json.js";
import {
  applyAcceptanceReviewResult,
  buildAcceptanceReviewArtifactFromEvidence,
} from "./acceptance-review-artifacts.js";

function readFixtureArtifact() {
  const file = process.env.SENTI_ACCEPTANCE_REVIEW_ARTIFACT;
  if (!file) return null;
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export default class RunAcceptanceReviewCommand extends FlowCommand {
  execute(ctx) {
    const state = ctx.flowManager.load();
    const specDir = resolveSpecDir(path.resolve(ctx.root, state.spec));
    const artifact = readFixtureArtifact() || buildAcceptanceReviewArtifactFromEvidence({
      specDir,
      flowState: state,
    });
    const result = applyAcceptanceReviewResult({
      root: ctx.root,
      flowManager: ctx.flowManager,
      artifact,
    });
    return {
      verdict: result.verdict,
      artifact_path: result.artifactPath,
      findings: result.artifact.findings,
      deferredFindings: result.artifact.deferredFindings || [],
      requirementAmendmentProposals: result.artifact.requirementAmendmentProposals,
      mechanicalBlockers: result.artifact.mechanicalBlockers,
      hardBlockers: result.artifact.hardBlockers,
    };
  }
}
