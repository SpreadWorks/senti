import { normalizeSourceArtifactPath } from "./flow-findings.js";
import { completeTestEvidenceRefresh } from "./impl-repair-artifacts.js";

const HASH_PATTERN = /^[a-f0-9]{64}$/;

function requireHash(value, field) {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    throw new Error(`${field} must be a 64-character SHA-256 digest`);
  }
  return value;
}

class AdditionalRefreshArtifact {
  constructor({ relativePath, index }) {
    this.relativePath = normalizeSourceArtifactPath(
      relativePath,
      `additionalArtifacts[${index}]`,
    );
    Object.freeze(this);
  }
}

export class StaleTestEvidenceRefreshResult {
  constructor({
    previousFingerprint,
    currentFingerprint,
    invalidatedArtifacts,
    invalidations = [],
  }) {
    this.recovered = true;
    this.previousFingerprint = previousFingerprint;
    this.currentFingerprint = currentFingerprint;
    this.invalidatedArtifacts = Object.freeze([...invalidatedArtifacts]);
    this.invalidations = Object.freeze(invalidations.map((record) => Object.freeze({
      ...record,
    })));
    this.activeStep = "test-execute";
    Object.freeze(this);
  }

  toJSON() {
    return {
      recovered: this.recovered,
      previousFingerprint: this.previousFingerprint,
      currentFingerprint: this.currentFingerprint,
      invalidatedArtifacts: [...this.invalidatedArtifacts],
      invalidations: this.invalidations.map((record) => ({ ...record })),
      activeStep: this.activeStep,
    };
  }
}

export class StaleTestEvidenceMismatch {
  constructor({ previousFingerprint, currentFingerprint, artifactNames }) {
    this.previousFingerprint = requireHash(previousFingerprint, "previousFingerprint");
    this.currentFingerprint = requireHash(currentFingerprint, "currentFingerprint");
    if (this.previousFingerprint === this.currentFingerprint) {
      throw new Error("stale evidence fingerprints must differ");
    }
    this.artifactNames = Object.freeze([...artifactNames]);
    Object.freeze(this);
  }

  static detect({ artifacts, currentFingerprint }) {
    const current = requireHash(currentFingerprint, "currentFingerprint");
    const staleArtifacts = [];
    const previousFingerprints = new Set();
    for (const [name, artifact] of artifacts) {
      const previous = artifact?.repairFingerprint;
      if (
        typeof previous === "string"
        && HASH_PATTERN.test(previous)
        && previous !== current
      ) {
        staleArtifacts.push(name);
        previousFingerprints.add(previous);
      }
    }
    if (staleArtifacts.length === 0) return null;
    if (previousFingerprints.size !== 1) {
      throw new Error("stale test evidence has inconsistent repair fingerprints");
    }
    return new StaleTestEvidenceMismatch({
      previousFingerprint: [...previousFingerprints][0],
      currentFingerprint: current,
      artifactNames: staleArtifacts,
    });
  }

  recover(options) {
    return new StaleTestEvidenceRefresh({
      previousFingerprint: this.previousFingerprint,
      currentFingerprint: this.currentFingerprint,
    }).recover(options);
  }
}

export class StaleTestEvidenceRefresh {
  constructor({ previousFingerprint, currentFingerprint }) {
    this.previousFingerprint = requireHash(previousFingerprint, "previousFingerprint");
    this.currentFingerprint = requireHash(currentFingerprint, "currentFingerprint");
    if (this.previousFingerprint === this.currentFingerprint) {
      throw new Error("stale evidence fingerprints must differ");
    }
    Object.freeze(this);
  }

  recover({
    root,
    state,
    specDir,
    flowManager,
    reason,
    sourceStep = "test-evidence-refresh",
    additionalArtifacts = [],
    faultInjector = null,
  }) {
    const normalizedAdditionalArtifacts = additionalArtifacts.map(
      (relativePath, index) => new AdditionalRefreshArtifact({
        relativePath,
        index,
      }).relativePath,
    );
    const completed = completeTestEvidenceRefresh({
      root,
      state,
      specDir,
      flowManager,
      reason,
      sourceStep,
      additionalArtifacts: normalizedAdditionalArtifacts,
      expectedPreviousFingerprint: this.previousFingerprint,
      expectedCurrentFingerprint: this.currentFingerprint,
      faultInjector,
    });
    return new StaleTestEvidenceRefreshResult({
      previousFingerprint: this.previousFingerprint,
      currentFingerprint: this.currentFingerprint,
      invalidatedArtifacts: completed.invalidatedArtifacts,
      invalidations: completed.invalidations || [],
    });
  }
}
