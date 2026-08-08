import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  ArtifactAuthority,
  FlowArtifactCatalog,
  FlowArtifactCatalogStore,
  FlowArtifactDescriptor,
  FlowId,
  FlowRunId,
  FlowSpecIdentity,
  FlowVersion,
  FlowVersionId,
  FlowVersionIdentity,
  FlowVersionIdentityStore,
  FlowVersionLocation,
  FlowVersionMigrationClassification,
  FlowVersionMigrationClassifier,
  FlowVersionMigrationPlan,
  FlowVersionRecord,
} from "../../../src/lib/flow-version.js";
import { buildCurrentFlowDefinition } from "../../../src/flow/definition.js";
import { ActivityTransition, CurrentAttempt, CurrentFlowStateAdoptionBoundary, FlowActivity } from "../../../src/flow/lib/current-flow-state.js";
import { assertCatalogPublicationAuthority } from "../../../src/flow/lib/flow-artifact-authority.js";
import { IssueLogStore } from "../../../src/flow/lib/issue-log-store.js";
import { ReviewEvidenceStore } from "../../../src/flow/lib/review-evidence-store.js";
import { ReviewDisposition, ReviewEvidence, ReviewProvenance } from "../../../src/flow/lib/review-convergence.js";

const roots = [];
function temporaryRoot() {
  const result = fs.mkdtempSync(path.join(os.tmpdir(), "flow-version-"));
  roots.push(result);
  return result;
}
function hash(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function identity({ version = 1, specId = "508-flow-version" } = {}) {
  return new FlowVersionRecord({
    identity: new FlowVersionIdentity({
      flowId: "series-a", flowVersionId: `series-a-v${version}`, version, specId, runId: "run-123",
    }),
    schemaRevision: 2,
  });
}
function startActivity(state) {
  const target = state.nextAction();
  const node = state.findNode(target.nodeId);
  const contract = state.definition.contractFor(target.nodeId, state.root);
  const attempt = new CurrentAttempt({
    id: "attempt-1", sequence: 1, startedAt: "2026-08-08T00:00:00.000Z",
    consumption: { semantic: 0, tooling: 0 }, failure: null, blocker: null, incomplete: [],
    operationClaims: [{ operation: "execute", resources: [...contract.resourceContract.required] }],
  });
  return new FlowActivity({
    id: "activity-1", nodeId: node.id, nodeKey: node.key, attemptId: attempt.id, sequence: attempt.sequence,
    confirmationOrder: 1, type: "attempt_started",
    transition: new ActivityTransition({ operation: "start_attempt", path: target.path, task: null, attempt, status: null }),
    result: null, timing: { startedAt: "2026-08-08T00:00:00.000Z", finishedAt: "2026-08-08T00:00:01.000Z", durationMs: 1000 },
    failure: null, provider: "test", model: "test", effort: "test", usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cost: 0 },
    references: { evaluations: [], findings: [], repairs: [], artifacts: [] },
  });
}

afterEach(() => {
  while (roots.length > 0) fs.rmSync(roots.pop(), { recursive: true, force: true });
});

