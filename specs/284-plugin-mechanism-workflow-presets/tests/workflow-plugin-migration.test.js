// spec: R8 R9
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "../../../src/lib/config.js";
import { createTmpDir, removeTmpDir, writeFile, writeJson } from "../../../tests/helpers/tmp-dir.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..");
const SENTI = path.join(ROOT, "src", "senti.js");

function runCli(root, args) {
  try {
    const stdout = execFileSync(process.execPath, [SENTI, ...args], {
      cwd: ROOT,
      env: { ...process.env, SENTI_WORK_ROOT: root, SENTI_SOURCE_ROOT: ROOT },
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

function writeProject(root, config = {}) {
  writeJson(root, ".senti/config.json", {
    lang: "en",
    type: "base",
    docs: { languages: ["en"], defaultLanguage: "en" },
    workflow: { flowIntegration: "enable" },
    ...config,
  });
}

function git(root, args) {
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function commitAll(repo) {
  git(repo, ["init"]);
  git(repo, ["config", "user.email", "spec@example.test"]);
  git(repo, ["config", "user.name", "Spec Test"]);
  git(repo, ["add", "."]);
  git(repo, ["commit", "-m", "fixture"]);
}

function writeWorkflowPluginRepo(repo) {
  writeJson(repo, "plugin.json", {
    name: "workflow",
    type: "workflow",
    files: ["plugin.json", "commands/", "skills/", "config.schema.json", "config.defaults.json"],
    contributions: {
      commands: [{ name: "workflow", path: "commands/workflow.js" }],
      skills: [{ name: "senti.workflow", path: "skills/senti.workflow" }],
      config: {
        schema: "config.schema.json",
        defaults: "config.defaults.json",
      },
    },
  });
  writeFile(repo, "commands/workflow.js", "export async function main() { return { ok: true }; }\n");
  writeFile(repo, "skills/senti.workflow/SKILL.md", "---\nname: senti.workflow\n---\n");
  writeJson(repo, "config.schema.json", {
    type: "object",
    properties: {
      workflow: {
        type: "object",
        properties: {
          flowIntegration: { type: "string", enum: ["enable", "disable"] },
        },
      },
    },
  });
  writeJson(repo, "config.defaults.json", { workflow: { flowIntegration: "disable" } });
  commitAll(repo);
}

describe("workflow plugin extraction and migration", () => {
  let tmp;
  afterEach(() => {
    if (tmp) removeTmpDir(tmp);
    tmp = null;
  });

  it("R8: workflow command skill and config contributions live in the official workflow plugin artifact", async () => {
    const officialPath = path.join(ROOT, "src", "lib", "official-plugins.js");
    assert.ok(fs.existsSync(officialPath), "src/lib/official-plugins.js must expose official plugin roots");
    const official = await import(officialPath);
    assert.equal(typeof official.officialWorkflowPluginRoot, "function");
    const workflowRoot = official.officialWorkflowPluginRoot();
    const manifestPath = path.join(workflowRoot, "plugin.json");
    assert.ok(fs.existsSync(manifestPath), `missing ${manifestPath}`);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

    assert.equal(manifest.name, "workflow");
    assert.ok(manifest.contributions.commands.some((command) => command.name === "workflow"));
    assert.ok(manifest.contributions.skills.some((skill) => /workflow/.test(skill.name)));
    assert.ok(manifest.contributions.config.schema);
    assert.ok(manifest.contributions.config.defaults);
    assert.ok(fs.existsSync(path.join(workflowRoot, manifest.contributions.config.schema)));
    assert.ok(fs.existsSync(path.join(workflowRoot, manifest.contributions.config.defaults)));
    const schema = JSON.parse(fs.readFileSync(path.join(workflowRoot, manifest.contributions.config.schema), "utf8"));
    assert.match(JSON.stringify(schema), /flowIntegration/);
  });

  it("R8: upgrade enables the official workflow plugin for legacy projects with no plugin config", () => {
    tmp = createTmpDir("senti-workflow-legacy-upgrade-");
    writeProject(tmp);

    const result = runCli(tmp, ["upgrade"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const config = JSON.parse(fs.readFileSync(path.join(tmp, ".senti", "config.json"), "utf8"));
    assert.ok(config.plugin.repos.some((repo) => /workflow/i.test(repo.id)));
    assert.ok(config.plugin.packages.some((pkg) => pkg.id === "workflow" && /^[0-9a-f]{40}$/.test(pkg.commit)));
    assert.equal(config.workflow.flowIntegration, "enable");
    assert.equal(loadConfig(tmp).workflow.flowIntegration, "enable");
  });

  it("R8: upgrade enables the workflow plugin for every valid existing project unless a provider exists", () => {
    tmp = createTmpDir("senti-workflow-upgrade-");
    const workflowRepo = path.join(tmp, "fixtures", "senti-workflow-plugin");
    writeWorkflowPluginRepo(workflowRepo);
    writeProject(tmp, {
      plugin: {
        repos: [{ id: "workflow", source: workflowRepo }],
        packages: [],
      },
    });

    const result = runCli(tmp, ["upgrade"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const config = JSON.parse(fs.readFileSync(path.join(tmp, ".senti", "config.json"), "utf8"));
    assert.ok(config.plugin.repos.some((repo) => /workflow/i.test(repo.id)));
    assert.ok(config.plugin.packages.some((pkg) => pkg.id === "workflow" && /^[0-9a-f]{40}$/.test(pkg.commit)));
    assert.equal(config.workflow.flowIntegration, "enable");
    assert.equal(loadConfig(tmp).workflow.flowIntegration, "enable");
  });

  it("R8: upgrade preserves an existing workflow provider instead of adding the official one", () => {
    tmp = createTmpDir("senti-workflow-provider-upgrade-");
    const workflowRepo = path.join(tmp, "fixtures", "senti-workflow-plugin");
    writeWorkflowPluginRepo(workflowRepo);
    writeProject(tmp, {
      plugin: {
        repos: [
          { id: "official-workflow", source: workflowRepo },
          { id: "custom-workflow-repo", source: "../custom-workflow" },
        ],
        packages: [
          {
            id: "custom-workflow",
            repo: "custom-workflow-repo",
            commit: "0123456789abcdef0123456789abcdef01234567",
          },
        ],
      },
    });
    writeJson(tmp, ".senti/plugins/custom-workflow/plugin.json", {
      name: "custom-workflow",
      type: "workflow",
      files: ["plugin.json", "commands/"],
      contributions: {
        commands: [{ name: "workflow", path: "commands/workflow.js" }],
      },
    });

    const result = runCli(tmp, ["upgrade"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);

    const config = JSON.parse(fs.readFileSync(path.join(tmp, ".senti", "config.json"), "utf8"));
    assert.ok(config.plugin.packages.some((pkg) => pkg.id === "custom-workflow"));
    assert.ok(!config.plugin.packages.some((pkg) => pkg.id === "workflow"));
    assert.equal(config.workflow.flowIntegration, "enable");
  });

  it("R9: plugin registry rejects core command overrides", () => {
    tmp = createTmpDir("senti-plugin-core-dispatch-");
    writeProject(tmp, {
      plugin: {
        repos: [{ id: "override", source: "local" }],
        packages: [{ id: "override", repo: "override", commit: "0123456789abcdef0123456789abcdef01234567" }],
      },
    });
    writeJson(tmp, ".senti/plugins/override/plugin.json", {
      name: "override",
      type: "mixed",
      files: ["plugin.json", "commands/"],
      contributions: {
        commands: [
          { name: "docs", path: "commands/docs.js" },
          { name: "custom-command", path: "commands/custom-command.js" },
        ],
      },
    });
    writeFile(tmp, ".senti/plugins/override/commands/docs.js", "export async function main() {}\n");
    writeFile(tmp, ".senti/plugins/override/commands/custom-command.js", "export async function main() { return { ok: true }; }\n");

    const help = runCli(tmp, ["docs", "--help"]);
    assert.equal(help.status, 0, "core docs command must remain available before plugin command resolution");

    const list = runCli(tmp, ["plugin", "list", "--json"]);
    assert.notEqual(list.status, 0, "core command override must be rejected");
    assert.match(`${list.stdout}\n${list.stderr}`, /core command|override|docs/i);
  });

  it("R9: generic plugin command dispatch runs non-core enabled plugin commands", () => {
    tmp = createTmpDir("senti-plugin-custom-dispatch-");
    writeProject(tmp, {
      plugin: {
        repos: [{ id: "custom", source: "local" }],
        packages: [{ id: "custom", repo: "custom", commit: "0123456789abcdef0123456789abcdef01234567" }],
      },
    });
    writeJson(tmp, ".senti/plugins/custom/plugin.json", {
      name: "custom",
      type: "mixed",
      files: ["plugin.json", "commands/"],
      contributions: {
        commands: [
          { name: "custom-command", path: "commands/custom-command.js" },
        ],
      },
    });
    writeFile(tmp, ".senti/plugins/custom/commands/custom-command.js", "export async function main() { return { ok: true }; }\n");

    const custom = runCli(tmp, ["custom-command", "--help"]);
    assert.equal(custom.status, 0, custom.stderr || custom.stdout);
  });
});
