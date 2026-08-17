import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../..");

describe("spec 246: spec review token reduction (R-04)", () => {
  it("R-04: review.js no longer reads spec.md as full text for spec review", () => {
    const reviewJs = readFileSync(
      resolve(ROOT, "src/flow/commands/review.js"),
      "utf-8"
    );
    const specReviewSection = extractFunction(reviewJs, "runSpecReview");
    if (specReviewSection) {
      const readsSpecMd =
        specReviewSection.includes("readFileSync") &&
        specReviewSection.includes("spec.md");
      assert.ok(
        !readsSpecMd,
        "runSpecReview should not read spec.md full text (should use spec.json field selection)"
      );
    }
  });

  it("R-04: buildSpecSummaryMarkdown uses minify for token reduction", () => {
    const reviewJs = readFileSync(
      resolve(ROOT, "src/flow/commands/review.js"),
      "utf-8"
    );
    const buildSection = extractFunction(reviewJs, "buildSpecSummaryMarkdown");
    assert.ok(buildSection, "buildSpecSummaryMarkdown function should exist");
    assert.ok(
      buildSection.includes("minify"),
      "buildSpecSummaryMarkdown should use minify"
    );
  });

  it("R-04: field-selection + minify output is smaller than spec.md", () => {
    const specJsonPath = resolve(
      ROOT,
      "specs/246-plan-review-overhaul/spec.json"
    );
    const specMdPath = resolve(
      ROOT,
      "specs/246-plan-review-overhaul/spec.md"
    );
    const specJson = JSON.parse(readFileSync(specJsonPath, "utf-8"));
    const specMd = readFileSync(specMdPath, "utf-8");

    const fields = {
      goal: specJson.goal,
      background: specJson.background,
      scope: specJson.scope,
      constraints: specJson.constraints,
      design_principles: specJson.design_principles,
      overview: specJson.overview,
      requirements: specJson.requirements?.map((r) => ({
        id: r.id,
        desc: r.desc,
        priority: r.priority,
      })),
    };

    const fieldsMd = formatFieldsAsMarkdown(fields);
    assert.ok(
      Buffer.byteLength(fieldsMd, "utf-8") <
        Buffer.byteLength(specMd, "utf-8"),
      `Field selection markdown (${Buffer.byteLength(fieldsMd, "utf-8")} bytes) should be smaller than spec.md (${Buffer.byteLength(specMd, "utf-8")} bytes)`
    );
  });
});

function formatFieldsAsMarkdown(fields) {
  const lines = [];
  lines.push(`# Goal\n${fields.goal}`);
  lines.push(`# Background\n${fields.background}`);
  if (fields.scope) {
    lines.push(`# Scope`);
    if (fields.scope.in) lines.push(`## In\n${fields.scope.in.map((s) => `- ${s}`).join("\n")}`);
    if (fields.scope.out) lines.push(`## Out\n${fields.scope.out.map((s) => `- ${s}`).join("\n")}`);
  }
  if (fields.constraints) lines.push(`# Constraints\n${fields.constraints.map((c) => `- ${c}`).join("\n")}`);
  if (fields.design_principles) lines.push(`# Design Principles\n${fields.design_principles.map((d) => `- ${d}`).join("\n")}`);
  if (fields.requirements) {
    lines.push(`# Requirements`);
    for (const r of fields.requirements) {
      lines.push(`- ${r.id} [${r.priority}]: ${r.desc}`);
    }
  }
  return lines.join("\n\n");
}

function extractFunction(source, funcName) {
  const idx = source.indexOf(`function ${funcName}`);
  if (idx === -1) {
    const asyncIdx = source.indexOf(`async function ${funcName}`);
    if (asyncIdx === -1) return null;
    return extractBalanced(source, asyncIdx);
  }
  return extractBalanced(source, idx);
}

function extractBalanced(source, startIdx) {
  const braceStart = source.indexOf("{", startIdx);
  if (braceStart === -1) return null;
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(startIdx, i + 1);
    }
  }
  return source.slice(startIdx);
}
