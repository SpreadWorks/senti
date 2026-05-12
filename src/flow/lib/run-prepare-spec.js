/**
 * src/flow/lib/run-prepare-spec.js
 *
 * FlowCommand: prepare-spec — create branch/worktree and initialize spec directory.
 * requiresFlow: false (this command creates the flow).
 */

import fs from "fs";
import path from "path";
import { isInsideWorktree } from "../../lib/cli.js";
import { sddDir } from "../../lib/config.js";
import { assertOk } from "../../lib/process.js";
import { buildInitialSteps } from "../../lib/flow-helpers.js";
import { findStepById } from "../definition.js";
import { getWorktreeStatus, runGit } from "../../lib/git-helpers.js";
import { emptySpecStub } from "../../lib/spec-json.js";
import { renderSpecMarkdown } from "../../spec/commands/render.js";
import { FlowCommand } from "./base-command.js";
import { writeIssueMd } from "./issue-body-cache.js";

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

function buildDraftTemplate() {
  return JSON.stringify({
    devType: "",
    goal: "",
    analysis: {
      problem: "",
      proposedApproach: "",
      validation: "",
    },
    scopeVerification: {
      in: [],
      out: [],
    },
    impactOnExisting: [],
    qa: [],
    openQuestions: [],
    approval: {
      approved: false,
      confirmedAt: "",
      notes: "",
    },
  }, null, 2) + "\n";
}

export class RunPrepareSpecCommand extends FlowCommand {
  constructor() {
    super({ requiresFlow: false });
  }