describe("Flow Version identity and resolver", () => {
  it("keeps persisted identity types independent and stores them separately from schema revision", () => {
    const value = new FlowVersionIdentity({
      flowId: new FlowId("series-a"), flowVersionId: new FlowVersionId("series-a-v1"), version: new FlowVersion(1),
      specId: new FlowSpecIdentity("508-flow-version"), runId: new FlowRunId("run-123"),
    });
    assert.deepEqual(value.toJSON(), { flowId: "series-a", flowVersionId: "series-a-v1", version: 1, specId: "508-flow-version", runId: "run-123" });
    assert.throws(() => new FlowId(value.specId));
    assert.throws(() => new FlowVersionId(value.runId));
    const location = new FlowVersionLocation({ repositoryRoot: temporaryRoot(), specId: "508-flow-version", version: 1 });
    const store = new FlowVersionIdentityStore({ location });
    store.create(new FlowVersionRecord({ identity: value, schemaRevision: 2 }));
    assert.equal(store.load().schemaRevision, 2);
  });

  it("keeps Version first and provides validator/review/gate/report/resume/finalize paths", () => {
    const location = new FlowVersionLocation({ repositoryRoot: temporaryRoot(), specId: "508-flow-version", version: 1004 });
    assert.equal(new FlowVersion(1).pathSegment, "001");
    assert.equal(location.relativeDirectory, "specs/508-flow-version/1004");
    assert.equal(location.flowStateFile.endsWith(path.join("specs", "508-flow-version", "1004", "flow.json")), true);
    assert.equal(location.validatorArtifactPath("result.json").endsWith(path.join("phases", "validation", "result.json")), true);
    assert.equal(location.gateArtifactPath("impl", "result.json").endsWith(path.join("phases", "gate-impl", "result.json")), true);
    assert.equal(location.reviewEvidencePath("evidence.json").endsWith(path.join("phases", "review", "evidence", "evidence.json")), true);
    assert.equal(location.reportFile.endsWith(path.join("artifacts", "report.json")), true);
    assert.equal(location.resumeRuntimeFile.endsWith(path.join(".runtime", "resume.json")), true);
    assert.equal(location.finalizeRuntimeFile.endsWith(path.join(".runtime", "finalize.json")), true);
    assert.throws(() => location.resolve("../flow.json"));
  });
});

