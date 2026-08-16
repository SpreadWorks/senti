import { PRODUCT } from "./product.js";

export const MANAGED_ANALYSIS_GITATTRIBUTE = `${PRODUCT.managedPath("output", "analysis.json")} merge=ours`;
export function normalizeManagedGitattributes(content, { appendIfMissing = true, replaceLines = [] } = {}) {
  if (!Array.isArray(replaceLines) || replaceLines.some((line) => typeof line !== "string" || line === "")) {
    throw new Error("managed gitattributes replacement lines must be non-empty strings");
  }
  const replaceLineSet = new Set([MANAGED_ANALYSIS_GITATTRIBUTE, ...replaceLines]);
  const hadFinalNewline = content.endsWith("\n");
  const lines = content === "" ? [] : content.split("\n");
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
  if (insertAt === -1) insertAt = kept.length;
  kept.splice(insertAt, 0, MANAGED_ANALYSIS_GITATTRIBUTE);
  return `${kept.join("\n")}\n`;
}
