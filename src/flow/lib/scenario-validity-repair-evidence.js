import { CanonicalTestSourceRevision } from "./canonical-test-artifacts.js";
import {
  scenarioValidityBlockingEntries,
  scenarioValidityRepairObservations,
} from "./plan-gate-repair.js";

/**
 * Immutable, catalog-bound scenario-validity repair evidence.
 *
 * This value is deliberately independent from the scenario command. The
 * canonical Store uses it to derive the idempotency identity and issue-log
 * entry while settling the Definition-selected repair atomically.
 */
export class CanonicalScenarioValidityRepairEvidence {
  constructor({ state, summary, testSourceRevision, timestamp = new Date().toISOString() } = {}) {
    if (state?.schemaRevision !== 3) throw new Error("canonical scenario-validity repair evidence requires a Version-1 Flow");
    if (!Array.isArray(summary)) throw new Error("canonical scenario-validity repair evidence summary must be an array");
    if (!(testSourceRevision instanceof CanonicalTestSourceRevision)) {
      throw new Error("canonical scenario-validity repair evidence requires a catalog test revision");
    }
    if (testSourceRevision.runId !== state.runId || testSourceRevision.specId !== state.specId) {
      throw new Error("canonical scenario-validity repair evidence test revision does not match the Flow");
    }
    if (!Number.isFinite(Date.parse(timestamp))) {
      throw new Error("canonical scenario-validity repair evidence timestamp must be ISO-8601");
    }
    this.runId = state.runId;
    this.specId = state.specId;
    this.testRevisionDigest = testSourceRevision.digest;
    this.timestamp = timestamp;
    this.blocking = scenarioValidityBlockingEntries(summary);
    Object.freeze(this);
  }

  get exists() { return this.blocking.length > 0; }

  get idempotencyKey() {
    return ["scenario-validity-test-repair", this.runId, this.testRevisionDigest].join("-");
  }

  toIssueLogEntry() {
    if (!this.exists) return null;
    return {
      step: "scenario-validity",
      phase: "test",
      reason: this.blocking.map(({ entry }) => `${entry.id}=${entry.classification}`).join(", "),
      trigger: "scenario-validity found a test-design blocker before implementation",
      resolution: "Rewind to the governed test handoff and replace the invalid test premise.",
      sourceArtifact: "scenario.validity",
      testRevisionDigest: this.testRevisionDigest,
      observations: scenarioValidityRepairObservations(this.blocking),
      timestamp: this.timestamp,
    };
  }
}