describe("Flow artifact catalog", () => {
  it("rejects catalog-managed files outside the catalog while excluding runtime and itself", () => {
    const location = new FlowVersionLocation({ repositoryRoot: temporaryRoot(), specId: "508-flow-version", version: 1 });
    fs.mkdirSync(path.dirname(location.artifactPath("a.json")), { recursive: true });
    fs.writeFileSync(location.artifactPath("a.json"), "a");
    fs.writeFileSync(location.artifactPath("z.json"), "z");
    const a = FlowArtifactDescriptor.fromFile({ location, kind: "summary", relativePath: "artifacts/a.json", mediaType: "application/json", authority: "canonical-flow-artifacts", retention: "permanent", activityId: "activity-a" });
    const z = FlowArtifactDescriptor.fromFile({ location, kind: "report", relativePath: "artifacts/z.json", mediaType: "application/json", authority: "repository-metadata", retention: "permanent", activityId: "activity-z" });
    const catalog = FlowArtifactCatalog.regenerate([z, a]);
    const store = new FlowArtifactCatalogStore({ location });
    store.save(catalog);
    assert.deepEqual(store.load().toJSON(), catalog.toJSON());
    fs.writeFileSync(location.artifactPath("uncataloged.json"), "rogue");
    assert.throws(() => store.load(), /missing from the catalog/);
    fs.unlinkSync(location.artifactPath("uncataloged.json"));
    fs.mkdirSync(path.dirname(location.phasePath("impl", "result.json")), { recursive: true });
    fs.writeFileSync(location.phasePath("impl", "result.json"), "phase");
    assert.throws(() => store.load(), /missing from the catalog/);
    fs.unlinkSync(location.phasePath("impl", "result.json"));
    fs.mkdirSync(path.dirname(location.runtimePath("transient.json")), { recursive: true });
    fs.writeFileSync(location.runtimePath("transient.json"), "runtime");
    assert.deepEqual(store.load().toJSON(), catalog.toJSON());
    fs.writeFileSync(location.resolve("unknown.txt"), "unknown");
    assert.throws(() => store.load(), /unclassified artifact/);
  });

  it("uses code-unit ordering and rejects duplicate typed authority and symlink ancestors", () => {
    const location = new FlowVersionLocation({ repositoryRoot: temporaryRoot(), specId: "508-flow-version", version: 1 });
    fs.mkdirSync(path.dirname(location.artifactPath("B.json")), { recursive: true });
    fs.writeFileSync(location.artifactPath("B.json"), "B");
    fs.writeFileSync(location.artifactPath("a.json"), "a");
    const catalog = FlowArtifactCatalog.regenerate([
      FlowArtifactDescriptor.fromFile({ location, kind: "lower", relativePath: "artifacts/a.json", mediaType: "text/plain", authority: "canonical-flow-artifacts", retention: "permanent" }),
      FlowArtifactDescriptor.fromFile({ location, kind: "upper", relativePath: "artifacts/B.json", mediaType: "text/plain", authority: "repository-metadata", retention: "permanent" }),
    ]);
    assert.deepEqual(catalog.artifacts.map((artifact) => artifact.relativePath), ["artifacts/B.json", "artifacts/a.json"]);
    const descriptor = (file, authority) => new FlowArtifactDescriptor({ kind: "result", relativePath: file, hash: hash(file), size: file.length, mediaType: "application/json", authority, retention: "permanent" });
    assert.throws(() => new FlowArtifactCatalog({ artifacts: [descriptor("artifacts/a.json", "canonical-flow-artifacts"), descriptor("artifacts/b.json", "canonical-flow-artifacts")] }), /duplicate artifact authority/);
    assert.throws(() => new FlowArtifactDescriptor({ kind: "result", relativePath: "artifacts/a.json", hash: hash("x"), size: 1, mediaType: "text/plain", authority: "arbitrary", retention: "permanent" }), /invalid artifact authority/);
    const outside = path.join(temporaryRoot(), "outside");
    fs.mkdirSync(outside);
    fs.writeFileSync(path.join(outside, "escape.json"), "escape");
    fs.symlinkSync(outside, location.artifactPath("linked"));
    assert.throws(() => FlowArtifactDescriptor.fromFile({ location, kind: "escape", relativePath: "artifacts/linked/escape.json", mediaType: "application/json", authority: "execution-checkout", retention: "permanent" }), /symbolic-link ancestor/);
    assert.equal(assertCatalogPublicationAuthority("draft", new ArtifactAuthority("dispatcher-handoff")).stepId, "draft");
  });

  it("rolls back every declared artifact and catalog on publication failure", () => {
    const location = new FlowVersionLocation({ repositoryRoot: temporaryRoot(), specId: "508-flow-version", version: 1 });
    fs.mkdirSync(path.dirname(location.artifactPath("result.json")), { recursive: true });
    fs.writeFileSync(location.artifactPath("result.json"), "before");
    const store = new FlowArtifactCatalogStore({ location });
    store.save(FlowArtifactCatalog.regenerate([
      FlowArtifactDescriptor.fromFile({ location, kind: "result", relativePath: "artifacts/result.json", mediaType: "application/json", authority: "canonical-flow-artifacts", retention: "permanent" }),
    ]));
    const catalogBefore = fs.readFileSync(location.catalogFile);
    assert.throws(() => store.publishMany({
      artifacts: [
        { relativePath: "artifacts/result.json", kind: "result", mediaType: "application/json", authority: "canonical-flow-artifacts", retention: "permanent" },
        { relativePath: "artifacts/new.json", kind: "new-result", mediaType: "application/json", authority: "repository-metadata", retention: "permanent" },
      ],
      write: () => {
        fs.writeFileSync(location.artifactPath("result.json"), "after");
        fs.writeFileSync(location.artifactPath("new.json"), "new");
        throw new Error("injected publication failure");
      },
    }), /injected publication failure/);
    assert.equal(fs.readFileSync(location.artifactPath("result.json"), "utf8"), "before");
    assert.equal(fs.existsSync(location.artifactPath("new.json")), false);
    assert.deepEqual(fs.readFileSync(location.catalogFile), catalogBefore);
    assert.doesNotThrow(() => store.load());
  });

  it("rolls back publication and unpublication when catalog persistence fails", () => {
    const location = new FlowVersionLocation({ repositoryRoot: temporaryRoot(), specId: "508-flow-version", version: 1 });
    fs.mkdirSync(path.dirname(location.artifactPath("result.json")), { recursive: true });
    fs.writeFileSync(location.artifactPath("result.json"), "before");
    const baseline = new FlowArtifactCatalogStore({ location });
    baseline.save(FlowArtifactCatalog.regenerate([
      FlowArtifactDescriptor.fromFile({ location, kind: "result", relativePath: "artifacts/result.json", mediaType: "application/json", authority: "canonical-flow-artifacts", retention: "permanent" }),
    ]));
    const failing = new FlowArtifactCatalogStore({
      location,
      faultInjector: ({ phase }) => {
        if (phase === "before-json-rename") throw new Error("injected catalog persistence failure");
      },
    });
    assert.throws(() => failing.publish({
      relativePath: "artifacts/result.json", kind: "result", mediaType: "application/json", authority: "canonical-flow-artifacts", retention: "permanent",
      write: () => fs.writeFileSync(location.artifactPath("result.json"), "after"),
    }), /injected catalog persistence failure/);
    assert.equal(fs.readFileSync(location.artifactPath("result.json"), "utf8"), "before");
    assert.doesNotThrow(() => baseline.load());
    assert.throws(() => failing.unpublish({
      relativePath: "artifacts/result.json",
      write: () => fs.unlinkSync(location.artifactPath("result.json")),
    }), /injected catalog persistence failure/);
    assert.equal(fs.readFileSync(location.artifactPath("result.json"), "utf8"), "before");
    assert.doesNotThrow(() => baseline.load());
  });

  it("serializes nested Version-root publications and removes its transient lock", () => {
    const location = new FlowVersionLocation({ repositoryRoot: temporaryRoot(), specId: "508-flow-version", version: 1 });
    fs.mkdirSync(path.dirname(location.artifactPath("one.json")), { recursive: true });
    fs.writeFileSync(location.artifactPath("one.json"), "one");
    const first = new FlowArtifactCatalogStore({ location });
    const second = new FlowArtifactCatalogStore({ location });
    first.save(FlowArtifactCatalog.regenerate([
      FlowArtifactDescriptor.fromFile({ location, kind: "one", relativePath: "artifacts/one.json", mediaType: "application/json", authority: "canonical-flow-artifacts", retention: "permanent" }),
    ]));
    first.publish({
      relativePath: "artifacts/one.json", kind: "one", mediaType: "application/json", authority: "canonical-flow-artifacts", retention: "permanent",
      write: () => {
        assert.throws(() => second.publish({
          relativePath: "artifacts/two.json", kind: "two", mediaType: "application/json", authority: "repository-metadata", retention: "permanent",
          write: () => fs.writeFileSync(location.artifactPath("two.json"), "two"),
        }), /lock|live|process/i);
        fs.writeFileSync(location.artifactPath("one.json"), "one-updated");
      },
    });
    second.publish({
      relativePath: "artifacts/two.json", kind: "two", mediaType: "application/json", authority: "repository-metadata", retention: "permanent",
      write: () => fs.writeFileSync(location.artifactPath("two.json"), "two"),
    });
    assert.deepEqual(first.load().artifacts.map((artifact) => artifact.relativePath), ["artifacts/one.json", "artifacts/two.json"]);
    assert.equal(fs.existsSync(location.resolve(".artifact-catalog.lock")), false);
  });
});

