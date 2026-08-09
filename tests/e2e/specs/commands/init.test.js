import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "fs";
import { join } from "path";
import { execFileSync, spawnSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson } from "../../../helpers/tmp-dir.js";
import { makeFlowManager } from "../../../helpers/flow-setup.js";

const CMD = join(process.cwd(), "src/senrail.js");

function initProject(tmp) {
  execFileSync("git", ["init", tmp], { encoding: "utf8" });
  execFileSync("git", ["-C", tmp, "checkout", "-b", "main"], { encoding: "utf8" });
  writeJson(tmp, ".senrail/config.json", {
    lang: "en", type: "sample-node-command",
    docs: { languages: ["en"], defaultLanguage: "en" },
  });
  execFileSync("git", ["-C", tmp, "add", "-A"], { encoding: "utf8" });
  execFileSync("git", ["-C", tmp, "commit", "-m", "init"], { encoding: "utf8" });
}

function assertPrepareArtifacts(root, specDir) {
  assert.ok(fs.existsSync(join(root, specDir, "spec.json")));
  assert.ok(fs.existsSync(join(root, specDir, "draft.json")));
}

function expectedSpecId(runId, slug) {
  const compact = runId.replaceAll("-", "").toLowerCase();
  const source = /^[0-9a-f]+$/.test(compact) && compact.length >= 8
    ? compact
    : crypto.createHash("sha256").update(runId).digest("hex");
  return `${source.slice(0, 8)}-${slug}`;
}

function assertRunDerivedSpecIdentity(data, slug) {
  assert.equal(data.specId, expectedSpecId(data.runId, slug));
  assert.equal(data.artifacts.specDir, `specs/${data.specId}`);
  assert.equal(data.artifacts.branch, `feature/${data.specId}`);
}

function assertDryRunSpecIdentity(data, slug) {
  assert.match(data.artifacts.specDir, new RegExp(`^specs/[0-9a-f]{8}-${slug}$`));
  const specId = data.artifacts.specDir.slice("specs/".length);
  assert.equal(data.artifacts.branch, `feature/${specId}`);
}

function assertCanonicalFlowState(root, data, { worktree }) {
  const flow = JSON.parse(fs.readFileSync(
    join(root, data.artifacts.specDir, "flow.json"),
    "utf8",
  ));
  assert.equal(flow.specId, data.specId);
  assert.equal(flow.runId, data.runId);
  assert.equal(flow.featureBranch, `feature/${data.specId}`);
  assert.equal(flow.worktree === true, worktree);
}

