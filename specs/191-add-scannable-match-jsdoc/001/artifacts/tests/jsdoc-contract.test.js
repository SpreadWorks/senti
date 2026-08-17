#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const targetPath = resolve(__dirname, "../../../src/docs/lib/scan-source.js");
const MAX_BYTES = 64 * 1024;
const raw = readFileSync(targetPath, "utf8");
if (raw.length > MAX_BYTES) {
  console.error(`FAIL: target file exceeds ${MAX_BYTES} bytes (got ${raw.length})`);
  process.exit(1);
}
const lines = raw.split("\n");

function extractJsdocBeforeMatch(lines) {
  const matchLineIdx = lines.findIndex((l) => /^\s*match\s*\(relPath\)\s*\{/.test(l));
  if (matchLineIdx === -1) return null;
  const endIdx = lines.slice(0, matchLineIdx).reduce(
    (acc, l, i) => (l.trim().endsWith("*/") ? i : acc),
    -1,
  );
  if (endIdx === -1) return null;
  const startIdx = lines.slice(0, endIdx).reduce(
    (acc, l, i) => (l.trim().startsWith("/**") ? i : acc),
    -1,
  );
  if (startIdx === -1 || startIdx >= endIdx) return null;
  return lines.slice(startIdx, endIdx + 1).join("\n");
}

const jsdoc = extractJsdocBeforeMatch(lines);
if (!jsdoc) {
  console.error("FAIL: could not locate Scannable mixin match() JSDoc block");
  process.exit(1);
}

const required = [
  { key: "SDD_SOURCE_ROOT", label: "scan root identifier" },
  { key: "POSIX", label: "POSIX separator wording" },
  { key: "./", label: "no-leading-dot-slash wording" },
];

const missing = required.filter((r) => !jsdoc.includes(r.key));
if (missing.length > 0) {
  console.error("FAIL: Scannable.match() JSDoc missing required keywords:");
  for (const m of missing) console.error(`  - ${m.key} (${m.label})`);
  process.exit(1);
}

console.log("PASS: Scannable.match() JSDoc contains all required keywords");
