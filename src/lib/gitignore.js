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

export function hasManagedGitignore(content) {
  return content.split("\n").some((line) => line.trim() === `${PRODUCT.managedDirName}/*`);
}

export function normalizeManagedGitignore(content, { appendIfMissing = true, replaceLines = [] } = {}) {
  if (!Array.isArray(replaceLines) || replaceLines.some((line) => typeof line !== "string" || line === "")) {
    throw new Error("managed gitignore replacement lines must be non-empty strings");
  }
  const replaceLineSet = new Set([...MANAGED_GITIGNORE_LINE_SET, ...replaceLines]);
  const hadFinalNewline = content.endsWith("\n");
  const lines = content.split("\n");
  if (hadFinalNewline) lines.pop();

  let insertAt = -1;
  const kept = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (replaceLineSet.has(trimmed)) {
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
