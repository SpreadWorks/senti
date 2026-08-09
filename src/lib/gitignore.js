import { PRODUCT } from "./product.js";

export const SENRAIL_GITIGNORE_LINES = [
  `${PRODUCT.managedDirName}/*`,
  `!${PRODUCT.managedPath("config.json")}`,
  `!${PRODUCT.managedPath("templates")}/`,
  `!${PRODUCT.managedPath("output")}/`,
  `!${PRODUCT.managedPath("presets")}/`,
  `${PRODUCT.managedPath("output")}/acceptance-report-*.json`,
];

const MANAGED_SENRAIL_GITIGNORE_LINES = new Set([
  ...SENRAIL_GITIGNORE_LINES,
  `${PRODUCT.managedDirName}/`,
]);

export function hasSenrailGitignore(content) {
  return content.split("\n").some((line) => line.trim() === `${PRODUCT.managedDirName}/*`);
}

export function normalizeSenrailGitignore(content, { appendIfMissing = true } = {}) {
  const hadFinalNewline = content.endsWith("\n");
  const lines = content.split("\n");
  if (hadFinalNewline) lines.pop();

  let insertAt = -1;
  const kept = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (MANAGED_SENRAIL_GITIGNORE_LINES.has(trimmed)) {
      if (insertAt === -1) insertAt = kept.length;
      continue;
    }
    kept.push(line);
  }

  if (insertAt === -1 && !appendIfMissing) return content;

  if (insertAt !== -1) {
    kept.splice(insertAt, 0, ...SENRAIL_GITIGNORE_LINES);
  } else if (appendIfMissing) {
    if (kept.length > 0 && kept[kept.length - 1] !== "") kept.push("");
    kept.push(...SENRAIL_GITIGNORE_LINES);
  }

  return `${kept.join("\n")}\n`;
}
