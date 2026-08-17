/**
 * Spec verification tests for 154-guardrail-english-only
 *
 * Verifies that the guardrail file migration is complete:
 * - No language-specific template guardrail files remain
 * - Each preset has a guardrail.json at its root
 * - Content is in English
 *
 * These tests should FAIL before implementation and PASS after.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const presetsDir = path.resolve(__dirname, "../../../src/presets");

function getPresetDirs() {
  return fs
    .readdirSync(presetsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(presetsDir, e.name));
}

function assertNoLegacyTemplateGuardrails(lang) {
  const found = [];
  for (const dir of getPresetDirs()) {
    const p = path.join(dir, "templates", lang, "guardrail.json");
    if (fs.existsSync(p)) found.push(p);
  }
  assert.deepEqual(
    found,
    [],
    `Found language-specific guardrail files that should have been deleted:\n${found.join("\n")}`,
  );
}

describe("guardrail migration: no language-specific files remain", () => {
  it("no templates/en/guardrail.json exists in any preset", () => {
    assertNoLegacyTemplateGuardrails("en");
  });

  it("no templates/ja/guardrail.json exists in any preset", () => {
    assertNoLegacyTemplateGuardrails("ja");
  });
});

describe("guardrail migration: preset-root guardrail.json exists", () => {
  it("each preset that previously had a guardrail has one at its root", () => {
    // Presets known to have guardrail files before migration
    const expectedPresets = [
      "api",
      "architecture",
      "base",
      "cakephp2",
      "ci",
      "cli",
      "coding-rule",
      "database",
      "document",
      "edge",
      "github-actions",
      "graphql",
      "greenfield",
      "infrastructure",
      "js-webapp",
      "laravel",
      "library",
      "maintenance",
      "monorepo",
      "nextjs",
      "node-cli",
      "oss-contribute",
      "rest",
      "storage",
      "symfony",
      "web-design",
      "webapp",
      "workers",
    ];

    const missing = [];
    for (const name of expectedPresets) {
      const p = path.join(presetsDir, name, "guardrail.json");
      if (!fs.existsSync(p)) missing.push(name);
    }
    assert.deepEqual(
      missing,
      [],
      `These presets are missing a root guardrail.json:\n${missing.join("\n")}`,
    );
  });
});

describe("guardrail migration: content is in English", () => {
  it("base preset guardrail.json contains English titles", () => {
    const p = path.join(presetsDir, "base", "guardrail.json");
    assert.ok(fs.existsSync(p), "base/guardrail.json should exist");
    const data = JSON.parse(fs.readFileSync(p, "utf8"));
    assert.ok(Array.isArray(data.guardrails), "guardrails should be an array");
    assert.ok(data.guardrails.length > 0, "guardrails should not be empty");

    // Known English title from the original en/guardrail.json
    const titles = data.guardrails.map((g) => g.title);
    assert.ok(
      titles.includes("Single Responsibility"),
      `Expected English title "Single Responsibility" in base guardrail. Got: ${titles.join(", ")}`,
    );
  });
});