describe("Flow Version migration classification", () => {
  it("classifies a real fixture into typed roles and emits only an in-memory V1 fixture", () => {
    const target = new FlowVersionLocation({ repositoryRoot: temporaryRoot(), specId: "508-flow-version", version: 1 });
    const source = path.join(temporaryRoot(), "legacy");
    fs.mkdirSync(path.join(source, "review-evidence"), { recursive: true });
    fs.mkdirSync(path.join(source, ".runtime"), { recursive: true });
    for (const [file, content] of [["flow.json", "{}"], ["activities.jsonl", ""], ["spec.json", "{}"], ["review-evidence/review.json", "{}"], [".runtime/resume.json", "{}"]]) fs.writeFileSync(path.join(source, file), content);
    const classification = FlowVersionMigrationClassification.inspect({ sourcePath: "specs/508-flow-version", legacyPresent: true, versionPresent: false, target });
    const plan = new FlowVersionMigrationPlan({ classification, artifacts: new FlowVersionMigrationClassifier({ target }).inspectDirectory(source) });
    assert.deepEqual(plan.toJSON().artifacts, [
      { role: "runtime", sourcePath: ".runtime/resume.json", targetPath: ".runtime/resume.json", cataloged: false },
      { role: "activity-ledger", sourcePath: "activities.jsonl", targetPath: "activities.jsonl", cataloged: true },
      { role: "flow-state", sourcePath: "flow.json", targetPath: "flow.json", cataloged: true },
      { role: "review-evidence", sourcePath: "review-evidence/review.json", targetPath: "phases/review/evidence/review.json", cataloged: true },
      { role: "spec-record", sourcePath: "spec.json", targetPath: "spec.json", cataloged: true },
    ]);
    const fixture = plan.outputFixture({ identity: identity(), state: { schemaRevision: 2, version: 1 }, spec: { id: "508-flow-version" } });
    assert.equal(fixture.format, "flow-version-v1");
    assert.equal(fixture.directory, "specs/508-flow-version/001");
    const exported = fixture.toJSON();
    exported.state.version = 2;
    exported.spec.id = "mutated";
    assert.deepEqual(fixture.toJSON().state, { schemaRevision: 2, version: 1 });
    assert.deepEqual(fixture.toJSON().spec, { id: "508-flow-version" });
    assert.throws(() => plan.outputFixture({ identity: identity(), state: { schemaRevision: 2, version: 2 }, spec: { id: "508-flow-version" } }), /schemaRevision\/version/);
    const conflict = FlowVersionMigrationClassification.inspect({ legacyPresent: true, versionPresent: true, target });
    assert.equal(conflict.migratable, false);
    assert.throws(() => new FlowVersionMigrationPlan({ classification: conflict }), /cannot plan/);
    fs.writeFileSync(path.join(source, "unknown.bin"), "?");
    assert.throws(() => new FlowVersionMigrationClassifier({ target }).inspectDirectory(source), /unknown legacy migration artifact/);
    fs.unlinkSync(path.join(source, "unknown.bin"));
    fs.symlinkSync(path.join(source, "spec.json"), path.join(source, "unsafe.json"));
    assert.throws(() => new FlowVersionMigrationClassifier({ target }).inspectDirectory(source), /unsafe migration source symlink/);
  });
});

