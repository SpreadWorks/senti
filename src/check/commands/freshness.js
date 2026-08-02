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
  FRESHNESS_SOURCE_POLICY,
  TraversalLimit,
} from "../../lib/file-tree-walker.js";

const FRESHNESS_RESULTS = new Set(["fresh", "stale", "never-built", "indeterminate"]);

export class FreshnessScan {
  #newestMs;

  constructor({ target, policy, newestMs = null, limits = [], complete = limits.length === 0 }) {
    if (typeof target !== "string" || target === "") {
      throw new Error("FreshnessScan target must be a non-empty string");
    }
    if (typeof policy !== "string" || policy === "") {
      throw new Error("FreshnessScan policy must be a non-empty string");
    }
    if (!limits.every((limit) => limit instanceof TraversalLimit)) {
      throw new Error("FreshnessScan limits must be TraversalLimit instances");
    }
    this.target = target;
    this.policy = policy;
    this.#newestMs = newestMs;
    this.limits = Object.freeze([...limits]);
    this.complete = complete;
    Object.freeze(this);
  }

  get hasFiles() {
    return this.#newestMs !== null;
  }

  newestTimestamp() {
    return this.#newestMs === null ? null : new Date(this.#newestMs).toISOString();
  }

  isNewerThan(other) {
    if (!(other instanceof FreshnessScan)) {
      throw new Error("FreshnessScan can only compare another FreshnessScan");
    }
    return this.#newestMs > other.#newestMs;
  }

  toJSON() {
    return {
      target: this.target,
      policy: this.policy,
      complete: this.complete,
      limits: this.limits.map(({ kind, relativePath, maximum }) => ({
        kind,
        relativePath,
        maximum,
      })),
    };
  }

  describeLimits() {
    return this.limits.map((limit) => limit.toString());
  }
}

export class FreshnessResult {
  constructor(result, {
    srcNewest = null,
    docsNewest = null,
    limits = [],
    sourceScan = null,
    docsScan = null,
  } = {}) {
    if (!FRESHNESS_RESULTS.has(result)) {
      throw new Error(`unsupported freshness result: ${result}`);
    }
    this.result = result;
    this.srcNewest = srcNewest;
    this.docsNewest = docsNewest;
    this.limits = Object.freeze([...limits]);
    this.sourceScan = sourceScan;
    this.docsScan = docsScan;
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
      sourceScan: this.sourceScan?.toJSON() ?? null,
      docsScan: this.docsScan?.toJSON() ?? null,
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
 * @param {import("../../lib/file-tree-walker.js").FreshnessSourcePolicy|null} sourcePolicy
 * @returns {Promise<FreshnessScan>}
 */
async function newestMtime(
  dir,
  policy = DEFAULT_SCAN_POLICY,
  sourcePolicy = null,
  excludedDirectory = null
) {
  const traversal = new FileTreeWalker(policy).walk(
    dir,
    sourcePolicy === null
      ? undefined
      : {
        shouldEnterDirectory: (relativePath) => (
          relativePath !== excludedDirectory
          && !relativePath.startsWith(`${excludedDirectory}/`)
          && sourcePolicy.shouldEnterDirectory(relativePath)
        ),
      }
  );
  let newestMs = null;
  const limits = [...traversal.limits];
  for (const relativePath of traversal.files) {
    try {
      const ms = (await fs.promises.stat(path.join(dir, relativePath))).mtimeMs;
      if (newestMs === null || ms > newestMs) newestMs = ms;
    } catch {
      // Preserve stat failures as a user-visible indeterminate scan result.
      limits.push(new TraversalLimit("unreadable", relativePath, null));
    }
  }
  return new FreshnessScan({
    target: dir,
    policy: sourcePolicy?.name ?? "default",
    newestMs,
    limits,
  });
}

/**
 * Run the freshness check.
 *
 * @param {string} workRoot - repo root (docs/ lives here)
 * @param {string} srcRoot  - source root
 * @param {{policy?: import("../../lib/file-tree-walker.js").ScanPolicy}} options
 * @returns {Promise<FreshnessResult>}
 */
async function checkFreshness(workRoot, srcRoot, {
  policy = DEFAULT_SCAN_POLICY,
  sourcePolicy: configuredSourcePolicy = FRESHNESS_SOURCE_POLICY,
} = {}) {
  const docsDir = path.join(workRoot, "docs");
  const sourceRelativeToWork = path.relative(workRoot, srcRoot);
  const sourcePolicy = (
    !sourceRelativeToWork.startsWith(`..${path.sep}`)
    && !path.isAbsolute(sourceRelativeToWork)
  ) ? configuredSourcePolicy.forRelativeRoot(sourceRelativeToWork) : configuredSourcePolicy;

  try {
    await fs.promises.access(docsDir);
  } catch {
    return new FreshnessResult("never-built", {
      sourceScan: new FreshnessScan({
        target: srcRoot,
        policy: sourcePolicy.name,
        complete: false,
      }),
      docsScan: new FreshnessScan({
        target: docsDir,
        policy: "default",
        complete: false,
      }),
    });
  }

  const docsRelativeToSource = path.relative(srcRoot, docsDir);
  const sourceDocsDirectory = (
    docsRelativeToSource !== ""
    && !docsRelativeToSource.startsWith(`..${path.sep}`)
    && !path.isAbsolute(docsRelativeToSource)
  ) ? docsRelativeToSource : null;
  const [srcResult, docsResult] = await Promise.all([
    newestMtime(srcRoot, policy, sourcePolicy, sourceDocsDirectory),
    newestMtime(docsDir, policy),
  ]);

  const srcNewest = srcResult.newestTimestamp();
  const docsNewest = docsResult.newestTimestamp();

  if (!srcResult.complete || !docsResult.complete) {
    return new FreshnessResult("indeterminate", {
      srcNewest,
      docsNewest,
      limits: [
        ...srcResult.describeLimits().map((limit) => `source: ${limit}`),
        ...docsResult.describeLimits().map((limit) => `docs: ${limit}`),
      ],
      sourceScan: srcResult,
      docsScan: docsResult,
    });
  }

  // If source has no files, treat as fresh (nothing to build from)
  if (!srcResult.hasFiles) {
    return new FreshnessResult("fresh", {
      srcNewest,
      docsNewest,
      sourceScan: srcResult,
      docsScan: docsResult,
    });
  }

  // If docs has no files but dir exists, treat as stale
  if (!docsResult.hasFiles) {
    return new FreshnessResult("stale", {
      srcNewest,
      docsNewest,
      sourceScan: srcResult,
      docsScan: docsResult,
    });
  }

  const result = srcResult.isNewerThan(docsResult) ? "stale" : "fresh";
  return new FreshnessResult(result, {
    srcNewest,
    docsNewest,
    sourceScan: srcResult,
    docsScan: docsResult,
  });
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
  const result = await checkFreshness(workRoot, srcRoot, {
    sourcePolicy: FRESHNESS_SOURCE_POLICY.withSpecRoot(container.get("flowSpecRoot")),
  });

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
