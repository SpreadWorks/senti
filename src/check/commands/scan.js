#!/usr/bin/env node
/**
 * src/check/commands/scan.js
 *
 * sdd-forge check scan — scan coverage report.
 *
 * Shows DataSource coverage: scan.include matched files vs DataSource-analyzed files.
 * Reports uncovered files grouped by extension (actionable summary) followed by the file list.
 */

import fs from "fs";
import path from "path";
import { sourceRoot, parseArgs } from "../../lib/cli.js";
import { sddOutputDir } from "../../lib/config.js";
import { globToRegex } from "../../lib/glob.js";
import { iterateAnalysisCategories } from "../../docs/lib/analysis-entry.js";
import { pushSection, DIVIDER } from "../../lib/formatter.js";
import { Command } from "../../lib/command.js";
import { EXIT_ERROR } from "../../lib/constants.js";

const DEFAULT_MAX_FILES = 10;
const MAX_SCAN_DEPTH = 32;
const MAX_SCAN_DIRECTORY_ENTRIES = 10_000;
const MAX_SCAN_FILES = 100_000;

function printHelp() {
  console.log([
    "Usage: sdd-forge check scan [options]",
    "",
    "Show scan coverage report for the current project.",
    "",
    "Options:",
    "  --format <text|json|md>  Output format (default: text)",
    "  --list                   Show all uncovered files (default: up to 10)",
    "  -h, --help               Show this help",
  ].join("\n"));
}

/**
 * Group files by extension, sorted by count descending then extension alphabetically.
 *
 * @param {string[]} files - relative file paths
 * @returns {{ ext: string, count: number }[]}
 */
function groupByExtension(files) {
  const counts = new Map();
  for (const f of files) {
    const ext = path.extname(f);
    counts.set(ext, (counts.get(ext) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([extA, countA], [extB, countB]) => countB - countA || extA.localeCompare(extB))
    .map(([ext, count]) => ({ ext, count }));
}

/**
 * Walk baseDir recursively, collecting files matched by includeMatchers.
 * Skips .git, node_modules, vendor, .sdd-forge directories.
 * Applies excludeMatchers to relative paths.
 *
 * @param {string} baseDir
 * @param {RegExp[]} includeMatchers
 * @param {RegExp[]} excludeMatchers
 * @returns {string[]} relative paths
 */
function walkIncludedFiles(baseDir, includeMatchers, excludeMatchers) {
  const results = [];

  function addResult(relPath) {
    results.push(relPath);
    if (results.length > MAX_SCAN_FILES) {
      throw new Error(`scan matched file count exceeds max ${MAX_SCAN_FILES}`);
    }
  }

  function walk(dir, relPrefix, depth) {
    if (depth > MAX_SCAN_DEPTH) {
      throw new Error(`scan directory depth exceeds max ${MAX_SCAN_DEPTH}: ${relPrefix || "."}`);
    }
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (_) {
      return;
    }
    if (entries.length > MAX_SCAN_DIRECTORY_ENTRIES) {
      throw new Error(`scan directory entry count exceeds max ${MAX_SCAN_DIRECTORY_ENTRIES}: ${relPrefix || "."}`);
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "vendor" || entry.name === ".sdd-forge") continue;
        const nextRel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
        walk(path.join(dir, entry.name), nextRel, depth + 1);
      } else if (entry.isFile()) {
        const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
        if (excludeMatchers.some((m) => m.test(relPath))) continue;
        if (includeMatchers.some((m) => m.test(relPath))) addResult(relPath);
      }
    }
  }

  walk(baseDir, "", 0);
  return results.sort();
}

function coveragePercent(coverage) {
  return coverage.total === 0 ? 0 : Math.round((coverage.analyzed / coverage.total) * 100);
}

/**
 * Compute DataSource coverage from config and analysis.json.
 *
 * @param {string} root - work root
 * @param {string} src - source root
 * @param {Object} cfg - sdd config
 * @returns {{ dataSourceCoverage: { total, analyzed, uncovered } }}
 */
function computeCoverage(root, src, cfg) {
  const outputPath = path.join(sddOutputDir(root), "analysis.json");
  if (!fs.existsSync(outputPath)) {
    throw new Error(`analysis.json not found: ${outputPath}\nRun 'sdd-forge docs scan' first.`);
  }

  let analysis;
  try {
    analysis = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  } catch (err) {
    throw new Error(`Failed to parse analysis.json: ${err.message}`);
  }

  // Resolve scan patterns
  const include = cfg.scan?.include || [];
  const exclude = cfg.scan?.exclude || [];
  const excludeMatchers = exclude.map((p) => globToRegex(p));
  const includeMatchers = include.map((p) => globToRegex(p));

  // scan.include matched files
  const includedFiles = walkIncludedFiles(src, includeMatchers, excludeMatchers);

  // Files analyzed by any DataSource (from analysis.json entries)
  const analyzedFiles = new Set();
  for (const [, cat] of iterateAnalysisCategories(analysis)) {
    for (const entry of cat.entries) {
      if (entry?.file) analyzedFiles.add(entry.file);
    }
  }

  const uncovered = includedFiles.filter((f) => !analyzedFiles.has(f));

  return {
    dataSourceCoverage: {
      total: includedFiles.length,
      analyzed: analyzedFiles.size,
      uncovered,
    },
  };
}

