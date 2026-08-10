import { PRODUCT } from "./product.js";

export const MANAGED_ANALYSIS_GITATTRIBUTE = `${PRODUCT.managedPath("output", "analysis.json")} merge=ours`;
const LEGACY_MANAGED_ANALYSIS_GITATTRIBUTES = new Set([
  ".sdd-forge/output/analysis.json merge=ours",
  ".senti/output/analysis.json merge=ours",
  ".senrail/output/analysis.json merge=ours",
]);

export function normalizeManagedGitattributes(content, { appendIfMissing = true } = {}) {
  const hadFinalNewline = content.endsWith("\n");
  const lines = content === "" ? [] : content.split("\n");
  if (hadFinalNewline) lines.pop();

  let insertAt = -1;
  const kept = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === MANAGED_ANALYSIS_GITATTRIBUTE) {
      if (insertAt === -1) insertAt = kept.length;
      continue;
    }
    kept.push(line);
  }

  if (insertAt === -1 && !appendIfMissing) return content;
  if (insertAt === -1) insertAt = kept.length;
  kept.splice(insertAt, 0, MANAGED_ANALYSIS_GITATTRIBUTE);
  return `${kept.join("\n")}\n`;
}

/** Replace only recognized legacy managed attributes during explicit migration. */
export function migrateLegacyManagedGitattributes(content) {
  const hadFinalNewline = content.endsWith("\n");
  const lines = content === "" ? [] : content.split("\n");
  if (hadFinalNewline) lines.pop();

  let insertAt = -1;
  const kept = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === MANAGED_ANALYSIS_GITATTRIBUTE || LEGACY_MANAGED_ANALYSIS_GITATTRIBUTES.has(trimmed)) {
      if (insertAt === -1) insertAt = kept.length;
      continue;
    }
    kept.push(line);
  }
  if (insertAt === -1) insertAt = kept.length;
  kept.splice(insertAt, 0, MANAGED_ANALYSIS_GITATTRIBUTE);
  return `${kept.join("\n")}\n`;
}
