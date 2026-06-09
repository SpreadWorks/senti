#!/usr/bin/env node
/**
 * src/presets-cmd.js
 *
 * `senti presets list` — display the preset inheritance tree.
 * Uses parent field for hierarchy display.
 */

import fs from "fs";
import path from "path";
import { PRESETS, presetByLeaf } from "./lib/presets.js";
import { EXIT_ERROR } from "./lib/constants.js";

export async function main() {
  const subCmd = process.argv[2];

  if (!subCmd || subCmd === "list") {
    printTree();
  } else if (subCmd === "-h" || subCmd === "--help") {
    const { loadLang } = await import("./lib/config.js");
    const { createI18n } = await import("./lib/i18n.js");
    const { repoRoot } = await import("./lib/cli.js");
    let lang;
    try {
      lang = loadLang(repoRoot());
    } catch (err) {
      process.stderr.write(`[senti presets] lang load failed, falling back to en: ${err?.message}\n`);
      lang = "en";
    }
    const tu = createI18n(lang);
    const h = tu.raw("help.cmdHelp.presets");
    console.log([h.usage, "", `  ${h.desc}`].join("\n"));
  } else {
    console.error(`senti presets: unknown command '${subCmd}'`);
    process.exit(EXIT_ERROR);
  }
}

function printTree() {
  // Build parent → children map
  const childrenMap = new Map();
  for (const p of PRESETS) {
    const parentKey = p.parent || null;
    if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
    if (parentKey !== null || p.key === "base") {
      // base has no parent (null), others have parent
    }
  }
  for (const p of PRESETS) {
    const parentKey = p.parent || null;
    if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
    childrenMap.get(parentKey).push(p);
  }

  // Find root (base — no parent)
  const roots = childrenMap.get(null) || [];
  const base = roots.find((p) => p.key === "base");
  if (!base) {
    console.log("(no base preset found)");
    return;
  }

  function printNode(preset, prefix, isLast, isRoot) {
    const parts = [preset.label];
    if (preset.axis) parts.push(`axis: ${preset.axis}`);
    if (preset.lang) parts.push(`lang: ${preset.lang}`);
    if (preset.aliases.length > 0) parts.push(`aliases: ${preset.aliases.join(", ")}`);
    const scanKeys = Object.keys(preset.scan);
    if (scanKeys.length > 0) parts.push(`scan: [${scanKeys.join(", ")}]`);

    const tplDir = path.join(preset.dir, "templates");
    const hasTpl = fs.existsSync(tplDir);
    const tplMark = hasTpl ? "" : "  [no templates]";

    if (isRoot) {
      console.log(`${preset.key}/  (${parts.join(", ")})${tplMark}`);
    } else {
      const connector = isLast ? "└── " : "├── ";
      console.log(`${prefix}${connector}${preset.key}/  (${parts.join(", ")})${tplMark}`);
    }

    const children = (childrenMap.get(preset.key) || []).sort((a, b) => a.key.localeCompare(b.key));
    const childPrefix = isRoot ? "" : (prefix + (isLast ? "    " : "│   "));
    for (let i = 0; i < children.length; i++) {
      printNode(children[i], childPrefix, i === children.length - 1, false);
    }
  }

  printNode(base, "", true, true);
}
