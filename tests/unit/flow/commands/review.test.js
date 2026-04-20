import { describe, it, afterEach } from "node:test";
import os from "os";
import fs from "fs";
import assert from "node:assert/strict";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir } from "../../../helpers/tmp-dir.js";
import { FLOW_STEPS } from "../../../../src/lib/flow-helpers.js";
import { FlowManager } from "../../../../src/lib/flow-manager.js";
import { Agent } from "../../../../src/lib/agent.js";
import { ProviderRegistry } from "../../../../src/lib/provider.js";
import { Logger } from "../../../../src/lib/log.js";
import {
  parseProposals,
  buildDraftSystemPrompt,
  filterProposalsByScope,
  collectTouchedFiles,
} from "../../../../src/flow/commands/review.js";

function resolveAgent(cfg, commandId) {
  const registry = new ProviderRegistry(cfg.agent?.providers || {});
  const agent = new Agent({
    config: cfg,
    paths: { root: process.cwd(), agentWorkDir: "/tmp" },
    registry,
    logger: new Logger({ logDir: os.tmpdir(), enabled: false }),
  });
  const resolved = agent.resolve(commandId);
  return resolved ? resolved.profile : null;
}

const FLOW_CMD = join(process.cwd(), "src/sdd-forge.js");
const FLOW_CMD_ARGS_PREFIX = ["flow"];

describe("FLOW_STEPS includes review", () => {
  it("has review between implement and finalize", () => {
    const implIdx = FLOW_STEPS.indexOf("implement");
    const reviewIdx = FLOW_STEPS.indexOf("review");
    const finalIdx = FLOW_STEPS.indexOf("finalize");
    assert.ok(reviewIdx > 0, "review step exists");
    assert.ok(reviewIdx > implIdx, "review comes after implement");
    assert.ok(reviewIdx < finalIdx, "review comes before finalize");
  });
});

describe("flow run routes review action", () => {
  it("shows review in flow run help output", () => {
    const result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "run", "--help"], { encoding: "utf8" });
    assert.match(result, /review/);
  });
});

describe("flow run review CLI", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("errors when no active flow", () => {
    tmp = createTmpDir();
    try {
      execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "run", "review"], {
        encoding: "utf8",
        env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
      });
      assert.fail("should exit non-zero");
    } catch (err) {
      const out = `${err.stdout || ""}${err.stderr || ""}`;
      assert.match(out, /no active flow/i);
    }
  });
});

describe("flow run review --phase test CLI", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("passes --phase test through to review command", () => {
    const result = execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "run", "review", "--help"], { encoding: "utf8" });
    assert.match(result, /--phase/);
  });

  it("errors when no active flow with --phase test", () => {
    tmp = createTmpDir();
    try {
      execFileSync("node", [FLOW_CMD, ...FLOW_CMD_ARGS_PREFIX, "run", "review", "--phase", "test"], {
        encoding: "utf8",
        env: { ...process.env, SDD_FORGE_WORK_ROOT: tmp },
      });
      assert.fail("should exit non-zero");
    } catch (err) {
      const out = `${err.stdout || ""}${err.stderr || ""}`;
      assert.match(out, /no active flow/i);
    }
  });
});

describe("resolveAgent for flow.review", () => {
  it("resolves flow.review.draft independently from flow.review.final via profiles", () => {
    const cfg = {
      agent: {
        default: "claude",
        providers: {
          claude: { command: "claude", args: ["-p", "{{PROMPT}}"] },
          "claude/opus": { command: "claude", args: ["-p", "{{PROMPT}}", "--model", "opus"] },
          codex: { command: "codex", args: ["exec", "{{PROMPT}}"] },
        },
        useProfile: "review",
        profiles: {
          review: {
            "flow.review.draft": "codex",
            "flow.review.final": "claude/opus",
          },
        },
      },
    };
    const draft = resolveAgent(cfg, "flow.review.draft");
    assert.equal(draft.command, "codex");

    const final = resolveAgent(cfg, "flow.review.final");
    assert.equal(final.command, "claude");
    assert.ok(final.args.includes("opus"));
  });

  it("falls back to flow.review prefix when specific phase not configured via profiles", () => {
    const cfg = {
      agent: {
        default: "claude",
        providers: {
          claude: { command: "claude", args: ["-p", "{{PROMPT}}"] },
          codex: { command: "codex", args: ["exec", "{{PROMPT}}"] },
        },
        useProfile: "review",
        profiles: {
          review: { "flow.review": "codex" },
        },
      },
    };
    // flow.review.draft matches "flow.review" prefix
    const draft = resolveAgent(cfg, "flow.review.draft");
    assert.equal(draft.command, "codex");
  });

  it("falls back to default agent when no flow.review configured", () => {
    const cfg = {
      agent: {
        default: "claude",
        providers: {
          claude: { command: "claude", args: ["-p", "{{PROMPT}}"] },
        },
      },
    };
    const draft = resolveAgent(cfg, "flow.review.draft");
    assert.equal(draft.command, "claude");
  });
});

describe("parseProposals extracts file from **File:** marker (spec 201 R-P1/R-P3)", () => {
  it("returns file=<path> when body contains '**File:** `path`'", () => {
    const text = [
      "### 1. Title A",
      "**File:** `src/foo.js`",
      "**Issue:** something",
      "",
      "### 2. Title B",
      "**File:** src/bar.js",
      "**Issue:** another",
    ].join("\n");
    const proposals = parseProposals(text);
    assert.equal(proposals.length, 2);
    assert.equal(proposals[0].file, "src/foo.js");
    assert.equal(proposals[1].file, "src/bar.js");
  });

  it("returns file=null when body has no **File:** marker", () => {
    const text = "### 1. No file\n**Issue:** nothing to point at\n";
    const proposals = parseProposals(text);
    assert.equal(proposals.length, 1);
    assert.equal(proposals[0].file, null);
  });
});

