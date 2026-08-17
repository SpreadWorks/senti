/**
 * Spec verification tests for 174-add-mysql-guardrails.
 *
 * Verifies that:
 * 1. mysql preset exists with correct parent
 * 2. mysql guardrail.json contains all 13 required guardrails (M-1~M-13)
 * 3. webapp guardrail.json contains the 3 new RDBMS-generic guardrails (W-1~W-3)
 * 4. NOTICE files exist for both mysql and webapp presets
 *
 * Run: node specs/174-add-mysql-guardrails/tests/mysql-guardrails.test.js
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PRESETS_DIR = path.resolve(__dirname, "../../../src/presets");
const MYSQL_DIR = path.join(PRESETS_DIR, "mysql");
const WEBAPP_DIR = path.join(PRESETS_DIR, "webapp");

// Expected mysql guardrail IDs (M-1~M-13)
const MYSQL_GUARDRAIL_IDS = [
  "monotonic-primary-key",
  "utf8mb4-charset-required",
  "no-enum-column-type",
  "datetime-over-timestamp",
  "composite-index-column-order",
  "explain-verify-query-plan",
  "no-function-on-indexed-column",
  "online-ddl-preferred",
  "deadlock-retry-with-backoff",
  "batch-write-sizing",
  "prefer-union-all",
  "not-null-by-default",
  "no-multi-valued-attribute",
];

// Expected webapp new guardrail IDs (W-1~W-3)
const WEBAPP_NEW_GUARDRAIL_IDS = [
  "no-select-star",
  "cursor-pagination-over-offset",
  "transaction-scope-minimization",
];

// Valid sdd-forge phases
const VALID_PHASES = new Set(["draft", "spec", "impl", "test"]);

/** Read file content if it exists, otherwise return empty string. */
function readTextIfExists(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

// ---------------------------------------------------------------------------
// 1. mysql preset structure
// ---------------------------------------------------------------------------

describe("mysql preset: structure", () => {
  it("preset.json exists", () => {
    assert.ok(
      fs.existsSync(path.join(MYSQL_DIR, "preset.json")),
      "src/presets/mysql/preset.json does not exist",
    );
  });

  it("preset.json has parent: database", () => {
    const preset = JSON.parse(fs.readFileSync(path.join(MYSQL_DIR, "preset.json"), "utf8"));
    assert.equal(preset.parent, "database", "mysql preset must inherit from database");
  });

  it("guardrail.json exists", () => {
    assert.ok(
      fs.existsSync(path.join(MYSQL_DIR, "guardrail.json")),
      "src/presets/mysql/guardrail.json does not exist",
    );
  });

  it("NOTICE file exists", () => {
    assert.ok(
      fs.existsSync(path.join(MYSQL_DIR, "NOTICE")),
      "src/presets/mysql/NOTICE does not exist",
    );
  });
});

// ---------------------------------------------------------------------------
// 2. mysql guardrail.json: content
// ---------------------------------------------------------------------------

describe("mysql guardrail.json: content", () => {
  const mysqlGuardrailDoc = fs.existsSync(path.join(MYSQL_DIR, "guardrail.json"))
    ? JSON.parse(fs.readFileSync(path.join(MYSQL_DIR, "guardrail.json"), "utf8"))
    : null;

  it("contains exactly 13 guardrails", () => {
    assert.ok(mysqlGuardrailDoc, "guardrail.json missing");
    assert.equal(mysqlGuardrailDoc.guardrails.length, 13, `expected 13 guardrails, got ${mysqlGuardrailDoc.guardrails?.length}`);
  });

  it("contains all required IDs", () => {
    assert.ok(mysqlGuardrailDoc, "guardrail.json missing");
    const ids = mysqlGuardrailDoc.guardrails.map((g) => g.id);
    const missing = MYSQL_GUARDRAIL_IDS.filter((id) => !ids.includes(id));
    assert.deepEqual(missing, [], `missing guardrail IDs: ${missing.join(", ")}`);
  });

  it("all guardrails have required fields (id, title, body, meta.phase)", () => {
    assert.ok(mysqlGuardrailDoc, "guardrail.json missing");
    for (const g of mysqlGuardrailDoc.guardrails) {
      assert.ok(g.id, `guardrail missing id: ${JSON.stringify(g)}`);
      assert.ok(g.title, `guardrail "${g.id}" missing title`);
      assert.ok(g.body, `guardrail "${g.id}" missing body`);
      assert.ok(Array.isArray(g.meta?.phase), `guardrail "${g.id}" missing meta.phase array`);
    }
  });

  it("all guardrail phases are valid sdd-forge phases", () => {
    assert.ok(mysqlGuardrailDoc, "guardrail.json missing");
    for (const g of mysqlGuardrailDoc.guardrails) {
      for (const phase of g.meta?.phase ?? []) {
        assert.ok(
          VALID_PHASES.has(phase),
          `guardrail "${g.id}" has invalid phase "${phase}". Valid: ${[...VALID_PHASES].join(", ")}`,
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. webapp guardrail.json: new entries
// ---------------------------------------------------------------------------

describe("webapp guardrail.json: new RDBMS-generic entries", () => {
  const webappGuardrailDoc = JSON.parse(fs.readFileSync(path.join(WEBAPP_DIR, "guardrail.json"), "utf8"));
  const ids = webappGuardrailDoc.guardrails.map((g) => g.id);

  for (const id of WEBAPP_NEW_GUARDRAIL_IDS) {
    it(`contains ${id}`, () => {
      assert.ok(ids.includes(id), `webapp guardrail missing: ${id}`);
    });
  }

  it("new guardrails have only valid phases", () => {
    for (const id of WEBAPP_NEW_GUARDRAIL_IDS) {
      const g = webappGuardrailDoc.guardrails.find((x) => x.id === id);
      if (!g) continue;
      for (const phase of g.meta?.phase ?? []) {
        assert.ok(
          VALID_PHASES.has(phase),
          `webapp guardrail "${id}" has invalid phase "${phase}"`,
        );
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 4. webapp NOTICE
// ---------------------------------------------------------------------------

describe("webapp NOTICE: attribution", () => {
  it("NOTICE file exists", () => {
    assert.ok(
      fs.existsSync(path.join(WEBAPP_DIR, "NOTICE")),
      "src/presets/webapp/NOTICE does not exist",
    );
  });

  it("NOTICE mentions planetscale/database-skills", () => {
    const content = readTextIfExists(path.join(WEBAPP_DIR, "NOTICE"));
    assert.ok(content.includes("planetscale/database-skills"), "webapp NOTICE missing planetscale attribution");
  });

  it("NOTICE mentions jarulraj/sqlcheck", () => {
    const content = readTextIfExists(path.join(WEBAPP_DIR, "NOTICE"));
    assert.ok(content.includes("jarulraj/sqlcheck"), "webapp NOTICE missing sqlcheck attribution");
  });
});

// ---------------------------------------------------------------------------
// 5. mysql NOTICE
// ---------------------------------------------------------------------------

describe("mysql NOTICE: attribution", () => {
  it("NOTICE mentions planetscale/database-skills", () => {
    const content = readTextIfExists(path.join(MYSQL_DIR, "NOTICE"));
    assert.ok(content.includes("planetscale/database-skills"), "mysql NOTICE missing planetscale attribution");
  });

  it("NOTICE mentions jarulraj/sqlcheck", () => {
    const content = readTextIfExists(path.join(MYSQL_DIR, "NOTICE"));
    assert.ok(content.includes("jarulraj/sqlcheck"), "mysql NOTICE missing sqlcheck attribution");
  });
});
