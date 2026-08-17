// spec: R1 R2
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PromptBuilder } from "../../../src/lib/prompt-builder.js";

const REPO_ROOT = new URL("../../..", import.meta.url).pathname;

function listJsFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(full);
    }
  }
  return files;
}

/**
 * Pure scanner extracted so synthetic fixtures can drive it. Takes an array of
 * `{ path, content }` and returns the list of paths whose PromptBuilder
 * variables (including ones constructed from aliased imports) call `.add(`.
 */
function scanFilesForBuilderAddCalls(files) {
  const offenders = [];
  for (const { path, content } of files) {
    // Detect any local name bound to PromptBuilder (direct or aliased import).
    const aliasNames = new Set(["PromptBuilder"]);
    for (const m of content.matchAll(
      /import\s*\{[^}]*\bPromptBuilder\s+as\s+([A-Za-z_$][\w$]*)/g,
    )) {
      aliasNames.add(m[1]);
    }
    // No PromptBuilder reference at all → skip (TC-6 / TC-38 negative case).
    let mentions = false;
    for (const name of aliasNames) {
      if (content.includes(name)) { mentions = true; break; }
    }
    if (!mentions) continue;

    // Find every variable initialized via `new <PromptBuilderName>(`.
    const vars = new Set();
    for (const name of aliasNames) {
      const newRe = new RegExp(
        `\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*new\\s+${name}\\s*\\(`,
        "g",
      );
      for (const m of content.matchAll(newRe)) vars.add(m[1]);
    }

    for (const varName of vars) {
      const addCall = new RegExp(`\\b${varName}\\.add\\s*\\(`);
      if (addCall.test(content)) {
        offenders.push(path);
        break;
      }
    }
  }
  return offenders;
}

function promptBuilderAddCalls() {
  const files = listJsFiles(join(REPO_ROOT, "src")).map((path) => ({
    path: path.replace(`${REPO_ROOT}/`, ""),
    content: readFileSync(path, "utf8"),
  }));
  return scanFilesForBuilderAddCalls(files);
}