  async execute(ctx) {
    const { root, flowManager } = ctx;

    const title = ctx.title || "";
    const base = ctx.base || "";
    const runIdArg = ctx.runId || "";
    const noBranch = ctx.noBranch || false;
    const useWorktreeFlag = ctx.worktree || false;
    const dryRun = ctx.dryRun || false;

    const { issue, request } = flowManager.resolvePreparingInputs(runIdArg, ctx.issue, ctx.request);
    const preparingState = runIdArg ? flowManager.loadPreparingFlow(runIdArg) : null;

    if (!title) {
      throw new Error("--title is required");
    }

    const config = ctx.config;
    if (!config) {
      throw new Error("config.json not found");
    }
    const resolvedBase = base || detectBaseBranch(root);

    // Determine branching strategy
    const inWorktree = isInsideWorktree(root);
    const skipBranch = noBranch || inWorktree;
    const useWorktree = !skipBranch && useWorktreeFlag;

    // Dirty worktree only matters for the `git checkout -b` path: switching
    // branches in-place would drag uncommitted changes into the new branch.
    // `git worktree add` creates an isolated checkout from the base branch
    // tip, and `skipBranch` only writes new files under specs/<idx>-<slug>/ —
    // both cases leave existing dirty files untouched.
    if (!dryRun && !skipBranch && !useWorktree) {
      const { dirty, dirtyFiles } = getWorktreeStatus(root);
      if (dirty) {
        throw new Error(`dirty worktree: ${dirtyFiles.join(", ")}. commit/stash before spec, or use --worktree to isolate.`);
      }
    }
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
    const draftPath = path.join(specDir, "draft.json");

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

    // Helper: write spec files. Creates spec.json (primary source of truth)
    // and generates spec.md in the same step via renderSpecMarkdown, which
    // satisfies spec 207 R3 — spec.md is always a deterministic render of the
    // current spec.json.
    function writeSpecFiles() {
      fs.mkdirSync(specDir, { recursive: true });
      const specJsonPath = path.join(specDir, "spec.json");
      if (!fs.existsSync(specJsonPath)) {
        fs.writeFileSync(specJsonPath, JSON.stringify(emptySpecStub(), null, 2) + "\n");
      }
      if (!fs.existsSync(specPath)) {
        const stub = JSON.parse(fs.readFileSync(specJsonPath, "utf8"));
        const today = new Date().toISOString().slice(0, 10);
        const rendered = renderSpecMarkdown(stub, {
          title: specDirName,
          featureBranch: branchName,
          created: today,
          status: "Draft",
          input: issue ? `GitHub Issue #${issue}` : "User request",
        });
        fs.writeFileSync(specPath, rendered);
      }
      if (!fs.existsSync(draftPath)) {
        fs.writeFileSync(draftPath, buildDraftTemplate());
      }
      if (preparingState?.issueBody && typeof preparingState.issueBody === "string") {
        if (!fs.existsSync(path.join(specDir, "issue.md"))) {
          writeIssueMd(specDir, preparingState.issueBody);
        }
      }
    }

    // Helper: write flow.json state
    const flowRunId = runIdArg || flowManager.generateRunId();
    function writeFlowState(extra) {
      // At prepare time a fresh flow has no tasks. Integration steps
      // initialize as `skipped` (spec 198 REQ-P4-1); tasks added later
      // during the flow do not retroactively un-skip them — the skip
      // state reflects "no tasks declared up-front".
      const steps = buildInitialSteps();
      for (const id of ["branch", "prepare-spec"]) {
        const step = findStepById(steps, id);
        if (step) {
          step.status = "done";
          step.finishedAt = new Date().toISOString();
        }
      }
      const draftStep = findStepById(steps, "draft");
      if (draftStep) {
        draftStep.status = "in_progress";
        draftStep.startedAt = new Date().toISOString();
      }
      const state = {
        spec: `specs/${specDirName}/spec.json`,
        baseBranch: resolvedBase,
        featureBranch: branchName,
        runId: flowRunId,
        steps,
        requirements: [],
        tasks: [],
        currentTaskId: null,
        ...(issue ? { issue: Number(issue) } : {}),
        ...(request ? { request } : {}),
        ...(preparingState?.autoApprove ? { autoApprove: true } : {}),
        ...(preparingState?.autoCheck ? { autoCheck: preparingState.autoCheck } : {}),
        ...(preparingState?.autoDesired != null ? { autoDesired: preparingState.autoDesired } : {}),
        ...(preparingState?.notes?.length ? { notes: preparingState.notes } : {}),
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

    const changed = [
      `specs/${specDirName}/spec.md`,
      `specs/${specDirName}/draft.json`,
    ];
    const createdFileLines = [
      `created spec: specs/${specDirName}/spec.md`,
      `created draft: specs/${specDirName}/draft.json`,
    ];
    const fillAndGateNext = [
      `fill specs/${specDirName}/spec.md`,
      `run: sdd-forge spec gate --spec specs/${specDirName}/spec.md`,
      `start implementation`,
    ];
    const lines = [];

    if (useWorktree) {
      runGitTrim(root, ["worktree", "add", worktreePath, "-b", branchName, resolvedBase]);
      writeSpecFiles();
      writeFlowState({ worktree: true });
      flowManager.addActiveFlow(specDirName, "worktree");
      lines.push(
        `created worktree: ${worktreePath}`,
        `created branch: ${branchName} (from ${resolvedBase})`,
        ...createdFileLines,
        "",
        "next:",
        `1) cd ${worktreePath}`,
        ...fillAndGateNext.map((l, i) => `${i + 2}) ${l}`),
      );
    } else if (skipBranch) {
      writeSpecFiles();
      writeFlowState();
      flowManager.addActiveFlow(specDirName, "local");
      lines.push(
        ...createdFileLines,
        "",
        "next:",
        ...fillAndGateNext.map((l, i) => `${i + 1}) ${l}`),
      );
    } else {
      runGitTrim(root, ["checkout", "-b", branchName, resolvedBase]);
      writeSpecFiles();
      writeFlowState();
      flowManager.addActiveFlow(specDirName, "branch");
      lines.push(
        `created branch: ${branchName} (from ${resolvedBase})`,
        ...createdFileLines,
        "",
        "next:",
        ...fillAndGateNext.map((l, i) => `${i + 1}) ${l}`),
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
