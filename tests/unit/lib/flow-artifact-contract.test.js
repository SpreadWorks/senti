import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import {
  FLOW_ARTIFACT_CONTRACTS,
  FLOW_ARTIFACT_LEGACY_SWITCH_TARGETS,
  FLOW_ARTIFACT_NORMAL_FLOW_FILES,
  FLOW_ARTIFACT_SWITCH_TARGETS,
  FlowArtifactAuthoritySlot,
  FlowArtifactAttempt,
  FlowArtifactAttemptSequence,
  FlowArtifactAttemptHistory,
  FlowArtifactAttemptRecord,
  FLOW_ARTIFACT_NO_ARTIFACT_STEPS,
  FlowArtifactCanonicalPath,
  FlowArtifactContract,
  FlowArtifactOwnership,
  FlowArtifactPlacement,
  FlowArtifactLegacyPattern,
  FlowArtifactKnownFile,
  FlowArtifactRegistry,
  FlowArtifactSwitchTarget,
} from "../../../src/lib/flow-artifact-contract.js";
import { FLOW_ARTIFACT_AUTHORITY_MATRIX } from "../../../src/flow/lib/flow-artifact-authority.js";

function contract(key, artifactPath, kind) {
  return new FlowArtifactContract({
    logicalKey: key,
    canonicalPath: artifactPath,
    placement: ["flow.state", "flow.activities", "spec.record", "issue.log", "artifact.catalog", "issue.snapshot"].includes(key) ? "root-authority" : "step-owner",
    retention: "permanent",
    cataloged: key !== "artifact.catalog",
    ownership: new FlowArtifactOwnership({ producers: ["system"], updaters: ["system"], consumers: ["system"] }),
    authoritySlot: new FlowArtifactAuthoritySlot({ kind, authority: "repository-metadata" }),
  });
}

