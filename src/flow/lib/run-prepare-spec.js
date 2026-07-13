/**
 * src/flow/lib/run-prepare-spec.js
 *
 * FlowCommand: prepare-spec — create branch/worktree and initialize spec directory.
 * requiresFlow: false (this command creates the flow).
 */

import fs from "fs";
import path from "path";
import { isInsideWorktree, PKG_DIR } from "../../lib/cli.js";
import { sentiDir, sentiOutputDir } from "../../lib/config.js";
import { assertOk, runCmd } from "../../lib/process.js";
import { iterateAnalysisCategories } from "../../docs/lib/analysis-entry.js";
import { buildInitialSteps } from "../../lib/flow-helpers.js";
import { findStepById } from "./step-tree.js";
import { getWorktreeStatus, runGit } from "../../lib/git-helpers.js";
import { emptySpecStub } from "../../lib/spec-json.js";
import { onHook } from "../../lib/hooks.js";
import { FlowCommand } from "./base-command.js";
import { writeIssueMd } from "./issue-body-cache.js";
import { discoverFlowCommandHooks, readProjectConfig, runFlowCommandWithPluginLifecycle } from "../../lib/plugin-registry.js";
import { Envelope } from "../../lib/flow-envelope.js";
import { FlowManager } from "../../lib/flow-manager.js";
import { RepositoryFlowOperationLock } from "../../lib/repository-maintenance-lock.js";

const MAX_PLUGIN_RUNTIME_SYNC_FILES = 2000;
const REQUIRED_WORKTREE_BRANCH_FILES = Object.freeze([".senti/config.json"]);
const MAX_REQUIRED_WORKTREE_BRANCH_FILES = 16;

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
    process.stderr.write(`[senti] failed to detect current branch, falling back to "main": ${e.message}\n`);
    return "main";
  }
}

export function buildDraftTemplate() {
  return JSON.stringify({
    devType: "",
    goal: "",
    analysis: {
      problem: "",
      proposedApproach: "",
      validation: "",
    },
    decisionMap: {
      knownFacts: [],
      decisionPoints: [],
      resolvedByProjectRules: [],
      requiresUserJudgment: [],
      deferredToSpec: [],
    },
    scopeVerification: {
      in: [],
      out: [],
    },
    impactOnExisting: [],
    // Keep the scaffold explicit about every QA field the draft prompt expects.
    qa: [
      {
        id: "q1",
        status: "pending",
        category: "goal-confirmation",
        question: "",
        answer: "",
        evidence: "",
        why: "",
        considered: "",
        droppedReason: "",
      },
    ],
    openQuestions: [],
    approval: {
      approved: false,
      confirmedAt: "",
      notes: "",
    },
  }, null, 2) + "\n";
}

function runDocsScanAndValidate(root) {
  const res = runCmd(process.execPath, [path.join(PKG_DIR, "senti.js"), "docs", "scan"], {
    cwd: root,
    timeout: 600000,
    env: { ...process.env, SENTI_WORK_ROOT: root },
  });
  assertOk(res, "docs scan failed during prepare-spec");
  const analysisPath = path.join(sentiOutputDir(root), "analysis.json");
  if (!fs.existsSync(analysisPath)) throw new Error(`analysis.json not found after docs scan: ${analysisPath}`);
  let analysis;
  try {
    analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
    [...iterateAnalysisCategories(analysis, { strict: true })];
  } catch (err) {
    throw new Error(`analysis.json is unreadable or invalid after docs scan: ${err.message}`);
  }
}

async function hookSnapshotFor(root) {
  return discoverFlowCommandHooks(root);
}

