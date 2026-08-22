import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { searchEntries } from "../../../src/flow/lib/get-context.js";

const ENTRIES = [
  {
    file: "src/auth/login.js",
    summary: "Login handler",
    detail: "Handles user login with session management",
    keywords: ["auth", "認証", "session", "login", "authentication"],
    chapter: "auth_and_session",
    role: "controller",
  },
  {
    file: "src/config/database.js",
    summary: "Database configuration",
    detail: "Defines DB connection settings",
    keywords: ["database", "DB", "データベース", "config", "connection"],
    chapter: "configuration",
    role: "config",
  },
  {
    file: "src/routes/api.js",
    summary: "API route definitions",
    detail: "REST API endpoint routing",
    keywords: ["route", "ルーティング", "API", "endpoint", "REST"],
    chapter: "cli_commands",
    role: "route",
  },
  {
    file: "src/utils/helper.js",
    summary: "Utility functions",
    detail: "Common helper functions",
    // no keywords — should not match
  },
];

describe("searchEntries", () => {
  it("matches keyword in keywords array (case-insensitive)", () => {
    const results = searchEntries(ENTRIES, "auth");
    assert.equal(results.length, 1);
    assert.equal(results[0].file, "src/auth/login.js");
  });

  it("matches partial keyword (substring)", () => {
    const results = searchEntries(ENTRIES, "login");
    assert.equal(results.length, 1);
    assert.equal(results[0].file, "src/auth/login.js");
  });

  it("matches case-insensitively", () => {
    const results = searchEntries(ENTRIES, "AUTH");
    assert.equal(results.length, 1);
    assert.equal(results[0].file, "src/auth/login.js");
  });

  it("matches Japanese keywords", () => {
    const results = searchEntries(ENTRIES, "認証");
    assert.equal(results.length, 1);
    assert.equal(results[0].file, "src/auth/login.js");
  });

  it("matches multiple entries", () => {
    const results = searchEntries(ENTRIES, "config");
    assert.equal(results.length, 1);
    assert.equal(results[0].file, "src/config/database.js");
  });

  it("returns empty array for no matches", () => {
    const results = searchEntries(ENTRIES, "nonexistent");
    assert.equal(results.length, 0);
  });

  it("skips entries without keywords field", () => {
    const results = searchEntries(ENTRIES, "helper");
    assert.equal(results.length, 0);
  });

  it("returns file, summary, keywords, chapter, role (no detail)", () => {
    const results = searchEntries(ENTRIES, "database");
    assert.equal(results.length, 1);
    const r = results[0];
    assert.equal(r.file, "src/config/database.js");
    assert.equal(r.summary, "Database configuration");
    assert.equal(r.detail, undefined);
    assert.ok(Array.isArray(r.keywords));
    assert.equal(r.chapter, "configuration");
    assert.equal(r.role, "config");
  });
});
