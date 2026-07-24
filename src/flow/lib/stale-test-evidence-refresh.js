import fs from "node:fs";
import path from "node:path";

import { flowLeafIdsBetween } from "../definition.js";
import { normalizeSourceArtifactPath } from "./flow-findings.js";
import { invalidateRepairEvidence } from "./impl-repair-artifacts.js";
import { findStepById } from "./step-tree.js";

const HASH_PATTERN = /^[a-f0-9]{64}$/;

function requireHash(value, field) {
  if (typeof value !== "string" || !HASH_PATTERN.test(value)) {
    throw new Error(`${field} must be a 64-character SHA-256 digest`);
  }
  return value;
}

function resetStep(step, status, now) {
  step.status = status;
  delete step.startedAt;
  delete step.finishedAt;
  if (status === "in_progress") step.startedAt = now;
}

class AdditionalArtifactDeletion {
  constructor({ specDir, relativePath, index }) {
    this.relativePath = normalizeSourceArtifactPath(
      relativePath,
      `additionalArtifacts[${index}]`,
    );
    this.path = path.resolve(specDir, this.relativePath);
    Object.freeze(this);
  }

  apply() {
    if (!fs.existsSync(this.path)) return false;
    fs.rmSync(this.path, { force: true });
    return true;
  }
}

export class StaleTestEvidenceRefreshResult {
  constructor({ previousFingerprint, currentFingerprint, invalidatedArtifacts }) {
    this.recovered = true;
    this.previousFingerprint = previousFingerprint;
    this.currentFingerprint = currentFingerprint;
    this.invalidatedArtifacts = Object.freeze([...invalidatedArtifacts]);
    this.activeStep = "test-execute";
    Object.freeze(this);
  }

  toJSON() {
    return {
      recovered: this.recovered,
      previousFingerprint: this.previousFingerprint,
      currentFingerprint: this.currentFingerprint,
      invalidatedArtifacts: [...this.invalidatedArtifacts],
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
    specDir,
    flowManager,
    reason,
    additionalArtifacts = [],
  }) {
    const additionalArtifactDeletions = additionalArtifacts.map(
      (relativePath, index) => new AdditionalArtifactDeletion({
        specDir,
        relativePath,
        index,
      }),
    );
    const invalidated = invalidateRepairEvidence({
      specDir,
      currentFingerprint: this.currentFingerprint,
      previousFingerprint: this.previousFingerprint,
      reason,
    });
    const additional = [];
    for (const deletion of additionalArtifactDeletions) {
      if (!deletion.apply()) continue;
      additional.push(deletion.relativePath);
    }
    const now = new Date().toISOString();
    flowManager.mutate((state) => {
      for (const stepId of flowLeafIdsBetween("test-execute", "finalize-cleanup")) {
        const step = findStepById(state.steps || [], stepId);
        if (!step) continue;
        resetStep(step, stepId === "test-execute" ? "in_progress" : "pending", now);
      }
      delete state.acceptanceReview;
    });
    return new StaleTestEvidenceRefreshResult({
      previousFingerprint: this.previousFingerprint,
      currentFingerprint: this.currentFingerprint,
      invalidatedArtifacts: [
        ...invalidated.invalidatedArtifacts,
        ...additional,
      ],
    });
  }
}
