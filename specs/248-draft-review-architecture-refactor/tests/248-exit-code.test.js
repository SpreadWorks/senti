import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(__dirname, "../../../src");
const reviewJsPath = path.join(srcRoot, "flow/commands/review.js");
const reviewJs = fs.readFileSync(reviewJsPath, "utf8");

describe("spec 248: review.js exit 0 on verdict FAIL (R4)", () => {
  it("R4: runDraftReview does not call process.exit after verdict determination", () => {
    const fn = extractFunction(reviewJs, "runDraftReview");
    assert.ok(fn, "runDraftReview function not found");
    const afterVerdict = extractAfterVerdictSection(fn);
    assert.ok(afterVerdict, "verdict section not found in runDraftReview");
    assert.ok(
      !afterVerdict.includes("process.exit(EXIT_ERROR)"),
      "runDraftReview calls process.exit(EXIT_ERROR) after verdict — should exit 0 instead",
    );
  });

  it("R4: runSpecReview does not call process.exit after verdict determination", () => {
    const fn = extractFunction(reviewJs, "runSpecReview");
    assert.ok(fn, "runSpecReview function not found");
    const afterVerdict = extractAfterVerdictSection(fn);
    assert.ok(afterVerdict, "verdict section not found in runSpecReview");
    assert.ok(
      !afterVerdict.includes("process.exit(EXIT_ERROR)"),
      "runSpecReview calls process.exit(EXIT_ERROR) after verdict — should exit 0 instead",
    );
  });

  it("R4: runTestReview does not call process.exit after verdict determination", () => {
    const fn = extractFunction(reviewJs, "runTestReview");
    assert.ok(fn, "runTestReview function not found");
    const afterVerdict = extractAfterVerdictSection(fn);
    assert.ok(afterVerdict, "verdict section not found in runTestReview");
    assert.ok(
      !afterVerdict.includes("process.exit(EXIT_ERROR)"),
      "runTestReview calls process.exit(EXIT_ERROR) after verdict — should exit 0 instead",
    );
  });

  it("R4: runDraftReview still exits on execution errors (file not found, parse error)", () => {
    const fn = extractFunction(reviewJs, "runDraftReview");
    assert.ok(fn, "runDraftReview function not found");
    const beforeVerdictBlock = fn.slice(0, fn.indexOf("verdict"));
    assert.ok(
      beforeVerdictBlock.includes("process.exit(EXIT_ERROR)"),
      "runDraftReview should still use process.exit(EXIT_ERROR) for execution errors",
    );
  });
});

function extractFunction(source, name) {
  const pattern = new RegExp(`(async\\s+)?function\\s+${name}\\s*\\(`);
  const match = source.match(pattern);
  if (!match) return null;
  const start = match.index;
  let depth = 0;
  let inBody = false;
  for (let i = start; i < source.length; i++) {
    if (source[i] === "{") { depth++; inBody = true; }
    if (source[i] === "}") { depth--; }
    if (inBody && depth === 0) return source.slice(start, i + 1);
  }
  return null;
}

function extractAfterVerdictSection(fnSource) {
  const patterns = [/verdict\s*===?\s*["']PASS["']/, /const\s+verdict\s*=/, /verdict=FAIL/];
  let latestIdx = -1;
  for (const p of patterns) {
    const m = fnSource.match(p);
    if (m && m.index > latestIdx) latestIdx = m.index;
  }
  if (latestIdx === -1) return null;
  return fnSource.slice(latestIdx);
}
