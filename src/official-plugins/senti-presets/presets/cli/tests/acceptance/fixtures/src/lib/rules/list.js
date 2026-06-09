const UNORDERED_PATTERN = /^(\s*)([-*+])\s+(.+)$/;
const ORDERED_PATTERN = /^(\s*)(\d+)\.\s+(.+)$/;

/**
 * Match a list item line and return parsed list data.
 * @param {string} line
 * @returns {{ ordered: boolean, indent: number, text: string } | null}
 */
export function matchList(line) {
  const unordered = line.match(UNORDERED_PATTERN);
  if (unordered) {
    return {
      ordered: false,
      indent: unordered[1].length,
      marker: unordered[2],
      text: unordered[3],
    };
  }

  const ordered = line.match(ORDERED_PATTERN);
  if (ordered) {
    return {
      ordered: true,
      indent: ordered[1].length,
      number: parseInt(ordered[2], 10),
      text: ordered[3],
    };
  }

  return null;
}
