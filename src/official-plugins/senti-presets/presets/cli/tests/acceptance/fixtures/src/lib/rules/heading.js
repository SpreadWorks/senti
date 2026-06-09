const HEADING_PATTERN = /^(#{1,6})\s+(.+)$/;

/**
 * Match a heading line and return the parsed heading data.
 * @param {string} line
 * @returns {{ level: number, text: string } | null}
 */
export function matchHeading(line) {
  const match = line.match(HEADING_PATTERN);
  if (!match) return null;
  return {
    level: match[1].length,
    text: match[2].trim(),
  };
}
