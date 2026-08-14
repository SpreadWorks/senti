/**
 * Version-1 test artifact access.
 *
 * Test commands retain their established execution and result shapes, but all
 * durable inputs and outputs cross the canonical Version Store.  This module
 * is deliberately the one place that translates a typed catalog descriptor
 * into an execution file path; callers never infer `<spec>/<version>` or a
 * legacy test-artifact sibling.
 */

import crypto from "node:crypto";
import path from "node:path";
import {
  CanonicalCommandAttemptArtifactHistory,
} from "./canonical-command-result.js";

function requiredObject(value, field) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${field} must be an object`);
  }
  return value;
}

function parseJson(bytes, field) {
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch (error) {
    throw new Error(`${field} must be JSON: ${error.message}`);
  }
}

function canonicalState(state) {
  if (state?.schemaRevision !== 3 || typeof state.specId !== "string" || state.specId === "") {
    throw new Error("CanonicalTestArtifactStore requires a Version-1 Flow state");
  }
  return state;
}

const TEST_SOURCE_PREFIX = "artifacts/tests/";
const SHA256 = /^[a-f0-9]{64}$/;

function requiredText(value, field) {
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${field} is required`);
  return value.trim();
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/**
 * Immutable revision of the cataloged spec-local test tree.
 *
 * The revision has the same JSON shape that review workers already consume,
 * but derives exclusively from catalog descriptors and their publication
 * Activities.  It is intentionally not another flow.json field or a path
 * based view of the test directory.
 */
export class CanonicalTestSourceRevision {
  constructor({ runId, specId, members, finalizedAt } = {}) {
    this.runId = requiredText(runId, "canonical test source revision runId");
    this.specId = requiredText(specId, "canonical test source revision specId");
    if (!Array.isArray(members)) throw new Error("canonical test source revision members must be an array");
    this.members = Object.freeze(members.map((member, index) => {
      if (member === null || typeof member !== "object" || Array.isArray(member)) {
        throw new Error(`canonical test source revision members[${index}] must be an object`);
      }
      const testPath = requiredText(member.testPath, `canonical test source revision members[${index}].testPath`);
      if (
        path.posix.isAbsolute(testPath)
        || path.posix.normalize(testPath) !== testPath
        || testPath.split("/").some((part) => part === "" || part === "." || part === "..")
      ) {
        throw new Error("canonical test source revision testPath is invalid");
      }
      const hash = requiredText(member.hash, `canonical test source revision members[${index}].hash`);
      if (!SHA256.test(hash)) throw new Error("canonical test source revision hash must be SHA-256");
      if (!Number.isSafeInteger(member.size) || member.size < 0) {
        throw new Error("canonical test source revision size must be a non-negative safe integer");
      }
      return Object.freeze({ testPath, hash, size: member.size, activityId: member.activityId ?? null });
    }).sort((left, right) => left.testPath.localeCompare(right.testPath)));
    if (new Set(this.members.map((member) => member.testPath)).size !== this.members.length) {
      throw new Error("canonical test source revision has duplicate test paths");
    }
    this.digest = sha256(this.members.map((member) => (
      `${member.testPath}\0${member.hash}\0${member.size}`
    )).join("\n"));
    this.byteLength = this.members.reduce((total, member) => total + member.size, 0);
    this.finalizedAt = requiredText(finalizedAt, "canonical test source revision finalizedAt");
    if (!Number.isFinite(Date.parse(this.finalizedAt))) {
      throw new Error("canonical test source revision finalizedAt must be an ISO timestamp");
    }
    Object.freeze(this);
  }

  static fromCatalog({ state, catalog, activities = [], now = () => new Date().toISOString() } = {}) {
    const canonical = canonicalState(state);
    if (catalog === null || typeof catalog !== "object" || !Array.isArray(catalog.artifacts)) {
      throw new Error("canonical test source revision requires an artifact catalog");
    }
    if (!Array.isArray(activities)) throw new Error("canonical test source revision activities must be an array");
    const activityById = new Map(activities.map((activity) => [activity?.id, activity]));
    const members = catalog.artifacts
      .filter((descriptor) => descriptor?.logicalKey === "tests.source")
      .map((descriptor) => {
        if (typeof descriptor.relativePath !== "string" || !descriptor.relativePath.startsWith(TEST_SOURCE_PREFIX)) {
          throw new Error("canonical test source catalog path is invalid");
        }
        return {
          testPath: descriptor.relativePath.slice(TEST_SOURCE_PREFIX.length),
          hash: descriptor.hash,
          size: descriptor.size,
          activityId: descriptor.activityId ?? null,
        };
      });
    const finalizedAt = members
      .map((member) => activityById.get(member.activityId)?.timing?.finishedAt ?? null)
      .filter(Boolean)
      .sort()
      .at(-1) ?? now();
    return new CanonicalTestSourceRevision({
      runId: canonical.runId,
      specId: canonical.specId,
      members,
      finalizedAt,
    });
  }

