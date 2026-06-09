import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { createTmpDir, removeTmpDir, writeJson } from "../../../helpers/tmp-dir.js";
import { copyFixtureInto } from "../../../acceptance/lib/pipeline.js";
import { getAcceptanceFixtureDir } from "../../../acceptance/lib/targets.js";

const SCAN_CMD = join(process.cwd(), "src/senti.js");
const SCAN_CMD_ARGS = ["docs", "scan"];
const INIT_CMD = join(process.cwd(), "src/senti.js");
const INIT_CMD_ARGS = ["docs", "init"];
const DATA_CMD = join(process.cwd(), "src/senti.js");
const DATA_CMD_ARGS = ["docs", "data"];

function makeEnv(tmp) {
  return { ...process.env, SENTI_WORK_ROOT: tmp, SENTI_SOURCE_ROOT: tmp };
}

function setupFromFixture(tmp, fixtureName, configOverrides) {
  return copyFixtureInto(getAcceptanceFixtureDir(fixtureName), tmp, configOverrides);
}

describe("parent chain: scan", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("node-cli scan loads modules from cli parent chain DataSource", () => {
    tmp = createTmpDir();
    setupFromFixture(tmp, "node-cli");

    const result = execFileSync("node", [SCAN_CMD, ...SCAN_CMD_ARGS, "--stdout"], {
      encoding: "utf8",
      env: makeEnv(tmp),
    });
    const analysis = JSON.parse(result);

    assert.ok(analysis.analyzedAt, "should have analyzedAt");
    assert.ok(analysis.modules, "modules category should exist from cli parent chain");
    assert.ok(analysis.modules.summary.total > 0, "should have scanned modules");
    assert.ok(analysis.modules.entries.length > 0, "should have module entries");

    const fileNames = analysis.modules.entries.map((m) => m.file);
    assert.ok(fileNames.some((f) => f.includes("cli.js")), "should have scanned cli.js");
  });

  it("laravel scan loads php-webapp parent chain DataSource (config category at top level)", () => {
    tmp = createTmpDir();
    setupFromFixture(tmp, "laravel");

    const result = execFileSync("node", [SCAN_CMD, ...SCAN_CMD_ARGS, "--stdout"], {
      encoding: "utf8",
      env: makeEnv(tmp),
    });
    const analysis = JSON.parse(result);

    assert.ok(analysis.analyzedAt, "should have analyzedAt");
    assert.ok(analysis.package, "package category should exist at top level");
    assert.ok(analysis.package.entries?.length > 0, "package should have entries");
    const composerEntry = analysis.package.entries.find((e) => e.composerDeps);
    assert.ok(composerEntry?.composerDeps?.require, "should have require deps");
    assert.ok(analysis.controllers, "controllers category should exist");
    assert.ok(analysis.controllers.entries?.length > 0, "should have scanned controllers");
    assert.ok(analysis.models, "models category should exist");
    assert.ok(analysis.models.entries?.length > 0, "should have model entries");
    assert.ok(analysis.routes, "routes category should exist");
    assert.ok(analysis.routes.entries?.length > 0, "should have route entries");
    assert.ok(analysis.tables, "tables category should exist");
    assert.ok(analysis.tables.entries?.length > 0, "should have table entries");
  });
});

