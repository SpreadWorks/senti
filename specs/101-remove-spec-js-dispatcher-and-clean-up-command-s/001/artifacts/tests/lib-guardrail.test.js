import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Tests for src/lib/guardrail.js — shared guardrail logic extracted from spec/commands/guardrail.js.
 *
 * These tests verify that the extraction preserves the original behavior.
 * Import path will be valid after Phase 1 implementation.
 */

// This test file is written to fail before implementation (lib/guardrail.js does not exist yet).
// After implementation, the import will resolve and tests will pass.

describe("lib/guardrail.js — parseGuardrailArticles", () => {
  let parseGuardrailArticles;

  it("parses ### headings and body text inside {%guardrail%} blocks", async () => {
    ({ parseGuardrailArticles } = await import("../../../../src/lib/guardrail.js"));
    const text = [
      "# Project Guardrail",
      "",
      '<!-- {%guardrail {phase: [spec]}%} -->',
      "### No External Dependencies",
      "Use only Node.js built-in modules.",
      "<!-- {%/guardrail%} -->",
      "",
      '<!-- {%guardrail {phase: [spec]}%} -->',
      "### REST-First",
      "All APIs must follow REST conventions.",
      "Use proper HTTP methods.",
      "<!-- {%/guardrail%} -->",
    ].join("\n");

    const articles = parseGuardrailArticles(text);
    assert.equal(articles.length, 2);
    assert.equal(articles[0].title, "No External Dependencies");
    assert.ok(articles[0].body.includes("Node.js built-in modules"));
    assert.equal(articles[1].title, "REST-First");
    assert.ok(articles[1].body.includes("REST conventions"));
  });

  it("returns empty array for no articles", async () => {
    ({ parseGuardrailArticles } = await import("../../../../src/lib/guardrail.js"));
    const articles = parseGuardrailArticles("# Guardrail\n\nSome intro text.\n");
    assert.deepEqual(articles, []);
  });

  it("handles article with no body", async () => {
    ({ parseGuardrailArticles } = await import("../../../../src/lib/guardrail.js"));
    const text = [
      '<!-- {%guardrail {phase: [spec]}%} -->',
      "### Empty Article",
      "<!-- {%/guardrail%} -->",
      '<!-- {%guardrail {phase: [spec]}%} -->',
      "### Next Article",
      "Some body.",
      "<!-- {%/guardrail%} -->",
    ].join("\n");
    const articles = parseGuardrailArticles(text);
    assert.equal(articles.length, 2);
    assert.equal(articles[0].title, "Empty Article");
    assert.equal(articles[0].body.trim(), "");
    assert.equal(articles[1].title, "Next Article");
  });
});

describe("lib/guardrail.js — filterByPhase", () => {
  it("filters articles by phase", async () => {
    const { filterByPhase } = await import("../../../../src/lib/guardrail.js");
    const articles = [
      { title: "A", meta: { phase: ["spec"] } },
      { title: "B", meta: { phase: ["impl", "lint"] } },
      { title: "C", meta: { phase: ["spec", "impl"] } },
    ];
    const specOnly = filterByPhase(articles, "spec");
    assert.equal(specOnly.length, 2);
    assert.ok(specOnly.some(a => a.title === "A"));
    assert.ok(specOnly.some(a => a.title === "C"));
  });

  it("returns empty when no articles match", async () => {
    const { filterByPhase } = await import("../../../../src/lib/guardrail.js");
    const articles = [{ title: "A", meta: { phase: ["lint"] } }];
    assert.deepEqual(filterByPhase(articles, "spec"), []);
  });
});

describe("lib/guardrail.js — matchScope", () => {
  it("matches file against scope glob patterns", async () => {
    const { matchScope } = await import("../../../../src/lib/guardrail.js");
    const scope = ["src/**/*.js"];
    assert.ok(matchScope("src/lib/foo.js", scope));
    assert.ok(!matchScope("tests/foo.js", scope));
  });

  it("returns true when no scope is defined (applies to all)", async () => {
    const { matchScope } = await import("../../../../src/lib/guardrail.js");
    assert.ok(matchScope("anything.js", undefined));
  });
});
