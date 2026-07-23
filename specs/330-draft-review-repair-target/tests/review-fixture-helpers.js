import crypto from "node:crypto";
import { ReviewFinding } from "../../../src/flow/lib/review-convergence.js";

export function reviewFindingFromHistory(record, sourceArtifact) {
  return new ReviewFinding({
    findingId: record.findingId,
    summary: record.body,
    fingerprint: crypto.createHash("sha256").update(JSON.stringify(record)).digest("hex"),
    evidenceRefs: [`${sourceArtifact}#${record.findingId}`],
  });
}