describe("Flow Version current-state storage", () => {
  it("refreshes flow-state catalog authority after apply and verifies all authoritative reads", () => {
    const location = new FlowVersionLocation({ repositoryRoot: temporaryRoot(), specId: "508-flow-version", version: 1 });
    const boundary = new CurrentFlowStateAdoptionBoundary({ definition: buildCurrentFlowDefinition() });
    const store = boundary.openVersionStore({ location, identity: identity() });
    store.create(boundary.createFresh());
    const applied = store.apply({ activity: startActivity(store.load()) });
    assert.deepEqual(store.load().current, applied.current);
    assert.equal(store.loadSnapshot().state.attempt.id, "attempt-1");
    assert.doesNotThrow(() => store.catalog());
    assert.deepEqual(store.catalog().artifacts.map((artifact) => artifact.relativePath), ["activities.jsonl", "flow-version.json", "flow.json"]);
    assert.equal(store.flowVersionIdentity().identity.runId.toString(), "run-123");
    fs.appendFileSync(location.flowStateFile, "tampered\n");
    assert.throws(() => store.load(), /does not match the catalog/);
    assert.throws(() => store.loadSnapshot(), /does not match the catalog/);
  });

  it("rejects identity tampering through the Version identity read boundary", () => {
    const location = new FlowVersionLocation({ repositoryRoot: temporaryRoot(), specId: "508-flow-version", version: 1 });
    const boundary = new CurrentFlowStateAdoptionBoundary({ definition: buildCurrentFlowDefinition() });
    const store = boundary.openVersionStore({ location, identity: identity() });
    store.create(boundary.createFresh());
    fs.appendFileSync(location.identityFile, "tampered\n");
    assert.throws(() => store.flowVersionIdentity(), /does not match the catalog/);
  });

  it("rejects every current-state authority read when the catalog is missing", () => {
    const location = new FlowVersionLocation({ repositoryRoot: temporaryRoot(), specId: "508-flow-version", version: 1 });
    const boundary = new CurrentFlowStateAdoptionBoundary({ definition: buildCurrentFlowDefinition() });
    const store = boundary.openVersionStore({ location, identity: identity() });
    assert.doesNotThrow(() => store.create(boundary.createFresh()));
    fs.unlinkSync(location.catalogFile);
    assert.throws(() => store.load(), /artifact catalog is required/);
    assert.throws(() => store.loadSnapshot(), /artifact catalog is required/);
    assert.throws(() => store.flowVersionIdentity(), /artifact catalog is required/);
    assert.throws(() => store.catalog(), /artifact catalog is required/);
  });

  it("rejects matching V2 and mismatched identity before creating any Version files", () => {
    const boundary = new CurrentFlowStateAdoptionBoundary({ definition: buildCurrentFlowDefinition() });
    const versionTwo = new FlowVersionLocation({ repositoryRoot: temporaryRoot(), specId: "508-flow-version", version: 2 });
    assert.throws(() => boundary.openVersionStore({ location: versionTwo, identity: identity({ version: 2 }) }), /Version 1 only/);
    assert.equal(fs.existsSync(versionTwo.directory), false);
    const mismatched = new FlowVersionLocation({ repositoryRoot: temporaryRoot(), specId: "508-flow-version", version: 1 });
    assert.throws(() => boundary.openVersionStore({ location: mismatched, identity: identity({ specId: "other-spec" }) }), /must match/);
    assert.equal(fs.existsSync(mismatched.directory), false);
  });

  it("preflights specs and cleans every partial Version file when creation fails", () => {
    const location = new FlowVersionLocation({ repositoryRoot: temporaryRoot(), specId: "508-flow-version", version: 1 });
    const boundary = new CurrentFlowStateAdoptionBoundary({ definition: buildCurrentFlowDefinition() });
    const store = boundary.openVersionStore({ location, identity: identity() });
    const occupied = new FlowVersionLocation({ repositoryRoot: temporaryRoot(), specId: "508-flow-version", version: 1 });
    fs.mkdirSync(occupied.directory, { recursive: true });
    const occupiedStore = boundary.openVersionStore({ location: occupied, identity: identity() });
    assert.throws(() => occupiedStore.create(boundary.createFresh()), /root must be absent/);
    assert.equal(fs.existsSync(occupied.directory), true);
    assert.throws(() => store.create(boundary.createFresh(), { specRecord: { id: "wrong" } }), /spec record must match/);
    assert.equal(fs.existsSync(location.directory), false);
    const failingSpec = { id: "508-flow-version" };
    Object.defineProperty(failingSpec, "injected", { enumerable: true, get() { throw new Error("injected spec serialization failure"); } });
    assert.throws(() => store.create(boundary.createFresh(), { specRecord: failingSpec }), /injected spec serialization failure/);
    assert.equal(fs.existsSync(location.directory), false);
    const atomicFailure = boundary.openVersionStore({
      location,
      identity: identity(),
      faultInjector: ({ phase }) => {
        if (phase === "before-current-flow-state-rename") throw new Error("injected state persistence failure");
      },
    });
    assert.throws(() => atomicFailure.create(boundary.createFresh(), { specRecord: { id: "508-flow-version" } }), /injected state persistence failure/);
    assert.equal(fs.existsSync(location.directory), false);
    assert.doesNotThrow(() => store.create(boundary.createFresh(), { specRecord: { id: "508-flow-version" } }));
  });
});

