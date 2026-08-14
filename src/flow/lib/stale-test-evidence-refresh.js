const HASH_PATTERN = /^[a-f0-9]{64}$/;

function requireHash(value, field) {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    throw new Error(`${field} must be a 64-character SHA-256 digest`);
  }
  return value;
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
    return this.#recover(options, this.previousFingerprint);
  }

  recoverFromCurrentAuthority(options) {
    return this.#recover(options, null);
  }

  #recover({
    state,
    flowManager,
    reason,
    sourceStep = "test-evidence-refresh",
  }, expectedPreviousFingerprint) {
    return new StaleTestEvidenceRefresh({
      previousFingerprint: this.previousFingerprint,
      currentFingerprint: this.currentFingerprint,
    }).recover({
      state,
      flowManager,
      reason,
      sourceStep,
      expectedPreviousFingerprint,
      artifactNames: this.artifactNames,
    });
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
    state,
    flowManager,
    reason,
    sourceStep = "test-evidence-refresh",
    expectedPreviousFingerprint = this.previousFingerprint,
    artifactNames = [],
  }) {
    if (state?.schemaRevision !== 3 || typeof flowManager?.rewindTestEvidence !== "function") {
      throw new Error("stale test evidence recovery requires the canonical Version Store");
    }
    if (expectedPreviousFingerprint !== null && expectedPreviousFingerprint !== this.previousFingerprint) {
      throw new Error("stale test evidence recovery baseline changed");
    }
    flowManager.rewindTestEvidence({ specId: state.specId, reason, sourceStep });
    return new StaleTestEvidenceRefreshResult({
      previousFingerprint: this.previousFingerprint,
      currentFingerprint: this.currentFingerprint,
      invalidatedArtifacts: artifactNames,
      invalidations: [],
    });
  }
}
