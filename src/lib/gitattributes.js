export const SENTI_ANALYSIS_GITATTRIBUTE = ".senti/output/analysis.json merge=ours";

const LEGACY_ANALYSIS_GITATTRIBUTE = ".sdd-forge/output/analysis.json merge=ours";

export function normalizeSentiGitattributes(content, { appendIfMissing = true } = {}) {
  const hadFinalNewline = content.endsWith("\n");
  const lines = content === "" ? [] : content.split("\n");
  if (hadFinalNewline) lines.pop();

  let insertAt = -1;
  const kept = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === SENTI_ANALYSIS_GITATTRIBUTE || trimmed === LEGACY_ANALYSIS_GITATTRIBUTE) {
      if (insertAt === -1) insertAt = kept.length;
      continue;
    }
    kept.push(line);
  }

  if (insertAt === -1 && !appendIfMissing) return content;
  if (insertAt === -1) insertAt = kept.length;
  kept.splice(insertAt, 0, SENTI_ANALYSIS_GITATTRIBUTE);
  return `${kept.join("\n")}\n`;
}
