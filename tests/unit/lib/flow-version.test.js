import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, it } from "node:test";
import {
  ArtifactAuthority,
  ArtifactAuthoritySlot,
  ArtifactPublicationClaim,
  AuthoritativeSpecRecord,
  FLOW_VERSION_RECORD_SCHEMA_REVISION,
  FlowArtifactCatalog,
  FlowArtifactCatalogStore,
  FlowArtifactDescriptor,
  FlowActivityId,
  FlowId,
  FlowRunId,
  FlowSpecIdentity,
  FlowVersion,
  FlowVersionAuthorityScope,
  FlowVersionId,
  FlowVersionIdentity,
  FlowVersionIdentityStore,
  FlowVersionLocation,
  FlowVersionMigrationArtifact,
  FlowVersionMigrationClassifier,
  FlowVersionMigrationMappingRule,
  FlowVersionMigrationOutput,
  FlowVersionMigrationOutputSet,
  FlowVersionMigrationPlan,
  FlowVersionMigrationSourcePolicy,
  FlowVersionRecord,
} from "../../../src/lib/flow-version.js";
import { buildCurrentFlowDefinition } from "../../../src/flow/definition.js";
import {
  ActivityTransition,
  CurrentAttempt,
  CURRENT_FLOW_SCHEMA_REVISION,
  CurrentFlowStateAdoptionBoundary,
  CurrentFlowVersionMigrationOutputBuilder,
  CurrentFlowVersionSemanticValidator,
  FlowActivity,
} from "../../../src/flow/lib/current-flow-state.js";
import {
  artifactPublicationClaimForStep,
  assertCatalogPublicationAuthority,
} from "../../../src/flow/lib/flow-artifact-authority.js";
import { IssueLogStore } from "../../../src/flow/lib/issue-log-store.js";
import { ReviewEvidenceStore } from "../../../src/flow/lib/review-evidence-store.js";
import { ReviewDisposition, ReviewEvidence, ReviewProvenance } from "../../../src/flow/lib/review-convergence.js";

const roots = [];
function temporaryRoot() {
  const result = fs.mkdtempSync(path.join(os.tmpdir(), "flow-version-"));
  roots.push(result);
  return result;
}
function canonicalLocation({ root = temporaryRoot(), specId = "508-flow-version", version = 1 } = {}) {
  return new FlowVersionLocation({
    repositoryRoot: root,
    authorityScope: FlowVersionAuthorityScope.canonical(),
    specId,
    version,
  });
}
function identity(overrides = {}) {
  const values = {
    flowId: "series-a",
    flowVersionId: "series-a-v1",
    version: 1,
    specId: "508-flow-version",
    runId: "run-123",
    ...overrides,
  };
  return new FlowVersionRecord({ identity: new FlowVersionIdentity(values) });
}
function specRecord(specId = "508-flow-version") {
  return new AuthoritativeSpecRecord({ id: specId, title: "Version authority fixture" });
}
function representativeMigrationPolicy() {
  const exact = (source) => new FlowVersionMigrationMappingRule({
    match: "exact", source, targetPath: `artifacts/legacy/${source}`, role: "artifact",
    operation: "copy", mediaType: source.endsWith(".json") ? "application/json" : "text/markdown",
    authority: "canonical-flow-artifacts", cardinality: "collection", retention: "permanent",
  });
  const namespace = (source) => new FlowVersionMigrationMappingRule({
    match: "namespace", source, targetNamespace: `artifacts/legacy/${source}`, role: "artifact",
    operation: "copy", mediaType: "application/json", authority: "canonical-flow-artifacts",
    cardinality: "collection", retention: "permanent",
  });
  return new FlowVersionMigrationSourcePolicy({
    rules: [
      "draft-coverage-repair.json", "draft-coverage-triage.json", "draft-review-coverage.json",
      "draft-review-questions.json", "draft.json", "issue.md",
    ].map(exact).concat(["plugin-artifacts", "review-history"].map(namespace)),
  });
}
function semanticValidator(definition = buildCurrentFlowDefinition()) {
  return new CurrentFlowVersionSemanticValidator({ definition });
}
function migrationOutputBuilder() { return new CurrentFlowVersionMigrationOutputBuilder(); }
function singleton(kind, authority = "canonical-flow-artifacts") {
  return ArtifactAuthoritySlot.singleton({ kind, authority });
}
function hash(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function descriptor({ file, kind, authority = "canonical-flow-artifacts", memberId = null, content = file }) {
  const authoritySlot = memberId === null
    ? singleton(kind, authority)
    : ArtifactAuthoritySlot.collectionMember({ kind, authority, memberId, publicationStep: "impl-review" });
  return new FlowArtifactDescriptor({
    authoritySlot,
    relativePath: file,
    hash: hash(content),
    size: Buffer.byteLength(content),
    mediaType: "application/json",
    retention: "permanent",
  });
}
function saveCatalog(location, descriptors) {
  return new FlowArtifactCatalogStore({ location }).initialize(new FlowArtifactCatalog({ artifacts: descriptors }));
}
function evidence(sequence) {
  return new ReviewEvidence({
    version: 1,
    phase: "impl",
    taskId: null,
    treeSha: String(sequence).padStart(40, "a"),
    provenance: new ReviewProvenance({
      provider: "test",
      invocationId: `review-${sequence}`,
      capturedAt: `2026-08-08T00:00:0${sequence}.000Z`,
    }),
    disposition: new ReviewDisposition({ value: "PASS" }),
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
    result: null,
    timing: { startedAt: "2026-08-08T00:00:00.000Z", finishedAt: "2026-08-08T00:00:01.000Z", durationMs: 1000 },
    failure: null, provider: "test", model: "test", effort: "test",
    usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cost: 0 },
    references: { evaluations: [], findings: [], repairs: [], artifacts: [] },
  });
}

afterEach(() => {
  while (roots.length > 0) fs.rmSync(roots.pop(), { recursive: true, force: true });
});

