/**
 * Shared helpers for Logger / agent-log tests.
 *
 * Centralized so unit tests and the e2e test do not redefine the same
 * date / JSONL parsing helpers (DRY rule from CLAUDE.md).
 */
import fs from "node:fs";

/** YYYY-MM-DD in local time, computed at call time. */
export function todayLocal() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Read a JSONL file and parse each non-empty line into an object. */
export function readJsonl(file) {
  return fs
    .readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}