describe("PromptBuilder prompt split API", () => {
  it("R1: appends user and system prompt sections independently", () => {
    const schema = { type: "object" };
    const built = new PromptBuilder()
      .setRole("role")
      .setRules("rules")
      .addSystemPrompt("## System One", "system one")
      .addSystemPrompt("## System Two", "system two")
      .addUserPrompt("## User One", "user one")
      .addUserPrompt("## User Two", "user two")
      .setJsonSchema(schema)
      .setFmtFallback("fallback")
      .build();

    assert.equal(
      built.systemPrompt,
      "role\n\nrules\n\n## System One\nsystem one\n\n## System Two\nsystem two",
    );
    assert.equal(built.userPrompt, "## User One\nuser one\n\n## User Two\nuser two");
    assert.equal(built.jsonSchema, schema);
    assert.equal(built.fmtFallback, "fallback");
    assert.equal(typeof new PromptBuilder().add, "undefined");
  });

  it("R1: setter methods overwrite only their own fields", () => {
    const built = new PromptBuilder()
      .addUserPrompt("## User", "kept")
      .addSystemPrompt("## System", "kept")
      .setRole("old role")
      .setRules("old rules")
      .setJsonSchema({ old: true })
      .setFmtFallback("old fallback")
      .setRole("new role")
      .setRules("new rules")
      .setJsonSchema({ next: true })
      .setFmtFallback("new fallback")
      .build();

    assert.equal(built.systemPrompt, "new role\n\nnew rules\n\n## System\nkept");
    assert.equal(built.userPrompt, "## User\nkept");
    assert.deepEqual(built.jsonSchema, { next: true });
    assert.equal(built.fmtFallback, "new fallback");
  });

  it("R2: production PromptBuilder callers do not use removed add API", () => {
    assert.deepEqual(promptBuilderAddCalls(), []);
  });

  it("R2: draft guardrail review perspectives remain in systemPrompt", () => {
    const reviewSource = readFileSync(join(REPO_ROOT, "src/flow/commands/review.js"), "utf8");
    assert.match(reviewSource, /addSystemPrompt\(\s*["']## Additional Guardrail Review Perspectives["']/);
  });

  // ─── GAP-1: synthetic fixtures for the static scan ────────────────────────

  describe("static-scan helper synthetic-fixture coverage (TC-5 / TC-6 / TC-37 / TC-38)", () => {
    it("TC-5: positive — pb.add(...) on a PromptBuilder var is reported", () => {
      const fixture = {
        path: "fixtures/positive-direct.js",
        content: [
          'import { PromptBuilder } from "../../src/lib/prompt-builder.js";',
          "function build() {",
          "  const pb = new PromptBuilder();",
          '  pb.add("## H", "c");',
          "  return pb.build();",
          "}",
        ].join("\n"),
      };
      const offenders = scanFilesForBuilderAddCalls([fixture]);
      assert.deepEqual(offenders, ["fixtures/positive-direct.js"]);
    });

    it("TC-6: negative — Set.add / MapLike.add with no PromptBuilder is ignored", () => {
      const fixtures = [
        {
          path: "fixtures/just-set.js",
          content: [
            "const s = new Set();",
            "s.add(1);",
            "s.add(2);",
          ].join("\n"),
        },
        {
          path: "fixtures/just-maplike.js",
          content: [
            "class MapLike { add(k, v) { this._k = k; this._v = v; } }",
            "const m = new MapLike();",
            'm.add("k", "v");',
          ].join("\n"),
        },
      ];
      assert.deepEqual(scanFilesForBuilderAddCalls(fixtures), []);
    });

    it("TC-37: aliased import — `PromptBuilder as PB` + pb.add(...) is reported", () => {
      const fixture = {
        path: "fixtures/aliased.js",
        content: [
          'import { PromptBuilder as PB } from "../../src/lib/prompt-builder.js";',
          "const pb = new PB();",
          'pb.add("## H", "c");',
        ].join("\n"),
      };
      const offenders = scanFilesForBuilderAddCalls([fixture]);
      assert.deepEqual(offenders, ["fixtures/aliased.js"]);
    });

    it("TC-38: negative — file imports PromptBuilder but only mutates a Set is NOT reported", () => {
      const fixture = {
        path: "fixtures/imports-but-set-only.js",
        content: [
          'import { PromptBuilder } from "../../src/lib/prompt-builder.js";',
          "// PromptBuilder is imported but unused here",
          "const someSet = new Set();",
          "someSet.add(42);",
          "export function noop() { return PromptBuilder; }",
        ].join("\n"),
      };
      assert.deepEqual(scanFilesForBuilderAddCalls([fixture]), []);
    });

    it("multi-fixture sanity: positive + negative are correctly separated", () => {
      const fixtures = [
        {
          path: "good.js",
          content: 'import { PromptBuilder } from "x";\nconst pb = new PromptBuilder();\npb.addUserPrompt("a","b");',
        },
        {
          path: "bad.js",
          content: 'import { PromptBuilder } from "x";\nconst pb = new PromptBuilder();\npb.add("a","b");',
        },
        {
          path: "neutral.js",
          content: 'const s = new Set();\ns.add(1);',
        },
      ];
      assert.deepEqual(scanFilesForBuilderAddCalls(fixtures), ["bad.js"]);
    });
  });

  // ─── GAP-11: empty-sections invariant (TC-36) ─────────────────────────────

  describe("empty-sections invariant (TC-36)", () => {
    it("build() with only addUserPrompt produces empty/null systemPrompt and the expected userPrompt", () => {
      const built = new PromptBuilder().addUserPrompt("## A", "alpha").build();
      assert.ok(
        built.systemPrompt === "" ||
          built.systemPrompt === null ||
          built.systemPrompt === undefined,
        `expected empty systemPrompt, got: ${JSON.stringify(built.systemPrompt)}`,
      );
      assert.equal(built.userPrompt, "## A\nalpha");
    });

    it("build() with no calls at all produces empty userPrompt and empty/null systemPrompt", () => {
      const built = new PromptBuilder().build();
      assert.ok(
        built.systemPrompt === "" ||
          built.systemPrompt === null ||
          built.systemPrompt === undefined,
      );
      assert.equal(built.userPrompt, "");
    });
  });
});