describe("Flow Version identity, schema, and consumer paths", () => {
  it("keeps all identity types and the Version-record schema independent", () => {
    const value = new FlowVersionIdentity({
      flowId: new FlowId("series-a"), flowVersionId: new FlowVersionId("series-a-v1"), version: new FlowVersion(1),
      specId: new FlowSpecIdentity("508-flow-version"), runId: new FlowRunId("run-123"),
    });
    assert.deepEqual(value.toJSON(), {
      flowId: "series-a", flowVersionId: "series-a-v1", version: 1, specId: "508-flow-version", runId: "run-123",
    });
    assert.notEqual(FLOW_VERSION_RECORD_SCHEMA_REVISION, CURRENT_FLOW_SCHEMA_REVISION);
    assert.throws(() => new FlowVersionRecord({ identity: value, schemaRevision: 999 }), /unsupported Flow Version record schemaRevision/);
    assert.throws(() => new FlowId(value.specId));
    const location = canonicalLocation();
    const store = new FlowVersionIdentityStore({ location });
    store.create(new FlowVersionRecord({ identity: value }));
    assert.equal(store.load().schemaRevision, FLOW_VERSION_RECORD_SCHEMA_REVISION);
  });

  it("provides one complete consumer API without embedding Version 1", () => {
    const location = canonicalLocation({ version: 1004 });
    assert.equal(new FlowVersion(1).pathSegment, "001");
    assert.equal(location.relativeDirectory, "specs/508-flow-version/1004");
    assert.equal(location.consumers.validator("result.json").endsWith(path.join("phases", "validation", "result.json")), true);
    assert.equal(location.consumers.review("evidence.json").endsWith(path.join("phases", "review", "evidence", "evidence.json")), true);
    assert.equal(location.consumers.gate("impl", "result.json").endsWith(path.join("phases", "gate-impl", "result.json")), true);
    assert.equal(location.consumers.report().endsWith(path.join("artifacts", "report.json")), true);
    assert.equal(location.consumers.resume().endsWith(path.join(".runtime", "resume", "resume.json")), true);
    assert.equal(location.consumers.finalize().endsWith(path.join(".runtime", "finalize", "finalize.json")), true);
    assert.throws(() => location.resolve("../flow.json"));
  });

  it("requires explicit canonical authority for persistent stores", () => {
    const execution = new FlowVersionLocation({
      repositoryRoot: temporaryRoot(), authorityScope: FlowVersionAuthorityScope.execution(),
      specId: "508-flow-version", version: 1,
    });
    assert.throws(() => new FlowArtifactCatalogStore({ location: execution }), /canonical Version authority/);
    assert.throws(() => new FlowVersionLocation({ repositoryRoot: temporaryRoot(), specId: "x", version: 1 }), /authority scope/);
  });
});

describe("Flow Version filesystem authority", () => {
  it("rejects a Version-root symlink before following it", () => {
    const root = temporaryRoot();
    const location = canonicalLocation({ root });
    const outside = temporaryRoot();
    fs.mkdirSync(path.dirname(location.directory), { recursive: true });
    fs.symlinkSync(outside, location.directory);
    assert.throws(() => new FlowArtifactCatalogStore({ location }).load(), /symbolic link/);
  });

  it("rejects a symlinked specId ancestor that escapes the repository", () => {
    const root = temporaryRoot();
    const location = canonicalLocation({ root });
    fs.mkdirSync(path.join(root, "specs"), { recursive: true });
    fs.symlinkSync(temporaryRoot(), path.join(root, "specs", "508-flow-version"));
    assert.throws(() => location.assertAuthority(), /symbolic link/);
  });
});

