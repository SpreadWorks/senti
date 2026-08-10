import { PRODUCT } from "./product.js";

export const MANAGED_GITIGNORE_LINES = [
  `${PRODUCT.managedDirName}/*`,
  `!${PRODUCT.managedPath("config.json")}`,
  `!${PRODUCT.managedPath("templates")}/`,
  `!${PRODUCT.managedPath("output")}/`,
  `!${PRODUCT.managedPath("presets")}/`,
  `${PRODUCT.managedPath("output")}/acceptance-report-*.json`,
];

const MANAGED_GITIGNORE_LINE_SET = new Set([
  ...MANAGED_GITIGNORE_LINES,
  `${PRODUCT.managedDirName}/`,
]);

const LEGACY_MANAGED_DIRECTORY_NAMES = Object.freeze([".sdd-forge", ".senti", ".senrail"]);

function managedLinesFor(directoryName) {
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

const LEGACY_MANAGED_GITIGNORE_LINE_SET = new Set(
  LEGACY_MANAGED_DIRECTORY_NAMES.flatMap(managedLinesFor),
);

export function hasManagedGitignore(content) {
  return content.split("\n").some((line) => line.trim() === `${PRODUCT.managedDirName}/*`);
}

export function normalizeManagedGitignore(content, { appendIfMissing = true } = {}) {
  const hadFinalNewline = content.endsWith("\n");
  const lines = content.split("\n");
  if (hadFinalNewline) lines.pop();

  let insertAt = -1;
  const kept = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (MANAGED_GITIGNORE_LINE_SET.has(trimmed)) {
      if (insertAt === -1) insertAt = kept.length;
      continue;
    }
    kept.push(line);
  }

  if (insertAt === -1 && !appendIfMissing) return content;

  if (insertAt !== -1) {
    kept.splice(insertAt, 0, ...MANAGED_GITIGNORE_LINES);
  } else if (appendIfMissing) {
    if (kept.length > 0 && kept[kept.length - 1] !== "") kept.push("");
    kept.push(...MANAGED_GITIGNORE_LINES);
  }

  return `${kept.join("\n")}\n`;
}

/**
 * Replace only the known managed ignore block from a previous product name.
 * This is deliberately migration-only: normal runtime never needs legacy
 * directory names.
 */
export function migrateLegacyManagedGitignore(content) {
  const hadFinalNewline = content.endsWith("\n");
  const lines = content.split("\n");
  if (hadFinalNewline) lines.pop();

  let insertAt = -1;
  const kept = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (MANAGED_GITIGNORE_LINE_SET.has(trimmed) || LEGACY_MANAGED_GITIGNORE_LINE_SET.has(trimmed)) {
      if (insertAt === -1) insertAt = kept.length;
      continue;
    }
    kept.push(line);
  }
  if (insertAt === -1) {
    if (kept.length > 0 && kept.at(-1) !== "") kept.push("");
    insertAt = kept.length;
  }
  kept.splice(insertAt, 0, ...MANAGED_GITIGNORE_LINES);
  return `${kept.join("\n")}\n`;
}
