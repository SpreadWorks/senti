import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  toBigrams,
  bigramSimilarity,
  ngramSearch,
  contextSearch,
} from "../../../src/flow/lib/get-context.js";
import {
  extractGoalAndScope,
  buildSpecReviewPrompt,
  buildDraftReviewPrompt,
} from "../../../src/flow/commands/review.js";

function makeEntry(file, opts = {}) {
  return {
    file,
    summary: opts.summary || `summary of ${file}`,
    detail: opts.detail || `detail of ${file}`,
    keywords: opts.keywords || [],
    chapter: opts.chapter || "test",
    role: opts.role || "lib",
    imports: opts.imports || [],
    methods: opts.methods || [],
    usedBy: opts.usedBy || [],
  };
}

// --- R1: spec.schema.json keywords field ---
describe("R1: spec.schema.json keywords field", () => {
  const schemaPath = path.resolve(
    import.meta.dirname,
    "../../../src/flow/schemas/spec.schema.json"
  );
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));

  it("has keywords property defined", () => {
    assert.ok(schema.properties.keywords, "keywords property should exist");
  });

  it("keywords is type array with string items", () => {
    const kw = schema.properties.keywords;
    assert.equal(kw.type, "array");
    assert.deepEqual(kw.items, { type: "string" });
  });

  it("keywords is not required", () => {
    assert.ok(
      !schema.required.includes("keywords"),
      "keywords should not be in required"
    );
  });
});

// --- R3: per-word bigram comparison ---
describe("R3: per-word bigram comparison", () => {
  const entries = [
    makeEntry("src/auth.js", { keywords: ["authentication", "login", "session"] }),
    makeEntry("src/config.js", { keywords: ["configuration", "settings", "env"] }),
    makeEntry("src/database.js", { keywords: ["database", "query", "connection"] }),
  ];

  it("splits query into words and matches each word independently", () => {
    const results = ngramSearch(entries, "authentication config");
    const files = results.map((r) => r.file);
    assert.ok(files.includes("src/auth.js"), "should match auth via 'authentication'");
    assert.ok(files.includes("src/config.js"), "should match config via 'config'");
  });

  it("matches when any query word has similarity >= 0.6 with any keyword", () => {
    const results = ngramSearch(entries, "login");
    const files = results.map((r) => r.file);
    assert.ok(files.includes("src/auth.js"), "should match auth via 'login' keyword");
  });

  it("does not match when similarity is below 0.6 for all pairs", () => {
    const results = ngramSearch(entries, "zzzzz");
    assert.equal(results.length, 0, "should not match completely unrelated query");
  });
});

// --- R4: imports/methods scoring ---
describe("R4: imports/methods scoring", () => {
  it("adds imports/methods bonus to scored entries", () => {
    const entries = [
      makeEntry("a.js", {
        keywords: ["target"],
        imports: ["b.js", "c.js", "d.js"],
        methods: ["foo", "bar"],
      }),
      makeEntry("b.js", {
        keywords: ["target"],
        imports: [],
        methods: [],
      }),
    ];
    const results = ngramSearch(entries, "target");
    assert.ok(results.length >= 2);
    assert.equal(results[0].file, "a.js", "entry with more imports/methods should rank higher");
  });

  it("handles null/undefined imports and methods gracefully", () => {
    const entries = [
      makeEntry("a.js", { keywords: ["target"], imports: null, methods: undefined }),
    ];
    const results = ngramSearch(entries, "target");
    assert.ok(results.length > 0, "should not crash on null imports/methods");
  });
});

// --- R5: dynamic N (multi-match strategy) ---
describe("R5: dynamic N result count control", () => {
  it("includes all entries with matchCount >= 2", () => {
    const entries = [
      makeEntry("multi.js", { keywords: ["alpha", "beta"] }),
      makeEntry("single.js", { keywords: ["alpha"] }),
    ];
    const results = ngramSearch(entries, "alpha beta");
    const multiEntry = results.find((r) => r.file === "multi.js");
    assert.ok(multiEntry, "entry matching 2+ query words should be included");
  });

  it("enforces maximum 30 results", () => {
    const entries = [];
    for (let i = 0; i < 50; i++) {
      entries.push(makeEntry(`file${i}.js`, { keywords: ["common"] }));
    }
    const results = ngramSearch(entries, "common");
    assert.ok(results.length <= 30, `should cap at 30, got ${results.length}`);
  });

  it("enforces minimum 5 results when enough candidates exist", () => {
    const entries = [];
    for (let i = 0; i < 10; i++) {
      entries.push(makeEntry(`file${i}.js`, { keywords: [`keyword${i}`] }));
    }
    const results = ngramSearch(entries, "keyword0 keyword1 keyword2 keyword3 keyword4");
    assert.ok(results.length >= 5, `should have at least 5, got ${results.length}`);
  });
});

// --- R6: extractGoalAndScope with keywords ---
describe("R6: extractGoalAndScope keywords integration", () => {
  it("uses spec.keywords when present", () => {
    const spec = {
      goal: "improve search",
      keywords: ["context", "search", "bigram"],
      scope: { in: ["src/flow/lib/get-context.js"] },
    };
    const result = extractGoalAndScope(spec);
    assert.equal(result, "context search bigram");
  });

  it("falls back to goal+scope when keywords is absent", () => {
    const spec = {
      goal: "improve search accuracy",
      scope: { in: ["src/flow/lib/get-context.js"] },
    };
    const result = extractGoalAndScope(spec);
    assert.ok(result.length > 0, "should return non-empty string from goal+scope");
    assert.ok(result.includes("improve") || result.includes("search") || result.includes("get-context"),
      "should contain content from goal or scope");
  });

  it("falls back when keywords is empty array", () => {
    const spec = {
      goal: "improve search",
      keywords: [],
      scope: { in: [] },
    };
    const result = extractGoalAndScope(spec);
    assert.ok(result.length > 0, "should fall back when keywords is empty");
  });
});