  toJSON() {
    return {
      version: 1,
      runId: this.runId,
      specId: this.specId,
      stepId: "test",
      digest: this.digest,
      byteLength: this.byteLength,
      finalizedAt: this.finalizedAt,
    };
  }
}

/** A catalog-resolved spec-local test source. */
export class CanonicalSpecTestSource {
  constructor({ testPath, relativePath, absolutePath, bytes } = {}) {
    if (typeof testPath !== "string" || testPath === "") throw new Error("canonical test source testPath is required");
    if (typeof relativePath !== "string" || relativePath === "") throw new Error("canonical test source relativePath is required");
    if (!path.isAbsolute(absolutePath)) throw new Error("canonical test source absolutePath is required");
    if (!Buffer.isBuffer(bytes)) throw new Error("canonical test source bytes are required");
    this.testPath = testPath;
    this.relativePath = relativePath;
    this.absolutePath = absolutePath;
    this.bytes = Buffer.from(bytes);
    Object.freeze(this);
  }

  get source() { return this.bytes.toString("utf8"); }
}

/**
 * A deep command-facing adapter over FlowManager's Version-1 Store surface.
 * It does not have a legacy mode; callers choose it only after the normal
 * FlowManager loaded the exact schema-revision-three state.
 */
export class CanonicalTestArtifactStore {
  constructor({ flowManager, state } = {}) {
    if (!flowManager || typeof flowManager.readArtifact !== "function"
      || typeof flowManager.artifactCatalog !== "function"
      || typeof flowManager.writeRuntimeArtifact !== "function"
      || typeof flowManager.readRuntimeArtifact !== "function"
      || typeof flowManager.activityLedger !== "function") {
      throw new Error("CanonicalTestArtifactStore requires the canonical FlowManager surface");
    }
    this.flowManager = flowManager;
    this.state = canonicalState(state);
    this.specId = this.state.specId;
    this.location = flowManager.specLocation(this.specId);
    Object.freeze(this);
  }

  get directory() { return this.location.directory; }

  readSpec(consumerNodeId) {
    const resolved = this.flowManager.readArtifact({
      specId: this.specId,
      logicalKey: "spec.record",
      consumerNodeId,
    });
    return Object.freeze(parseJson(resolved.bytes, "canonical spec.json"));
  }

  /** Return the latest payload in a producer-owned attempts[] result file. */
  readCurrentAttempt({ logicalKey, consumerNodeId, optional = false } = {}) {
    const resolved = this.flowManager.readArtifact({
      specId: this.specId,
      logicalKey,
      consumerNodeId,
      optional,
    });
    if (resolved === null) return null;
    const history = CanonicalCommandAttemptArtifactHistory.fromBytes({ logicalKey, bytes: resolved.bytes });
    return Object.freeze({
      attempt: history.current.attempt,
      payload: history.current.payload,
      relativePath: resolved.relativePath,
      descriptor: resolved.descriptor,
    });
  }

  /** Resolve every cataloged spec-local test source for one authorized reader. */
  testSources(consumerNodeId) {
    const catalog = this.flowManager.artifactCatalog(this.specId);
    const prefix = "artifacts/tests/";
    return Object.freeze(catalog.artifacts
      .filter((descriptor) => descriptor.logicalKey === "tests.source")
      .map((descriptor) => {
        if (!descriptor.relativePath.startsWith(prefix)) {
          throw new Error("canonical test source catalog path is invalid");
        }
        const testPath = descriptor.relativePath.slice(prefix.length);
        const resolved = this.flowManager.readArtifact({
          specId: this.specId,
          logicalKey: "tests.source",
          parameters: { testPath },
          consumerNodeId,
        });
        return new CanonicalSpecTestSource({
          testPath,
          relativePath: resolved.relativePath,
          absolutePath: this.location.resolve(resolved.relativePath),
          bytes: resolved.bytes,
        });
      })
      .sort((left, right) => left.testPath.localeCompare(right.testPath)));
  }

  /** Derive the current test-tree revision from catalog provenance only. */
  testSourceRevision() {
    return CanonicalTestSourceRevision.fromCatalog({
      state: this.state,
      catalog: this.flowManager.artifactCatalog(this.specId),
      activities: this.flowManager.activityLedger(this.specId),
    });
  }

  writeRaw({ nodeId, logicalKey, parameters = {}, bytes, mediaType = "text/plain" } = {}) {
    return this.flowManager.writeRuntimeArtifact({
      specId: this.specId,
      nodeId,
      artifact: { logicalKey, parameters, mediaType, bytes },
    });
  }

  readRaw({ logicalKey, parameters = {}, consumerNodeId, optional = false } = {}) {
    return this.flowManager.readRuntimeArtifact({
      specId: this.specId,
      logicalKey,
      parameters,
      consumerNodeId,
      optional,
    });
  }

  /** A strict boundary guard for command-returned durable payloads. */
  resultPayload(value, field) {
    return Object.freeze(structuredClone(requiredObject(value, field)));
  }
}

export function isCanonicalFlowState(state) {
  return state?.schemaRevision === 3;
}
