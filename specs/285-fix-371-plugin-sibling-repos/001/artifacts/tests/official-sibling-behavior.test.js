// spec: R3 R4 R5
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../tests/helpers/tmp-dir.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..");
const SENTI = path.join(ROOT, "src", "senti.js");
const PRESETS_REPO = "/home/nakano/workspace/senti-presets";
const WORKFLOW_REPO = "/home/nakano/workspace/senti-workflow-plugin";

function runCli(root, args, extraEnv = {}) {
  try {
    const stdout = execFileSync(process.execPath, [SENTI, ...args], {
      cwd: ROOT,
      env: {
        ...process.env,
        SENTI_WORK_ROOT: root,
        SENTI_SOURCE_ROOT: ROOT,
        SENTI_OFFICIAL_PRESETS_REPO: PRESETS_REPO,
        SENTI_OFFICIAL_WORKFLOW_PLUGIN_REPO: WORKFLOW_REPO,
        ...extraEnv,
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    return {
      status: err.status ?? 1,
      stdout: err.stdout?.toString() ?? "",
      stderr: err.stderr?.toString() ?? "",
    };
  }
}

function git(repo, args) {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function commitAll(repo) {
  execFileSync("git", ["init"], { cwd: repo, stdio: ["ignore", "pipe", "pipe"] });
  git(repo, ["config", "user.email", "spec@example.test"]);
  git(repo, ["config", "user.name", "Spec Test"]);
  git(repo, ["add", "."]);
  git(repo, ["commit", "-m", "fixture"]);
}

function commitEmptyRepo(repo) {
  execFileSync("git", ["init"], { cwd: repo, stdio: ["ignore", "pipe", "pipe"] });
  git(repo, ["config", "user.email", "spec@example.test"]);
  git(repo, ["config", "user.name", "Spec Test"]);
  git(repo, ["commit", "--allow-empty", "-m", "empty fixture"]);
}

function initRepoWithoutHead(repo) {
  execFileSync("git", ["init"], { cwd: repo, stdio: ["ignore", "pipe", "pipe"] });
  git(repo, ["config", "user.email", "spec@example.test"]);
  git(repo, ["config", "user.name", "Spec Test"]);
}

async function importFresh(relPath) {
  const url = pathToFileURL(path.join(ROOT, relPath));
  url.search = `?t=${Date.now()}-${Math.random()}`;
  return import(url.href);
}

function writeProject(root, config = {}) {
  writeJson(root, ".senti/config.json", {
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    workflow: { flowIntegration: "enable" },
    ...config,
  });
}

function writeMinimalPresetPlugin(repo) {
  writeJson(repo, "plugin.json", {
    name: "official-presets",
    type: "preset",
    files: ["plugin.json", "presets/"],
    contributions: {
      presets: [{ key: "webapp", path: "presets/webapp", parent: "base" }],
    },
  });
  writeJson(repo, "presets/webapp/preset.json", {
    parent: "base",
    label: "Webapp",
    chapters: [{ chapter: "README.md" }],
  });
}

function writeMinimalPresetPluginRepo(repo) {
  writeMinimalPresetPlugin(repo);
  commitAll(repo);
}

function writeBrokenPresetPlugin(repo) {
  writeJson(repo, "plugin.json", {
    name: "official-presets",
    type: "preset",
    files: ["plugin.json", "presets/"],
    contributions: {
      presets: [{ key: "webapp", path: "presets/webapp", parent: "base" }],
    },
  });
  commitAll(repo);
}

function writeMinimalWorkflowPlugin(repo) {
  writeJson(repo, "plugin.json", {
    name: "workflow",
    type: "workflow",
    files: ["plugin.json", "commands/", "skills/", "config/"],
    contributions: {
      commands: [{ name: "workflow", path: "commands/workflow.js" }],
      skills: [{ name: "senti.workflow", path: "skills/senti.workflow" }],
      config: {
        schema: "config/schema.json",
        defaults: "config/defaults.json",
      },
    },
  });
  writeFile(repo, "commands/workflow.js", "export function main() { console.log('workflow fixture'); }\n");
  writeFile(repo, "skills/senti.workflow/SKILL.md", "---\nname: senti.workflow\n---\n");
  writeJson(repo, "config/schema.json", { properties: { workflow: { properties: { flowIntegration: { type: "string" } } } } });
  writeJson(repo, "config/defaults.json", { workflow: { flowIntegration: "enable" } });
}

function writeMinimalWorkflowPluginRepo(repo) {
  writeMinimalWorkflowPlugin(repo);
  commitAll(repo);
}

function writeBrokenWorkflowPlugin(repo) {
  writeJson(repo, "plugin.json", {
    name: "workflow",
    type: "workflow",
    files: ["plugin.json", "commands/", "skills/", "config/"],
    contributions: {
      commands: [{ name: "workflow", path: "commands/workflow.js" }],
      skills: [{ name: "senti.workflow", path: "skills/senti.workflow" }],
      config: {
        schema: "config/schema.json",
        defaults: "config/defaults.json",
      },
    },
  });
  writeFile(repo, "skills/senti.workflow/SKILL.md", "---\nname: senti.workflow\n---\n");
  writeJson(repo, "config/schema.json", { properties: { workflow: { properties: { flowIntegration: { type: "string" } } } } });
  writeJson(repo, "config/defaults.json", { workflow: { flowIntegration: "enable" } });
  commitAll(repo);
}

function assertOfficialPresetsNotWritten(root) {
  const config = JSON.parse(fs.readFileSync(path.join(root, ".senti", "config.json"), "utf8"));
  assert.ok(!config.plugin?.packages?.some((pkg) => pkg.id === "official-presets"));
  assert.ok(!fs.existsSync(path.join(root, ".senti", "plugins", "official-presets")));
}

function assertWorkflowNotWritten(root) {
  const config = JSON.parse(fs.readFileSync(path.join(root, ".senti", "config.json"), "utf8"));
  assert.ok(!config.plugin?.packages?.some((pkg) => pkg.id === "workflow"));
  assert.ok(!fs.existsSync(path.join(root, ".senti", "plugins", "workflow")));
}

describe("official sibling plugin behavior", () => {
  let tmp;
  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  it("R3: official helpers expose sibling roots and unenabled non-base presets are unavailable", async () => {
    process.env.SENTI_OFFICIAL_PRESETS_REPO = PRESETS_REPO;
    process.env.SENTI_OFFICIAL_WORKFLOW_PLUGIN_REPO = WORKFLOW_REPO;
    const official = await importFresh("src/lib/official-plugins.js");

    assert.equal(official.officialPresetPluginRoot(), PRESETS_REPO);
    assert.equal(official.officialWorkflowPluginRoot(), WORKFLOW_REPO);

    tmp = createTmpDir("senti-official-unenabled-");
    writeProject(tmp, {
      workflow: { flowIntegration: "disable" },
      plugin: { repos: [], packages: [] },
    });
    const presets = await importFresh("src/lib/presets.js");
    assert.deepEqual(
      presets.CORE_PRESETS.map((preset) => preset.key).sort(),
      ["base"],
      "src/presets/base must be the only built-in preset source",
    );
    assert.throws(
      () => presets.resolveChain("webapp", tmp),
      /Preset not found: webapp/,
      "non-base official presets must not resolve until the plugin is enabled",
    );
  });

  it("R4: official preset upgrade rejects dirty sibling sources before writing plugin.packages", () => {
    tmp = createTmpDir("senti-official-dirty-");
    const dirtyRepo = path.join(tmp, "dirty-senti-presets");
    writeMinimalPresetPluginRepo(dirtyRepo);
    writeFile(dirtyRepo, "presets/webapp/dirty.txt", "not committed\n");
    writeProject(tmp, { type: "webapp" });

    const result = runCli(tmp, ["upgrade"], { SENTI_OFFICIAL_PRESETS_REPO: dirtyRepo });

    assert.notEqual(result.status, 0, "dirty official source must fail upgrade");
    assert.match(`${result.stdout}\n${result.stderr}`, /dirty|clean|uncommitted/i);
    assertOfficialPresetsNotWritten(tmp);
  });

  it("R4: official preset upgrade rejects an empty sibling source", () => {
    tmp = createTmpDir("senti-official-empty-");
    const emptyRepo = path.join(tmp, "empty-senti-presets");
    fs.mkdirSync(emptyRepo, { recursive: true });
    commitEmptyRepo(emptyRepo);
    writeProject(tmp, { type: "webapp" });

    const result = runCli(tmp, ["upgrade"], { SENTI_OFFICIAL_PRESETS_REPO: emptyRepo });

    assert.notEqual(result.status, 0, "empty sibling source must fail upgrade");
    assert.match(`${result.stdout}\n${result.stderr}`, /plugin\.json|manifest|empty/i);
    assertOfficialPresetsNotWritten(tmp);
  });

  it("R4: official preset upgrade rejects a sibling source without plugin.json", () => {
    tmp = createTmpDir("senti-official-missing-manifest-");
    const missingManifestRepo = path.join(tmp, "missing-manifest-senti-presets");
    writeFile(missingManifestRepo, "README.md", "no plugin manifest here\n");
    commitAll(missingManifestRepo);
    writeProject(tmp, { type: "webapp" });

    const result = runCli(tmp, ["upgrade"], { SENTI_OFFICIAL_PRESETS_REPO: missingManifestRepo });

    assert.notEqual(result.status, 0, "missing plugin.json must fail upgrade");
    assert.match(`${result.stdout}\n${result.stderr}`, /plugin\.json|manifest/i);
    assertOfficialPresetsNotWritten(tmp);
  });

  it("R4: official preset upgrade rejects missing contribution paths", () => {
    tmp = createTmpDir("senti-official-missing-path-");
    const brokenRepo = path.join(tmp, "broken-senti-presets");
    writeBrokenPresetPlugin(brokenRepo);
    writeProject(tmp, { type: "webapp" });

    const result = runCli(tmp, ["upgrade"], { SENTI_OFFICIAL_PRESETS_REPO: brokenRepo });

    assert.notEqual(result.status, 0, "missing contribution path must fail upgrade");
    assert.match(`${result.stdout}\n${result.stderr}`, /missing|ENOENT|presets/i);
    assertOfficialPresetsNotWritten(tmp);
  });

  it("R4: official preset upgrade rejects non-Git sources before commit pinning", () => {
    tmp = createTmpDir("senti-official-non-git-");
    const nonGitRepo = path.join(tmp, "non-git-senti-presets");
    writeJson(nonGitRepo, "plugin.json", {
      name: "official-presets",
      type: "preset",
      files: ["plugin.json", "presets/"],
      contributions: {
        presets: [{ key: "webapp", path: "presets/webapp", parent: "base" }],
      },
    });
    writeJson(nonGitRepo, "presets/webapp/preset.json", {
      parent: "base",
      label: "Webapp",
      chapters: [{ chapter: "README.md" }],
    });
    writeProject(tmp, { type: "webapp" });

    const result = runCli(tmp, ["upgrade"], { SENTI_OFFICIAL_PRESETS_REPO: nonGitRepo });

    assert.notEqual(result.status, 0, "non-Git official source must fail upgrade");
    assert.match(`${result.stdout}\n${result.stderr}`, /git|HEAD|commit/i);
    assertOfficialPresetsNotWritten(tmp);
  });

  it("R4: official preset upgrade rejects missing HEAD before writing a pinned package", () => {
    tmp = createTmpDir("senti-official-missing-head-");
    const noHeadRepo = path.join(tmp, "no-head-senti-presets");
    fs.mkdirSync(noHeadRepo, { recursive: true });
    initRepoWithoutHead(noHeadRepo);
    writeMinimalPresetPlugin(noHeadRepo);
    writeProject(tmp, { type: "webapp" });

    const result = runCli(tmp, ["upgrade"], { SENTI_OFFICIAL_PRESETS_REPO: noHeadRepo });

    assert.notEqual(result.status, 0, "official source without HEAD must fail upgrade");
    assert.match(`${result.stdout}\n${result.stderr}`, /HEAD|commit|plugin\.json/i);
    assertOfficialPresetsNotWritten(tmp);
  });

  it("R4: official preset upgrade rejects working-tree-only files that would mismatch the recorded commit", () => {
    tmp = createTmpDir("senti-official-worktree-mismatch-");
    const mismatchRepo = path.join(tmp, "mismatch-senti-presets");
    writeMinimalPresetPluginRepo(mismatchRepo);
    writeFile(mismatchRepo, "presets/webapp/worktree-only.txt", "not present in HEAD\n");
    writeProject(tmp, { type: "webapp" });

    const result = runCli(tmp, ["upgrade"], { SENTI_OFFICIAL_PRESETS_REPO: mismatchRepo });

    assert.notEqual(result.status, 0, "working tree content outside the recorded commit must fail upgrade");
    assert.match(`${result.stdout}\n${result.stderr}`, /dirty|clean|uncommitted|commit/i);
    assertOfficialPresetsNotWritten(tmp);
  });

  it("R4: official workflow upgrade rejects an empty sibling source", () => {
    tmp = createTmpDir("senti-official-workflow-empty-");
    const emptyRepo = path.join(tmp, "empty-workflow");
    fs.mkdirSync(emptyRepo, { recursive: true });
    commitEmptyRepo(emptyRepo);
    writeProject(tmp);

    const result = runCli(tmp, ["upgrade"], { SENTI_OFFICIAL_WORKFLOW_PLUGIN_REPO: emptyRepo });

    assert.notEqual(result.status, 0, "empty workflow sibling source must fail upgrade");
    assert.match(`${result.stdout}\n${result.stderr}`, /plugin\.json|manifest|empty/i);
    assertWorkflowNotWritten(tmp);
  });

  it("R4: official workflow upgrade rejects a sibling source without plugin.json", () => {
    tmp = createTmpDir("senti-official-workflow-missing-manifest-");
    const missingManifestRepo = path.join(tmp, "missing-manifest-workflow");
    writeFile(missingManifestRepo, "README.md", "no plugin manifest here\n");
    commitAll(missingManifestRepo);
    writeProject(tmp);

    const result = runCli(tmp, ["upgrade"], { SENTI_OFFICIAL_WORKFLOW_PLUGIN_REPO: missingManifestRepo });

    assert.notEqual(result.status, 0, "missing workflow plugin.json must fail upgrade");
    assert.match(`${result.stdout}\n${result.stderr}`, /plugin\.json|manifest/i);
    assertWorkflowNotWritten(tmp);
  });

  it("R4: official workflow upgrade rejects missing contribution paths", () => {
    tmp = createTmpDir("senti-official-workflow-missing-path-");
    const brokenRepo = path.join(tmp, "broken-workflow");
    writeBrokenWorkflowPlugin(brokenRepo);
    writeProject(tmp);

    const result = runCli(tmp, ["upgrade"], { SENTI_OFFICIAL_WORKFLOW_PLUGIN_REPO: brokenRepo });

    assert.notEqual(result.status, 0, "missing workflow contribution path must fail upgrade");
    assert.match(`${result.stdout}\n${result.stderr}`, /missing|ENOENT|commands/i);
    assertWorkflowNotWritten(tmp);
  });

  it("R4: official workflow upgrade rejects dirty sibling sources before writing plugin.packages", () => {
    tmp = createTmpDir("senti-official-workflow-dirty-");
    const dirtyRepo = path.join(tmp, "dirty-workflow");
    writeMinimalWorkflowPluginRepo(dirtyRepo);
    writeFile(dirtyRepo, "commands/dirty.js", "not committed\n");
    writeProject(tmp);

    const result = runCli(tmp, ["upgrade"], { SENTI_OFFICIAL_WORKFLOW_PLUGIN_REPO: dirtyRepo });

    assert.notEqual(result.status, 0, "dirty workflow source must fail upgrade");
    assert.match(`${result.stdout}\n${result.stderr}`, /dirty|clean|uncommitted/i);
    assertWorkflowNotWritten(tmp);
  });

  it("R4: official workflow upgrade rejects non-Git sources before commit pinning", () => {
    tmp = createTmpDir("senti-official-workflow-non-git-");
    const nonGitRepo = path.join(tmp, "non-git-workflow");
    writeMinimalWorkflowPlugin(nonGitRepo);
    writeProject(tmp);

    const result = runCli(tmp, ["upgrade"], { SENTI_OFFICIAL_WORKFLOW_PLUGIN_REPO: nonGitRepo });

    assert.notEqual(result.status, 0, "non-Git workflow source must fail upgrade");
    assert.match(`${result.stdout}\n${result.stderr}`, /git|HEAD|commit/i);
    assertWorkflowNotWritten(tmp);
  });

  it("R4: official workflow upgrade rejects missing HEAD before writing a pinned package", () => {
    tmp = createTmpDir("senti-official-workflow-missing-head-");
    const noHeadRepo = path.join(tmp, "no-head-workflow");
    fs.mkdirSync(noHeadRepo, { recursive: true });
    initRepoWithoutHead(noHeadRepo);
    writeMinimalWorkflowPlugin(noHeadRepo);
    writeProject(tmp);

    const result = runCli(tmp, ["upgrade"], { SENTI_OFFICIAL_WORKFLOW_PLUGIN_REPO: noHeadRepo });

    assert.notEqual(result.status, 0, "workflow source without HEAD must fail upgrade");
    assert.match(`${result.stdout}\n${result.stderr}`, /HEAD|commit|plugin\.json/i);
    assertWorkflowNotWritten(tmp);
  });

  it("R4: official workflow upgrade rejects working-tree-only files that would mismatch the recorded commit", () => {
    tmp = createTmpDir("senti-official-workflow-worktree-mismatch-");
    const mismatchRepo = path.join(tmp, "mismatch-workflow");
    writeMinimalWorkflowPluginRepo(mismatchRepo);
    writeFile(mismatchRepo, "commands/worktree-only.js", "not present in HEAD\n");
    writeProject(tmp);

    const result = runCli(tmp, ["upgrade"], { SENTI_OFFICIAL_WORKFLOW_PLUGIN_REPO: mismatchRepo });

    assert.notEqual(result.status, 0, "workflow working tree content outside the recorded commit must fail upgrade");
    assert.match(`${result.stdout}\n${result.stderr}`, /dirty|clean|uncommitted|commit/i);
    assertWorkflowNotWritten(tmp);
  });

  it("R4/R5: official preset upgrade records a commit-pinned sibling package", () => {
    tmp = createTmpDir("senti-official-presets-success-");
    writeProject(tmp, { type: "webapp" });

    const upgrade = runCli(tmp, ["upgrade"]);
    assert.equal(upgrade.status, 0, upgrade.stderr || upgrade.stdout);

    const config = JSON.parse(fs.readFileSync(path.join(tmp, ".senti", "config.json"), "utf8"));
    const presetPackage = config.plugin.packages.find((pkg) => pkg.id === "official-presets");
    assert.ok(presetPackage, "official-presets package must be enabled");
    assert.equal(config.plugin.repos.find((repo) => repo.id === presetPackage.repo).source, PRESETS_REPO);
    assert.equal(presetPackage.commit, git(PRESETS_REPO, ["rev-parse", "HEAD"]));
    assert.ok(fs.existsSync(path.join(tmp, ".senti", "plugins", "official-presets", "presets", "webapp", "preset.json")));
  });

  it("R5: upgrade from sibling workflow repo installs and executes workflow command", async () => {
    tmp = createTmpDir("senti-official-workflow-");
    writeProject(tmp);

    const upgrade = runCli(tmp, ["upgrade"]);
    assert.equal(upgrade.status, 0, upgrade.stderr || upgrade.stdout);

    const config = JSON.parse(fs.readFileSync(path.join(tmp, ".senti", "config.json"), "utf8"));
    const workflowPackage = config.plugin.packages.find((pkg) => pkg.id === "workflow");
    assert.ok(workflowPackage, "workflow package must be enabled");
    assert.equal(config.plugin.repos.find((repo) => repo.id === workflowPackage.repo).source, WORKFLOW_REPO);
    assert.equal(workflowPackage.commit, git(WORKFLOW_REPO, ["rev-parse", "HEAD"]));
    const installedCommand = path.join(tmp, ".senti", "plugins", "workflow", "commands", "workflow.js");
    assert.ok(fs.existsSync(installedCommand));

    const registryModule = await importFresh("src/lib/plugin-registry.js");
    const workflowCommand = registryModule.loadPluginRegistry(tmp).resolveCommand("workflow");
    assert.equal(workflowCommand.absolutePath, installedCommand);

    const help = runCli(tmp, ["workflow", "--help"]);
    assert.equal(help.status, 0, help.stderr || help.stdout);
    assert.match(help.stdout, /workflow|Usage/i);
  });
});