describe("Flow artifact catalog authority slots", () => {
  it("allows distinct collection members but rejects the same logical member", () => {
    const first = descriptor({ file: "phases/review/evidence/a.json", kind: "review-evidence", memberId: "evidence-a" });
    const second = descriptor({ file: "phases/review/evidence/b.json", kind: "review-evidence", memberId: "evidence-b" });
    assert.equal(new FlowArtifactCatalog({ artifacts: [first, second] }).artifacts.length, 2);
    assert.throws(() => new FlowArtifactCatalog({ artifacts: [
      first,
      descriptor({ file: "phases/review/evidence/c.json", kind: "review-evidence", memberId: "evidence-a" }),
    ] }), /duplicate artifact authority slot/);
    assert.throws(() => new ArtifactAuthoritySlot({
      kind: "review-evidence", authority: "canonical-flow-artifacts", cardinality: "collection", publicationStep: "impl-review",
    }), /requires a memberId/);
    assert.throws(() => ArtifactAuthoritySlot.singleton({ kind: "result", authority: "arbitrary" }), /invalid artifact authority/);
  });

  it("binds publication claims to the executable ownership matrix", () => {
    assert.equal(assertCatalogPublicationAuthority("impl-review", new ArtifactAuthority("canonical-flow-artifacts")).stepId, "impl-review");
    const location = canonicalLocation();
    fs.mkdirSync(path.dirname(location.artifactPath("a.json")), { recursive: true });
    fs.writeFileSync(location.artifactPath("a.json"), "a");
    saveCatalog(location, [FlowArtifactDescriptor.fromFile({
      location, authoritySlot: singleton("result"), relativePath: "artifacts/a.json",
      mediaType: "application/json", retention: "permanent",
    })]);
    const store = new FlowArtifactCatalogStore({ location });
    assert.throws(() => store.publish({
      relativePath: "artifacts/a.json", authoritySlot: singleton("result"),
      publicationClaim: artifactPublicationClaimForStep("branch"),
      mediaType: "application/json", retention: "permanent", write: () => {},
    }), /claim authority mismatch/);
    assert.throws(() => store.publish({
      relativePath: "artifacts/a.json",
      authoritySlot: ArtifactAuthoritySlot.singleton({
        kind: "result", authority: "canonical-flow-artifacts", publicationStep: "impl-review",
      }),
      publicationClaim: artifactPublicationClaimForStep("spec-review"),
      mediaType: "application/json", retention: "permanent", write: () => {},
    }), /claim step mismatch/);
    assert.throws(() => artifactPublicationClaimForStep("not-a-step"), /unknown/);
    assert.throws(() => new ArtifactPublicationClaim({
      producer: "system", stepId: "version-storage", authority: "system",
    }), /only be issued/);
    assert.throws(() => new ArtifactPublicationClaim({
      producer: "worker", stepId: "impl-review", authority: "canonical-flow-artifacts",
    }), /only be issued/);
    assert.throws(() => store.publishSystem({
      relativePath: "phases/review/evidence/bypass.json",
      authoritySlot: ArtifactAuthoritySlot.collectionMember({
        kind: "review-evidence", authority: "canonical-flow-artifacts",
        memberId: "bypass", publicationStep: "system",
      }),
      mediaType: "application/json", retention: "permanent", write: () => {},
    }), /system publication is not authorized/);
  });

  it("validates Activity ledger syntax, uniqueness, and catalog associations", () => {
    const setup = (ledgerText, associatedId = null) => {
      const location = canonicalLocation();
      fs.mkdirSync(path.dirname(location.artifactPath("result.json")), { recursive: true });
      fs.writeFileSync(location.activitiesFile, ledgerText);
      fs.writeFileSync(location.artifactPath("result.json"), "result");
      const descriptors = [
        FlowArtifactDescriptor.fromFile({
          location, authoritySlot: singleton("activity-ledger"), relativePath: "activities.jsonl",
          mediaType: "application/x-ndjson", retention: "permanent",
        }),
        FlowArtifactDescriptor.fromFile({
          location, authoritySlot: singleton("result"), relativePath: "artifacts/result.json",
          mediaType: "application/json", retention: "permanent",
          activityId: associatedId === null ? null : new FlowActivityId(associatedId),
        }),
      ];
      return { location, catalog: new FlowArtifactCatalog({ artifacts: descriptors }) };
    };
    assert.throws(() => {
      const value = setup("not-json\n");
      new FlowArtifactCatalogStore({ location: value.location }).initialize(value.catalog);
    }, /malformed JSON/);
    assert.throws(() => {
      const value = setup('{"id":"activity-1"}\n{"id":"activity-1"}\n');
      new FlowArtifactCatalogStore({ location: value.location }).initialize(value.catalog);
    }, /duplicate Activity id/);
    assert.throws(() => {
      const value = setup('{"id":"activity-1"}\n', "activity-missing");
      new FlowArtifactCatalogStore({ location: value.location }).initialize(value.catalog);
    }, /references a missing Activity/);
    const valid = setup('{"id":"activity-1"}\n', "activity-1");
    assert.doesNotThrow(() => new FlowArtifactCatalogStore({ location: valid.location }).initialize(valid.catalog));
  });

  it("does not create a missing Version root on authoritative reads", () => {
    const location = canonicalLocation();
    const store = new FlowArtifactCatalogStore({ location });
    assert.equal(fs.existsSync(location.directory), false);
    assert.throws(() => store.load(), /does not exist/);
    assert.equal(fs.existsSync(location.directory), false);
    assert.throws(() => store.require(), /does not exist/);
    assert.equal(fs.existsSync(location.directory), false);
  });

  it("preserves corrupt lock errors instead of reporting BUSY", () => {
    const location = canonicalLocation();
    fs.mkdirSync(path.dirname(location.artifactPath("a.json")), { recursive: true });
    fs.writeFileSync(location.artifactPath("a.json"), "a");
    saveCatalog(location, [FlowArtifactDescriptor.fromFile({
      location, authoritySlot: singleton("a"), relativePath: "artifacts/a.json",
      mediaType: "application/json", retention: "permanent",
    })]);
    fs.writeFileSync(location.resolve(".artifact-catalog.lock"), "corrupt");
    assert.throws(() => new FlowArtifactCatalogStore({ location }).load(), (error) => (
      error.code === "PROCESS_OWNED_LOCK_CORRUPT" && error.code !== "FLOW_ARTIFACT_CATALOG_BUSY"
    ));
  });

  it("reports concurrent catalog authority as typed retryable BUSY", () => {
    const location = canonicalLocation();
    fs.mkdirSync(path.dirname(location.artifactPath("a.json")), { recursive: true });
    fs.writeFileSync(location.artifactPath("a.json"), "a");
    saveCatalog(location, [FlowArtifactDescriptor.fromFile({
      location, authoritySlot: singleton("a"), relativePath: "artifacts/a.json",
      mediaType: "application/json", retention: "permanent",
    })]);
    const first = new FlowArtifactCatalogStore({ location });
    const second = new FlowArtifactCatalogStore({ location });
    first.publishSystem({
      relativePath: "artifacts/a.json", authoritySlot: singleton("a"),
      mediaType: "application/json", retention: "permanent",
      write: () => {
        assert.throws(() => second.load(), (error) => (
          error.code === "FLOW_ARTIFACT_CATALOG_BUSY" && error.retryable === true
        ));
        fs.writeFileSync(location.artifactPath("a.json"), "updated");
      },
    });
    assert.equal(fs.readFileSync(location.artifactPath("a.json"), "utf8"), "updated");
  });

  it("restores the complete managed tree after undeclared mutation, deletion, and creation", () => {
    for (const attack of ["mutate", "delete", "create", "hardlink"]) {
      const location = canonicalLocation();
      fs.mkdirSync(path.dirname(location.artifactPath("a.json")), { recursive: true });
      fs.writeFileSync(location.artifactPath("a.json"), "a-before");
      fs.writeFileSync(location.artifactPath("b.json"), "b-before");
      const descriptors = [
        FlowArtifactDescriptor.fromFile({ location, authoritySlot: singleton("a"), relativePath: "artifacts/a.json", mediaType: "application/json", retention: "permanent" }),
        FlowArtifactDescriptor.fromFile({ location, authoritySlot: singleton("b"), relativePath: "artifacts/b.json", mediaType: "application/json", retention: "permanent" }),
      ];
      saveCatalog(location, descriptors);
      const catalogBefore = fs.readFileSync(location.catalogFile);
      const store = new FlowArtifactCatalogStore({ location });
      assert.throws(() => store.publishSystem({
        relativePath: "artifacts/a.json", authoritySlot: singleton("a"),
        mediaType: "application/json", retention: "permanent",
        write: () => {
          fs.writeFileSync(location.artifactPath("a.json"), "a-after");
          if (attack === "mutate") fs.writeFileSync(location.artifactPath("b.json"), "b-after");
          if (attack === "delete") fs.unlinkSync(location.artifactPath("b.json"));
          if (attack === "create") {
            fs.mkdirSync(path.dirname(location.artifactPath("rogue/deep.json")), { recursive: true });
            fs.writeFileSync(location.artifactPath("rogue/deep.json"), "rogue");
          }
          if (attack === "hardlink") fs.linkSync(location.artifactPath("b.json"), location.artifactPath("rogue.json"));
        },
      }), /undeclared Version artifact|hard linked/);
      assert.equal(fs.readFileSync(location.artifactPath("a.json"), "utf8"), "a-before");
      assert.equal(fs.readFileSync(location.artifactPath("b.json"), "utf8"), "b-before");
      assert.equal(fs.existsSync(location.artifactPath("rogue")), false);
      assert.equal(fs.existsSync(location.artifactPath("rogue.json")), false);
      assert.deepEqual(fs.readFileSync(location.catalogFile), catalogBefore);
    }
  });

  it("removes never-created nested parents when a declared write fails", () => {
    const location = canonicalLocation();
    fs.mkdirSync(path.dirname(location.artifactPath("base.json")), { recursive: true });
    fs.writeFileSync(location.artifactPath("base.json"), "base");
    saveCatalog(location, [FlowArtifactDescriptor.fromFile({
      location, authoritySlot: singleton("base"), relativePath: "artifacts/base.json",
      mediaType: "application/json", retention: "permanent",
    })]);
    const store = new FlowArtifactCatalogStore({ location });
    assert.throws(() => store.publishSystem({
      relativePath: "artifacts/new/deep/result.json", authoritySlot: singleton("new"),
      mediaType: "application/json", retention: "permanent",
      write: () => {
        fs.mkdirSync(path.dirname(location.artifactPath("new/deep/result.json")), { recursive: true });
        fs.writeFileSync(location.artifactPath("new/deep/result.json"), "new");
        throw new Error("injected write failure");
      },
    }), /injected write failure/);
    assert.equal(fs.existsSync(location.artifactPath("new")), false);
  });

  it("rejects hard links and arbitrary hidden subtrees", () => {
    const location = canonicalLocation();
    fs.mkdirSync(path.dirname(location.artifactPath("source.json")), { recursive: true });
    fs.writeFileSync(location.artifactPath("source.json"), "source");
    fs.linkSync(location.artifactPath("source.json"), location.artifactPath("linked.json"));
    assert.throws(() => FlowArtifactDescriptor.fromFile({
      location, authoritySlot: singleton("source"), relativePath: "artifacts/source.json",
      mediaType: "application/json", retention: "permanent",
    }), /hard linked/);
    fs.unlinkSync(location.artifactPath("linked.json"));
    const source = FlowArtifactDescriptor.fromFile({
      location, authoritySlot: singleton("source"), relativePath: "artifacts/source.json",
      mediaType: "application/json", retention: "permanent",
    });
    fs.mkdirSync(location.resolve(".senti"));
    fs.writeFileSync(location.resolve(".senti/arbitrary.json"), "rogue");
    assert.throws(() => saveCatalog(location, [source]), /unclassified artifact/);
  });

  it("only unpublishes an existing catalog-managed member", () => {
    const location = canonicalLocation();
    fs.mkdirSync(path.dirname(location.artifactPath("a.json")), { recursive: true });
    fs.writeFileSync(location.artifactPath("a.json"), "a");
    saveCatalog(location, [FlowArtifactDescriptor.fromFile({
      location, authoritySlot: singleton("a"), relativePath: "artifacts/a.json",
      mediaType: "application/json", retention: "permanent",
    })]);
    const store = new FlowArtifactCatalogStore({ location });
    for (const invalid of [".runtime/x.json", "artifact-catalog.json", ".artifact-catalog.lock", "artifacts/missing.json"]) {
      assert.throws(() => store.unpublishSystem({
        relativePath: invalid, write: () => {},
      }), /managed artifact path|does not exist|not cataloged/);
    }
    store.unpublishSystem({
      relativePath: "artifacts/a.json",
      write: () => fs.unlinkSync(location.artifactPath("a.json")),
    });
    assert.equal(store.load().artifacts.length, 0);
  });
});

