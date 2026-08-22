import { existsSync, readdirSync, statSync } from "node:fs";
import { isAbsolute, parse, relative, resolve, sep } from "node:path";
import { globToRegex } from "../../src/lib/glob.js";

function toGlobPath(filePath) {
  return filePath.split(sep).join("/");
}

function traversalRoot(absolutePattern) {
  const wildcard = absolutePattern.indexOf("*");
  if (wildcard === -1) return absolutePattern;
  const staticPrefix = absolutePattern.slice(0, wildcard);
  const root = staticPrefix.slice(0, staticPrefix.lastIndexOf(sep));
  return root || parse(absolutePattern).root;
}

export function globFilesSync(pattern, {
  cwd = process.cwd(),
  maxDepth = 32,
  maxEntries = 10000,
} = {}) {
  if (typeof pattern !== "string" || pattern.length === 0) {
    throw new TypeError("glob pattern must be a non-empty string");
  }

  const absoluteInput = isAbsolute(pattern);
  const absolutePattern = resolve(cwd, pattern);
  const matcher = globToRegex(toGlobPath(absolutePattern));
  const root = traversalRoot(absolutePattern);
  if (!existsSync(root)) return [];

  const matches = [];
  let visitedEntries = 0;

  const addIfMatched = (candidate) => {
    if (!matcher.test(toGlobPath(candidate))) return;
    matches.push(absoluteInput ? candidate : relative(cwd, candidate));
  };

  const visit = (dir, depth) => {
    if (depth > maxDepth) throw new Error(`glob traversal depth exceeds ${maxDepth}`);
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      visitedEntries += 1;
      if (visitedEntries > maxEntries) throw new Error(`glob traversal entry limit exceeded (${maxEntries})`);
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) visit(full, depth + 1);
      else if (entry.isFile()) addIfMatched(full);
    }
  };

  const rootStat = statSync(root);
  if (rootStat.isDirectory()) visit(root, 0);
  else if (rootStat.isFile()) addIfMatched(root);
  return matches.sort();
}
