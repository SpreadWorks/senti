// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11 R12 R13 R14
// Spec verification tests for spec 249. Covers all requirements R1-R14.

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "..", "..", "..");

function withTmpDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spec-249-"));
  try { return fn(dir); } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}

// R1: header convention accepts `// spec:` and `# spec:`
test("R1: parseHeader accepts // spec: and # spec: per extension", async () => {
  const { parseHeader } = await import(path.join(repoRoot, "src/flow/lib/test-headers.js"));
  assert.equal(parseHeader("// spec: R1 R2", { ext: ".js" }).kind, "valid");
  assert.equal(parseHeader("# spec: R1", { ext: ".md" }).kind, "valid");
});

// R2: pre-validation blocks step done when headers are missing
test("R2: validateTestHeaders reports failure when headers missing", async () => {
  const { validateTestHeaders } = await import(path.join(repoRoot, "src/flow/lib/test-headers.js"));
  withTmpDir((dir) => {
    const specDir = path.join(dir, "spec");
    fs.mkdirSync(path.join(specDir, "tests"), { recursive: true });
    fs.writeFileSync(path.join(specDir, "tests", "a.test.js"), "import { test } from 'node:test';\ntest('R1: x', ()=>{});\n");
    const result = validateTestHeaders({ specDir, spec: { requirements: [{ id: "R1", desc: "foo" }] } });
    assert.equal(result.ok, false);
    assert.ok(result.missingHeaders.length >= 1);
  });
});

// R3: spec.schema.json supports requirements[].testable
test("R3: spec.schema.json requirements item allows testable boolean", () => {
  const schema = JSON.parse(fs.readFileSync(path.join(repoRoot, "src/flow/schemas/spec.schema.json"), "utf8"));
  assert.equal(schema.properties.requirements.items.properties.testable?.type, "boolean");
});

// R4: validation reports each violation category
test("R4: validateTestHeaders reports all violation categories independently", async () => {
  const { validateTestHeaders } = await import(path.join(repoRoot, "src/flow/lib/test-headers.js"));
  withTmpDir((dir) => {
    const specDir = path.join(dir, "spec");
    fs.mkdirSync(path.join(specDir, "tests"), { recursive: true });
    // Unknown ID R99 + malformed (`/// spec:`)
    fs.writeFileSync(path.join(specDir, "tests", "a.test.js"), "// spec: R99\n/// spec: R1\nit('R99: x', ()=>{});\n");
    const result = validateTestHeaders({ specDir, spec: { requirements: [{ id: "R1", desc: "..." }] } });
    assert.ok(result.unknownIds.length >= 1);
    assert.ok(result.malformedHeaders.length >= 1);
  });
});

// R5: retro static evaluation uses headers (loadTestMap removed)
test("R5: req-map.js no longer exports loadTestMap (header-based mapping)", () => {
  const reqMap = fs.readFileSync(path.join(repoRoot, "src/flow/lib/req-map.js"), "utf8");
  assert.equal(/export\s+function\s+loadTestMap\b/.test(reqMap), false);
});

// R6: retro filters testable: false; evaluateReqByResults returns 'not_done' for null
test("R6: evaluateReqByResults returns 'not_done' for null counts (was 'unverified')", async () => {
  const { evaluateReqByResults } = await import(path.join(repoRoot, "src/flow/lib/req-map.js"));
  assert.equal(evaluateReqByResults(null), "not_done");
});

// R7: review.js no longer dynamic-imports loadTestMap from req-map.js
test("R7: review.js no longer imports loadTestMap from req-map.js", () => {
  const review = fs.readFileSync(path.join(repoRoot, "src/flow/commands/review.js"), "utf8");
  assert.equal(/loadTestMap.*req-map\.js/.test(review), false);
});

// R8: req-map.js retains file-map / TAP exports
test("R8: req-map.js retains loadFileMap / parseTapOutput / extractReqResults", () => {
  const reqMap = fs.readFileSync(path.join(repoRoot, "src/flow/lib/req-map.js"), "utf8");
  for (const sym of ["loadFileMap", "parseTapOutput", "extractReqResults", "evaluateReqByResults", "reconcileFileMap"]) {
    assert.ok(new RegExp(`export\\s+function\\s+${sym}\\b`).test(reqMap), `${sym} should remain`);
  }
});

// R9: requirementsAsText / extractRequirements annotate testable: false
test("R9: requirementsAsText annotates testable: false with `(testing not required)`", async () => {
  const { requirementsAsText } = await import(path.join(repoRoot, "src/flow/lib/run-retro.js"));
  const out = requirementsAsText([
    { id: "R1", desc: "alpha" },
    { id: "R2", desc: "beta", testable: false },
  ]);
  assert.ok(out.includes("(testing not required)"));
  assert.equal(out.split("\n").find((l) => l.includes("R1")).includes("(testing not required)"), false);
});

// R10: test.md prompt updated to header instruction
test("R10: test.md mentions header convention and removes test-map.json wording", () => {
  const testMd = fs.readFileSync(path.join(repoRoot, "src/flow/prompts/plan/test.md"), "utf8");
  assert.equal(/spec:\s*R\d+/.test(testMd), true, "test.md must include header example");
  // Allow benign mentions in legacy-replacement notes; require no `Create ... test-map.json` instruction
  assert.equal(/Create\s+`?specs\/<spec>\/tests\/test-map\.json/.test(testMd), false);
});

// R11: shared helper at src/flow/lib/test-headers.js
test("R11: src/flow/lib/test-headers.js exists and exports validateTestHeaders", async () => {
  const mod = await import(path.join(repoRoot, "src/flow/lib/test-headers.js"));
  assert.equal(typeof mod.validateTestHeaders, "function");
  assert.equal(typeof mod.collectFileHeaders, "function");
  assert.equal(typeof mod.parseHeader, "function");
});

// R12: edge cases — no tests dir / all testable: false
test("R12: validateTestHeaders ok when all requirements testable: false (no tests dir)", async () => {
  const { validateTestHeaders } = await import(path.join(repoRoot, "src/flow/lib/test-headers.js"));
  withTmpDir((dir) => {
    const specDir = path.join(dir, "spec");
    fs.mkdirSync(specDir, { recursive: true });
    const result = validateTestHeaders({
      specDir,
      spec: { requirements: [{ id: "R1", desc: "...", testable: false }] },
    });
    assert.equal(result.ok, true);
  });
});

// R13: spec.md prompt teaches testable: false
test("R13: spec.md prompt mentions testable: false", () => {
  const specMd = fs.readFileSync(path.join(repoRoot, "src/flow/prompts/plan/spec.md"), "utf8");
  assert.equal(/testable\s*:\s*false/.test(specMd), true);
});

// R14: test.md instructs AI to read spec.json (not spec.md) for testable
test("R14: test.md instructs reading spec.json (not spec.md) for testable values", () => {
  const testMd = fs.readFileSync(path.join(repoRoot, "src/flow/prompts/plan/test.md"), "utf8");
  assert.equal(/spec\.json/.test(testMd), true, "test.md must reference spec.json for the testable flag");
});
