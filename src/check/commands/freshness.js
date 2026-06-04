#!/usr/bin/env node
/**
 * src/check/commands/freshness.js
 *
 * sdd-forge check freshness — compare docs/ and source modification timestamps.
 *
 * Determines whether `sdd-forge docs build` is needed by comparing the newest mtime
 * of files under SDD_SOURCE_ROOT with the newest mtime of files under docs/.
 *
 * Results:
 *   fresh       — docs/ is up to date (exit 0)
 *   stale       — source is newer than docs/ (exit 1)
 *   never-built — docs/ does not exist (exit 1)
 */

import fs from "fs";
import path from "path";
import { sourceRoot, parseArgs } from "../../lib/cli.js";
import { Command } from "../../lib/command.js";
import { EXIT_ERROR } from "../../lib/constants.js";

const FILE_LIMIT = 10_000;

function printHelp() {
  console.log(
    [
      "Usage: sdd-forge check freshness [options]",
      "",
      "Compare docs/ and source modification timestamps to determine if",
      "sdd-forge docs build is needed.",
      "",
      "Results:",
      "  fresh       docs/ is up to date",
      "  stale       source is newer than docs/ — run sdd-forge docs build",
      "  never-built docs/ does not exist — run sdd-forge docs build",
      "",
      "Exit codes:",
      "  0  fresh",
      "  1  stale or never-built",
      "",
      "Options:",
      "  --format <text|json>  Output format (default: text)",
      "  -h, --help            Show this help",
    ].join("\n")
  );
}

/**
 * Recursively walk a directory and collect file paths, up to `limit` entries.
 *
 * @param {string} dir
 * @param {number} limit
 * @returns {Promise<{ files: string[], truncated: boolean }>}
 */
async function walkFiles(dir, limit) {
  const files = [];
  let truncated = false;

  async function walk(current) {
    if (truncated) return;
    let entries;
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (truncated) return;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        files.push(full);
        if (files.length >= limit) {
          truncated = true;
          return;
        }
      }
    }
  }

  await walk(dir);
  return { files, truncated };
}

/**
 * Find the newest mtime (ms) among files in a directory.
 *
 * @param {string} dir
 * @param {number} limit
 * @returns {Promise<{ newestMs: number|null, truncated: boolean }>}
 */
async function newestMtime(dir, limit) {
  const { files, truncated } = await walkFiles(dir, limit);
  let newestMs = null;
  for (const f of files) {
    try {
      const ms = (await fs.promises.stat(f)).mtimeMs;
      if (newestMs === null || ms > newestMs) newestMs = ms;
    } catch {
      // skip unreadable files
    }
  }
  return { newestMs, truncated };
}

/**
 * Run the freshness check.
 *
 * @param {string} workRoot - repo root (docs/ lives here)
 * @param {string} srcRoot  - source root
 * @returns {Promise<{ result: "fresh"|"stale"|"never-built", srcNewest: string|null, docsNewest: string|null }>}
 */
async function checkFreshness(workRoot, srcRoot) {
  const docsDir = path.join(workRoot, "docs");

  try {
    await fs.promises.access(docsDir);
  } catch {
    return { result: "never-built", srcNewest: null, docsNewest: null };
  }

  const [srcResult, docsResult] = await Promise.all([
    newestMtime(srcRoot, FILE_LIMIT),
    newestMtime(docsDir, FILE_LIMIT),
  ]);

  const { newestMs: srcMs, truncated: srcTruncated } = srcResult;
  const { newestMs: docsMs, truncated: docsTruncated } = docsResult;

  if (srcTruncated) {
    process.stderr.write(
      `sdd-forge check freshness: warning — source file limit (${FILE_LIMIT}) reached, result may be approximate\n`
    );
  }
  if (docsTruncated) {
    process.stderr.write(
      `sdd-forge check freshness: warning — docs file limit (${FILE_LIMIT}) reached, result may be approximate\n`
    );
  }

  const srcNewest = srcMs !== null ? new Date(srcMs).toISOString() : null;
  const docsNewest = docsMs !== null ? new Date(docsMs).toISOString() : null;

  // If source has no files, treat as fresh (nothing to build from)
  if (srcMs === null) {
    return { result: "fresh", srcNewest, docsNewest };
  }

  // If docs has no files but dir exists, treat as stale
  if (docsMs === null) {
    return { result: "stale", srcNewest, docsNewest };
  }

  const result = srcMs > docsMs ? "stale" : "fresh";
  return { result, srcNewest, docsNewest };
}

async function runFreshnessCheck(rawArgs, container) {
  const cli = parseArgs(rawArgs, {
    options: ["--format"],
    defaults: { format: "text" },
  });

  if (cli.help) {
    printHelp();
    return;
  }

  const format = cli.format;
  if (!["text", "json"].includes(format)) {
    process.stderr.write(`sdd-forge check freshness: unknown format '${format}'. Use text or json.\n`);
    process.exit(EXIT_ERROR);
  }

  const workRoot = container.get("root");
  const srcRoot = sourceRoot();
  const { result, srcNewest, docsNewest } = await checkFreshness(workRoot, srcRoot);

  const ok = result === "fresh";

  if (format === "json") {
    process.stdout.write(JSON.stringify({ ok, result, srcNewest, docsNewest }, null, 2) + "\n");
    if (!ok) process.exit(EXIT_ERROR);
    return;
  }

  // text format
  switch (result) {
    case "fresh":
      process.stdout.write("fresh — docs/ is up to date\n");
      break;
    case "stale":
      process.stdout.write("stale — source is newer than docs/, run: sdd-forge docs build\n");
      process.exit(EXIT_ERROR);
      break;
    case "never-built":
      process.stdout.write("never-built — docs/ does not exist, run: sdd-forge docs build\n");
      process.exit(EXIT_ERROR);
      break;
  }
}

export { checkFreshness };

export default class CheckFreshnessCommand extends Command {
  static outputMode = "raw";
  async execute(ctx) {
    return runFreshnessCheck(ctx._rawArgs || [], ctx.container);
  }
}
