#!/usr/bin/env node
/**
 * src/check/commands/freshness.js
 *
 * senti check freshness — compare docs/ and source modification timestamps.
 *
 * Determines whether `senti docs build` is needed by comparing the newest mtime
 * of files under SENTI_SOURCE_ROOT with the newest mtime of files under docs/.
 *
 * Results:
 *   fresh       — docs/ is up to date (exit 0)
 *   stale       — source is newer than docs/ (exit 1)
 *   never-built — docs/ does not exist (exit 1)
 *   indeterminate — traversal limits prevent a reliable result (exit 1)
 */

import fs from "fs";
import path from "path";
import { sourceRoot, parseArgs } from "../../lib/cli.js";
import { Command } from "../../lib/command.js";
import { EXIT_ERROR } from "../../lib/constants.js";
import {
  DEFAULT_SCAN_POLICY,
  FileTreeWalker,
} from "../../lib/file-tree-walker.js";

const FRESHNESS_RESULTS = new Set(["fresh", "stale", "never-built", "indeterminate"]);

export class FreshnessResult {
  constructor(result, { srcNewest = null, docsNewest = null, limits = [] } = {}) {
    if (!FRESHNESS_RESULTS.has(result)) {
      throw new Error(`unsupported freshness result: ${result}`);
    }
    this.result = result;
    this.srcNewest = srcNewest;
    this.docsNewest = docsNewest;
    this.limits = Object.freeze([...limits]);
    Object.freeze(this);
  }

  get ok() {
    return this.result === "fresh";
  }

  toJSON() {
    return {
      ok: this.ok,
      result: this.result,
      srcNewest: this.srcNewest,
      docsNewest: this.docsNewest,
      limits: this.limits,
    };
  }

  toText() {
    switch (this.result) {
      case "fresh":
        return "fresh — docs/ is up to date";
      case "stale":
        return "stale — source is newer than docs/, run: senti docs build";
      case "never-built":
        return "never-built — docs/ does not exist, run: senti docs build";
      case "indeterminate":
        return `indeterminate — ${this.limits.join(", ")}`;
    }
  }
}

function printHelp() {
  console.log(
    [
      "Usage: senti check freshness [options]",
      "",
      "Compare docs/ and source modification timestamps to determine if",
      "senti docs build is needed.",
      "",
      "Results:",
      "  fresh       docs/ is up to date",
      "  stale       source is newer than docs/ — run senti docs build",
      "  never-built docs/ does not exist — run senti docs build",
      "  indeterminate traversal limits prevent a reliable result",
      "",
      "Exit codes:",
      "  0  fresh",
      "  1  stale, never-built, or indeterminate",
      "",
      "Options:",
      "  --format <text|json>  Output format (default: text)",
      "  -h, --help            Show this help",
    ].join("\n")
  );
}

/**
 * Find the newest mtime (ms) among files in a directory.
 *
 * @param {string} dir
 * @param {import("../../lib/file-tree-walker.js").ScanPolicy} policy
 * @returns {Promise<{ newestMs: number|null, complete: boolean, limits: string[] }>}
 */
async function newestMtime(dir, policy = DEFAULT_SCAN_POLICY) {
  const traversal = new FileTreeWalker(policy).walk(dir);
  let newestMs = null;
  const statFailures = [];
  for (const relativePath of traversal.files) {
    try {
      const ms = (await fs.promises.stat(path.join(dir, relativePath))).mtimeMs;
      if (newestMs === null || ms > newestMs) newestMs = ms;
    } catch (err) {
      statFailures.push(`unreadable file ${relativePath}: ${err.code || err.message}`);
    }
  }
  return {
    newestMs,
    complete: traversal.complete && statFailures.length === 0,
    limits: [
      ...traversal.limits.map((limit) => limit.toString()),
      ...statFailures,
    ],
  };
}

/**
 * Run the freshness check.
 *
 * @param {string} workRoot - repo root (docs/ lives here)
 * @param {string} srcRoot  - source root
 * @param {{policy?: import("../../lib/file-tree-walker.js").ScanPolicy}} options
 * @returns {Promise<FreshnessResult>}
 */
async function checkFreshness(workRoot, srcRoot, { policy = DEFAULT_SCAN_POLICY } = {}) {
  const docsDir = path.join(workRoot, "docs");

  try {
    await fs.promises.access(docsDir);
  } catch {
    return new FreshnessResult("never-built");
  }

  const [srcResult, docsResult] = await Promise.all([
    newestMtime(srcRoot, policy),
    newestMtime(docsDir, policy),
  ]);

  const { newestMs: srcMs } = srcResult;
  const { newestMs: docsMs } = docsResult;

  const srcNewest = srcMs !== null ? new Date(srcMs).toISOString() : null;
  const docsNewest = docsMs !== null ? new Date(docsMs).toISOString() : null;

  if (!srcResult.complete || !docsResult.complete) {
    return new FreshnessResult("indeterminate", {
      srcNewest,
      docsNewest,
      limits: [
        ...srcResult.limits.map((limit) => `source: ${limit}`),
        ...docsResult.limits.map((limit) => `docs: ${limit}`),
      ],
    });
  }

  // If source has no files, treat as fresh (nothing to build from)
  if (srcMs === null) {
    return new FreshnessResult("fresh", { srcNewest, docsNewest });
  }

  // If docs has no files but dir exists, treat as stale
  if (docsMs === null) {
    return new FreshnessResult("stale", { srcNewest, docsNewest });
  }

  const result = srcMs > docsMs ? "stale" : "fresh";
  return new FreshnessResult(result, { srcNewest, docsNewest });
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
    process.stderr.write(`senti check freshness: unknown format '${format}'. Use text or json.\n`);
    process.exit(EXIT_ERROR);
  }

  const workRoot = container.get("root");
  const srcRoot = sourceRoot();
  const result = await checkFreshness(workRoot, srcRoot);

  if (format === "json") {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    if (!result.ok) process.exit(EXIT_ERROR);
    return;
  }

  process.stdout.write(result.toText() + "\n");
  if (!result.ok) process.exit(EXIT_ERROR);
}

export { newestMtime, checkFreshness };

export default class CheckFreshnessCommand extends Command {
  static outputMode = "raw";
  async execute(ctx) {
    return runFreshnessCheck(ctx._rawArgs || [], ctx.container);
  }
}
