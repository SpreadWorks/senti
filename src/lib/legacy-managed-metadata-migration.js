/**
 * Retired managed-root metadata rewriting.
 *
 * This is intentionally imported only by the explicit layout migration.
 * Runtime code must not import this boundary: normal setup/normalizer paths
 * see current product metadata only and never interpret a retired directory
 * name.
 */

import { normalizeManagedGitattributes } from "./gitattributes.js";
import { normalizeManagedGitignore } from "./gitignore.js";
import { LEGACY_MANAGED_DIRECTORY_NAMES } from "./legacy-managed-directory-migration.js";

function legacyGitignoreLines(directoryName) {
  return [
    `${directoryName}/*`,
    `!${directoryName}/config.json`,
    `!${directoryName}/templates/`,
    `!${directoryName}/output/`,
    `!${directoryName}/presets/`,
    `${directoryName}/output/acceptance-report-*.json`,
    `${directoryName}/`,
  ];
}

const LEGACY_GITIGNORE_LINES = new Set(LEGACY_MANAGED_DIRECTORY_NAMES.flatMap(legacyGitignoreLines));
const LEGACY_GITATTRIBUTES = new Set(
  LEGACY_MANAGED_DIRECTORY_NAMES.map((directoryName) => `${directoryName}/output/analysis.json merge=ours`),
);

/** Rewrite retired ignore blocks only while the one-way layout migration owns the root. */
export function migrateLegacyManagedGitignore(content) {
  return normalizeManagedGitignore(content, { replaceLines: [...LEGACY_GITIGNORE_LINES] });
}

/** Rewrite retired attributes only while the one-way layout migration owns the root. */
export function migrateLegacyManagedGitattributes(content) {
  return normalizeManagedGitattributes(content, { replaceLines: [...LEGACY_GITATTRIBUTES] });
}