describe("spec init CLI", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("creates spec files in dry-run mode", () => {
    tmp = createTmpDir();
    initProject(tmp);

    const result = execFileSync("node", [CMD, "flow", "prepare", "--title", "test-feature", "--base", "main", "--dry-run"], {
      encoding: "utf8",
      env: { ...process.env, SENRAIL_WORK_ROOT: tmp },
    });

    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.match(envelope.data.result, /dry-run/);
    assertDryRunSpecIdentity(envelope.data, "test-feature");
  });

  it("throws when no title given", () => {
    tmp = createTmpDir();
    initProject(tmp);
    try {
      execFileSync("node", [CMD, "flow", "prepare"], {
        encoding: "utf8",
        env: { ...process.env, SENRAIL_WORK_ROOT: tmp },
      });
      assert.fail("should throw");
    } catch (err) {
      const envelope = JSON.parse(err.stdout);
      assert.equal(envelope.ok, false);
      assert.ok(envelope.errors[0].messages.some((m) => m.includes("--title is required")));
    }
  });

  it("creates spec files and branch", () => {
    tmp = createTmpDir();
    initProject(tmp);

    const result = execFileSync("node", [CMD, "flow", "prepare", "--title", "my-feat", "--base", "main"], {
      encoding: "utf8",
      env: { ...process.env, SENRAIL_WORK_ROOT: tmp },
    });

    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.match(envelope.data.output, /created branch/);
    assert.match(envelope.data.output, /created spec/);
    assertRunDerivedSpecIdentity(envelope.data, "my-feat");
    assertPrepareArtifacts(tmp, envelope.data.artifacts.specDir);
    assertCanonicalFlowState(tmp, envelope.data, { worktree: false });
    assert.equal(
      execFileSync("git", ["-C", tmp, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim(),
      `feature/${envelope.data.specId}`,
    );
  });

  it("shows help with --help", () => {
    tmp = createTmpDir();
    initProject(tmp);
    const result = execFileSync("node", [CMD, "flow", "prepare", "--help"], {
      encoding: "utf8",
      env: { ...process.env, SENRAIL_WORK_ROOT: tmp },
    });
    assert.match(result, /--title/);
    assert.match(result, /--no-branch/);
    assert.match(result, /--worktree/);
  });

  it("creates spec without branch using --no-branch", () => {
    tmp = createTmpDir();
    initProject(tmp);

    const result = execFileSync("node", [CMD, "flow", "prepare", "--title", "nb-feat", "--base", "main", "--no-branch"], {
      encoding: "utf8",
      env: { ...process.env, SENRAIL_WORK_ROOT: tmp },
    });

    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    // Should create spec but NOT branch
    assert.match(envelope.data.output, /created spec/);
    assert.ok(!envelope.data.output.includes("created branch"));
    assertRunDerivedSpecIdentity(envelope.data, "nb-feat");
    assertPrepareArtifacts(tmp, envelope.data.artifacts.specDir);
    assertCanonicalFlowState(tmp, envelope.data, { worktree: false });

    // Should still be on main
    const branch = execFileSync("git", ["-C", tmp, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim();
    assert.equal(branch, "main");
  });

  it("shows mode: spec-only in --no-branch --dry-run", () => {
    tmp = createTmpDir();
    initProject(tmp);

    const result = execFileSync("node", [CMD, "flow", "prepare", "--title", "test-so", "--base", "main", "--no-branch", "--dry-run"], {
      encoding: "utf8",
      env: { ...process.env, SENRAIL_WORK_ROOT: tmp },
    });

    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.artifacts.mode, "spec-only");
  });

  it("creates worktree with --worktree", () => {
    tmp = createTmpDir();
    initProject(tmp);

    const result = execFileSync("node", [CMD, "flow", "prepare", "--title", "wt-feat", "--base", "main", "--worktree"], {
      encoding: "utf8",
      env: { ...process.env, SENRAIL_WORK_ROOT: tmp },
    });

    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.match(envelope.data.output, /created worktree/);
    assert.match(envelope.data.output, /created branch/);
    assertRunDerivedSpecIdentity(envelope.data, "wt-feat");
    const wtPath = join(tmp, ".senrail", "worktree", `feature-${envelope.data.specId}`);
    assert.equal(envelope.data.worktreePath, wtPath);
    assert.equal(envelope.data.artifacts.worktree, wtPath);
    assertPrepareArtifacts(tmp, envelope.data.artifacts.specDir);
    assertCanonicalFlowState(tmp, envelope.data, { worktree: true });
    assert.equal(fs.existsSync(join(wtPath, "specs", envelope.data.specId)), false);
    assert.equal(
      execFileSync("git", ["-C", wtPath, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim(),
      `feature/${envelope.data.specId}`,
    );

    // Cleanup worktree
    execFileSync("git", ["-C", tmp, "worktree", "remove", "--force", wtPath], { encoding: "utf8" });
  });

  it("shows mode: worktree in --worktree --dry-run", () => {
    tmp = createTmpDir();
    initProject(tmp);

    const result = execFileSync("node", [CMD, "flow", "prepare", "--title", "test-wt", "--base", "main", "--worktree", "--dry-run"], {
      encoding: "utf8",
      env: { ...process.env, SENRAIL_WORK_ROOT: tmp },
    });

    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    assert.equal(envelope.data.artifacts.mode, "worktree");
    assert.ok(envelope.data.artifacts.worktree, "should have worktree path");
    assertDryRunSpecIdentity(envelope.data, "test-wt");
    assert.equal(
      envelope.data.artifacts.worktree,
      join(tmp, ".senrail", "worktree", envelope.data.artifacts.branch.replace("/", "-")),
    );
  });

  it("auto-detects worktree and skips branch creation", () => {
    tmp = createTmpDir();
    initProject(tmp);

    const wtPath = join(tmp, "auto-wt");
    execFileSync("git", ["-C", tmp, "worktree", "add", wtPath, "-b", "wt-auto"], { encoding: "utf8" });
    writeJson(wtPath, ".senrail/config.json", {
      lang: "en", type: "sample-node-command",
      docs: { languages: ["en"], defaultLanguage: "en" },
    });

    const initialized = JSON.parse(execFileSync("node", [
      CMD, "flow", "set", "init", "--request", "prepare from a generic worktree",
    ], {
      encoding: "utf8",
      env: { ...process.env, SENRAIL_WORK_ROOT: wtPath },
    }));
    const prepared = spawnSync("node", [
      CMD, "flow", "prepare", "--title", "auto-feat", "--base", "main",
      "--run-id", initialized.data.runId,
    ], {
      encoding: "utf8",
      env: { ...process.env, SENRAIL_WORK_ROOT: wtPath },
    });
    assert.equal(prepared.status, 0, `stdout:\n${prepared.stdout}\nstderr:\n${prepared.stderr}`);
    const result = prepared.stdout;

    const envelope = JSON.parse(result);
    assert.equal(envelope.ok, true);
    // Should detect worktree and create spec-only (no branch)
    assert.ok(!envelope.data.output.includes("created branch"));
    assert.match(envelope.data.output, /created spec/);
    assert.equal(envelope.data.runId, initialized.data.runId);
    assertRunDerivedSpecIdentity(envelope.data, "auto-feat");
    assertPrepareArtifacts(tmp, envelope.data.artifacts.specDir);
    assertCanonicalFlowState(tmp, envelope.data, { worktree: false });
    assert.equal(fs.existsSync(join(wtPath, "specs", envelope.data.specId)), false);

    const specId = envelope.data.specId;
    const mainSpecDir = join(tmp, "specs", specId);
    const mainState = JSON.parse(fs.readFileSync(join(mainSpecDir, "flow.json"), "utf8"));
    fs.writeFileSync(join(mainSpecDir, "flow.json"), `${JSON.stringify({
      ...mainState,
      request: "main authority",
    }, null, 2)}\n`);

    const switched = JSON.parse(execFileSync("node", [CMD, "flow", "get", "status", "--details"], {
      encoding: "utf8",
      env: { ...process.env, SENRAIL_WORK_ROOT: wtPath },
    }));
    assert.equal(switched.data.request, "main authority");

    const secondSpec = "002-positional";
    const secondState = {
      ...mainState,
      specId: secondSpec,
      runId: "run-positional-second",
      issue: 442,
      worktree: false,
      request: "positional target",
    };
    fs.mkdirSync(join(tmp, "specs", secondSpec), { recursive: true });
    fs.writeFileSync(join(tmp, "specs", secondSpec, "flow.json"), `${JSON.stringify(secondState, null, 2)}\n`);
    makeFlowManager(tmp).addActiveFlow(secondSpec, "local");
    fs.writeFileSync(join(tmp, ".senrail", ".current-flow"), `${specId}\n`);
    const positional = JSON.parse(execFileSync("node", [
      CMD, "flow", "get", "status", "run-positional-second",
      "--expect-run-id", "run-positional-second",
      "--expect-issue", "442",
      "--expect-spec", secondSpec,
    ], {
      encoding: "utf8",
      env: { ...process.env, SENRAIL_WORK_ROOT: wtPath },
    }));
    assert.equal(positional.data.runId, "run-positional-second");

    // Cleanup worktree
    execFileSync("git", ["-C", tmp, "worktree", "remove", "--force", wtPath], { encoding: "utf8" });
  });

  it("does not resume an unregistered flow from a generic linked worktree", () => {
    tmp = createTmpDir();
    initProject(tmp);
    const wtPath = join(tmp, "orphan-wt");
    execFileSync("git", ["-C", tmp, "worktree", "add", wtPath, "-b", "wt-orphan"], { encoding: "utf8" });
    writeJson(wtPath, ".senrail/config.json", {
      lang: "en", type: "sample-node-command",
      docs: { languages: ["en"], defaultLanguage: "en" },
    });
    const prepareResult = spawnSync("node", [
      CMD, "flow", "prepare", "--title", "orphan-generic", "--base", "main",
    ], {
      encoding: "utf8",
      env: { ...process.env, SENRAIL_WORK_ROOT: wtPath },
    });
    assert.equal(
      prepareResult.status,
      0,
      `stdout:\n${prepareResult.stdout}\nstderr:\n${prepareResult.stderr}`,
    );
    const prepared = JSON.parse(prepareResult.stdout);
    fs.rmSync(join(tmp, ".senrail", ".active-flow"), { force: true });

    try {
      execFileSync("node", [
        CMD, "flow", "resume", "--spec", prepared.data.specId,
      ], {
        encoding: "utf8",
        env: { ...process.env, SENRAIL_WORK_ROOT: tmp },
      });
      assert.fail("unregistered worktree flow must not resume");
    } catch (error) {
      const resumed = JSON.parse(error.stdout);
      assert.equal(resumed.ok, false);
      assert.equal(resumed.errors[0].code, "FLOW_TARGET_AUTHORITY_CORRUPT");
    }

    execFileSync("git", ["-C", tmp, "worktree", "remove", "--force", wtPath], { encoding: "utf8" });
  });
});