describe("Flow Version migration classification", () => {
  function coherentFixture(source, target, OutputBuilder = CurrentFlowVersionMigrationOutputBuilder) {
    const definition = buildCurrentFlowDefinition();
    const plan = new FlowVersionMigrationClassifier({
      target, semanticValidator: semanticValidator(definition), outputBuilder: new OutputBuilder(),
    }).inspect(source).plan();
    return plan.outputFixture({
      identity: identity(), state: new CurrentFlowStateAdoptionBoundary({ definition }).createFresh(), spec: specRecord(),
    });
  }

  it("keeps source generation and aggregate output contracts unambiguous", () => {
    const mapping = (operation, outputKey = null) => new FlowVersionMigrationMappingRule({
      match: "exact", source: "input.json", targetPath: "artifacts/output.json",
      role: "artifact", operation, outputKey, mediaType: "application/json",
      authority: "canonical-flow-artifacts", cardinality: "collection", retention: "permanent",
    });
    assert.throws(() => mapping("generate", "generated-output"), /cannot generate/);
    assert.throws(() => mapping("copy", "copy-output"), /only valid for transform/);
    assert.throws(() => new FlowVersionMigrationArtifact({
      role: "artifact", sourcePath: "input.json", targetPath: "artifacts/output.json",
      operation: "copy", outputKey: "copy-output", sourceHash: "a".repeat(64), size: 1,
      mediaType: "application/json", authoritySlot: ArtifactAuthoritySlot.collectionMember({
        kind: "artifact", authority: "canonical-flow-artifacts", memberId: "copy-member", publicationStep: "system",
      }), retention: "permanent",
    }), /only valid for transform/);

    const output = (retention) => new FlowVersionMigrationOutput({
      outputKey: "aggregate", targetPath: "artifacts/output.json", operation: "transform",
      bytes: Buffer.from("same"), mediaType: "application/json",
      authoritySlot: ArtifactAuthoritySlot.collectionMember({
        kind: "artifact", authority: "canonical-flow-artifacts", memberId: "aggregate-member", publicationStep: "system",
      }), retention,
    });
    assert.throws(() => new FlowVersionMigrationOutputSet([
      output("permanent"), output("ephemeral"),
    ]), /output key conflict/);

    const source = path.join(temporaryRoot(), "legacy");
    fs.mkdirSync(source);
    for (const file of ["flow.json", "spec.json", "one.json", "two.json"]) fs.writeFileSync(path.join(source, file), "{}");
    const transform = (sourcePath, mediaType) => new FlowVersionMigrationMappingRule({
      match: "exact", source: sourcePath, targetPath: "artifacts/aggregate.json",
      role: "artifact", operation: "transform", outputKey: "aggregate-output", mediaType,
      authority: "canonical-flow-artifacts", cardinality: "collection", retention: "permanent",
    });
    const inspection = new FlowVersionMigrationClassifier({
      target: canonicalLocation(), sourcePolicy: new FlowVersionMigrationSourcePolicy({
        rules: [transform("one.json", "application/json"), transform("two.json", "text/plain")],
      }), semanticValidator: semanticValidator(), outputBuilder: migrationOutputBuilder(),
    }).inspect(source);
    assert.equal(inspection.classification.blockers.some((blocker) => blocker.code === "PORTABLE_TARGET_COLLISION"), true);
    assert.equal(inspection.classification.blockers.some((blocker) => blocker.code === "DUPLICATE_AUTHORITY_SLOT"), true);
    assert.throws(() => inspection.plan(), /cannot plan/);
  });

  it("excludes owned runtime files while active nested transaction markers block", () => {
    const source = path.join(temporaryRoot(), "legacy");
    fs.mkdirSync(path.join(source, ".runtime", "resume"), { recursive: true });
    fs.writeFileSync(path.join(source, "flow.json"), "{}");
    fs.writeFileSync(path.join(source, "spec.json"), "{}");
    fs.writeFileSync(path.join(source, ".runtime", "resume", "state.json"), "runtime");
    const target = canonicalLocation();
    const fixture = coherentFixture(source, target);
    const runtime = fixture.plan.artifacts.find((artifact) => artifact.sourcePath.endsWith("state.json"));
    assert.equal(runtime.operation.toJSON(), "exclude-runtime");
    assert.equal(runtime.targetPath, null);
    const materialized = fixture.materialize();
    assert.equal(fs.existsSync(materialized.location.resolve(".runtime/resume/state.json")), false);
    assert.equal(materialized.catalog.artifacts.some((artifact) => artifact.relativePath.includes("state.json")), false);

    fs.mkdirSync(path.join(source, "phases", "review"), { recursive: true });
    fs.writeFileSync(path.join(source, "phases", "review", ".retry-recovery.transaction.json"), "{}");
    const blocked = new FlowVersionMigrationClassifier({ target: canonicalLocation() }).inspect(source);
    assert.equal(blocked.classification.blockers.some((blocker) => blocker.code === "ACTIVE_TRANSACTION_MARKER"), true);
  });

  it("binds materialization to the complete inventory and preserves a foreign target race", () => {
    for (const drift of ["file", "symlink", "lock"]) {
      const source = path.join(temporaryRoot(), "legacy");
      fs.mkdirSync(source);
      fs.writeFileSync(path.join(source, "flow.json"), "{}");
      fs.writeFileSync(path.join(source, "spec.json"), "{}");
      const target = canonicalLocation();
      const fixture = coherentFixture(source, target);
      if (drift === "file") fs.writeFileSync(path.join(source, "unknown.json"), "{}");
      if (drift === "symlink") fs.symlinkSync(path.join(source, "flow.json"), path.join(source, "added.json"));
      if (drift === "lock") fs.writeFileSync(path.join(source, "nested.transaction.lock"), "active");
      assert.throws(() => fixture.materialize(), /source inventory changed/);
      assert.equal(fs.existsSync(target.directory), false);
    }

    const source = path.join(temporaryRoot(), "legacy");
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "flow.json"), "{}");
    fs.writeFileSync(path.join(source, "spec.json"), "{}");
    const target = canonicalLocation();
    class RacingBuilder extends CurrentFlowVersionMigrationOutputBuilder {
      build(options) {
        const outputs = super.build(options);
        fs.mkdirSync(target.directory, { recursive: true });
        fs.writeFileSync(path.join(target.directory, "foreign-sentinel"), "foreign");
        return outputs;
      }
    }
    assert.throws(() => coherentFixture(source, target, RacingBuilder).materialize(), /target must be absent/);
    assert.equal(fs.readFileSync(path.join(target.directory, "foreign-sentinel"), "utf8"), "foreign");
  });

  it("aggregates singleton authority and portable Unicode target collisions", () => {
    const source = path.join(temporaryRoot(), "legacy");
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "flow.json"), "{}");
    fs.writeFileSync(path.join(source, "spec.json"), "{}");
    fs.writeFileSync(path.join(source, "one.json"), "1");
    fs.writeFileSync(path.join(source, "two.json"), "2");
    const rule = (sourcePath, targetPath, cardinality = "collection") => new FlowVersionMigrationMappingRule({
      match: "exact", source: sourcePath, targetPath, role: "artifact", operation: "copy",
      mediaType: "application/json", authority: "canonical-flow-artifacts", cardinality, retention: "permanent",
    });
    const inspect = (rules) => new FlowVersionMigrationClassifier({
      target: canonicalLocation(), sourcePolicy: new FlowVersionMigrationSourcePolicy({ rules }),
      semanticValidator: semanticValidator(), outputBuilder: migrationOutputBuilder(),
    }).inspect(source);
    const authority = inspect([
      rule("one.json", "artifacts/one.json", "singleton"),
      rule("two.json", "artifacts/two.json", "singleton"),
    ]);
    assert.equal(authority.classification.blockers.some((blocker) => blocker.code === "DUPLICATE_AUTHORITY_SLOT"), true);
    const portable = inspect([
      rule("one.json", "artifacts/Caf\u00e9.json"),
      rule("two.json", "artifacts/Cafe\u0301.json"),
    ]);
    assert.equal(portable.classification.blockers.some((blocker) => blocker.code === "PORTABLE_TARGET_COLLISION"), true);
  });
  it("classifies a tracked representative legacy Spec and emits a coherent fixture", () => {
    const target = canonicalLocation({ specId: "484-flow-authority-boundaries" });
    const source = path.resolve("specs/484-flow-authority-boundaries");
    const definition = buildCurrentFlowDefinition();
    const inspection = new FlowVersionMigrationClassifier({
      target, sourcePolicy: representativeMigrationPolicy(),
      semanticValidator: semanticValidator(definition), outputBuilder: migrationOutputBuilder(),
    }).inspect(source);
    assert.equal(inspection.classification.value, "legacy");
    const mapped = new Map(inspection.artifacts.map((artifact) => [artifact.sourcePath, artifact.targetPath]));
    assert.equal(mapped.get("draft-coverage-repair.json"), "artifacts/legacy/draft-coverage-repair.json");
    assert.equal(mapped.get("plugin-artifacts/workflow/prepare.json"), "artifacts/legacy/plugin-artifacts/workflow/prepare.json");
    assert.equal(mapped.get("review-evidence/098e20e2f7292411a95e1cf4db4c4fd1cc3bbb7e24599205f76a8e5d724b88b1.json")?.startsWith("phases/review/evidence/"), true);
    const plan = inspection.plan();
    const boundary = new CurrentFlowStateAdoptionBoundary({ definition });
    const fixture = plan.outputFixture({
      identity: identity({ specId: "484-flow-authority-boundaries" }),
      state: boundary.createFresh(),
      spec: specRecord("484-flow-authority-boundaries"),
    });
    const exported = fixture.toJSON();
    assert.equal(exported.catalogPaths.includes("flow-version.json"), true);
    assert.equal(exported.catalogPaths.includes("activities.jsonl"), true);
    assert.equal(exported.catalogPaths.includes("flow.json"), true);
    assert.equal(exported.catalogPaths.includes("spec.json"), true);
    assert.equal(plan.writes.includes(target.relativePath("flow-version.json")), true);
    assert.equal(inspection.artifacts.every((artifact) => (
      new Set(["copy", "transform", "exclude-runtime"]).has(artifact.operation.toJSON())
      && /^[a-f0-9]{64}$/.test(artifact.sourceHash)
      && artifact.size >= 0
      && artifact.mediaType.length > 0
      && artifact.retention.length > 0
    )), true);
    const materialized = fixture.materialize();
    const store = new FlowArtifactCatalogStore({ location: materialized.location });
    assert.doesNotThrow(() => store.require());
    assert.equal(store.read({ relativePaths: exported.catalogPaths, read: (catalog) => catalog.hash }), materialized.catalog.hash);
    exported.state.version = 9;
    exported.spec.id = "mutated";
    assert.equal(fixture.toJSON().state.version, 1);
    assert.equal(fixture.toJSON().spec.id, "484-flow-authority-boundaries");
  });

  it("derives fresh, versioned, and conflict states from the filesystem", () => {
    const missing = path.join(temporaryRoot(), "missing");
    const freshTarget = canonicalLocation();
    const fresh = new FlowVersionMigrationClassifier({ target: freshTarget }).inspect(missing);
    assert.equal(fresh.classification.value, "fresh");
    assert.equal(fresh.classification.migratable, false);
    assert.throws(() => fresh.plan(), /cannot plan a fresh source/);

    const versionedTarget = canonicalLocation();
    const boundary = new CurrentFlowStateAdoptionBoundary({ definition: buildCurrentFlowDefinition() });
    boundary.openVersionStore({ location: versionedTarget, identity: identity() })
      .create(boundary.createFresh(), { specRecord: specRecord() });
    const versioned = new FlowVersionMigrationClassifier({ target: versionedTarget, semanticValidator: semanticValidator(boundary.definition) }).inspect(missing);
    assert.equal(versioned.classification.value, "versioned");
    assert.throws(() => versioned.plan(), /cannot plan a versioned source/);

    const source = path.join(temporaryRoot(), "legacy");
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "flow.json"), "{}");
    const conflictTarget = canonicalLocation();
    boundary.openVersionStore({ location: conflictTarget, identity: identity() })
      .create(boundary.createFresh(), { specRecord: specRecord() });
    const conflict = new FlowVersionMigrationClassifier({ target: conflictTarget, semanticValidator: semanticValidator(boundary.definition) }).inspect(source);
    assert.equal(conflict.classification.value, "conflict");
    assert.throws(() => conflict.plan(), /cannot plan a conflict source/);

  });

  it("classifies partial, corrupt, and symlinked targets as blocked conflicts", () => {
    const missing = path.join(temporaryRoot(), "missing");
    const partial = canonicalLocation();
    fs.mkdirSync(partial.directory, { recursive: true });
    fs.writeFileSync(partial.flowStateFile, "{}");
    const partialResult = new FlowVersionMigrationClassifier({ target: partial }).inspect(missing).classification;
    assert.equal(partialResult.value, "conflict");
    assert.equal(partialResult.blockers[0].code, "INVALID_VERSION_TARGET");

    const corrupt = canonicalLocation();
    fs.mkdirSync(corrupt.directory, { recursive: true });
    fs.writeFileSync(corrupt.catalogFile, "not-json");
    assert.equal(new FlowVersionMigrationClassifier({ target: corrupt }).inspect(missing).classification.value, "conflict");

    const linked = canonicalLocation();
    fs.mkdirSync(path.dirname(linked.directory), { recursive: true });
    fs.symlinkSync(temporaryRoot(), linked.directory);
    const linkedResult = new FlowVersionMigrationClassifier({ target: linked }).inspect(missing).classification;
    assert.equal(linkedResult.value, "conflict");
    assert.equal(linkedResult.blockers[0].code, "INVALID_VERSION_TARGET");
  });

  it("rejects forbidden, linked, and conflicting legacy artifacts", () => {
    const target = canonicalLocation();
    const source = path.join(temporaryRoot(), "legacy");
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "manifest.md"), "forbidden");
    const blockerCodes = () => new FlowVersionMigrationClassifier({ target }).inspect(source)
      .classification.blockers.map((blocker) => blocker.code);
    assert.equal(blockerCodes().includes("FORBIDDEN_MANIFEST"), true);
    fs.unlinkSync(path.join(source, "manifest.md"));
    fs.writeFileSync(path.join(source, "manifest.json"), "{}");
    assert.equal(blockerCodes().includes("FORBIDDEN_MANIFEST"), true);
    fs.unlinkSync(path.join(source, "manifest.json"));
    fs.writeFileSync(path.join(source, ".env"), "secret");
    assert.equal(blockerCodes().includes("UNKNOWN_HIDDEN_ARTIFACT"), true);
    fs.unlinkSync(path.join(source, ".env"));
    fs.writeFileSync(path.join(source, ".artifact-catalog.lock"), "active");
    assert.equal(blockerCodes().includes("ACTIVE_TRANSACTION_MARKER"), true);
    fs.unlinkSync(path.join(source, ".artifact-catalog.lock"));
    fs.writeFileSync(path.join(source, "unknown-visible.txt"), "unknown");
    assert.equal(blockerCodes().includes("UNKNOWN_VISIBLE_ARTIFACT"), true);
    fs.unlinkSync(path.join(source, "unknown-visible.txt"));
    fs.writeFileSync(path.join(source, "flow.json"), "{}");
    fs.linkSync(path.join(source, "flow.json"), path.join(source, "hard.json"));
    assert.equal(blockerCodes().includes("UNSAFE_SOURCE_HARDLINK"), true);
    fs.unlinkSync(path.join(source, "hard.json"));
    fs.symlinkSync(path.join(source, "flow.json"), path.join(source, "unsafe.json"));
    assert.equal(blockerCodes().includes("UNSAFE_SOURCE_SYMLINK"), true);
    fs.unlinkSync(path.join(source, "unsafe.json"));
    fs.mkdirSync(path.join(source, "artifacts", "legacy"), { recursive: true });
    fs.writeFileSync(path.join(source, "x.json"), "root");
    fs.writeFileSync(path.join(source, "artifacts", "legacy", "x.json"), "nested");
    const inspection = new FlowVersionMigrationClassifier({
      target, sourcePolicy: new FlowVersionMigrationSourcePolicy({ rules: [
        new FlowVersionMigrationMappingRule({ match: "exact", source: "x.json", targetPath: "artifacts/legacy/x.json", role: "artifact", operation: "copy", mediaType: "application/json", authority: "canonical-flow-artifacts", cardinality: "collection", retention: "permanent" }),
      ] }),
    }).inspect(source);
    assert.equal(inspection.classification.blockers.some((blocker) => blocker.code === "PORTABLE_TARGET_COLLISION"), true);
    assert.throws(() => inspection.plan(), /cannot plan/);

    fs.rmSync(path.join(source, "artifacts"), { recursive: true });
    fs.unlinkSync(path.join(source, "x.json"));
    fs.writeFileSync(path.join(source, "container"), "ancestor");
    fs.mkdirSync(path.join(source, "artifacts", "legacy", "container"), { recursive: true });
    fs.writeFileSync(path.join(source, "artifacts", "legacy", "container", "child.json"), "child");
    const ancestorConflict = new FlowVersionMigrationClassifier({
      target, sourcePolicy: new FlowVersionMigrationSourcePolicy({ rules: [
        new FlowVersionMigrationMappingRule({ match: "exact", source: "container", targetPath: "artifacts/legacy/container", role: "artifact", operation: "copy", mediaType: "application/octet-stream", authority: "canonical-flow-artifacts", cardinality: "collection", retention: "permanent" }),
      ] }),
    }).inspect(source);
    assert.equal(ancestorConflict.classification.blockers.some((blocker) => blocker.code === "PORTABLE_TARGET_COLLISION"), true);
    assert.throws(() => ancestorConflict.plan(), /cannot plan/);
  });

  it("rejects source drift before materializing any target files", () => {
    const target = canonicalLocation();
    const source = path.join(temporaryRoot(), "legacy");
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "flow.json"), "{}");
    fs.writeFileSync(path.join(source, "spec.json"), "{}");
    const definition = buildCurrentFlowDefinition();
    const fixture = new FlowVersionMigrationClassifier({
      target, semanticValidator: semanticValidator(definition), outputBuilder: migrationOutputBuilder(),
    }).inspect(source).plan().outputFixture({
      identity: identity(), state: new CurrentFlowStateAdoptionBoundary({ definition }).createFresh(), spec: specRecord(),
    });
    fs.writeFileSync(path.join(source, "flow.json"), "changed");
    assert.throws(() => fixture.materialize(), /source inventory changed/);
    assert.equal(fs.existsSync(target.directory), false);
  });

  it("enforces migration source, role, and namespace invariants", () => {
    assert.throws(() => new FlowVersionMigrationArtifact({
      role: "flow-state", sourcePath: "flow.json", targetPath: "artifacts/flow.json",
      operation: "copy", sourceHash: "a".repeat(64), size: 1,
      mediaType: "application/json", authoritySlot: singleton("flow-state", "repository-metadata"), retention: "permanent",
    }), /does not match its role/);
    const target = canonicalLocation();
    const source = path.join(temporaryRoot(), "legacy");
    fs.mkdirSync(source);
    fs.writeFileSync(path.join(source, "flow.json"), "{}");
    fs.writeFileSync(path.join(source, "spec.json"), "{}");
    const inspection = new FlowVersionMigrationClassifier({
      target, semanticValidator: semanticValidator(), outputBuilder: migrationOutputBuilder(),
    }).inspect(source);
    assert.throws(() => new FlowVersionMigrationPlan({
      classification: inspection.classification,
      artifacts: [inspection.artifacts[0], inspection.artifacts[0]],
      inventory: inspection.inventory,
      sourcePolicy: inspection.sourcePolicy,
      semanticValidator: inspection.semanticValidator,
      outputBuilder: inspection.outputBuilder,
    }), /duplicate migration source artifact/);
  });
});

