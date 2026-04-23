/**
 * src/flow/lib/issue-body-cache.js
 *
 * Shared helpers for the Issue-body cache lifecycle (spec 225).
 * Centralizes the fetch → minify → truncate → persist flow so that
 * `flow set init`, `flow prepare`, and `flow set issue` stay aligned.
 */

import fs from "fs";
import path from "path";
import { fetchIssue } from "./fetch-issue.js";
import { minify as minifyMd, truncate as truncateMd } from "../../docs/lib/lang/md.js";

/**
 * Fetch the Issue body via gh (lenient), normalize it (minify + truncate),
 * and return the resulting string. Returns null when:
 *   - gh fails (fetch-issue already emits a warning to stderr)
 *   - body is missing or empty after normalization
 */
export function fetchNormalizedIssueBody(number, root) {
  const fetched = fetchIssue(number, root, { strict: false });
  if (!fetched || typeof fetched.body !== "string" || fetched.body.length === 0) {
    return null;
  }
  const normalized = truncateMd(minifyMd(fetched.body));
  return normalized && normalized.length > 0 ? normalized : null;
}

/**
 * Write `body` to `<specDir>/issue.md`. Overwrites any existing file.
 * No-op when body is empty/null (caller already decided not to cache).
 */
export function writeIssueMd(specDir, body) {
  if (!body) return;
  fs.writeFileSync(path.join(specDir, "issue.md"), body);
}