describe("Flow Version writer locations", () => {
  it("publishes issue and review artifacts into the shared Version catalog", () => {
    const location = new FlowVersionLocation({ repositoryRoot: temporaryRoot(), specId: "508-flow-version", version: 1 });
    const boundary = new CurrentFlowStateAdoptionBoundary({ definition: buildCurrentFlowDefinition() });
    const flow = boundary.openVersionStore({ location, identity: identity() });
    flow.create(boundary.createFresh(), { specRecord: { id: "508-flow-version" } });
    const issueLog = IssueLogStore.forVersion({ location });
    issueLog.append({ kind: "test" }, "issue-entry-1");
    assert.equal(issueLog.filePath, location.issueLogFile);
    const review = ReviewEvidenceStore.forVersion({ location });
    const evidence = new ReviewEvidence({
      version: 1, phase: "impl", taskId: null, treeSha: "a".repeat(40),
      provenance: new ReviewProvenance({ provider: "test", invocationId: "review-1", capturedAt: "2026-08-08T00:00:00.000Z" }),
      disposition: new ReviewDisposition({ value: "PASS" }),
    });
    review.write(evidence);
    assert.equal(review.contains(evidence), true);
    assert.doesNotThrow(() => flow.catalog());
    fs.appendFileSync(location.reviewEvidencePath(`${evidence.identity.evidenceDigest}.json`), "tampered\n");
    assert.throws(() => review.contains(evidence), /does not match the catalog/);
  });

  it("rejects tampered cataloged Issue-log reads in Version mode", () => {
    const location = new FlowVersionLocation({ repositoryRoot: temporaryRoot(), specId: "508-flow-version", version: 1 });
    const boundary = new CurrentFlowStateAdoptionBoundary({ definition: buildCurrentFlowDefinition() });
    const flow = boundary.openVersionStore({ location, identity: identity() });
    flow.create(boundary.createFresh(), { specRecord: { id: "508-flow-version" } });
    const issueLog = IssueLogStore.forVersion({ location });
    issueLog.append({ kind: "test" }, "issue-entry-1");
    fs.appendFileSync(location.issueLogFile, "tampered\n");
    assert.throws(() => issueLog.read(), /does not match the catalog/);
  });

  it("rejects missing catalog on Version issue-log and review-evidence reads", () => {
    const location = new FlowVersionLocation({ repositoryRoot: temporaryRoot(), specId: "508-flow-version", version: 1 });
    const boundary = new CurrentFlowStateAdoptionBoundary({ definition: buildCurrentFlowDefinition() });
    const flow = boundary.openVersionStore({ location, identity: identity() });
    flow.create(boundary.createFresh(), { specRecord: { id: "508-flow-version" } });
    const issueLog = IssueLogStore.forVersion({ location });
    issueLog.append({ kind: "test" }, "issue-entry-1");
    const review = ReviewEvidenceStore.forVersion({ location });
    const evidence = new ReviewEvidence({
      version: 1, phase: "impl", taskId: null, treeSha: "a".repeat(40),
      provenance: new ReviewProvenance({ provider: "test", invocationId: "review-1", capturedAt: "2026-08-08T00:00:00.000Z" }),
      disposition: new ReviewDisposition({ value: "PASS" }),
    });
    review.write(evidence);
    fs.unlinkSync(location.catalogFile);
    assert.throws(() => issueLog.read(), /artifact catalog is required/);
    assert.throws(() => review.contains(evidence), /artifact catalog is required/);
  });
});
