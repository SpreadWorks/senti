/**
 * tests/runner/test-runner-labels.js
 *
 * Helpers for the project test runner (`tests/run.js`) to emit per-type
 * label lines for the executable test suites.
 *
 * Directory → type mapping:
 *   .../tests/unit/...        → unit
 *   .../tests/integration/... → integration
 *   .../tests/e2e/...         → e2e
 *   .../tests/acceptance/...  → acceptance
 */

const CATEGORY_PATTERNS = [
  { re: /\/tests\/unit\//, type: "unit" },
  { re: /\/tests\/integration\//, type: "integration" },
  { re: /\/tests\/e2e\//, type: "e2e" },
  { re: /\/tests\/acceptance\//, type: "acceptance" },
  { re: /\/tests\/agent\//, type: "agent" },
  { re: /\/src\/presets\/[^/]+\/tests\/acceptance\//, type: "acceptance" },
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
  const e = Number(counts?.e2e ?? 0);
  const a = Number(counts?.acceptance ?? 0);
  const agent = Number(counts?.agent ?? 0);
  return `unit: ${u}\nintegration: ${i}\ne2e: ${e}\nacceptance: ${a}\nagent: ${agent}`;
}

export function parsePassCount(output) {
  const match = /^\s*(?:#|ℹ)\s*pass\s+(\d+)\s*$/mu.exec(output || "");
  return match ? Number(match[1]) : 0;
}

export function groupTestFilesByCategory(files) {
  const groups = { unit: [], integration: [], e2e: [], acceptance: [], agent: [], other: [] };
  for (const f of files) {
    const t = categorizeTestFile(f) || "other";
    groups[t].push(f);
  }
  return groups;
}
