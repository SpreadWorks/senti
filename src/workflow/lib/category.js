export const VALID_CATEGORIES = new Set(["RESEARCH", "BUG", "ENHANCE", "OTHER"]);

const CATEGORY_PREFIX_RE = /^\[(RESEARCH|BUG|ENHANCE|OTHER)\] /;

export function prefixCategory(title, category) {
  if (category == null) return title;
  if (!VALID_CATEGORIES.has(category)) {
    throw new Error(
      `category must be one of ${[...VALID_CATEGORIES].join(", ")}, got "${category}"`,
    );
  }
  const m = title.match(CATEGORY_PREFIX_RE);
  if (m && m[1] === category) return title;
  return `[${category}] ${title}`;
}
