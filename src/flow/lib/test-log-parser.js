/**
 * src/flow/lib/test-log-parser.js
 *
 * Default test-log parser for `flow run tests`. Parses an aggregated
 * stdout/stderr log from a test runner and extracts per-type counts.
 *
 * Supports:
 *   - Explicit labeled counts: "unit: N", "integration: N", "acceptance: N"
 *   - node --test TAP summary `# pass N` (counted as unit if no explicit label)
 *   - Mocha-style "N passing" (counted as unit if no explicit label)
 *
 * Missing labels are intentionally omitted from the returned object so the
 * caller can distinguish "not measured" from "measured zero".
 */

const TYPES = ["unit", "integration", "acceptance"];

export function parseCountsFromLog(text) {
  const out = {};
  for (const type of TYPES) {
    const m = new RegExp(`^\\s*${type}\\s*[:=]\\s*(\\d+)\\s*$`, "im").exec(text);
    if (m) out[type] = Number(m[1]);
  }
  if (out.unit == null) {
    const pass = /^\s*#\s*pass\s+(\d+)\s*$/m.exec(text);
    if (pass) out.unit = Number(pass[1]);
    else {
      const mocha = /(\d+)\s+passing/.exec(text);
      if (mocha) out.unit = Number(mocha[1]);
    }
  }
  return out;
}
