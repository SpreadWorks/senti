import {
  FlowOutbox,
  finalizationOutboxIdentity,
} from "./flow-outbox.js";
import {
  DirectGitEvidence,
  DirectIntegrationReceipt,
} from "./direct-completion.js";
import { runGit } from "../../lib/git-helpers.js";

function gitValue(args, label) {
  const result = runGit(args);
  if (!result.ok) {
    throw Object.assign(new Error(
      `${label}: ${result.stderr || result.stdout || "git command failed"}`,
    ), { code: "DIRECT_GIT_PROBE_FAILED" });
  }
  return result.stdout.trim();
}

function isAncestor(mainRoot, ancestor, descendant) {
  return runGit([
    "-C",
    mainRoot,
    "merge-base",
    "--is-ancestor",
    ancestor,
    descendant,
  ]).ok;
}

function findOutboxReceiptCommit(mainRoot, baseBranch, idempotencyKey) {
  const result = runGit([
    "-C",
    mainRoot,
    "log",
    baseBranch,
    "--fixed-strings",
    `--grep=senti-outbox: ${idempotencyKey}`,
    "--format=%H",
    "--max-count=1",
  ]);
  if (!result.ok) {
    throw Object.assign(new Error(
      `integration receipt commit lookup failed: ${result.stderr || result.stdout}`,
    ), { code: "DIRECT_INTEGRATION_RECEIPT_PROBE_FAILED" });
  }
  return result.stdout.trim() || null;
}

function directReceiptEvidence(mainRoot, state, currentFeatureHead, currentMainHead) {
  if (!state.directIntegrationReceipt) return null;
  const receipt = DirectIntegrationReceipt.fromStored(state.directIntegrationReceipt);
  const identityMatches = receipt.status === "merged"
    && receipt.runId === state.runId
    && receipt.spec === state.spec
    && (receipt.issue ?? null) === (state.issue ?? null)
    && receipt.featureHead === currentFeatureHead
    && isAncestor(mainRoot, receipt.mainHead, currentMainHead);
  if (!identityMatches) {
    throw Object.assign(new Error(
      "persisted direct integration receipt no longer matches the Flow or Git target",
    ), { code: "DIRECT_INTEGRATION_RECEIPT_INVALID" });
  }
  return new DirectGitEvidence({
    kind: "integration-receipt",
    featureHead: currentFeatureHead,
    mainHead: currentMainHead,
    receiptKey: receipt.receiptId,
    receiptCommit: receipt.mainHead,
  });
}

function normalFinalizeReceiptEvidence(mainRoot, state, currentFeatureHead, currentMainHead) {
  const identity = finalizationOutboxIdentity(state, "finalize-merge");
  const entry = new FlowOutbox(state.outbox || []).find(identity);
  if (!entry) return null;
  const result = entry.result;
  if (entry.status !== "done" || result?.status !== "done") return null;
  if (result.strategy !== "squash") return null;
  const receiptCommit = findOutboxReceiptCommit(
    mainRoot,
    state.baseBranch,
    identity.idempotencyKey,
  );
  const valid = result.mergedFromSha === currentFeatureHead
    && receiptCommit != null
    && isAncestor(mainRoot, receiptCommit, currentMainHead);
  if (!valid) {
    throw Object.assign(new Error(
      "finalize-merge outbox does not provide a complete matching integration receipt",
    ), { code: "DIRECT_INTEGRATION_RECEIPT_INVALID" });
  }
  return new DirectGitEvidence({
    kind: "integration-receipt",
    featureHead: currentFeatureHead,
    mainHead: currentMainHead,
    receiptKey: identity.idempotencyKey,
    receiptCommit,
  });
}

export function inspectPersistedIntegrationReceipt(mainRoot, state) {
  const currentFeatureHead = gitValue(
    ["-C", mainRoot, "rev-parse", `refs/heads/${state.featureBranch}`],
    "integration receipt feature HEAD could not be resolved",
  );
  const currentMainHead = gitValue(
    ["-C", mainRoot, "rev-parse", `refs/heads/${state.baseBranch}`],
    "integration receipt main HEAD could not be resolved",
  );
  return directReceiptEvidence(mainRoot, state, currentFeatureHead, currentMainHead)
    || normalFinalizeReceiptEvidence(mainRoot, state, currentFeatureHead, currentMainHead);
}

export function revalidatePersistedIntegrationReceipt(mainRoot, state, expected) {
  const persisted = DirectGitEvidence.fromStored(expected);
  if (persisted.kind !== "integration-receipt") return null;
  const current = inspectPersistedIntegrationReceipt(mainRoot, state);
  if (
    current == null
    || current.featureHead !== persisted.featureHead
    || current.mainHead !== persisted.mainHead
    || current.receiptKey !== persisted.receiptKey
    || current.receiptCommit !== persisted.receiptCommit
  ) {
    return null;
  }
  return current;
}
