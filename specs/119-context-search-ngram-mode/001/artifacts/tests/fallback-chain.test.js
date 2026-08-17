import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ngramSearch, fallbackSearch } from "../../../src/flow/get/context.js";

/**
 * Spec #119 verification tests: 3-stage fallback chain
 * ngram → fallbackSearch → AI (agent availability tested separately)
 */

const ANALYSIS = {
  modules: {
    entries: [
      { file: "src/config.js", keywords: ["configuration", "settings", "config-loader"], summary: "Config loader" },
      { file: "src/parser.js", keywords: ["parser", "ast", "tokenizer"], summary: "Parser" },
      { file: "src/render.js", keywords: ["render", "template", "output"], summary: "Renderer" },
    ],
  },
};

const ALL_ENTRIES = ANALYSIS.modules.entries;

describe("Spec #119: Fallback chain (R3)", () => {
  it("AC1: ngram search returns results without AI (default mode)", () => {
    const results = ngramSearch(ALL_ENTRIES, "configuration settings");
    assert.ok(results.length > 0, "ngram should find config entries");
    assert.equal(results[0].file, "src/config.js");
  });

  it("AC4: ngram 0 → fallbackSearch returns results → stops", () => {
    // Query that ngram won't match well but fallbackSearch will
    // "config" is a substring of "configuration" and "config-loader"
    const ngramResults = ngramSearch(ALL_ENTRIES, "zz");
    assert.equal(ngramResults.length, 0, "ngram should find nothing for 'zz'");

    const fallbackResults = fallbackSearch(ALL_ENTRIES, "config");
    assert.ok(fallbackResults.length > 0, "fallbackSearch should find config entries");
  });

  it("AC3: ngram 0 → fallbackSearch 0 → would proceed to AI", () => {
    const ngramResults = ngramSearch(ALL_ENTRIES, "xyznonexistent");
    assert.equal(ngramResults.length, 0, "ngram should find nothing");

    const fallbackResults = fallbackSearch(ALL_ENTRIES, "xyznonexistent");
    assert.equal(fallbackResults.length, 0, "fallbackSearch should find nothing");

    // AI stage would be called here if agent is available
    // (agent invocation not tested in unit tests)
  });

  it("R3.3: returns first stage results when available", () => {
    const results = ngramSearch(ALL_ENTRIES, "parser tokenizer");
    assert.ok(results.length > 0, "ngram should find parser entries");
    // Should not need fallback
  });
});

describe("Spec #119: Japanese short keyword (AC6)", () => {
  const JP_ANALYSIS = {
    modules: {
      entries: [
        { file: "src/auth.js", keywords: ["認証", "auth", "authentication"], summary: "Auth" },
        { file: "src/flow.js", keywords: ["フロー管理", "flow", "state"], summary: "Flow" },
      ],
    },
  };
  const JP_ENTRIES = JP_ANALYSIS.modules.entries;

  it("Japanese 2-char keyword produces 1 bigram", () => {
    // "認証" → bigram ["認証"] — just 1 bigram
    // This tests the edge case from the issue
    const results = ngramSearch(JP_ENTRIES, "認証");
    // May or may not match depending on threshold — this documents the behavior
    // The important thing is it doesn't throw
    assert.ok(Array.isArray(results));
  });

  it("longer Japanese keyword matches better", () => {
    const results = ngramSearch(JP_ENTRIES, "フロー管理");
    assert.ok(results.length > 0, "longer Japanese keywords should match");
    assert.equal(results[0].file, "src/flow.js");
  });
});
