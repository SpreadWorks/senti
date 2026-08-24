#!/usr/bin/env node
/**
 * src/check/commands/freshness.js
 *
 * sennel check freshness — compare docs/ and source modification timestamps.
 *
 * Determines whether `sennel docs build` is needed by comparing the newest mtime
 * of files under SENNEL_SOURCE_ROOT with the newest mtime of files under docs/.
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
  TraversalLimit,
} from "../../lib/file-tree-walker.js";
import {
  DocumentationSourceSelection,
  isDocumentationScannerExcludedPath,
} from "../../docs/lib/source-selection.js";
import { resolveDocumentationScanPatterns } from "../../docs/lib/scan-patterns.js";
import { DocumentationBuildInputSelection } from "../lib/documentation-build-input-selection.js";
import { resolveDocsContext } from "../../docs/lib/docs-context.js";
import { runGit } from "../../lib/git-helpers.js";

const FRESHNESS_RESULTS = new Set(["fresh", "stale", "never-built", "indeterminate"]);
const GIT_FILE_LIST_MAX_BUFFER = 16 * 1024 * 1024;

/**
 * Resolves the bounded material-input set that can affect documentation
 * freshness. Git contributes tracked/non-ignored files only when they match
 * the documentation scan or a supplemental build input. The filesystem pass
 * then adds explicitly selected source plus managed build controls, including
 * ignored paths that `docs build` actually consumes.
 */
export class FreshnessFileInventory {
  constructor({ root, policy, sourceSelection = null, excludedDirectory = null, gitRunner = runGit }) {
    if (typeof root !== "string" || !path.isAbsolute(root)) {
      throw new Error("freshness inventory root must be an absolute path");
    }
    if (!policy || !Number.isSafeInteger(policy.maxFiles) || policy.maxFiles < 1) {
      throw new Error("freshness inventory requires a scan policy");
    }
    if (excludedDirectory != null && (typeof excludedDirectory !== "string" || excludedDirectory === "")) {
      throw new Error("freshness excluded directory must be a non-empty string or null");
    }
    if (sourceSelection !== null && !(sourceSelection instanceof DocumentationBuildInputSelection)) {
      throw new Error("freshness source selection must be a DocumentationBuildInputSelection or null");
    }
    if (typeof gitRunner !== "function") {
      throw new Error("freshness inventory git runner must be a function");
    }
    this.root = path.resolve(root);
    this.policy = policy;
    this.sourceSelection = sourceSelection;
    this.excludedDirectory = excludedDirectory?.split(path.sep).join("/") ?? null;
    this.gitRunner = gitRunner;
    Object.freeze(this);
  }

  collect() {
    const gitInventory = this.sourceSelection === null ? null : this.#collectGitInventory();
    if (gitInventory !== null) return gitInventory;
    return new FileTreeWalker(this.policy).walk(this.root, {
      includeFile: (relativePath) => this.#includesFilesystem(relativePath),
      shouldEnterDirectory: (relativePath) => this.#includesFilesystemDirectory(relativePath),
    });
  }

  #collectGitInventory() {
    const repository = this.gitRunner(["rev-parse", "--is-inside-work-tree"], { cwd: this.root });
    if (!repository.ok || repository.stdout.trim() !== "true") return null;

    const pathspec = this.#conservativeGitPathspec();
    let conservative = [];
    if (pathspec.length > 0) {
      const listing = this.gitRunner([
        "ls-files",
        "-z",
        "--cached",
        "--others",
        "--exclude-standard",
        "--",
        ...pathspec,
      ], {
        cwd: this.root,
        maxBuffer: GIT_FILE_LIST_MAX_BUFFER,
      });
      if (!listing.ok) {
        return new FileTreeWalkResult([], [new TraversalLimit("unreadable", ".git/index", null)]);
      }
      conservative = listing.stdout.split("\0").filter(Boolean)
        .filter((relativePath) => this.#includesConservative(relativePath));
    }
    const explicit = this.#collectExplicitFilesystemCandidates();
    const limits = [...explicit.limits];
    const candidates = [...new Set([...conservative, ...explicit.files])]
      .sort((left, right) => left.localeCompare(right));
    const files = [];
    for (const relativePath of candidates) {
      if (files.length === this.policy.maxFiles) {
        limits.push(new TraversalLimit("files", relativePath, this.policy.maxFiles));
        break;
      }
      files.push(relativePath);
    }
    return new FileTreeWalkResult(files, limits);
  }

