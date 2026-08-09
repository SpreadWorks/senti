#!/usr/bin/env node
/**
 * src/presets-cmd.js
 *
 * `senrail presets list` — display the preset inheritance tree.
 * Uses parent field for hierarchy display.
 */

import fs from "fs";
import path from "path";
import { listPresets } from "./lib/presets.js";
import { EXIT_ERROR } from "./lib/constants.js";
import { repoRoot } from "./lib/cli.js";

export const MAX_PRESET_TREE_ITEMS = 512;
export const MAX_PRESET_TREE_DEPTH = 16;

export async function main() {
  const subCmd = process.argv[2];

  if (!subCmd || subCmd === "list") {
    try {
      printTree();
    } catch (err) {
      console.error(`senrail presets: ${err.message}`);
      process.exit(EXIT_ERROR);
    }
  } else if (subCmd === "-h" || subCmd === "--help") {
    const { loadLang } = await import("./lib/config.js");
    const { createI18n } = await import("./lib/i18n.js");
    let lang;
    try {
      lang = loadLang(repoRoot());
    } catch (err) {
      process.stderr.write(`[senrail presets] lang load failed, falling back to en: ${err?.message}\n`);
      lang = "en";
    }
    const tu = createI18n(lang);
    const h = tu.raw("help.cmdHelp.presets");
    console.log([h.usage, "", `  ${h.desc}`].join("\n"));
  } else {
    console.error(`senrail presets: unknown command '${subCmd}'`);
    process.exit(EXIT_ERROR);
  }
}

function printTree() {
  console.log(formatPresetTree(listPresets(repoRoot(), { maxEntries: MAX_PRESET_TREE_ITEMS })));
}

export function formatPresetTree(presets) {
  if (presets.length > MAX_PRESET_TREE_ITEMS) {
    throw new Error(`preset tree exceeds ${MAX_PRESET_TREE_ITEMS} entries`);
  }

  const childrenMap = new Map();
  for (const p of presets) {
    const parentKey = p.parent || null;
    if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
    childrenMap.get(parentKey).push(p);
  }

  const roots = childrenMap.get(null) || [];
  const base = roots.find((p) => p.key === "base");
  if (!base) {
    return "(no base preset found)";
  }
  const lines = [];

  function formatNode(preset, prefix, isLast, isRoot, depth, visited) {
    if (depth > MAX_PRESET_TREE_DEPTH) return;
    if (visited.has(preset.key)) return;
    const nextVisited = new Set(visited);
    nextVisited.add(preset.key);
    const parts = [preset.label];
    if (preset.axis) parts.push(`axis: ${preset.axis}`);
    if (preset.lang) parts.push(`lang: ${preset.lang}`);
    const aliases = preset.aliases || [];
    if (aliases.length > 0) parts.push(`aliases: ${aliases.join(", ")}`);
    const scanKeys = Object.keys(preset.scan || {});
    if (scanKeys.length > 0) parts.push(`scan: [${scanKeys.join(", ")}]`);

    const tplDir = path.join(preset.dir, "templates");
    const hasTpl = fs.existsSync(tplDir);
    const tplMark = hasTpl ? "" : "  [no templates]";

    if (isRoot) {
      lines.push(`${preset.key}/  (${parts.join(", ")})${tplMark}`);
    } else {
      const connector = isLast ? "└── " : "├── ";
      lines.push(`${prefix}${connector}${preset.key}/  (${parts.join(", ")})${tplMark}`);
    }

    const children = (childrenMap.get(preset.key) || []).sort((a, b) => a.key.localeCompare(b.key));
    const childPrefix = isRoot ? "" : (prefix + (isLast ? "    " : "│   "));
    for (let i = 0; i < children.length; i++) {
      formatNode(children[i], childPrefix, i === children.length - 1, false, depth + 1, nextVisited);
    }
  }

  formatNode(base, "", true, true, 0, new Set());
  return lines.join("\n");
}