describe("parent chain: init", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("node-cli init includes stack_and_ops.md from parent chain", () => {
    tmp = createTmpDir();
    setupFromFixture(tmp, "node-cli", {
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      chapters: [
        { chapter: "overview.md" },
        { chapter: "stack_and_ops.md" },
        { chapter: "project_structure.md" },
        { chapter: "cli_commands.md" },
      ],
    });
    writeJson(tmp, ".senti/output/analysis.json", {
      analyzedAt: "2026-01-01",
      modules: { entries: [{ file: "src/cli.js", className: "cli.js", methods: ["run"] }], summary: { total: 1 } },
    });

    execFileSync("node", [INIT_CMD, ...INIT_CMD_ARGS, "--force"], {
      encoding: "utf8",
      env: makeEnv(tmp),
    });

    const docsDir = join(tmp, "docs");
    const files = fs.readdirSync(docsDir).filter((f) => f.endsWith(".md"));
    assert.ok(files.length > 0, "should have chapter files");

    const hasStackAndOps = files.some((f) => f.includes("stack_and_ops"));
    assert.ok(hasStackAndOps, "stack_and_ops.md should be included from parent chain");
  });

  it("laravel init generates webapp chapters with ja fallback", () => {
    tmp = createTmpDir();
    setupFromFixture(tmp, "laravel", {
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      chapters: [
        { chapter: "overview.md" },
        { chapter: "stack_and_ops.md" },
        { chapter: "project_structure.md" },
        { chapter: "controller_routes.md" },
      ],
    });
    writeJson(tmp, ".senti/output/analysis.json", {
      analyzedAt: "2026-01-01",
      controllers: { entries: [], summary: { total: 0, totalActions: 0 } },
      models: { entries: [], summary: { total: 0 } },
    });

    execFileSync("node", [INIT_CMD, ...INIT_CMD_ARGS, "--force"], {
      encoding: "utf8",
      env: makeEnv(tmp),
    });

    const docsDir = join(tmp, "docs");
    const files = fs.readdirSync(docsDir).filter((f) => f.endsWith(".md"));
    assert.ok(files.length >= 4, `should have at least 4 chapters, got ${files.length}`);

    const hasStackAndOps = files.some((f) => f.includes("stack_and_ops"));
    assert.ok(hasStackAndOps, "stack_and_ops.md should be included from php-webapp parent chain");
  });

  it("resolveChaptersOrder includes parent chain chapters", async () => {
    const { resolveChaptersOrder } = await import("../../../../src/docs/lib/template-merger.js");

    const nodeCli = resolveChaptersOrder("node-cli");
    assert.ok(nodeCli.includes("stack_and_ops.md"), "node-cli should include stack_and_ops.md from parent chain");
    assert.ok(nodeCli.includes("overview.md"), "should include overview.md");
    assert.ok(nodeCli.includes("cli_commands.md"), "should include cli_commands.md from node-cli preset");

    const overviewIdx = nodeCli.indexOf("overview.md");
    const stackIdx = nodeCli.indexOf("stack_and_ops.md");
    assert.ok(stackIdx > overviewIdx, "stack_and_ops.md should come after overview.md");

    const laravel = resolveChaptersOrder("laravel");
    assert.ok(laravel.includes("stack_and_ops.md"), "laravel should include stack_and_ops.md from parent chain");
    assert.ok(laravel.includes("controller_routes.md"), "should include controller_routes.md from webapp preset");
  });
});

describe("parent chain: data", () => {
  let tmp;
  afterEach(() => tmp && removeTmpDir(tmp));

  it("node-cli stack_and_ops uses text directive instead of data for config.stack", () => {
    tmp = createTmpDir();
    setupFromFixture(tmp, "node-cli", {
      docs: { languages: ["ja"], defaultLanguage: "ja" },
    });

    execFileSync("node", [INIT_CMD, ...INIT_CMD_ARGS, "--force"], {
      encoding: "utf8",
      env: makeEnv(tmp),
    });

    const docsDir = join(tmp, "docs");
    const files = fs.readdirSync(docsDir).filter((f) => f.includes("stack_and_ops"));
    assert.ok(files.length > 0, "stack_and_ops chapter should exist");

    const stackFile = join(docsDir, files[0]);
    const content = fs.readFileSync(stackFile, "utf8");
    assert.ok(!content.includes("config.stack"), "should not contain config.stack data directive");
  });

  it("laravel data resolves config.composer directive via laravel DataSource", () => {
    tmp = createTmpDir();
    setupFromFixture(tmp, "laravel", {
      docs: { languages: ["ja"], defaultLanguage: "ja" },
      chapters: [
        { chapter: "overview.md" },
        { chapter: "stack_and_ops.md" },
        { chapter: "project_structure.md" },
        { chapter: "controller_routes.md" },
      ],
    });

    execFileSync("node", [SCAN_CMD, ...SCAN_CMD_ARGS], {
      encoding: "utf8",
      env: makeEnv(tmp),
    });

    execFileSync("node", [INIT_CMD, ...INIT_CMD_ARGS, "--force"], {
      encoding: "utf8",
      env: makeEnv(tmp),
    });

    const docsDir = join(tmp, "docs");
    const files = fs.readdirSync(docsDir).filter((f) => f.includes("stack_and_ops"));

    let targetFile;
    if (files.length > 0) {
      targetFile = join(docsDir, files[0]);
    } else {
      targetFile = join(docsDir, "01_stack_and_ops.md");
      fs.writeFileSync(targetFile, "# 01. Stack and Ops\n\n");
    }

    const before = fs.readFileSync(targetFile, "utf8");
    if (!before.includes("laravel.config.composer")) {
      const content = `${before}\n<!-- {{data("laravel.config.composer", {labels: "Package|Version|Description"})}} -->\nplaceholder\n<!-- {{/data}} -->\n`;
      fs.writeFileSync(targetFile, content);
    }

    execFileSync("node", [DATA_CMD, ...DATA_CMD_ARGS], {
      encoding: "utf8",
      env: makeEnv(tmp),
    });

    const after = fs.readFileSync(targetFile, "utf8");
    assert.ok(!after.includes("placeholder"), "config.composer directive should be resolved");
    assert.ok(
      after.includes("Package") || after.includes("laravel/framework") || after.includes("php"),
      "resolved config.composer should contain package information from composer.json",
    );
  });
});
