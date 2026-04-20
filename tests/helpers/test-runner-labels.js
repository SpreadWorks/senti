/**
 * tests/helpers/test-runner-labels.js
 *
 * Helpers for the project test runner (`tests/run.js`) to emit per-type
 * label lines (unit / integration / acceptance) as required by spec 200.
 *
 * Directory → type mapping:
 *   .../tests/unit/...        → unit
 *   .../tests/e2e/...         → integration (semantic mapping; e2e is
 *                                treated as integration in test.summary)
 *   .../tests/acceptance/...  → acceptance
 */

const CATEGORY_PATTERNS = [
  { re: /\/tests\/unit\//, type: "unit" },
  { re: /\/tests\/e2e\//, type: "integration" },
  { re: /\/tests\/acceptance\//, type: "acceptance" },
];

export function categorizeTestFile(filePath) {
  const normalized = filePath.replace(/\\/g, "/");
  for (const { re, type } of CATEGORY_PATTERNS) {
    if (re.test(normalized)) return type;
  }
  return null;
}

export function formatLabelSummary(counts) {
  const u = Number(counts?.unit ?? 0);
  const i = Number(counts?.integration ?? 0);
  const a = Number(counts?.acceptance ?? 0);
  return `unit: ${u}\nintegration: ${i}\nacceptance: ${a}`;
}

export function groupTestFilesByCategory(files) {
  const groups = { unit: [], integration: [], acceptance: [], other: [] };
  for (const f of files) {
    const t = categorizeTestFile(f) || "other";
    groups[t].push(f);
  }
  return groups;
}
