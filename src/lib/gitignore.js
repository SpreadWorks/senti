export const SENTI_GITIGNORE_LINES = [
  ".senti/*",
  "!.senti/config.json",
  "!.senti/templates/",
  "!.senti/output/",
  "!.senti/presets/",
  ".senti/output/acceptance-report-*.json",
];

const LEGACY_SDD_GITIGNORE_LINES = new Set([
  ".sdd-forge/*",
  "!.sdd-forge/config.json",
  "!.sdd-forge/templates/",
  "!.sdd-forge/output/",
  "!.sdd-forge/presets/",
  ".sdd-forge/output/acceptance-report-*.json",
  ".sdd-forge/",
  ".sdd-forge/worktree",
  ".sdd-forge/worktree/",
]);

const MANAGED_SENTI_GITIGNORE_LINES = new Set([
  ...SENTI_GITIGNORE_LINES,
  ".senti/",
  ...LEGACY_SDD_GITIGNORE_LINES,
]);

export function hasSentiGitignore(content) {
  return content.split("\n").some((line) => line.trim() === ".senti/*");
}

export function normalizeSentiGitignore(content, { appendIfMissing = true } = {}) {
  const hadFinalNewline = content.endsWith("\n");
  const lines = content.split("\n");
  if (hadFinalNewline) lines.pop();

  let insertAt = -1;
  let hadLegacyEntries = false;
  const kept = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (MANAGED_SENTI_GITIGNORE_LINES.has(trimmed)) {
      if (insertAt === -1) insertAt = kept.length;
      if (LEGACY_SDD_GITIGNORE_LINES.has(trimmed)) hadLegacyEntries = true;
      continue;
    }
    kept.push(line);
  }

  if (insertAt === -1 && !appendIfMissing) return content;

  if (insertAt !== -1) {
    kept.splice(insertAt, 0, ...SENTI_GITIGNORE_LINES, ...(hadLegacyEntries ? [".sdd-forge/"] : []));
  } else if (appendIfMissing) {
    if (kept.length > 0 && kept[kept.length - 1] !== "") kept.push("");
    kept.push(...SENTI_GITIGNORE_LINES);
  }

  return `${kept.join("\n")}\n`;
}
