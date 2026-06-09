const FENCE_OPEN_PATTERN = /^(`{3,})(\w*)$/;
const FENCE_CLOSE_PATTERN = /^`{3,}$/;

/**
 * Match a code block fence opening or closing line.
 * @param {string} line
 * @returns {{ type: 'open' | 'close', lang?: string, fenceLength: number } | null}
 */
export function matchCodeBlock(line) {
  const openMatch = line.match(FENCE_OPEN_PATTERN);
  if (openMatch) {
    return {
      type: 'open',
      lang: openMatch[2] || null,
      fenceLength: openMatch[1].length,
    };
  }

  const closeMatch = line.match(FENCE_CLOSE_PATTERN);
  if (closeMatch) {
    return {
      type: 'close',
      fenceLength: closeMatch[0].length,
    };
  }

  return null;
}