  #collectExplicitFilesystemCandidates() {
    return new FileTreeWalker(this.policy).walk(this.root, {
      includeFile: (relativePath) => this.#includesExplicitOrManaged(relativePath),
      shouldEnterDirectory: (relativePath) => this.#includesExplicitOrManagedDirectory(relativePath),
    });
  }

  #conservativeGitPathspec() {
    const pathspec = this.sourceSelection.conservativeGitPathspec();
    if (pathspec.length === 0 || this.excludedDirectory === null) return pathspec;
    return [...pathspec, `:(exclude,literal)${this.excludedDirectory}`];
  }

  #isExcludedDirectory(relativePath) {
    if (
      this.excludedDirectory !== null
      && (
        relativePath === this.excludedDirectory
        || relativePath.startsWith(`${this.excludedDirectory}/`)
      )
    ) {
      return true;
    }
    return this.sourceSelection !== null
      && isDocumentationScannerExcludedPath(relativePath);
  }

  #includesConservative(relativePath) {
    if (this.#isExcludedDirectory(relativePath)) return false;
    return this.sourceSelection.matchesConservativeFile(relativePath);
  }

  #includesExplicitOrManaged(relativePath) {
    if (this.#isExcludedDirectory(relativePath)) return false;
    return this.sourceSelection.matchesExplicitOrManagedFile(relativePath);
  }

  #includesFilesystem(relativePath) {
    if (this.#isExcludedDirectory(relativePath)) return false;
    return this.sourceSelection === null
      || this.sourceSelection.matchesConservativeFile(relativePath)
      || this.sourceSelection.matchesExplicitOrManagedFile(relativePath);
  }

  #includesFilesystemDirectory(relativePath) {
    if (this.#isExcludedDirectory(relativePath)) return false;
    return this.sourceSelection === null
      || this.sourceSelection.shouldEnterConservativeDirectory(relativePath)
      || this.sourceSelection.shouldEnterExplicitOrManagedDirectory(relativePath);
  }

  #includesExplicitOrManagedDirectory(relativePath) {
    if (this.#isExcludedDirectory(relativePath)) return false;
    return this.sourceSelection.shouldEnterExplicitOrManagedDirectory(relativePath);
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
        return "stale — source is newer than docs/, run: sennel docs build";
      case "never-built":
        return "never-built — docs/ does not exist, run: sennel docs build";
      case "indeterminate":
        return `indeterminate — ${this.limits.join(", ")}`;
    }
  }
}

function printHelp() {
  console.log(
    [
      "Usage: sennel check freshness [options]",
      "",
      "Compare docs/ and source modification timestamps to determine if",
      "sennel docs build is needed.",
      "",
      "Results:",
      "  fresh       docs/ is up to date",
      "  stale       source is newer than docs/ — run sennel docs build",
      "  never-built docs/ does not exist — run sennel docs build",
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
 * @param {DocumentationBuildInputSelection|null} sourceSelection
 * @param {string|null} excludedDirectory
 * @param {typeof runGit} gitRunner
 * @returns {Promise<FreshnessScan>}
 */
async function newestMtime(
  dir,
  policy = DEFAULT_SCAN_POLICY,
  sourceSelection = null,
  excludedDirectory = null,
  gitRunner = runGit,
) {
  const traversal = new FreshnessFileInventory({
    root: dir,
    policy,
    sourceSelection,
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
    policy: sourceSelection ? "freshness-source" : "default",
    newestMs,
    limits,
  });
}

/**
 * Run the freshness check.
 *
 * @param {string} workRoot - repo root (docs/ lives here)
 * @param {string} srcRoot  - source root
 * @param {{
 *   policy?: import("../../lib/file-tree-walker.js").ScanPolicy,
 *   sourceSelection?: DocumentationBuildInputSelection|null,
 *   gitRunner?: typeof runGit,
 * }} options
 * @returns {Promise<FreshnessResult>}
 */
async function checkFreshness(workRoot, srcRoot, {
  policy = DEFAULT_SCAN_POLICY,
  sourceSelection = null,
  gitRunner = runGit,
} = {}) {
  const docsDir = path.join(workRoot, "docs");
  try {
    await fs.promises.access(docsDir);
  } catch {
    return new FreshnessResult("never-built", {
      sourceScan: new FreshnessScan({
        target: srcRoot,
        policy: "freshness-source",
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
    newestMtime(srcRoot, policy, sourceSelection, sourceDocsDirectory, gitRunner),
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
    process.stderr.write(`sennel check freshness: unknown format '${format}'. Use text or json.\n`);
    process.exit(EXIT_ERROR);
  }

  const workRoot = container.get("root");
  const srcRoot = sourceRoot();
  const docsContext = resolveDocsContext(container, null);
  const patterns = resolveDocumentationScanPatterns(docsContext);
  const sourceRelativeToWork = path.relative(workRoot, srcRoot);
  const sourceRootIsWithinWorkRoot = (
    !sourceRelativeToWork.startsWith(`..${path.sep}`)
    && !path.isAbsolute(sourceRelativeToWork)
  );
  const sourceRootRelativePath = sourceRootIsWithinWorkRoot ? sourceRelativeToWork : "";
  const result = await checkFreshness(workRoot, srcRoot, {
    sourceSelection: new DocumentationBuildInputSelection({
      scanSelection: new DocumentationSourceSelection(patterns),
      flowSpecRoot: sourceRootIsWithinWorkRoot ? container.get("flowSpecRoot") : null,
      sourceRootRelativePath,
      managedRoot: sourceRootIsWithinWorkRoot ? undefined : null,
    }),
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
