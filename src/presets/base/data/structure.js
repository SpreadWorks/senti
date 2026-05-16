/**
 * StructureSource — enrich-based DataSource for project structure.
 *
 * Reads enriched analysis items to generate directory tree and role tables.
 */

/** Collect all items across all analysis categories. */
function allItems(analysis, iterateAnalysisCategories) {
  const items = [];
  for (const [, val] of iterateAnalysisCategories(analysis)) {
    for (const item of val.entries) {
      const p = item?.relPath || item?.file;
      if (p) items.push({ ...item, relPath: p });
    }
  }
  return items;
}

/** Extract parent directories from items and count files per directory. */
function buildDirectoryMap(items) {
  const dirs = new Map();
  for (const item of items) {
    const parts = item.relPath.split("/");
    if (parts.length < 2) continue;
    const dir = parts.slice(0, -1).join("/");
    if (!dirs.has(dir)) dirs.set(dir, { count: 0, roles: new Set() });
    const entry = dirs.get(dir);
    entry.count++;
    if (item.role) entry.roles.add(item.role);
  }
  return dirs;
}

const MAX_EXPAND_DEPTH = 5;

/** Validate analysis and return directory map, or null if not ready. */
function getDirectoryMap(analysis, iterateAnalysisCategories) {
  if (!analysis?.enrichedAt) return null;
  const items = allItems(analysis, iterateAnalysisCategories);
  if (items.length === 0) return null;
  const dirs = buildDirectoryMap(items);
  if (dirs.size === 0) return null;
  return dirs;
}

/**
 * Aggregate dirs map at a given depth, using prefix segments.
 */
function aggregateAtDepth(dirs, depth) {
  const agg = new Map();
  for (const [dir, info] of dirs) {
    const parts = dir.split("/");
    const key = parts.slice(0, depth).join("/");
    if (!agg.has(key)) agg.set(key, { count: 0, roles: new Set() });
    const entry = agg.get(key);
    entry.count += info.count;
    for (const r of info.roles) entry.roles.add(r);
  }
  return agg;
}

export default function register(container) {
  const DataSource = container.get("base.DataSource");
  const iterateAnalysisCategories = container.get("base.iterateAnalysisCategories");

  return class StructureSource extends DataSource {
    /** Directory tree as a code block. */
    tree(analysis, _labels) {
      const dirs = getDirectoryMap(analysis, iterateAnalysisCategories);
      if (!dirs) return null;

      const sorted = [...dirs.keys()].sort();
      const lines = ["```"];
      for (const dir of sorted) {
        const info = dirs.get(dir);
        const roles = [...info.roles].join(", ");
        lines.push(`${dir}/    ${roles ? `(${roles})` : ""}`);
      }
      lines.push("```");
      return lines.join("\n");
    }

    /** Major directories with file counts and roles. */
    directories(analysis, labels) {
      const dirs = getDirectoryMap(analysis, iterateAnalysisCategories);
      if (!dirs) return null;

      let depth = 1;
      let agg = aggregateAtDepth(dirs, depth);

      while (agg.size === 1 && depth < MAX_EXPAND_DEPTH) {
        depth++;
        agg = aggregateAtDepth(dirs, depth);
      }

      const rows = [...agg.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .map(([dir, info]) => [dir, String(info.count), [...info.roles].join(", ") || "—"]);
      const hdr = labels.length >= 2 ? labels : ["Directory", "Files", "Role"];
      return this.toMarkdownTable(rows, hdr);
    }
  };
}
