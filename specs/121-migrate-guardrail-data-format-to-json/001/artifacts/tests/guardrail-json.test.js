import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createTmpDir, removeTmpDir, writeJson, writeFile } from "../../../tests/helpers/tmp-dir.js";

// These imports will fail until R3/R5/R6 are implemented.
// The test verifies the new JSON-based API after migration.

// ---------------------------------------------------------------------------
// R3: JSON loading — parseGuardrailJson
// ---------------------------------------------------------------------------

describe("JSON guardrail loading", () => {
  it("loads guardrails from guardrail.json", async () => {
    // After R3, guardrail.js should export a function to parse JSON guardrails
    const { loadMergedGuardrails } = await import("../../../src/lib/guardrail.js");
    let tmp;
    try {
      tmp = createTmpDir();
      writeJson(tmp, ".sdd-forge/config.json", {
        lang: "en",
        type: "base",
        docs: { languages: ["en"], defaultLanguage: "en" },
      });
      writeJson(tmp, ".sdd-forge/guardrail.json", {
        guardrails: [
          {
            id: "no-external-deps",
            title: "No External Dependencies",
            body: "Use only Node.js built-in modules.",
            meta: { phase: ["spec", "impl"] },
          },
        ],
      });
      const result = loadMergedGuardrails(tmp);
      assert.ok(Array.isArray(result));
      const found = result.find((g) => g.id === "no-external-deps");
      assert.ok(found, "should find project guardrail by id");
      assert.equal(found.title, "No External Dependencies");
      assert.deepEqual(found.meta.phase, ["spec", "impl"]);
    } finally {
      if (tmp) removeTmpDir(tmp);
    }
  });

  it("converts lint string to RegExp on load", async () => {
    const { loadMergedGuardrails } = await import("../../../src/lib/guardrail.js");
    let tmp;
    try {
      tmp = createTmpDir();
      writeJson(tmp, ".sdd-forge/config.json", {
        lang: "en",
        type: "base",
        docs: { languages: ["en"], defaultLanguage: "en" },
      });
      writeJson(tmp, ".sdd-forge/guardrail.json", {
        guardrails: [
          {
            id: "no-console-log",
            title: "No console.log",
            body: "Remove debug logging.",
            meta: {
              phase: ["lint"],
              lint: "/console\\.log/gi",
            },
          },
        ],
      });
      const result = loadMergedGuardrails(tmp);
      const found = result.find((g) => g.id === "no-console-log");
      assert.ok(found);
      assert.ok(found.meta.lint instanceof RegExp, "lint should be converted to RegExp");
      assert.ok(found.meta.lint.test("Console.Log"), "RegExp flags should be applied");
    } finally {
      if (tmp) removeTmpDir(tmp);
    }
  });

  it("applies default phase when meta.phase is missing", async () => {
    const { loadMergedGuardrails } = await import("../../../src/lib/guardrail.js");
    let tmp;
    try {
      tmp = createTmpDir();
      writeJson(tmp, ".sdd-forge/config.json", {
        lang: "en",
        type: "base",
        docs: { languages: ["en"], defaultLanguage: "en" },
      });
      writeJson(tmp, ".sdd-forge/guardrail.json", {
        guardrails: [
          {
            id: "no-phase",
            title: "No Phase Specified",
            body: "Should default to spec.",
            meta: {},
          },
        ],
      });
      const result = loadMergedGuardrails(tmp);
      const found = result.find((g) => g.id === "no-phase");
      assert.ok(found);
      assert.deepEqual(found.meta.phase, ["spec"], "should default to [\"spec\"]");
    } finally {
      if (tmp) removeTmpDir(tmp);
    }
  });
});

// ---------------------------------------------------------------------------
// R4: id-based merge
// ---------------------------------------------------------------------------

describe("id-based guardrail merge", () => {
  it("child overrides parent guardrail with same id", async () => {
    const { loadMergedGuardrails } = await import("../../../src/lib/guardrail.js");
    let tmp;
    try {
      tmp = createTmpDir();
      writeJson(tmp, ".sdd-forge/config.json", {
        lang: "en",
        type: "base",
        docs: { languages: ["en"], defaultLanguage: "en" },
      });
      // Project guardrail overrides a preset guardrail by id
      writeJson(tmp, ".sdd-forge/guardrail.json", {
        guardrails: [
          {
            id: "single-responsibility",
            title: "Single Responsibility (Override)",
            body: "Project-specific override of the base rule.",
            meta: { phase: ["spec"] },
          },
        ],
      });
      const result = loadMergedGuardrails(tmp);
      // The base preset has "single-responsibility" — project should override it
      const matches = result.filter((g) => g.id === "single-responsibility");
      assert.equal(matches.length, 1, "should have exactly one entry for this id");
      assert.ok(matches[0].title.includes("Override"), "should be the project override");
    } finally {
      if (tmp) removeTmpDir(tmp);
    }
  });

  it("new id from child is appended", async () => {
    const { loadMergedGuardrails } = await import("../../../src/lib/guardrail.js");
    let tmp;
    try {
      tmp = createTmpDir();
      writeJson(tmp, ".sdd-forge/config.json", {
        lang: "en",
        type: "base",
        docs: { languages: ["en"], defaultLanguage: "en" },
      });
      writeJson(tmp, ".sdd-forge/guardrail.json", {
        guardrails: [
          {
            id: "project-custom-rule",
            title: "Project Custom Rule",
            body: "A rule unique to this project.",
            meta: { phase: ["impl"] },
          },
        ],
      });
      const result = loadMergedGuardrails(tmp);
      const found = result.find((g) => g.id === "project-custom-rule");
      assert.ok(found, "new id should be appended to the merged list");
    } finally {
      if (tmp) removeTmpDir(tmp);
    }
  });
});

// ---------------------------------------------------------------------------
// R6: rename verification — articles should not exist
// ---------------------------------------------------------------------------

describe("guardrails rename verification", () => {
  it("exports loadMergedGuardrails (not loadMergedArticles)", async () => {
    const mod = await import("../../../src/lib/guardrail.js");
    assert.ok(typeof mod.loadMergedGuardrails === "function", "loadMergedGuardrails should be exported");
    assert.equal(mod.loadMergedArticles, undefined, "loadMergedArticles should not exist");
  });

  it("exports filterByPhase", async () => {
    const mod = await import("../../../src/lib/guardrail.js");
    assert.ok(typeof mod.filterByPhase === "function");
  });

  it("does not export parseGuardrailArticles", async () => {
    const mod = await import("../../../src/lib/guardrail.js");
    assert.equal(mod.parseGuardrailArticles, undefined, "parseGuardrailArticles should be removed");
  });

  it("does not export serializeArticle", async () => {
    const mod = await import("../../../src/lib/guardrail.js");
    assert.equal(mod.serializeArticle, undefined, "serializeArticle should be removed");
  });

  it("does not export loadGuardrailTemplate", async () => {
    const mod = await import("../../../src/lib/guardrail.js");
    assert.equal(mod.loadGuardrailTemplate, undefined, "loadGuardrailTemplate should be removed");
  });
});