describe("Current Flow Version storage", () => {
  it("requires a typed authoritative Spec and catalogs every root authority", () => {
    const location = canonicalLocation();
    const boundary = new CurrentFlowStateAdoptionBoundary({ definition: buildCurrentFlowDefinition() });
    const store = boundary.openVersionStore({ location, identity: identity() });
    assert.throws(() => store.create(boundary.createFresh()), /AuthoritativeSpecRecord is required/);
    assert.equal(fs.existsSync(location.directory), false);
    assert.throws(() => store.create(boundary.createFresh(), { specRecord: specRecord("other") }), /must match/);
    assert.doesNotThrow(() => store.create(boundary.createFresh(), { specRecord: specRecord() }));
    assert.deepEqual(store.catalog().artifacts.map((artifact) => artifact.relativePath), [
      "activities.jsonl", "flow-version.json", "flow.json", "spec.json",
    ]);
    assert.equal(store.load().schemaRevision, CURRENT_FLOW_SCHEMA_REVISION);
    assert.equal(store.flowVersionIdentity().schemaRevision, FLOW_VERSION_RECORD_SCHEMA_REVISION);
  });

  it("exact-matches the complete opened identity on every authoritative operation", () => {
    const location = canonicalLocation();
    const boundary = new CurrentFlowStateAdoptionBoundary({ definition: buildCurrentFlowDefinition() });
    const original = boundary.openVersionStore({ location, identity: identity() });
    original.create(boundary.createFresh(), { specRecord: specRecord() });
    for (const substituted of [
      identity({ flowId: "series-b" }),
      identity({ flowVersionId: "series-a-substitute" }),
      identity({ runId: "run-substitute" }),
    ]) {
      const store = boundary.openVersionStore({ location, identity: substituted });
      assert.throws(() => store.load(), /does not exactly match/);
      assert.throws(() => store.loadSnapshot(), /does not exactly match/);
      assert.throws(() => store.catalog(), /does not exactly match/);
      assert.throws(() => store.flowVersionIdentity(), /does not exactly match/);
      assert.throws(() => store.apply({ activity: startActivity(boundary.createFresh()) }), /does not exactly match/);
    }
  });

  it("updates state and catalog atomically under exact identity", () => {
    const location = canonicalLocation();
    const boundary = new CurrentFlowStateAdoptionBoundary({ definition: buildCurrentFlowDefinition() });
    const store = boundary.openVersionStore({ location, identity: identity() });
    store.create(boundary.createFresh(), { specRecord: specRecord() });
    const applied = store.apply({ activity: startActivity(store.load()) });
    assert.deepEqual(store.load().current, applied.current);
    assert.equal(store.loadSnapshot().state.attempt.id, "attempt-1");
    fs.appendFileSync(location.flowStateFile, "tampered\n");
    assert.throws(() => store.load(), /does not match the catalog/);
  });
});

