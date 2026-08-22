import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toBigrams, bigramSimilarity, ngramSearch } from "../../../src/flow/lib/get-context.js";

describe("toBigrams", () => {
  it("splits a string into bigrams", () => {
    assert.deepEqual(toBigrams("hello"), ["he", "el", "ll", "lo"]);
  });

  it("converts to lowercase", () => {
    assert.deepEqual(toBigrams("Hello"), ["he", "el", "ll", "lo"]);
  });

  it("returns empty array for single character", () => {
    assert.deepEqual(toBigrams("a"), []);
  });

  it("returns empty array for empty string", () => {
    assert.deepEqual(toBigrams(""), []);
  });

  it("handles Japanese text", () => {
    assert.deepEqual(toBigrams("認証"), ["認証"]);
  });

  it("handles longer Japanese text", () => {
    const bigrams = toBigrams("テンプレート");
    assert.equal(bigrams.length, 5);
    assert.equal(bigrams[0], "テン");
    assert.equal(bigrams[4], "ート");
  });

  it("handles mixed alphanumeric and Japanese", () => {
    const bigrams = toBigrams("auth認証");
    assert.ok(bigrams.length > 0);
    assert.ok(bigrams.includes("au"));
    assert.ok(bigrams.includes("h認"));
    assert.ok(bigrams.includes("認証"));
  });
});

describe("bigramSimilarity", () => {
  it("returns 1.0 for identical sets", () => {
    const a = toBigrams("hello");
    assert.equal(bigramSimilarity(a, a), 1.0);
  });

  it("returns 0.0 for completely different sets", () => {
    const a = toBigrams("abc");
    const b = toBigrams("xyz");
    assert.equal(bigramSimilarity(a, b), 0.0);
  });

  it("returns value between 0 and 1 for partial overlap", () => {
    const a = toBigrams("hello");
    const b = toBigrams("help");
    const score = bigramSimilarity(a, b);
    assert.ok(score > 0);
    assert.ok(score < 1);
  });

  it("returns 0 when either set is empty", () => {
    assert.equal(bigramSimilarity([], ["ab"]), 0.0);
    assert.equal(bigramSimilarity(["ab"], []), 0.0);
    assert.equal(bigramSimilarity([], []), 0.0);
  });
});

const SAMPLE_ANALYSIS = {
  _meta: { version: 1 },
  controllers: {
    entries: [
      { file: "src/auth.js", keywords: ["authentication", "login", "session"], summary: "Auth handler" },
      { file: "src/user.js", keywords: ["user", "profile", "account"], summary: "User manager" },
    ],
  },
  models: {
    entries: [
      { file: "src/db.js", keywords: ["database", "connection", "query"], summary: "DB connection" },
      { file: "src/old.js", summary: "Legacy module" },
    ],
  },
};

const ALL_ENTRIES = [
  { file: "src/auth.js", keywords: ["authentication", "login", "session"], summary: "Auth handler" },
  { file: "src/user.js", keywords: ["user", "profile", "account"], summary: "User manager" },
  { file: "src/db.js", keywords: ["database", "connection", "query"], summary: "DB connection" },
  { file: "src/old.js", summary: "Legacy module" },
];

describe("ngramSearch", () => {
  it("returns entries matching query by bigram similarity", () => {
    const results = ngramSearch(ALL_ENTRIES, "authentication login");
    assert.ok(results.length > 0);
    assert.equal(results[0].file, "src/auth.js");
  });

  it("returns entries sorted by score descending", () => {
    const results = ngramSearch(ALL_ENTRIES, "authentication");
    if (results.length >= 2) {
      // First result should have highest relevance
      assert.equal(results[0].file, "src/auth.js");
    }
  });

  it("returns empty array when no keywords match", () => {
    const results = ngramSearch(ALL_ENTRIES, "zzzzzzzzz");
    assert.deepEqual(results, []);
  });

  it("skips entries without keywords", () => {
    const results = ngramSearch(ALL_ENTRIES, "legacy");
    // src/old.js has no keywords, should not appear
    const files = results.map((r) => r.file);
    assert.ok(!files.includes("src/old.js"));
  });

  it("returns entries with expected shape", () => {
    const results = ngramSearch(ALL_ENTRIES, "database");
    assert.ok(results.length > 0);
    const entry = results[0];
    assert.ok("file" in entry);
    assert.ok("summary" in entry);
    assert.ok("keywords" in entry);
    assert.ok("chapter" in entry);
    assert.ok("role" in entry);
  });

  it("handles Japanese query against English keywords", () => {
    // Japanese query with no overlap should return empty
    const results = ngramSearch(ALL_ENTRIES, "日本語テスト");
    assert.deepEqual(results, []);
  });
});
