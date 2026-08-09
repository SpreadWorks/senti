#!/usr/bin/env node
/**
 * src/check/commands/scan.js
 *
 * senrail check scan — scan coverage report.
 *
 * Shows DataSource coverage: scan.include matched files vs DataSource-analyzed files.
 * Reports uncovered files grouped by extension (actionable summary) followed by the file list.
 */

import fs from "fs";
import path from "path";
import { sourceRoot, parseArgs } from "../../lib/cli.js";
import { senrailOutputDir } from "../../lib/config.js";
import { globToRegex } from "../../lib/glob.js";
import { iterateAnalysisCategories } from "../../docs/lib/analysis-entry.js";
import { pushSection } from "../../lib/formatter.js";
import { Command } from "../../lib/command.js";
import { EXIT_ERROR } from "../../lib/constants.js";
import {
  DEFAULT_SCAN_POLICY,
  FileTreeWalker,
} from "../../lib/file-tree-walker.js";

const DEFAULT_MAX_FILES = 10;
const SKIPPED_DIRECTORY_NAMES = new Set([".git", "node_modules", "vendor", ".senrail"]);

function printHelp() {
  console.log([
    "Usage: senrail check scan [options]",
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
 * Skips .git, node_modules, vendor, .senrail directories.
 * Applies excludeMatchers to relative paths.
 *
 * @param {string} baseDir
 * @param {RegExp[]} includeMatchers
 * @param {RegExp[]} excludeMatchers
 * @param {import("../../lib/file-tree-walker.js").ScanPolicy} policy
 * @returns {import("../../lib/file-tree-walker.js").FileTreeWalkResult}
 */
function walkIncludedFiles(baseDir, includeMatchers, excludeMatchers, policy = DEFAULT_SCAN_POLICY) {
  const walker = new FileTreeWalker(policy);
  return walker.walk(baseDir, {
    shouldEnterDirectory(relativePath) {
      return !SKIPPED_DIRECTORY_NAMES.has(path.posix.basename(relativePath));
    },
    includeFile(relativePath) {
      if (excludeMatchers.some((matcher) => matcher.test(relativePath))) return false;
      return includeMatchers.some((matcher) => matcher.test(relativePath));
    },
  });
}

function coveragePercent(coverage) {
  if (coverage.total === 0) return 0;
  if (coverage.analyzed === coverage.total) return 100;
  return Math.floor((coverage.analyzed * 10_000) / coverage.total) / 100;
}

/**
 * Compute DataSource coverage from config and analysis.json.
 *
 * @param {string} root - work root
 * @param {string} src - source root
 * @param {Object} cfg - senrail config
 * @param {{policy?: import("../../lib/file-tree-walker.js").ScanPolicy}} options
 * @returns {{ dataSourceCoverage: { total: number, analyzed: number, uncovered: string[], complete: boolean, result: string, limits: string[] } }}
 */
function computeCoverage(root, src, cfg, { policy = DEFAULT_SCAN_POLICY } = {}) {
  const outputPath = path.join(senrailOutputDir(root), "analysis.json");
  if (!fs.existsSync(outputPath)) {
    throw new Error(`analysis.json not found: ${outputPath}\nRun 'senrail docs scan' first.`);
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
  const traversal = walkIncludedFiles(src, includeMatchers, excludeMatchers, policy);
  const includedFiles = traversal.files;

  // Files analyzed by any DataSource (from analysis.json entries)
  const analyzedFiles = new Set();
  for (const [, cat] of iterateAnalysisCategories(analysis)) {
    for (const entry of cat.entries) {
      if (entry?.file) analyzedFiles.add(entry.file);
    }
  }

  const uncovered = includedFiles.filter((f) => !analyzedFiles.has(f));
  const analyzed = includedFiles.length - uncovered.length;

  return {
    dataSourceCoverage: {
      total: includedFiles.length,
      analyzed,
      uncovered,
      complete: traversal.complete,
      result: traversal.complete ? "complete" : "indeterminate",
      limits: traversal.limits.map((limit) => limit.toString()),
    },
  };
}

/**
 * Format as plain text.
 */
function formatText(data, showAll) {
  const { dataSourceCoverage: ds } = data;
  const lines = [];
  if (ds.complete) {
    lines.push(`  DataSource: ${ds.analyzed} / ${ds.total} files (${coveragePercent(ds)}%)`);
  } else {
    lines.push(`  DataSource: indeterminate — ${ds.analyzed} / ${ds.total} traversed files`);
    lines.push(`  Limits: ${ds.limits.join(", ")}`);
  }

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

  const lines = [];
  lines.push("# Scan Coverage Report");
  lines.push("");
  lines.push("## DataSource Coverage");
  lines.push("");
  if (ds.complete) {
    lines.push(`**${ds.analyzed} / ${ds.total} files (${coveragePercent(ds)}%)**`);
  } else {
    lines.push(`**indeterminate — ${ds.analyzed} / ${ds.total} traversed files**`);
    lines.push("");
    lines.push(`Limits: ${ds.limits.join(", ")}`);
  }

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
    process.stderr.write(`senrail check scan: unknown format '${format}'. Use text, json, or md.\n`);
    process.exit(EXIT_ERROR);
  }

  const root = container.get("root");
  const src = sourceRoot();

  const cfg = container.get("config");
  if (!cfg || Object.keys(cfg).length === 0) {
    process.stderr.write(`senrail check scan: config is not available\n`);
    process.exit(EXIT_ERROR);
  }

  let data;
  try {
    data = computeCoverage(root, src, cfg);
  } catch (err) {
    process.stderr.write(`senrail check scan: ${err.message}\n`);
    process.exit(EXIT_ERROR);
  }

  const showAll = cli.list;

  if (format === "json") {
    const { dataSourceCoverage: ds } = data;
    const out = {
      dataSourceCoverage: {
        total: ds.total,
        analyzed: ds.analyzed,
        percent: ds.complete ? coveragePercent(ds) : null,
        result: ds.result,
        complete: ds.complete,
        limits: ds.limits,
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

  if (!data.dataSourceCoverage.complete) process.exit(EXIT_ERROR);
}

export { groupByExtension, walkIncludedFiles, coveragePercent, computeCoverage, formatText };

export default class CheckScanCommand extends Command {
  static outputMode = "raw";
  async execute(ctx) {
    return runCheckScan(ctx._rawArgs || [], ctx.container);
  }
}