/**
 * Format as plain text.
 */
function formatText(data, showAll) {
  const { dataSourceCoverage: ds } = data;
  const lines = [];
  const dsPct = coveragePercent(ds);

  lines.push(`  DataSource: ${ds.analyzed} / ${ds.total} files (${dsPct}%)`);

  if (ds.uncovered.length > 0) {
    const extGroups = groupByExtension(ds.uncovered);

    pushSection(lines, "Uncovered by extension");
    for (const { ext, count } of extGroups) {
      const label = ext || "(no extension)";
      lines.push(`    ${label.padEnd(12)} ${count} files`);
    }

    pushSection(lines, "Uncovered files");
    const display = showAll ? ds.uncovered : ds.uncovered.slice(0, DEFAULT_MAX_FILES);
    for (const f of display) lines.push(`      - ${f}`);
    if (!showAll && ds.uncovered.length > DEFAULT_MAX_FILES) {
      lines.push(`      ... and ${ds.uncovered.length - DEFAULT_MAX_FILES} more (use --list to show all)`);
    }
  }

  return lines.join("\n");
}

/**
 * Format as Markdown.
 */
function formatMarkdown(data, showAll) {
  const { dataSourceCoverage: ds } = data;
  const dsPct = coveragePercent(ds);

  const lines = [];
  lines.push("# Scan Coverage Report");
  lines.push("");
  lines.push("## DataSource Coverage");
  lines.push("");
  lines.push(`**${ds.analyzed} / ${ds.total} files (${dsPct}%)**`);

  if (ds.uncovered.length > 0) {
    const extGroups = groupByExtension(ds.uncovered);

    lines.push("");
    lines.push("### Uncovered by extension");
    lines.push("");
    for (const { ext, count } of extGroups) {
      const label = ext || "(no extension)";
      lines.push(`- \`${label}\`  ${count} files`);
    }

    lines.push("");
    lines.push("### Uncovered files");
    lines.push("");
    const display = showAll ? ds.uncovered : ds.uncovered.slice(0, DEFAULT_MAX_FILES);
    for (const f of display) lines.push(`- \`${f}\``);
    if (!showAll && ds.uncovered.length > DEFAULT_MAX_FILES) {
      lines.push(`- _...and ${ds.uncovered.length - DEFAULT_MAX_FILES} more (use --list to show all)_`);
    }
  }

  return lines.join("\n");
}

async function runCheckScan(rawArgs, container) {
  const cli = parseArgs(rawArgs, {
    flags: ["--list"],
    options: ["--format"],
    defaults: { list: false, format: "text" },
  });

  if (cli.help) {
    printHelp();
    return;
  }

  const format = cli.format || "text";
  if (!["text", "json", "md"].includes(format)) {
    process.stderr.write(`sdd-forge check scan: unknown format '${format}'. Use text, json, or md.\n`);
    process.exit(EXIT_ERROR);
  }

  const root = container.get("root");
  const src = sourceRoot();

  const cfg = container.get("config");
  if (!cfg || Object.keys(cfg).length === 0) {
    process.stderr.write(`sdd-forge check scan: config is not available\n`);
    process.exit(EXIT_ERROR);
  }

  let data;
  try {
    data = computeCoverage(root, src, cfg);
  } catch (err) {
    process.stderr.write(`sdd-forge check scan: ${err.message}\n`);
    process.exit(EXIT_ERROR);
  }

  const showAll = cli.list;

  if (format === "json") {
    const { dataSourceCoverage: ds } = data;
    const out = {
      dataSourceCoverage: {
        total: ds.total,
        analyzed: ds.analyzed,
        percent: coveragePercent(ds),
        uncovered: showAll ? ds.uncovered : ds.uncovered.slice(0, DEFAULT_MAX_FILES),
        uncoveredTotal: ds.uncovered.length,
        uncoveredByExtension: groupByExtension(ds.uncovered),
      },
    };
    process.stdout.write(JSON.stringify(out, null, 2) + "\n");
  } else if (format === "md") {
    process.stdout.write(formatMarkdown(data, showAll) + "\n");
  } else {
    process.stdout.write(formatText(data, showAll) + "\n");
  }
}

export { groupByExtension, computeCoverage, formatText };

export default class CheckScanCommand extends Command {
  static outputMode = "raw";
  async execute(ctx) {
    return runCheckScan(ctx._rawArgs || [], ctx.container);
  }
}