// --- R7: scope.in path matching ---
describe("R7: scope.in path matching", () => {
  it("extracts backtick-enclosed file paths from scope.in", () => {
    const entries = [
      makeEntry("src/flow/lib/get-context.js", { keywords: ["context"] }),
      makeEntry("src/flow/commands/review.js", { keywords: ["review"] }),
      makeEntry("src/lib/other.js", { keywords: ["other"] }),
    ];
    const scopePaths = ["src/flow/lib/get-context.js", "src/flow/commands/review.js"];
    const results = contextSearch(entries, {}, "unrelated query", ".", "ngram", { scopePaths });
    const files = results.map((r) => r.file);
    assert.ok(files.includes("src/flow/lib/get-context.js"), "should include scope.in match");
    assert.ok(files.includes("src/flow/commands/review.js"), "should include scope.in match");
  });
});

// --- R8: imports expansion with hub exclusion ---
describe("R8: imports expansion", () => {
  it("expands imports of matched files by one level", () => {
    const entries = [
      makeEntry("src/a.js", { keywords: ["target"], imports: ["src/b.js"] }),
      makeEntry("src/b.js", { keywords: ["dependency"] }),
      makeEntry("src/c.js", { keywords: ["unrelated"] }),
    ];
    const results = contextSearch(entries, {}, "target", ".", "ngram", { expandImports: true });
    const files = results.map((r) => r.file);
    assert.ok(files.includes("src/a.js"), "should include direct match");
    assert.ok(files.includes("src/b.js"), "should include import of matched file");
    assert.ok(!files.includes("src/c.js"), "should not include unrelated file");
  });

  it("excludes hub files from expansion path", () => {
    const hubImports = Array.from({ length: 10 }, (_, i) => `dep${i}.js`);
    const hubUsedBy = Array.from({ length: 10 }, (_, i) => `user${i}.js`);
    const entries = [
      makeEntry("src/a.js", { keywords: ["target"], imports: ["src/hub.js"] }),
      makeEntry("src/hub.js", {
        keywords: ["hub"],
        imports: hubImports,
        usedBy: hubUsedBy,
      }),
    ];
    const results = contextSearch(entries, {}, "target", ".", "ngram", { expandImports: true });
    const files = results.map((r) => r.file);
    assert.ok(files.includes("src/a.js"), "should include direct match");
    assert.ok(!files.includes("src/hub.js"), "should exclude hub from expansion");
  });

  it("keeps hub files that are direct matches", () => {
    const hubImports = Array.from({ length: 10 }, (_, i) => `dep${i}.js`);
    const hubUsedBy = Array.from({ length: 10 }, (_, i) => `user${i}.js`);
    const entries = [
      makeEntry("src/hub.js", {
        keywords: ["target"],
        imports: hubImports,
        usedBy: hubUsedBy,
      }),
    ];
    const results = contextSearch(entries, {}, "target", ".", "ngram", { expandImports: true });
    const files = results.map((r) => r.file);
    assert.ok(files.includes("src/hub.js"), "hub with direct match should be kept");
  });
});

// --- R9: detail removal from prompts ---
describe("R9: detail removal from review prompts", () => {
  it("buildSpecReviewPrompt output does not contain detail", () => {
    const contextEntries = [
      { file: "a.js", summary: "summary A", detail: "detail A" },
      { file: "b.js", summary: "summary B", detail: "detail B" },
    ];
    const prompt = buildSpecReviewPrompt("spec text", contextEntries);
    assert.ok(!prompt.includes("detail A"), "should not contain detail A");
    assert.ok(!prompt.includes("detail B"), "should not contain detail B");
    assert.ok(prompt.includes("summary A"), "should contain summary A");
    assert.ok(prompt.includes("summary B"), "should contain summary B");
  });

  it("buildDraftReviewPrompt output does not contain detail", () => {
    const contextEntries = [
      { file: "a.js", summary: "summary A", detail: "detail A" },
    ];
    const prompt = buildDraftReviewPrompt({}, "request", contextEntries);
    assert.ok(!prompt.includes("detail A"), "should not contain detail");
    assert.ok(prompt.includes("summary A"), "should contain summary");
  });
});

// --- R10: score-based sorting ---
describe("R10: score-based sorting", () => {
  it("returns results sorted by score descending", () => {
    const entries = [
      makeEntry("low.js", { keywords: ["xyzzy"] }),
      makeEntry("high.js", { keywords: ["target"], imports: ["a", "b", "c"], methods: ["x", "y"] }),
      makeEntry("mid.js", { keywords: ["target"] }),
    ];
    const results = ngramSearch(entries, "target");
    if (results.length >= 2) {
      const highIdx = results.findIndex((r) => r.file === "high.js");
      const midIdx = results.findIndex((r) => r.file === "mid.js");
      if (highIdx >= 0 && midIdx >= 0) {
        assert.ok(highIdx < midIdx, "higher scored entry should come first");
      }
    }
  });
});

// --- R11: relevance order text ---
describe("R11: relevance order annotation in prompts", () => {
  it("buildSpecReviewPrompt includes relevance order statement", () => {
    const prompt = buildSpecReviewPrompt("spec text", []);
    assert.ok(
      prompt.includes("関連度順") || prompt.includes("relevance"),
      "should mention relevance ordering"
    );
  });

  it("buildDraftReviewPrompt includes relevance order statement", () => {
    const prompt = buildDraftReviewPrompt({}, "request", []);
    assert.ok(
      prompt.includes("関連度順") || prompt.includes("relevance"),
      "should mention relevance ordering"
    );
  });
});
