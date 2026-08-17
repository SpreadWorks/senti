/** Documentation scan-pattern resolution, isolated from the hot scanner path. */

import { presetByLeaf } from "../../lib/presets.js";

export function resolveDocumentationScanPatterns({ config, type, root }) {
  if (config.scan) return { include: config.scan.include || [], exclude: config.scan.exclude || [] };
  const seenInclude = new Set();
  const seenExclude = new Set();
  const include = [];
  const exclude = [];
  for (const presetType of (Array.isArray(type) ? type : [type])) {
    const scan = presetByLeaf(presetType, root)?.scan;
    if (!scan) continue;
    for (const pattern of scan.include || []) {
      if (!seenInclude.has(pattern)) { seenInclude.add(pattern); include.push(pattern); }
    }
    for (const pattern of scan.exclude || []) {
      if (!seenExclude.has(pattern)) { seenExclude.add(pattern); exclude.push(pattern); }
    }
  }
  return { include, exclude };
}