function copyPluginRuntimeDirectory(src, dest, counter = { files: 0 }) {
  const stat = fs.lstatSync(src);
  if (stat.isSymbolicLink()) throw new Error(`plugin runtime sync rejected symlink: ${src}`);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyPluginRuntimeDirectory(path.join(src, entry), path.join(dest, entry), counter);
    }
    return;
  }
  if (!stat.isFile()) return;
  counter.files += 1;
  if (counter.files > MAX_PLUGIN_RUNTIME_SYNC_FILES) {
    throw new Error(`plugin runtime sync exceeds ${MAX_PLUGIN_RUNTIME_SYNC_FILES} files`);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function syncPluginRuntimeToWorktree(root, worktreePath) {
  const config = readProjectConfig(root);
  const sourceSentiDir = sentiDir(root);
  const targetSentiDir = sentiDir(worktreePath);
  const localConfigPath = path.join(sourceSentiDir, "config.local.json");
  if (fs.existsSync(localConfigPath)) {
    fs.mkdirSync(targetSentiDir, { recursive: true });
    fs.copyFileSync(localConfigPath, path.join(targetSentiDir, "config.local.json"));
  }
  for (const pkg of config.plugin?.packages || []) {
    if (pkg.enabled === false) continue;
    const sourcePluginRoot = path.join(sourceSentiDir, "plugins", pkg.id);
    if (!fs.existsSync(sourcePluginRoot)) continue;
    const targetPluginRoot = path.join(targetSentiDir, "plugins", pkg.id);
    fs.rmSync(targetPluginRoot, { recursive: true, force: true });
    copyPluginRuntimeDirectory(sourcePluginRoot, targetPluginRoot);
  }
}

function gitPathspecStatus(root, relPath) {
  const res = runGit(["-C", root, "status", "--porcelain", "--untracked-files=all", "--", relPath]);
  assertOk(res, `git status failed for ${relPath}`);
  return res.stdout.split(/\r?\n/).filter(Boolean);
}

function branchHasPath(root, ref, relPath) {
  const res = runGit(["-C", root, "cat-file", "-e", `${ref}:${relPath}`]);
  return res.ok;
}

function gitBlobId(root, ref, relPath) {
  const res = runGit(["-C", root, "rev-parse", `${ref}:${relPath}`]);
  return res.ok ? res.stdout.trim() : null;
}

function classifyRequiredBranchFile(root, baseRef, relPath) {
  const lines = gitPathspecStatus(root, relPath);
  const statuses = new Set();
  for (const line of lines) {
    const code = line.slice(0, 2);
    if (code === "??") {
      statuses.add("untracked");
      continue;
    }
    if (code[0] !== " ") statuses.add("staged");
    if (code[1] !== " ") statuses.add("unstaged");
  }
  if (statuses.size > 0) {
    return {
      ok: false,
      path: relPath,
      status: [...statuses].join("+"),
      reason: `${relPath} has local ${[...statuses].join(" and ")} state that will not be reflected in the new worktree checkout from ${baseRef}.`,
    };
  }
  if (!branchHasPath(root, baseRef, relPath)) {
    return {
      ok: false,
      path: relPath,
      status: "missing",
      reason: `${relPath} is not present in ${baseRef}, so the new worktree checkout will not contain the required config file.`,
    };
  }
  const currentBlob = gitBlobId(root, "HEAD", relPath);
  const baseBlob = gitBlobId(root, baseRef, relPath);
  if (currentBlob && baseBlob && currentBlob !== baseBlob) {
    return {
      ok: false,
      path: relPath,
      status: "base-mismatch",
      reason: `${relPath} content in HEAD differs from ${baseRef}, so the new worktree checkout from ${baseRef} will use stale required config content that is not reflected from the current branch.`,
    };
  }
  return { ok: true, path: relPath };
}

function checkRequiredWorktreeBranchFiles(root, baseRef) {
  if (REQUIRED_WORKTREE_BRANCH_FILES.length > MAX_REQUIRED_WORKTREE_BRANCH_FILES) {
    throw new Error(`required worktree branch file list exceeds ${MAX_REQUIRED_WORKTREE_BRANCH_FILES} entries`);
  }
  const issues = [];
  for (const relPath of REQUIRED_WORKTREE_BRANCH_FILES) {
    const result = classifyRequiredBranchFile(root, baseRef, relPath);
    if (!result.ok) issues.push(result);
  }
  return issues;
}

function requiredWorktreeFilesEnvelope(issues) {
  const paths = issues.map((issue) => `${issue.path} (${issue.status})`).join(", ");
  return Envelope.fail("run", "prepare-spec", "REQUIRED_WORKTREE_FILES_UNREFLECTED", [
    `Required worktree branch files are not reflected in the source branch: ${paths}.`,
    "Commit the required file changes and continue/resume this flow prepare, or abort flow prepare.",
    "The preflight stopped before prepare-state cleanup, git worktree add, feature branch creation, spec files, flow state, docs scan, and config copying side effects.",
  ], {
    requiredFiles: issues,
    recoveryOptions: ["commit-and-continue", "abort"],
    choices: [
      { id: "commit-and-continue", label: "Commit required files and continue" },
      { id: "abort", label: "Abort flow prepare" },
    ],
  });
}

export async function runPrepareWithPluginHooks({ root, title, request, noBranch = true, issue = null }) {
  const specDirName = "001-plugin-hook-snapshot-fixture";
  const specDir = path.join(root, "specs", specDirName);
  fs.mkdirSync(specDir, { recursive: true });
  const flowPath = path.join(specDir, "flow.json");
  const plans = await hookSnapshotFor(root);
  let featureBranch = null;
  if (!noBranch) featureBranch = `feature/${specDirName}`;
  const state = {
    spec: `specs/${specDirName}/spec.json`,
    baseBranch: "main",
    featureBranch,
    runId: `fixture-${Date.now()}`,
    steps: [],
    requirements: [],
    tasks: [],
    currentTaskId: null,
    ...(issue ? { issue: Number(issue) } : {}),
    request,
    title,
    plugins: { flowCommandHooks: plans },
  };
  new FlowManager({ root, mainRoot: root, inWorktree: false }).create(state);
  const lifecycle = await runFlowCommandWithPluginLifecycle(root, plans, {
    command: "prepare",
    flow: state,
    main: async () => ({ ok: true, data: { issue: state.issue, spec: state.spec, runId: state.runId } }),
  });
  return { flowPath: path.relative(root, flowPath).split(path.sep).join("/"), lifecycle };
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
    if (ctx.flowState && !runIdArg) {
      return Envelope.fail(
        "run",
        "prepare-spec",
        "TARGET_REQUIRED",
        "Cannot run bare prepare while another flow is active; run `senti flow set init` and pass the returned --run-id.",
        {
          active: {
            runId: ctx.flowState.runId || null,
            issue: ctx.flowState.issue || null,
            spec: ctx.flowState.spec || null,
          },
        },
      );
    }
    if (ctx.flowState && runIdArg && ctx.flowState.runId !== runIdArg) {
      return Envelope.fail(
        "run",
        "prepare-spec",
        "ACTIVE_FLOW_MISMATCH",
        "prepare --run-id did not resolve to an isolated preparing flow; target selection would use another active flow.",
        {
          active: {
            runId: ctx.flowState.runId || null,
            issue: ctx.flowState.issue || null,
            spec: ctx.flowState.spec || null,
          },
          requested: {
            runId: runIdArg,
            issue: preparingState?.issue || null,
          },
        },
      );
    }

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
      const blockingDirtyFiles = dirtyFiles.filter((file) => {
        const rel = file.replace(/^[ AMDRCU?!]{2}\s+/, "");
        return !rel.startsWith(".tmp/");
      });
      if (dirty && blockingDirtyFiles.length > 0) {
        throw new Error(`dirty worktree: ${blockingDirtyFiles.join(", ")}. commit/stash before spec, or use --worktree to isolate.`);
      }
    }
    if (!skipBranch) ensureBaseBranch(root, resolvedBase);

    const idx = String(nextIndex(root)).padStart(3, "0");
    const slug = slugify(title) || "feature";
    const branchName = `feature/${idx}-${slug}`;
    const specDirName = `${idx}-${slug}`;

    // Determine where spec files live
    const worktreePath = useWorktree
      ? path.join(sentiDir(root), "worktree", branchName.replace(/\//g, "-"))
      : null;
    const specRoot = useWorktree ? worktreePath : root;
    const specDir = path.join(specRoot, "specs", specDirName);
    const draftPath = path.join(specDir, "draft.json");

    if (!dryRun && useWorktree) {
      const requiredFileIssues = checkRequiredWorktreeBranchFiles(root, resolvedBase);
      if (requiredFileIssues.length > 0) {
        return requiredWorktreeFilesEnvelope(requiredFileIssues);
      }
    }

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

    const operationLock = new RepositoryFlowOperationLock({
      mainRoot: ctx.mainRoot || flowManager._mainRoot || root,
    });
    const operationOwnerToken = operationLock.acquire();
    try {

    // Helper: write planning source files. spec.json is the source of truth;
    // spec.md is a generated view rendered later when human approval needs it.
    function writeSpecFiles() {
      fs.mkdirSync(specDir, { recursive: true });
      const specJsonPath = path.join(specDir, "spec.json");
      if (!fs.existsSync(specJsonPath)) {
        fs.writeFileSync(specJsonPath, JSON.stringify(emptySpecStub(), null, 2) + "\n");
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
    async function writeFlowState(extra) {
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
      state.plugins = { flowCommandHooks: await hookSnapshotFor(specRoot) };
      flowManager.forRoot(specRoot).create(state, { operationOwnerToken });
      await runFlowCommandWithPluginLifecycle(specRoot, state.plugins.flowCommandHooks, {
        command: "prepare",
        flow: state,
        main: async () => ({ ok: true, data: { issue: state.issue, spec: state.spec, runId: state.runId } }),
      });
    }

    // Clean stale active-flow registry entries before creating a new flow.
    flowManager.cleanStaleFlows();

    const changed = [
      `specs/${specDirName}/spec.json`,
      `specs/${specDirName}/draft.json`,
    ];
    const createdFileLines = [
      `created spec source: specs/${specDirName}/spec.json`,
      `created draft: specs/${specDirName}/draft.json`,
    ];
    const fillAndGateNext = [
      `fill specs/${specDirName}/draft.json`,
      `run: senti flow run gate --phase draft`,
      `start implementation`,
    ];
    const lines = [];

    if (useWorktree) {
      runGitTrim(root, ["worktree", "add", worktreePath, "-b", branchName, resolvedBase]);
      syncPluginRuntimeToWorktree(root, worktreePath);
      await onHook("PostWorktree", { CWD: worktreePath });
      writeSpecFiles();
      await writeFlowState({ worktree: true });
      runDocsScanAndValidate(specRoot);
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
      await writeFlowState();
      runDocsScanAndValidate(specRoot);
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
      await writeFlowState();
      runDocsScanAndValidate(specRoot);
      flowManager.addActiveFlow(specDirName, "branch");
      lines.push(
        `created branch: ${branchName} (from ${resolvedBase})`,
        ...createdFileLines,
        "",
        "next:",
        ...fillAndGateNext.map((l, i) => `${i + 1}) ${l}`),
      );
    }

    if (runIdArg) {
      flowManager.deletePreparingFlow(runIdArg);
    }

    return {
      result: "ok",
      runId: flowRunId,
      issue: issue ? Number(issue) : null,
      spec: `specs/${specDirName}/spec.json`,
      worktreePath,
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
    } finally {
      operationLock.release();
    }
  }
}

export default RunPrepareSpecCommand;
