#!/usr/bin/env node
/**
 * src/check/commands/freshness.js
 *
 * senrail check freshness — compare docs/ and source modification timestamps.
 *
 * Determines whether `senrail docs build` is needed by comparing the newest mtime
 * of files under SENRAIL_SOURCE_ROOT with the newest mtime of files under docs/.
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
  FileTreeWalkResult,
  FRESHNESS_SOURCE_POLICY,
  TraversalLimit,
} from "../../lib/file-tree-walker.js";
import { runGit } from "../../lib/git-helpers.js";

const FRESHNESS_RESULTS = new Set(["fresh", "stale", "never-built", "indeterminate"]);
const GIT_FILE_LIST_MAX_BUFFER = 16 * 1024 * 1024;

/**
 * Resolves the bounded file set that can affect documentation freshness.
 * Git repositories use Git's own tracked/untracked/ignore semantics; other
 * directories retain the filesystem traversal used by project-mode sources.
 */
export class FreshnessFileInventory {
  constructor({ root, policy, sourcePolicy = null, excludedDirectory = null, gitRunner = runGit }) {
    if (typeof root !== "string" || !path.isAbsolute(root)) {
      throw new Error("freshness inventory root must be an absolute path");
    }
    if (!policy || !Number.isSafeInteger(policy.maxFiles) || policy.maxFiles < 1) {
      throw new Error("freshness inventory requires a scan policy");
    }
    if (excludedDirectory != null && (typeof excludedDirectory !== "string" || excludedDirectory === "")) {
      throw new Error("freshness excluded directory must be a non-empty string or null");
    }
    if (typeof gitRunner !== "function") {
      throw new Error("freshness inventory git runner must be a function");
    }
    this.root = path.resolve(root);
    this.policy = policy;
    this.sourcePolicy = sourcePolicy;
    this.excludedDirectory = excludedDirectory?.split(path.sep).join("/") ?? null;
    this.gitRunner = gitRunner;
    Object.freeze(this);
  }

  collect() {
    const gitInventory = this.sourcePolicy === null ? null : this.#collectGitInventory();
    if (gitInventory !== null) return gitInventory;
    return new FileTreeWalker(this.policy).walk(this.root, {
      includeFile: (relativePath) => this.#includes(relativePath),
      shouldEnterDirectory: (relativePath) => this.#includesDirectory(relativePath),
    });
  }

  #collectGitInventory() {
    const repository = this.gitRunner(["rev-parse", "--is-inside-work-tree"], { cwd: this.root });
    if (!repository.ok || repository.stdout.trim() !== "true") return null;

    const listing = this.gitRunner([
      "ls-files",
      "-z",
      "--cached",
      "--others",
      "--exclude-standard",
      "--",
      ".",
    ], {
      cwd: this.root,
      maxBuffer: GIT_FILE_LIST_MAX_BUFFER,
    });
    if (!listing.ok) {
      return new FileTreeWalkResult([], [new TraversalLimit("unreadable", ".git/index", null)]);
    }

    const candidates = [...new Set(listing.stdout.split("\0").filter(Boolean))]
      .sort((left, right) => left.localeCompare(right));
    const files = [];
    for (const relativePath of candidates) {
      if (!this.#includes(relativePath)) continue;
      if (files.length === this.policy.maxFiles) {
        return new FileTreeWalkResult(
          files,
          [new TraversalLimit("files", relativePath, this.policy.maxFiles)],
        );
      }
      files.push(relativePath);
    }
    return new FileTreeWalkResult(files, []);
  }

  #includes(relativePath) {
    if (
      this.excludedDirectory !== null
      && (
        relativePath === this.excludedDirectory
        || relativePath.startsWith(`${this.excludedDirectory}/`)
      )
    ) {
      return false;
    }
    return this.sourcePolicy === null || this.sourcePolicy.shouldIncludeFile(relativePath);
  }

  #includesDirectory(relativePath) {
    if (
      this.excludedDirectory !== null
      && (
        relativePath === this.excludedDirectory
        || relativePath.startsWith(`${this.excludedDirectory}/`)
      )
    ) {
      return false;
    }
    return this.sourcePolicy === null || this.sourcePolicy.shouldEnterDirectory(relativePath);
  }
}

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
        return "stale — source is newer than docs/, run: senrail docs build";
      case "never-built":
        return "never-built — docs/ does not exist, run: senrail docs build";
      case "indeterminate":
        return `indeterminate — ${this.limits.join(", ")}`;
    }
  }
}

function printHelp() {
  console.log(
    [
      "Usage: senrail check freshness [options]",
      "",
      "Compare docs/ and source modification timestamps to determine if",
      "senrail docs build is needed.",
      "",
      "Results:",
      "  fresh       docs/ is up to date",
      "  stale       source is newer than docs/ — run senrail docs build",
      "  never-built docs/ does not exist — run senrail docs build",
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
  excludedDirectory = null,
  gitRunner = runGit,
) {
  const traversal = new FreshnessFileInventory({
    root: dir,
    policy,
    sourcePolicy,
    excludedDirectory,
    gitRunner,
  }).collect();
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
  gitRunner = runGit,
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
    newestMtime(srcRoot, policy, sourcePolicy, sourceDocsDirectory, gitRunner),
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
    process.stderr.write(`senrail check freshness: unknown format '${format}'. Use text or json.\n`);
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
