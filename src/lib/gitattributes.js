import { PRODUCT } from "./product.js";

export const SENRAIL_ANALYSIS_GITATTRIBUTE = `${PRODUCT.managedPath("output", "analysis.json")} merge=ours`;

export function normalizeSenrailGitattributes(content, { appendIfMissing = true } = {}) {
  const hadFinalNewline = content.endsWith("\n");
  const lines = content === "" ? [] : content.split("\n");
  if (hadFinalNewline) lines.pop();

  let insertAt = -1;
  const kept = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === SENRAIL_ANALYSIS_GITATTRIBUTE) {
      if (insertAt === -1) insertAt = kept.length;
      continue;
    }
    kept.push(line);
  }

  if (insertAt === -1 && !appendIfMissing) return content;
  if (insertAt === -1) insertAt = kept.length;
  kept.splice(insertAt, 0, SENRAIL_ANALYSIS_GITATTRIBUTE);
  return `${kept.join("\n")}\n`;
}
