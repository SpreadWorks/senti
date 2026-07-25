// spec: R8
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { ImplRepairLedger } from "../../../src/flow/lib/impl-repair-artifacts.js";
import {
  RepairDeltaArtifact,
} from "../../../src/flow/lib/repair-state-identity.js";
import {
  RepairLedgerReconciliationAuthority,
  RepairLedgerManifestEvidence,
} from "../repair-ledger-reconciliation.js";

const specDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(specDir, name), "utf8"));
}

function reconciliationFixture() {
  const authority = readJson("repair-ledger-reconciliation.json");
  const flow = readJson("flow.json");
  const ledgerJson = readJson("impl-repair.json");
  return {
    authority,
    flow,
    originalLedger: new ImplRepairLedger({
      version: ledgerJson.version,
      entries: ledgerJson.entries.slice(0, authority.preservedEntryCount),
    }),
    appliedLedger: new ImplRepairLedger(ledgerJson),
    manifest: new RepairLedgerManifestEvidence({ hash: authority.expectedManifestHash }),
    delta: new RepairDeltaArtifact(readJson(`repair-deltas/${authority.bridgeEntryId}.json`)),
  };
}

test("R8: preserves the existing ledger and verifies one applied bridge", () => {
  const fixture = reconciliationFixture();
  const authority = new RepairLedgerReconciliationAuthority(fixture.authority);

  const plan = authority.prepare({
    state: fixture.flow,
    ledger: fixture.originalLedger,
    manifest: fixture.manifest,
  });
  assert.equal(plan.entry.id, "repair-006");
  assert.equal(plan.entry.previousHash, fixture.authority.expectedLedgerTail);
  assert.equal(plan.entry.currentHash, fixture.authority.expectedManifestHash);

  const result = authority.verifyApplied({
    state: fixture.flow,
    originalLedger: fixture.originalLedger,
    appliedLedger: fixture.appliedLedger,
    manifest: fixture.manifest,
    delta: fixture.delta,
  });
  assert.equal(result.preservedEntryCount, 5);
  assert.equal(result.bridgeEntryId, "repair-006");
  assert.deepEqual(
    fixture.appliedLedger.entries.slice(0, 5).map((entry) => entry.toJSON()),
    fixture.originalLedger.entries.map((entry) => entry.toJSON()),
  );
});

test("R8: rejects every authority mismatch before changing ledger or delta bytes", () => {
  const fixture = reconciliationFixture();
  const ledgerPath = path.join(specDir, "impl-repair.json");
  const deltaPath = path.join(specDir, `repair-deltas/${fixture.authority.bridgeEntryId}.json`);
  const beforeLedger = fs.readFileSync(ledgerPath);
  const beforeDelta = fs.readFileSync(deltaPath);
  const variants = [
    ["runId", (value) => { value.runId = "foreign-run"; }],
    ["spec", (value) => { value.spec = "specs/foreign/spec.json"; }],
    ["issue", (value) => { value.issue += 1; }],
    ["ledger-tail", (value) => { value.expectedLedgerTail = "0".repeat(64); }],
    ["manifest", (value) => { value.expectedManifestHash = "1".repeat(64); }],
    ["changed-path", (value) => { value.changedPaths = [...value.changedPaths, "foreign.js"]; }],
    ["delta-digest", (value) => { value.changedPathsDigest = "2".repeat(64); }],
  ];

  for (const [name, mutate] of variants) {
    const input = structuredClone(fixture.authority);
    mutate(input);
    assert.throws(() => {
      const authority = new RepairLedgerReconciliationAuthority(input);
      authority.prepare({
        state: fixture.flow,
        ledger: fixture.originalLedger,
        manifest: fixture.manifest,
      });
    }, undefined, name);
    assert.deepEqual(fs.readFileSync(ledgerPath), beforeLedger, `${name}:ledger`);
    assert.deepEqual(fs.readFileSync(deltaPath), beforeDelta, `${name}:delta`);
  }
});