describe("Flow artifact contract registry", () => {
  it("declares the complete root, task, shared, evidence, recovery, and runtime inventory", () => {
    const paths = new Map(FLOW_ARTIFACT_CONTRACTS.inventory().map((entry) => [entry.logicalKey.toString(), entry.canonicalPath.toString()]));
    assert.deepEqual([...paths.entries()].filter(([, value]) => !value.includes("/")), [
      ["flow.state", "flow.json"], ["flow.activities", "activities.jsonl"], ["spec.record", "spec.json"],
      ["issue.log", "issue-log.json"], ["artifact.catalog", "artifact-catalog.json"], ["issue.snapshot", "issue.md"],
    ]);
    assert.equal(paths.get("draft"), "steps/draft/result.json");
    assert.equal(paths.get("retro"), "steps/impl/retro/result.json");
    assert.equal(paths.get("report"), "artifacts/report.json");
    assert.equal(paths.get("ideas"), "artifacts/ideas.json");
    assert.equal(paths.get("plugin.lifecycle.artifact"), "artifacts/plugin-artifacts/:{pluginArtifactPath}");
    assert.equal(paths.get("task.gate"), "steps/impl/:{taskId}/gate/result.json");
    assert.equal(paths.get("task.gate.source"), "steps/impl/:{taskId}/gate/source.json");
    assert.equal(paths.has("task.impl"), false);
    assert.equal(paths.get("task.review"), "steps/impl/:{taskId}/review/result.json");
    assert.deepEqual(
      FLOW_ARTIFACT_SWITCH_TARGETS.filter((entry) => entry.action === "new").map((entry) => entry.logicalKey),
      ["flow.activities", "artifact.catalog", "task.review"],
    );
    assert.equal(paths.get("draft.gate.source"), "steps/draft-gate/source.json");
    assert.equal(paths.get("spec.gate.source"), "steps/spec-gate/source.json");
    assert.equal(paths.has("test.coverage"), false);
    assert.equal(paths.get("test.review"), "steps/test-review/result.json");
    assert.equal(paths.get("acceptance.review.evidence"), "steps/acceptance-review/dispositions.json");
    assert.equal(paths.get("repair.fingerprint"), "steps/impl/repair/fingerprint.json");
    assert.equal(paths.get("repair.delta"), "steps/impl/repair/deltas/:{deltaId}.json");
    assert.equal(paths.get("retry.recovery.transaction"), ".runtime/retry-recovery/transaction.json");
    assert.equal(paths.get("worker.handoff"), ".runtime/worker-handoffs/:{handoffPath}");
    assert.equal(paths.get("flow.findings"), "steps/flow-findings.json");
    assert.equal(paths.get("nonblocking.handoffs"), "steps/nonblocking-handoffs.json");
    assert.equal(paths.get("scenario.validity.raw-log"), "steps/scenario-validity/output.log");
    assert.equal(paths.get("test.execute.raw-log"), "steps/test-execute/output.log");
    assert.equal(paths.get("final.regression.raw-log"), "steps/final-regression/attempt-:{attempt}.log");
    assert.equal(paths.get("finalize.cleanup.agent-metrics"), "steps/finalize-cleanup/agent-metrics.json");
    assert.equal(paths.get("finalize.cleanup.runtime-log"), ".runtime/finalize-cleanup/runtime-log.json");
    assert.equal(paths.get("runtime.lock.artifact-catalog"), ".runtime/locks/artifact-catalog.lock");
    assert.deepEqual(FLOW_ARTIFACT_LEGACY_SWITCH_TARGETS.map(String), ["flow-version.json", "artifacts", "review-evidence"]);
  });

  it("keeps transient step raw logs out of the repository index", () => {
    const gitignore = fs.readFileSync(new URL("../../../.gitignore", import.meta.url), "utf8");
    const patterns = new Set(gitignore.split("\n"));
    for (const pattern of [
      "**/steps/scenario-validity/output.log",
      "**/steps/test-execute/output.log",
      "**/steps/final-regression/attempt-*.log",
    ]) assert.equal(patterns.has(pattern), true, pattern);
  });

  it("keeps raw logs diagnostic-only while test source serves every dependent step", () => {
    assert.deepEqual(FLOW_ARTIFACT_CONTRACTS.require("scenario.validity.raw-log").ownership.consumers, ["scenario-validity"]);
    assert.deepEqual(FLOW_ARTIFACT_CONTRACTS.require("test.execute.raw-log").ownership.consumers, ["test-execute"]);
    assert.deepEqual(FLOW_ARTIFACT_CONTRACTS.require("final.regression.raw-log").ownership.consumers, ["final-regression"]);
    const testsSource = FLOW_ARTIFACT_CONTRACTS.require("tests.source");
    assert.deepEqual(testsSource.ownership.consumers, ["scenario-validity", "test-review", "implement", "test-execute"]);
    assert.deepEqual(testsSource.ownership.updaters, ["system", "test"]);
  });

  it("maps real source-era paths explicitly and never invents logical-key filenames", () => {
    const targets = new Map(FLOW_ARTIFACT_SWITCH_TARGETS.map((entry) => [entry.logicalKey, entry]));
    assert.deepEqual(targets.get("draft").legacyPaths.map(String), ["draft.json"]);
    assert.deepEqual(targets.get("draft.gate.source").legacyPaths.map(String), ["draft-gate-source.json"]);
    assert.deepEqual(targets.get("task.gate").legacyPaths.map(String), ["task-impl-gate-result.json"]);
    assert.deepEqual(targets.get("acceptance.review.evidence").legacyPaths.map(String), ["acceptance-review-evidence.json"]);
    assert.deepEqual(targets.get("test.review").legacyPaths.map(String), ["test-review.json", "test-coverage.json"]);
    assert.deepEqual(targets.get("ideas").legacyPaths.map(String), ["ideas.json", "plugin-artifacts/workflow/ideas.json"]);
    assert.deepEqual(targets.get("plugin.lifecycle.artifact").legacyPatterns.map(String), ["plugin-artifacts/:{pluginArtifactPath}"]);
    assert.deepEqual(targets.get("review.evidence").legacyPatterns.map(String), ["review-evidence/:{digest}.json"]);
    assert.deepEqual(targets.get("legacy.upgrade.log").legacyPaths.map(String), ["tests/.raw/upgrade.log"]);
    assert.equal(targets.get("legacy.upgrade.log").action, "remove");
    assert.equal(targets.get("flow.state").action, "switch");
    assert.equal(targets.get("draft").legacyPaths.some((entry) => entry.toString() === "draft.json"), true);
    for (const fabricated of ["draft-questions-review.json", "draft-coverage-review.json", "spec-gate.json", "impl-gate.json"]) {
      assert.equal(FLOW_ARTIFACT_SWITCH_TARGETS.some((entry) => entry.legacyPaths.some((path) => path.toString() === fabricated)), false, fabricated);
    }
  });

  it("classifies every normal Flow source filename or typed pattern exactly once", () => {
    const samples = new Map([
      ["draft.json", "draft"],
      ["draft-gate-source.json", "draft.gate.source"],
      ["spec-gate-result.json", "spec.gate"],
      ["task-impl-gate-source.json", "task.gate.source"],
      ["steps/impl/T-1/review/result.json", "task.review"],
      ["acceptance-review-evidence.json", "acceptance.review.evidence"],
      ["repair-deltas/repair-001.json", "repair.delta"],
      ["review-evidence/evidence.json", "review.evidence"],
      ["tests/scenarios/flow.test.js", "tests.source"],
      ["tests/.raw/test-execution.log", "test.execute.raw-log"],
      ["tests/.raw/final-regression-attempt-001.log", "final.regression.raw-log"],
      [".sennel/handoffs/run/invocation/request.json", "worker.handoff"],
      ["review-history/work-units/impl-review/unit.json", "review.work.unit"],
      ["review-history/impl-review-attempt-001.json", "legacy.review.history"],
      ["plugin-artifacts/example-plugin/output.json", "plugin.lifecycle.artifact"],
      ["plugin-artifacts/workflow/ideas.json", "ideas"],
      ["agent-metrics.json", "finalize.cleanup.agent-metrics"],
      ["finalize-cleanup.json", "finalize.cleanup.journal"],
      [".current-flow-state.lock", "runtime.lock.current-flow-state"],
      [".flow.json.writer.owner-1.owner.tmp", "runtime.lock.flow-state-writer-owner"],
      [".impl-repair.lock/owner.json", "runtime.lock.impl-repair"],
      ["..issue-log.lock.owner-1.owner.tmp", "runtime.lock.issue-log-owner"],
      ["..current-flow-state.lock.owner-1.owner.tmp", "runtime.lock.current-flow-state-owner"],
      ["..artifact-catalog.lock.owner-1.owner.tmp", "runtime.lock.artifact-catalog-owner"],
      ["..retry-recovery.lock.owner-1.owner.tmp", "runtime.lock.retry-recovery-owner"],
      ["report-envelope.json", "legacy.finalize.envelopes"],
      ["tests/.raw/upgrade.log", "legacy.upgrade.log"],
    ]);
    for (const [file, logicalKey] of samples) {
      assert.equal(FLOW_ARTIFACT_CONTRACTS.classifyKnownFile(file).logicalKey, logicalKey, file);
    }
    for (const entry of FLOW_ARTIFACT_NORMAL_FLOW_FILES) {
      const target = FLOW_ARTIFACT_CONTRACTS.target(entry.logicalKey);
      assert.equal(target.action, entry.action, entry.toString());
    }
  });

  it("resolves structured task and owner-hierarchy paths while rejecting unsafe input", () => {
    assert.equal(FLOW_ARTIFACT_CONTRACTS.taskDirectory("T-1", "impl"), "steps/impl/T-1/impl");
    assert.equal(FLOW_ARTIFACT_CONTRACTS.taskDirectory("T-1", "review"), "steps/impl/T-1/review");
    assert.equal(FLOW_ARTIFACT_CONTRACTS.taskDirectory("T-1", "gate"), "steps/impl/T-1/gate");
    assert.equal(FLOW_ARTIFACT_CONTRACTS.resolve("task.review", { taskId: "T-1" }).relativePath, "steps/impl/T-1/review/result.json");
    assert.equal(FLOW_ARTIFACT_CONTRACTS.resolve("task.gate", { taskId: "T-1" }).relativePath, "steps/impl/T-1/gate/result.json");
    assert.equal(FLOW_ARTIFACT_CONTRACTS.reviewEvidence({ taskId: "T-1", digest: "abc" }).relativePath, "steps/impl/T-1/review/evidence/abc.json");
    assert.throws(() => FLOW_ARTIFACT_CONTRACTS.resolve("review.evidence", { ownerPath: "impl/T-1/review", digest: "abc" }), /typed registry/);
    assert.throws(() => new FlowArtifactCanonicalPath("steps/../escape.json"), /normalized/);
  });

  it("authorizes each declared updater without copying a canonical contract", () => {
    const draft = FLOW_ARTIFACT_CONTRACTS.resolve("draft");
    assert.equal(draft.authoritySlotFor("draft-refine").publicationStep, "draft-refine");
    assert.equal(draft.authoritySlotFor("draft").claimKey(), draft.authoritySlotFor("draft-refine").claimKey());
    assert.throws(() => draft.authoritySlotFor("spec-review"), /not authorized/);
    assert.equal(FLOW_ARTIFACT_CONTRACTS.reviewEvidence({ reviewStep: "spec-review", digest: "evidence" }).relativePath, "steps/spec-review/evidence/evidence.json");
    assert.equal(FLOW_ARTIFACT_CONTRACTS.reviewEvidence({ reviewStep: "test-review", digest: "evidence" }).relativePath, "steps/test-review/evidence/evidence.json");
    const reviewEvidence = FLOW_ARTIFACT_CONTRACTS.require("review.evidence");
    for (const updater of ["draft-questions-review", "draft-coverage-review", "spec-review", "test-review", "impl-review", "task-review"]) {
      assert.doesNotThrow(() => reviewEvidence.authoritySlotFor(updater, "evidence"), updater);
    }
    assert.throws(() => FLOW_ARTIFACT_CONTRACTS.reviewEvidence({ reviewStep: "report", digest: "evidence" }), /invalid review artifact owner/);
  });

  it("binds placement, ownership, and authority to the canonical publication boundary", () => {
    const draft = FLOW_ARTIFACT_CONTRACTS.require("draft");
    const tests = FLOW_ARTIFACT_CONTRACTS.require("tests.source");
    const fileMap = FLOW_ARTIFACT_CONTRACTS.require("file.map");
    assert.equal(draft.placement.toString(), "step-owner");
    assert.equal(draft.authoritySlot.authority.toString(), "canonical-flow-artifacts");
    assert.equal(tests.authoritySlot.authority.toString(), "canonical-flow-artifacts");
    assert.equal(fileMap.authoritySlot.authority.toString(), "execution-checkout");
    assert.equal(FLOW_ARTIFACT_CONTRACTS.require("worker.handoff").authoritySlot.authority.toString(), "dispatcher-handoff");
    assert.throws(() => new FlowArtifactContract({
      logicalKey: "flow.state", canonicalPath: "flow.json", placement: "step-owner", retention: "permanent",
      ownership: new FlowArtifactOwnership({ producers: ["system"], updaters: ["system"], consumers: ["system"] }),
      authoritySlot: new FlowArtifactAuthoritySlot({ kind: "invalid-root", authority: "repository-metadata" }),
    }), /step-owner placement/);
    assert.throws(() => new FlowArtifactContract({
      logicalKey: "bad.transient", canonicalPath: "steps/bad/result.json", placement: "transient", retention: "permanent",
      ownership: new FlowArtifactOwnership({ producers: ["system"], updaters: ["system"], consumers: ["system"] }),
      authoritySlot: new FlowArtifactAuthoritySlot({ kind: "invalid-transient", authority: "canonical-flow-artifacts" }),
    }), /transient placement/);
    assert.throws(() => new FlowArtifactContract({
      logicalKey: "bad.deliverable", canonicalPath: "steps/bad/result.json", placement: "independent-deliverable", retention: "permanent",
      ownership: new FlowArtifactOwnership({ producers: ["system"], updaters: ["system"], consumers: ["system"] }),
      authoritySlot: new FlowArtifactAuthoritySlot({ kind: "invalid-deliverable", authority: "canonical-flow-artifacts" }),
    }), /independent deliverable placement/);
    assert.throws(() => new FlowArtifactContract({
      logicalKey: "bad.root", canonicalPath: "steps/root/result.json", placement: "root-authority", retention: "permanent",
      ownership: new FlowArtifactOwnership({ producers: ["system"], updaters: ["system"], consumers: ["system"] }),
      authoritySlot: new FlowArtifactAuthoritySlot({ kind: "invalid-root-path", authority: "repository-metadata" }),
    }), /root authority placement/);
    assert.throws(() => new FlowArtifactContract({
      logicalKey: "artifact.catalog", canonicalPath: "artifact-catalog.json", placement: "root-authority", retention: "permanent", cataloged: true,
      ownership: new FlowArtifactOwnership({ producers: ["system"], updaters: ["system"], consumers: ["system"] }),
      authoritySlot: new FlowArtifactAuthoritySlot({ kind: "invalid-catalog-self", authority: "repository-metadata" }),
    }), /catalog membership/);
    assert.throws(() => new FlowArtifactContract({
      logicalKey: "bad.owner", canonicalPath: "steps/a.json", placement: "step-owner", retention: "permanent",
      ownership: new FlowArtifactOwnership({ producers: ["system"], updaters: ["system"], consumers: ["system"] }),
      authoritySlot: new FlowArtifactAuthoritySlot({ kind: "invalid-shared-owner", authority: "canonical-flow-artifacts" }),
    }), /step owner placement/);
    assert.throws(() => new FlowArtifactContract({
      logicalKey: "bad.shared", canonicalPath: "steps/owner/shared.json", placement: "step-shared", retention: "permanent",
      ownership: new FlowArtifactOwnership({ producers: ["system"], updaters: ["system"], consumers: ["system"] }),
      authoritySlot: new FlowArtifactAuthoritySlot({ kind: "invalid-nested-shared", authority: "canonical-flow-artifacts" }),
    }), /step shared placement/);
  });

  it("rejects invalid switch target actors, actions, duplicate old paths, and contract disagreement", () => {
    assert.throws(() => new FlowArtifactSwitchTarget({
      logicalKey: "draft", legacyPaths: ["draft.json"], canonicalPath: "steps/draft/result.json", action: "move", producer: "draft", consumer: "draft",
    }), /action is invalid/);
    assert.throws(() => new FlowArtifactSwitchTarget({
      logicalKey: "draft", legacyPaths: ["draft.json"], canonicalPath: "steps/draft/result.json", action: "switch", producer: "unknown", consumer: "draft",
    }), /authority step/);
    const roots = [
      contract("flow.state", "flow.json", "flow-state"), contract("flow.activities", "activities.jsonl", "activity-ledger"),
      contract("spec.record", "spec.json", "spec-record"), contract("issue.log", "issue-log.json", "issue-log"),
      contract("artifact.catalog", "artifact-catalog.json", "artifact-catalog"), contract("issue.snapshot", "issue.md", "issue-snapshot"),
    ];
    const targets = roots.map((entry) => new FlowArtifactSwitchTarget({
      logicalKey: entry.logicalKey.toString(), canonicalPath: entry.canonicalPath.toString(), action: "new", producer: "system", consumer: "system",
    }));
    assert.throws(() => new FlowArtifactRegistry({
      contracts: roots,
      switchTargets: [...targets, new FlowArtifactSwitchTarget({
        logicalKey: "legacy.one", legacyPaths: ["same.json"], action: "remove", producer: "system", consumer: "system",
      }), new FlowArtifactSwitchTarget({
        logicalKey: "legacy.two", legacyPaths: ["same.json"], action: "remove", producer: "system", consumer: "system",
      })],
    }), /duplicate legacy artifact switch path/);
    const mismatched = [...targets];
    mismatched[0] = new FlowArtifactSwitchTarget({
      logicalKey: "flow.state", canonicalPath: "steps/flow/result.json", action: "new", producer: "system", consumer: "system",
    });
    assert.throws(() => new FlowArtifactRegistry({ contracts: roots, switchTargets: mismatched }), /canonical path does not match/);
    const unauthorizedProducer = [...targets];
    unauthorizedProducer[0] = new FlowArtifactSwitchTarget({
      logicalKey: "flow.state", canonicalPath: "flow.json", action: "new", producer: "draft", consumer: "system",
    });
    assert.throws(() => new FlowArtifactRegistry({ contracts: roots, switchTargets: unauthorizedProducer }), /producer is not declared/);

    assert.throws(() => new FlowArtifactRegistry({
      contracts: roots,
      switchTargets: [...targets, new FlowArtifactSwitchTarget({
        logicalKey: "legacy.pattern", legacyPatterns: [new FlowArtifactLegacyPattern("tests/:{path}")], action: "remove", producer: "system", consumer: "system",
      }), new FlowArtifactSwitchTarget({
        logicalKey: "legacy.exact", legacyPaths: ["tests/foo.json"], action: "remove", producer: "system", consumer: "system",
      })],
    }), /overlapping legacy artifact switch paths/);

    const knownRoots = roots.map((entry) => new FlowArtifactKnownFile({
      logicalKey: entry.logicalKey.toString(), action: "new", canonicalPath: entry.canonicalPath.toString(),
    }));
    assert.throws(() => new FlowArtifactRegistry({
      contracts: roots, switchTargets: targets, knownFiles: knownRoots.slice(1),
    }), /switch target inventory entry must be declared exactly once/);
    assert.throws(() => new FlowArtifactRegistry({
      contracts: roots,
      switchTargets: [...targets, new FlowArtifactSwitchTarget({
        logicalKey: "legacy.pattern-one", legacyPatterns: [new FlowArtifactLegacyPattern("tests/:{path}")], action: "remove", producer: "system", consumer: "system",
      }), new FlowArtifactSwitchTarget({
        logicalKey: "legacy.pattern-two", legacyPatterns: [new FlowArtifactLegacyPattern("tests/:{file}")], action: "remove", producer: "system", consumer: "system",
      })],
    }), /overlapping legacy artifact switch paths/);
  });

  it("rejects duplicate logical keys, canonical paths, authority slots, and ambiguous patterns", () => {
    const roots = [
      contract("flow.state", "flow.json", "flow-state"),
      contract("flow.activities", "activities.jsonl", "activity-ledger"),
      contract("spec.record", "spec.json", "spec-record"),
      contract("issue.log", "issue-log.json", "issue-log"),
      contract("artifact.catalog", "artifact-catalog.json", "artifact-catalog"),
      contract("issue.snapshot", "issue.md", "issue-snapshot"),
    ];
    assert.throws(() => new FlowArtifactRegistry({ contracts: [...roots, contract("result.one", "steps/a/result.json", "other"), contract("result.one", "steps/b/result.json", "other-two")] }), /duplicate artifact logical key/);
    assert.throws(() => new FlowArtifactRegistry({ contracts: [...roots, contract("result.one", "steps/a/result.json", "other"), contract("result.two", "steps/a/result.json", "other-two")] }), /duplicate artifact canonical path/);
    assert.throws(() => new FlowArtifactRegistry({ contracts: [...roots, contract("result.one", "steps/a/result.json", "same"), contract("result.two", "steps/b/result.json", "same")] }), /duplicate artifact authority slot/);
    assert.throws(() => new FlowArtifactRegistry({ contracts: [
      ...roots,
      contract("result.one", "steps/impl/:{stepId}/result.json", "result-one"),
      contract("result.two", "steps/impl/review/result.json", "result-two"),
    ] }), /overlapping artifact canonical paths/);
  });

  it("allocates raw-log attempts as an append-only sequence", () => {
    const sequence = new FlowArtifactAttemptSequence([new FlowArtifactAttempt(1), new FlowArtifactAttempt(2)]);
    assert.equal(sequence.next().toString(), "003");
    assert.equal(FLOW_ARTIFACT_CONTRACTS.resolve("final.regression.raw-log", {
      attempt: sequence.next().toString(),
    }).relativePath, "steps/final-regression/attempt-003.log");
    assert.throws(() => new FlowArtifactAttemptSequence([new FlowArtifactAttempt(2), new FlowArtifactAttempt(1)]), /append-only/);
    for (const attempt of ["abc", "000", "1", "../001", "1000"]) {
      assert.throws(() => FLOW_ARTIFACT_CONTRACTS.resolve("final.regression.raw-log", { attempt }), /three-digit positive attempt/, attempt);
    }
    assert.throws(() => new FlowArtifactAttemptRecord({ attempt: 1, payload: { attempt: 2 } }), /must not override/);
  });

  it("keeps review and execution attempts append-only without allowing a prior prefix rewrite", () => {
    const first = new FlowArtifactAttempt(1);
    const second = new FlowArtifactAttempt(2);
    const firstRecord = new FlowArtifactAttemptRecord({ attempt: first, payload: { result: "pass", evidence: { digest: "one" } } });
    const secondRecord = new FlowArtifactAttemptRecord({ attempt: second, payload: { result: "pass" } });
    const prefix = new FlowArtifactAttemptHistory([firstRecord]);
    const beforeAppend = prefix.toJSON();
    const history = prefix.append(secondRecord);
    assert.equal(history.current, secondRecord);
    assert.deepEqual(prefix.toJSON(), beforeAppend);
    assert.deepEqual(history.toJSON(), { attempts: [{ attempt: 1, result: "pass", evidence: { digest: "one" } }, { attempt: 2, result: "pass" }] });
    assert.throws(() => { history.attempts[0] = secondRecord; }, /read only|Cannot assign/);
    assert.throws(() => { history.attempts[0].payload.evidence.digest = "rewritten"; }, /read only|Cannot assign/);
    assert.deepEqual(history.toJSON().attempts[0], beforeAppend.attempts[0]);
    assert.throws(() => new FlowArtifactAttemptHistory([secondRecord, firstRecord]), /append-only/);
    assert.throws(() => new FlowArtifactAttemptHistory([firstRecord, firstRecord]), /append-only/);
  });

  it("scopes review evidence authority members by owner and digest", () => {
    const impl = FLOW_ARTIFACT_CONTRACTS.reviewEvidence({ reviewStep: "impl-review", digest: "same" });
    const spec = FLOW_ARTIFACT_CONTRACTS.reviewEvidence({ reviewStep: "spec-review", digest: "same" });
    const repeat = FLOW_ARTIFACT_CONTRACTS.reviewEvidence({ reviewStep: "impl-review", digest: "same" });
    assert.notEqual(impl.relativePath, spec.relativePath);
    assert.notEqual(impl.memberId, spec.memberId);
    assert.notEqual(impl.authoritySlotFor("impl-review").claimKey(), spec.authoritySlotFor("spec-review").claimKey());
    assert.equal(impl.memberId, repeat.memberId);
    assert.equal(impl.authoritySlotFor("impl-review").claimKey(), repeat.authoritySlotFor("impl-review").claimKey());
  });

  it("keeps finalize cleanup and runtime locks cataloged only through their declared classification", () => {
    for (const key of [
      "finalize.cleanup.agent-metrics", "finalize.cleanup.notes", "finalize.cleanup.plugin-artifacts",
      "finalize.cleanup.runtime-log", "finalize.cleanup.journal", "runtime.lock.issue-log",
      "runtime.lock.current-flow-state", "runtime.lock.artifact-catalog", "runtime.lock.retry-recovery",
      "runtime.lock.flow-state-writer", "runtime.lock.flow-state-writer-owner", "runtime.lock.impl-repair",
      "runtime.lock.issue-log-owner", "runtime.lock.current-flow-state-owner", "runtime.lock.artifact-catalog-owner", "runtime.lock.retry-recovery-owner",
    ]) {
      const entry = FLOW_ARTIFACT_CONTRACTS.require(key);
      const target = FLOW_ARTIFACT_CONTRACTS.target(key);
      assert.notEqual(FLOW_ARTIFACT_NORMAL_FLOW_FILES.filter((file) => file.logicalKey === key).length, 0, key);
      assert.equal(target.canonicalPath, entry.canonicalPath.toString(), key);
      if (key.includes("runtime") || key.includes("runtime.lock")) {
        assert.equal(entry.retention.toString(), "transient", key);
        assert.equal(entry.cataloged, false, key);
      }
    }
  });

  it("classifies every executable leaf as an artifact producer/updater or explicit no-artifact step", () => {
    const contracts = FLOW_ARTIFACT_CONTRACTS.inventory();
    const noArtifact = new Set(FLOW_ARTIFACT_NO_ARTIFACT_STEPS.map((entry) => entry.stepId));
    for (const entry of FLOW_ARTIFACT_AUTHORITY_MATRIX) {
      assert.equal(contracts.some((contract) => (
        contract.ownership.producers.includes(entry.stepId)
        || contract.ownership.updaters.includes(entry.stepId)
      )) || noArtifact.has(entry.stepId), true, `${entry.stepId} has no artifact classification`);
    }
  });

  it("does not retain ownership or switch actors outside the authority matrix", () => {
    const allowed = new Set(["system", ...FLOW_ARTIFACT_AUTHORITY_MATRIX.map((entry) => entry.stepId)]);
    for (const contract of FLOW_ARTIFACT_CONTRACTS.inventory()) {
      for (const actor of [...contract.ownership.producers, ...contract.ownership.updaters, ...contract.ownership.consumers]) {
        assert.equal(allowed.has(actor), true, `${contract.logicalKey}/${actor}`);
      }
    }
    for (const target of FLOW_ARTIFACT_SWITCH_TARGETS) {
      assert.equal(allowed.has(target.producer), true, `${target.logicalKey}.producer/${target.producer}`);
      assert.equal(allowed.has(target.consumer), true, `${target.logicalKey}.consumer/${target.consumer}`);
    }
  });
});