describe("Version collection writers", () => {
  it("stores two review evidence members without pretending their digests are Activity IDs", () => {
    const location = canonicalLocation();
    const boundary = new CurrentFlowStateAdoptionBoundary({ definition: buildCurrentFlowDefinition() });
    const flow = boundary.openVersionStore({ location, identity: identity() });
    flow.create(boundary.createFresh(), { specRecord: specRecord() });
    const claim = artifactPublicationClaimForStep("impl-review");
    const review = ReviewEvidenceStore.forVersion({ location, publicationClaim: claim });
    const first = evidence(1);
    const second = evidence(2);
    review.write(first);
    review.write(second);
    assert.equal(review.contains(first), true);
    assert.equal(review.contains(second), true);
    const members = flow.catalog().artifacts.filter((artifact) => artifact.kind === "review-evidence");
    assert.deepEqual(members.map((artifact) => artifact.memberId).sort(), [first.identity.evidenceDigest, second.identity.evidenceDigest].sort());
    assert.deepEqual(members.map((artifact) => artifact.activityId), [null, null]);
    assert.equal(typeof flow.regenerateCatalog, "undefined");

    const store = new FlowArtifactCatalogStore({ location });
    assert.throws(() => store.publish({
      relativePath: "phases/review/evidence/duplicate.json",
      authoritySlot: ArtifactAuthoritySlot.collectionMember({
        kind: "review-evidence", authority: "canonical-flow-artifacts", memberId: first.identity.evidenceDigest,
        publicationStep: "impl-review",
      }),
      publicationClaim: claim,
      mediaType: "application/json", retention: "permanent",
      write: () => fs.writeFileSync(location.reviewEvidencePath("duplicate.json"), "{}"),
    }), /duplicate artifact authority slot/);
    assert.equal(fs.existsSync(location.reviewEvidencePath("duplicate.json")), false);
  });

  it("serializes Issue-log publication through the same catalog authority", () => {
    const location = canonicalLocation();
    const boundary = new CurrentFlowStateAdoptionBoundary({ definition: buildCurrentFlowDefinition() });
    const flow = boundary.openVersionStore({ location, identity: identity() });
    flow.create(boundary.createFresh(), { specRecord: specRecord() });
    const issueLog = IssueLogStore.forVersion({ location });
    issueLog.append({ kind: "test" }, "issue-entry-1");
    assert.equal(issueLog.read().document.entries.length, 1);
    assert.equal(flow.catalog().resolve("issue-log.json").kind, "issue-log");
  });
});