describe("buildDraftSystemPrompt enforces scope (spec 201 R-P2)", () => {
  it("includes an instruction restricting proposals to the diff target files", () => {
    const prompt = buildDraftSystemPrompt();
    assert.match(
      prompt,
      /diff|touched|changed/i,
      "prompt must mention diff/touched/changed scope constraint",
    );
    assert.match(
      prompt,
      /only|do not propose|out of scope|outside/i,
      "prompt must explicitly restrict suggestions",
    );
  });
});

describe("filterProposalsByScope (spec 201 R-P1/R-P3)", () => {
  it("keeps proposals whose file is in the touched set", () => {
    const proposals = [
      { title: "A", body: "", file: "src/foo.js" },
      { title: "B", body: "", file: "src/bar.js" },
    ];
    const touched = new Set(["src/foo.js", "src/bar.js"]);
    const { kept, excluded } = filterProposalsByScope(proposals, touched);
    assert.equal(kept.length, 2);
    assert.equal(excluded.outOfScope, 0);
    assert.equal(excluded.missingFile, 0);
  });

  it("removes proposals whose file is not in the touched set (R-P1)", () => {
    const proposals = [
      { title: "InScope", body: "", file: "src/foo.js" },
      { title: "OutOfScope", body: "", file: "src/flow/lib/run-draft-task.js" },
    ];
    const touched = new Set(["src/foo.js"]);
    const { kept, excluded } = filterProposalsByScope(proposals, touched);
    assert.equal(kept.length, 1);
    assert.equal(kept[0].title, "InScope");
    assert.equal(excluded.outOfScope, 1);
  });

  it("removes proposals with no file (R-P3) and reports missingFile count", () => {
    const proposals = [
      { title: "WithFile", body: "", file: "src/foo.js" },
      { title: "NoFile", body: "", file: null },
    ];
    const touched = new Set(["src/foo.js"]);
    const { kept, excluded } = filterProposalsByScope(proposals, touched);
    assert.equal(kept.length, 1);
    assert.equal(kept[0].title, "WithFile");
    assert.equal(excluded.missingFile, 1);
  });
});

function initTestRepo(tmp, baseFiles) {
  execFileSync("git", ["-C", tmp, "init", "-q", "-b", "main"]);
  execFileSync("git", ["-C", tmp, "config", "user.email", "t@t"]);
  execFileSync("git", ["-C", tmp, "config", "user.name", "t"]);
  for (const [name, content] of Object.entries(baseFiles)) {
    fs.writeFileSync(join(tmp, name), content);
  }
  execFileSync("git", ["-C", tmp, "add", "."]);
  execFileSync("git", ["-C", tmp, "commit", "-q", "-m", "base"]);
}

describe("collectTouchedFiles (spec 201 R-P4)", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("returns the set of files changed in committed diff vs baseBranch", () => {
    tmp = createTmpDir();
    initTestRepo(tmp, { "a.js": "a\n", "b.js": "b\n" });
    execFileSync("git", ["-C", tmp, "checkout", "-q", "-b", "feature"]);
    fs.writeFileSync(join(tmp, "a.js"), "a modified\n");
    execFileSync("git", ["-C", tmp, "add", "a.js"]);
    execFileSync("git", ["-C", tmp, "commit", "-q", "-m", "change a"]);

    const touched = collectTouchedFiles(tmp, "main");
    assert.ok(touched instanceof Set, "returns a Set");
    assert.ok(touched.has("a.js"), "includes changed file");
    assert.ok(!touched.has("b.js"), "excludes unchanged file");
  });

  it("includes staged-but-uncommitted changes", () => {
    tmp = createTmpDir();
    initTestRepo(tmp, { "a.js": "a\n" });
    fs.writeFileSync(join(tmp, "c.js"), "c\n");
    execFileSync("git", ["-C", tmp, "add", "c.js"]);

    const touched = collectTouchedFiles(tmp, "main");
    assert.ok(touched.has("c.js"), "includes staged file");
  });
});

describe("resolveAgent for flow.review.test", () => {
  it("resolves flow.review.test when explicitly configured via profiles", () => {
    const cfg = {
      agent: {
        default: "claude",
        providers: {
          claude: { command: "claude", args: ["-p", "{{PROMPT}}"] },
          codex: { command: "codex", args: ["exec", "{{PROMPT}}"] },
        },
        useProfile: "review",
        profiles: {
          review: {
            "flow.review.test": "codex",
            "flow.review.draft": "claude",
          },
        },
      },
    };
    const testAgent = resolveAgent(cfg, "flow.review.test");
    assert.equal(testAgent.command, "codex");
  });

  it("falls back to flow.review prefix when flow.review.test not in profile", () => {
    const cfg = {
      agent: {
        default: "claude",
        providers: {
          claude: { command: "claude", args: ["-p", "{{PROMPT}}"] },
          codex: { command: "codex", args: ["exec", "{{PROMPT}}"] },
        },
        useProfile: "review",
        profiles: {
          review: { "flow.review": "codex" },
        },
      },
    };
    // flow.review.test matches "flow.review" prefix
    const testAgent = resolveAgent(cfg, "flow.review.test");
    assert.equal(testAgent.command, "codex");
  });

  it("falls back to agent.default when no flow.review configured", () => {
    const cfg = {
      agent: {
        default: "claude",
        providers: {
          claude: { command: "claude", args: ["-p", "{{PROMPT}}"] },
        },
      },
    };
    const testAgent = resolveAgent(cfg, "flow.review.test");
    assert.equal(testAgent.command, "claude");
  });
});
