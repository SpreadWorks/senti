/**
 * src/flow/lib/run-prepare-spec.js
 *
 * FlowCommand: prepare-spec — create branch/worktree and initialize spec directory.
 * requiresFlow: false (this command creates the flow).
 */

import fs from "fs";
import path from "path";
import { isInsideWorktree } from "../../lib/cli.js";
import { sddDir, DEFAULT_LANG } from "../../lib/config.js";
import { assertOk } from "../../lib/process.js";
import { translate } from "../../lib/i18n.js";
import { buildInitialSteps } from "../../lib/flow-helpers.js";
import { getWorktreeStatus, runGit } from "../../lib/git-helpers.js";
import { FlowCommand } from "./base-command.js";

function runGitTrim(root, args) {
  const res = runGit(["-C", root, ...args]);
  if (res.ok) return res.stdout.trim();
  assertOk(res, `git ${args.join(" ")} failed`);
}

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function nextIndex(root) {
  const specsDir = path.join(root, "specs");
  let max = 0;

  if (fs.existsSync(specsDir)) {
    for (const ent of fs.readdirSync(specsDir, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const m = ent.name.match(/^([0-9]{3})-/);
      if (m) max = Math.max(max, Number(m[1]));
    }
  }

  const branchLines = runGitTrim(root, ["branch", "--list", "feature/[0-9][0-9][0-9]-*"])
    .split("\n")
    .map((x) => x.replace(/^[* ]+/, "").trim())
    .filter(Boolean);
  for (const b of branchLines) {
    const m = b.match(/^feature\/([0-9]{3})-/);
    if (m) max = Math.max(max, Number(m[1]));
  }

  return max + 1;
}

function ensureClean(root) {
  const status = runGitTrim(root, ["status", "--porcelain"]);
  if (status.trim()) {
    throw new Error("worktree is dirty. commit/stash before spec.");
  }
}

function ensureBaseBranch(root, base) {
  try {
    runGitTrim(root, ["rev-parse", "--verify", base]);
  } catch (e) {
    throw new Error(`base branch not found: ${base}: ${e.message}`);
  }
}

function detectBaseBranch(root) {
  try {
    return runGitTrim(root, ["rev-parse", "--abbrev-ref", "HEAD"]).trim();
  } catch (e) {
    process.stderr.write(`[sdd-forge] failed to detect current branch, falling back to "main": ${e.message}\n`);
    return "main";
  }
}

function buildQaTemplate() {
  const t = translate();
  const prompt = t("messages:spec.qaConfirmationPrompt");
  return [
    "# Clarification Q&A",
    "",
    "- Q: ",
    "  - A: ",
    "",
    "## Confirmation",
    "- Before implementation, ask the user:",
    `  - "${prompt}"`,
    "- If approved, update `spec.md` -> `## User Confirmation` with checked state.",
    "",
  ].join("\n");
}

const DEFAULT_SPEC_TEMPLATE = `# Feature Specification: {{SPEC_DIR}}

**Feature Branch**: \`{{BRANCH_NAME}}\`
**Created**: {{DATE}}
**Status**: Draft
**Input**: User request

## Goal
-

## Scope
-

## Out of Scope
-

## Clarifications (Q&A)
- Q:
  - A:

## Alternatives Considered
-

## User Confirmation
- [ ] User approved this spec
- Confirmed at:
- Notes:

## Requirements
-

## Acceptance Criteria
-

## Open Questions
- [ ]
`;

function loadLocalTemplate(root, lang, fileName, fallback) {
  const localPath = path.join(root, ".sdd-forge", "templates", lang, "specs", fileName);
  if (fs.existsSync(localPath)) return fs.readFileSync(localPath, "utf8");
  return fallback;
}

function createQaTemplate(root, lang) {
  return loadLocalTemplate(root, lang, "qa.md", buildQaTemplate());
}

function createSpecTemplate({ branchName, specDirName }, root, lang) {
  const template = loadLocalTemplate(root, lang, "spec.md", DEFAULT_SPEC_TEMPLATE);
  const today = new Date().toISOString().slice(0, 10);
  return template
    .replace(/\{\{BRANCH_NAME\}\}/g, branchName)
    .replace(/\{\{SPEC_DIR\}\}/g, specDirName)
    .replace(/\{\{DATE\}\}/g, today)
    .replace(/\{\{STATUS\}\}/g, "Draft");
}

export class RunPrepareSpecCommand extends FlowCommand {
  constructor() {
    super({ requiresFlow: false });
  }

  async execute(ctx) {
    const { root, flowManager } = ctx;

    // Dirty worktree check — abort early if uncommitted changes exist
    const { dirty, dirtyFiles } = getWorktreeStatus(root);
    if (dirty) {
      throw new Error(`dirty worktree: ${dirtyFiles.join(", ")}`);
    }

    const title = ctx.title || "";
    const base = ctx.base || "";
    const runIdArg = ctx.runId || "";
    const noBranch = ctx.noBranch || false;
    const useWorktreeFlag = ctx.worktree || false;
    const dryRun = ctx.dryRun || false;

    const { issue, request } = flowManager.resolvePreparingInputs(runIdArg, ctx.issue, ctx.request);

    if (!title) {
      throw new Error("--title is required");
    }

    const config = ctx.config;
    if (!config) {
      throw new Error("config.json not found");
    }
    const lang = config.lang || DEFAULT_LANG;
    const resolvedBase = base || detectBaseBranch(root);

    // Determine branching strategy
    const inWorktree = isInsideWorktree(root);
    const skipBranch = noBranch || inWorktree;
    const useWorktree = !skipBranch && useWorktreeFlag;

    if (!dryRun) ensureClean(root);
    if (!skipBranch) ensureBaseBranch(root, resolvedBase);

    const idx = String(nextIndex(root)).padStart(3, "0");
    const slug = slugify(title) || "feature";
    const branchName = `feature/${idx}-${slug}`;
    const specDirName = `${idx}-${slug}`;

    // Determine where spec files live
    const worktreePath = useWorktree
      ? path.join(sddDir(root), "worktree", branchName.replace(/\//g, "-"))
      : null;
    const specRoot = useWorktree ? worktreePath : root;
    const specDir = path.join(specRoot, "specs", specDirName);
    const specPath = path.join(specDir, "spec.md");
    const qaPath = path.join(specDir, "qa.md");

    if (dryRun) {
      const mode = useWorktree ? "worktree" : skipBranch ? "spec-only" : "branch";
      return {
        result: "dry-run",
        changed: [],
        artifacts: { specDir: `specs/${specDirName}`, branch: branchName, worktree: worktreePath, mode },
        next: null,
        output: [
          `[dry-run] mode: ${mode}`,
          `[dry-run] base: ${resolvedBase}`,
          `[dry-run] branch: ${branchName}`,
          `[dry-run] spec dir: specs/${specDirName}`,
        ].join("\n"),
      };
    }

    // Helper: write spec files
    function writeSpecFiles() {
      fs.mkdirSync(specDir, { recursive: true });
      if (!fs.existsSync(specPath)) {
        fs.writeFileSync(specPath, createSpecTemplate({ branchName, specDirName }, root, lang));
      }
      if (!fs.existsSync(qaPath)) {
        fs.writeFileSync(qaPath, createQaTemplate(root, lang));
      }
    }

    // Helper: write flow.json state
    const flowRunId = runIdArg || flowManager.generateRunId();
    function writeFlowState(extra) {
      const steps = buildInitialSteps();
      for (const id of ["branch", "spec"]) {
        const step = steps.find((s) => s.id === id);
        if (step) step.status = "done";
      }
      const state = {
        spec: `specs/${specDirName}/spec.md`,
        baseBranch: resolvedBase,
        featureBranch: branchName,
        runId: flowRunId,
        lifecycle: "active",
        steps,
        requirements: [],
        tasks: [],
        currentTaskId: null,
        ...(issue ? { issue: Number(issue) } : {}),
        ...(request ? { request } : {}),
        ...extra,
      };
      flowManager.forRoot(specRoot).save(state);
    }

    // Clean stale .active-flow entries and preparing files before creating a new flow
    flowManager.cleanStaleFlows();
    flowManager.cleanStalePreparingFlows();

    // Delete the preparing file if --run-id was provided
    if (runIdArg) {
      flowManager.deletePreparingFlow(runIdArg);
    }

    const changed = [`specs/${specDirName}/spec.md`, `specs/${specDirName}/qa.md`];
    const lines = [];

    if (useWorktree) {
      runGitTrim(root, ["worktree", "add", worktreePath, "-b", branchName, resolvedBase]);
      writeSpecFiles();
      writeFlowState({ worktree: true });
      flowManager.addActiveFlow(specDirName, "worktree");
      lines.push(
        `created worktree: ${worktreePath}`,
        `created branch: ${branchName} (from ${resolvedBase})`,
        `created spec: specs/${specDirName}/spec.md`,
        `created qa: specs/${specDirName}/qa.md`,
        "",
        "next:",
        `1) cd ${worktreePath}`,
        `2) fill specs/${specDirName}/spec.md`,
        `3) run: sdd-forge spec gate --spec specs/${specDirName}/spec.md`,
        `4) start implementation`,
      );
    } else if (skipBranch) {
      writeSpecFiles();
      writeFlowState();
      flowManager.addActiveFlow(specDirName, "local");
      lines.push(
        `created spec: specs/${specDirName}/spec.md`,
        `created qa: specs/${specDirName}/qa.md`,
        "",
        "next:",
        `1) fill specs/${specDirName}/spec.md`,
        `2) run: sdd-forge spec gate --spec specs/${specDirName}/spec.md`,
        `3) start implementation`,
      );
    } else {
      runGitTrim(root, ["checkout", "-b", branchName, resolvedBase]);
      writeSpecFiles();
      writeFlowState();
      flowManager.addActiveFlow(specDirName, "branch");
      lines.push(
        `created branch: ${branchName} (from ${resolvedBase})`,
        `created spec: specs/${specDirName}/spec.md`,
        `created qa: specs/${specDirName}/qa.md`,
        "",
        "next:",
        `1) fill specs/${specDirName}/spec.md`,
        `2) run: sdd-forge spec gate --spec specs/${specDirName}/spec.md`,
        `3) start implementation`,
      );
    }

    return {
      result: "ok",
      changed,
      artifacts: {
        specDir: `specs/${specDirName}`,
        branch: branchName,
        worktree: worktreePath,
        mode: useWorktree ? "worktree" : (skipBranch ? "spec-only" : "branch"),
      },
      next: "draft",
      output: lines.join("\n"),
    };
  }
}

export default RunPrepareSpecCommand;
