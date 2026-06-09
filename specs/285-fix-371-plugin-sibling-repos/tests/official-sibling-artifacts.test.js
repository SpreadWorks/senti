// spec: R1 R2
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PRESETS_REPO = "/home/nakano/workspace/senti-presets";
const WORKFLOW_REPO = "/home/nakano/workspace/senti-workflow-plugin";
const SPEC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EVIDENCE_PATH = path.join(SPEC_DIR, "sibling-repository-evidence.json");
const EXPECTED_OFFICIAL_PRESETS = [
  "api",
  "architecture",
  "cakephp2",
  "ci",
  "cli",
  "coding-rule",
  "database",
  "document",
  "drizzle",
  "edge",
  "github-actions",
  "graphql",
  "greenfield",
  "hono",
  "infrastructure",
  "js-webapp",
  "laravel",
  "library",
  "maintenance",
  "monorepo",
  "mysql",
  "nextjs",
  "node-cli",
  "oss-contribute",
  "php-webapp",
  "postgres",
  "principle",
  "r2",
  "rest",
  "storage",
  "symfony",
  "ui-ux",
  "web-design",
  "webapp",
  "workers",
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function git(repo, args) {
  return execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function assertCleanGitRepo(repo) {
  assert.ok(fs.existsSync(path.join(repo, ".git")), `${repo} must be a Git repository`);
  assert.match(git(repo, ["rev-parse", "HEAD"]), /^[0-9a-f]{40}$/);
  assert.equal(git(repo, ["status", "--short"]), "", `${repo} must be clean`);
}

function assertEvidence(requirement, repo, name) {
  const evidence = readJson(EVIDENCE_PATH);
  const entry = evidence.repositories.find((item) => item.requirement === requirement);
  assert.ok(entry, `${requirement} evidence entry is required`);
  assert.equal(entry.name, name);
  assert.equal(entry.path, repo);
  assert.equal(entry.head, git(repo, ["rev-parse", "HEAD"]));
  assert.equal(entry.tree, git(repo, ["rev-parse", "HEAD^{tree}"]));
  assert.equal(entry.status, "clean");
  assert.equal(git(repo, ["status", "--short"]), "");
  return entry;
}

function assertTrackedAtHead(repo, relPath) {
  const normalized = relPath.replace(/\/$/, "");
  const trackedFiles = git(repo, ["ls-files", "--", normalized]).split("\n").filter(Boolean);
  assert.notEqual(trackedFiles.length, 0, `${relPath} must be tracked in git`);
  for (const file of trackedFiles) {
    git(repo, ["cat-file", "-e", `HEAD:${file}`]);
  }
}

function assertPackaged(files, relPath) {
  const normalized = relPath.replace(/\/$/, "");
  assert.ok(
    files.some((entry) => {
      const file = entry.replace(/\/$/, "");
      return normalized === file || normalized.startsWith(`${file}/`);
    }),
    `${relPath} must be included in manifest.files`,
  );
}

function assertInsideRepo(repo, relPath) {
  assert.ok(relPath, "contribution path must be non-empty");
  assert.equal(path.isAbsolute(relPath), false, `${relPath} must be relative`);
  assert.ok(!relPath.includes(".."), `${relPath} must not traverse parents`);
  const full = path.resolve(repo, relPath);
  assert.ok(full.startsWith(path.resolve(repo) + path.sep), `${relPath} must stay inside repo`);
  assert.ok(fs.existsSync(full), `missing contribution path: ${full}`);
  assertTrackedAtHead(repo, relPath);
}

describe("official sibling plugin artifacts", () => {
  it("R1: senti-presets is a committed official preset plugin package", () => {
    assertCleanGitRepo(PRESETS_REPO);
    const evidence = assertEvidence("R1", PRESETS_REPO, "senti-presets");
    const manifestPath = path.join(PRESETS_REPO, "plugin.json");
    assert.ok(fs.existsSync(manifestPath), "senti-presets/plugin.json must exist");
    assertTrackedAtHead(PRESETS_REPO, "plugin.json");

    const manifest = readJson(manifestPath);
    assert.equal(manifest.name, "official-presets");
    assert.equal(manifest.type, "preset");
    assert.ok(Array.isArray(manifest.files));
    assert.ok(manifest.files.includes("plugin.json"));
    assert.ok(manifest.files.some((entry) => entry === "presets/" || entry === "presets"));
    assert.ok(Array.isArray(manifest.contributions?.presets));

    const keys = manifest.contributions.presets.map((preset) => preset.key).sort();
    assert.deepEqual(keys, EXPECTED_OFFICIAL_PRESETS);
    assert.deepEqual(
      evidence.trackedPresetManifests,
      EXPECTED_OFFICIAL_PRESETS.map((key) => `presets/${key}/preset.json`),
    );
    for (const preset of manifest.contributions.presets) {
      assert.ok(preset.key, "preset contribution key is required");
      assert.ok(preset.parent, `preset ${preset.key} parent is required`);
      assertPackaged(manifest.files, preset.path);
      assertInsideRepo(PRESETS_REPO, preset.path);
      assert.ok(fs.existsSync(path.join(PRESETS_REPO, preset.path, "preset.json")));
      assertTrackedAtHead(PRESETS_REPO, path.join(preset.path, "preset.json"));
    }
  });

  it("R2: senti-workflow-plugin is a committed official workflow plugin package", () => {
    assertCleanGitRepo(WORKFLOW_REPO);
    assertEvidence("R2", WORKFLOW_REPO, "senti-workflow-plugin");
    const manifestPath = path.join(WORKFLOW_REPO, "plugin.json");
    assert.ok(fs.existsSync(manifestPath), "senti-workflow-plugin/plugin.json must exist");
    assertTrackedAtHead(WORKFLOW_REPO, "plugin.json");

    const manifest = readJson(manifestPath);
    assert.equal(manifest.name, "workflow");
    assert.equal(manifest.type, "workflow");
    assert.ok(Array.isArray(manifest.files));
    assert.ok(manifest.files.includes("plugin.json"));

    const workflowCommand = manifest.contributions?.commands?.find((command) => command.name === "workflow");
    assert.ok(workflowCommand, "workflow command contribution is required");
    assertPackaged(manifest.files, workflowCommand.path);
    assertInsideRepo(WORKFLOW_REPO, workflowCommand.path);

    const workflowSkill = manifest.contributions?.skills?.find((skill) => skill.name === "senti.workflow");
    assert.ok(workflowSkill, "senti.workflow skill contribution is required");
    assertPackaged(manifest.files, workflowSkill.path);
    assertInsideRepo(WORKFLOW_REPO, workflowSkill.path);
    assert.ok(fs.existsSync(path.join(WORKFLOW_REPO, workflowSkill.path, "SKILL.md")));

    assertPackaged(manifest.files, manifest.contributions.config.schema);
    assertInsideRepo(WORKFLOW_REPO, manifest.contributions.config.schema);
    assertPackaged(manifest.files, manifest.contributions.config.defaults);
    assertInsideRepo(WORKFLOW_REPO, manifest.contributions.config.defaults);
    assert.match(fs.readFileSync(path.join(WORKFLOW_REPO, manifest.contributions.config.schema), "utf8"), /flowIntegration/);
  });
});
