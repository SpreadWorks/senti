// spec: R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11 R12
//
// Spec verification tests for 269-promote-workflow-cli.
// These verify the workflow CLI promotion (experimental/ → src/workflow/,
// `sdd-forge workflow` surface, enable-gate removal, config-key migration,
// skill relocation, help registration). They are expected to FAIL before
// implementation (src/workflow/ does not exist yet).

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// specs/269-promote-workflow-cli/tests → repo (worktree) root
const ROOT = path.resolve(__dirname, "..", "..", "..");
const SDD_FORGE = path.join(ROOT, "src", "sdd-forge.js");

// Isolated work root with a minimal, schema-valid config so CLI invocations do
// not depend on this repo's own .sdd-forge/config.json (which migrates to the
// new workflow.* key on a different schedule). repoRoot() honors SDD_FORGE_WORK_ROOT.
const CLI_WORK_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), "sdd-workflow-cli-"));
fs.mkdirSync(path.join(CLI_WORK_ROOT, ".sdd-forge"), { recursive: true });
fs.writeFileSync(
  path.join(CLI_WORK_ROOT, ".sdd-forge", "config.json"),
  JSON.stringify({
    lang: "ja",
    type: "node-cli",
    docs: { languages: ["ja"], defaultLanguage: "ja" },
    workflow: { languages: { source: "ja", publish: "en" } },
  }),
);

/** Run `node src/sdd-forge.js <args...>` against an isolated work root, never throwing. */
function runCli(args) {
  try {
    const stdout = execFileSync(process.execPath, [SDD_FORGE, ...args], {
      cwd: ROOT,
      env: { ...process.env, SDD_FORGE_WORK_ROOT: CLI_WORK_ROOT },
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

/** Recursively collect file contents under a directory (empty if absent). */
function readTree(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...readTree(full));
    else out.push({ path: full, content: fs.readFileSync(full, "utf8") });
  }
  return out;
}

// --- R1: workflow source relocated under src/workflow/ ---------------------
test("R1: src/workflow/ contains the relocated dispatcher, registry, every lib dependency and all commands", () => {
  const wfDir = path.join(ROOT, "src", "workflow");
  assert.ok(fs.existsSync(wfDir), "src/workflow/ must exist");

  // Dispatcher entry must live INSIDE src/workflow/ (R1: relocate under src/workflow/).
  // NAMESPACE_SCRIPTS resolves <value>.js, so the route value is "workflow/index".
  assert.ok(
    fs.existsSync(path.join(wfDir, "index.js")),
    "the workflow dispatcher must live at src/workflow/index.js (inside src/workflow/)",
  );
  assert.ok(
    !fs.existsSync(path.join(ROOT, "src", "workflow.js")),
    "no top-level src/workflow.js dispatcher may remain outside src/workflow/",
  );

  assert.ok(fs.existsSync(path.join(wfDir, "registry.js")), "src/workflow/registry.js must exist");

  const libDir = path.join(wfDir, "lib");
  assert.ok(fs.existsSync(libDir), "src/workflow/lib/ must exist");
  for (const dep of [
    "config.js", "graphql.js", "board-helpers.js", "hash.js",
    "validation.js", "category.js", "base-command.js",
  ]) {
    assert.ok(fs.existsSync(path.join(libDir, dep)), `src/workflow/lib/${dep} must exist`);
  }

  const cmdDir = path.join(libDir, "commands");
  assert.ok(fs.existsSync(cmdDir), "src/workflow/lib/commands/ must exist");
  for (const cmd of ["add", "update", "show", "search", "list", "publish"]) {
    assert.ok(fs.existsSync(path.join(cmdDir, `${cmd}.js`)), `command ${cmd}.js must exist`);
  }

  // Import paths must be adjusted to the new src/ layout: no relocated production
  // file may still import from experimental/ or via the old "../src/" prefix that
  // experimental/workflow.js used to reach sdd-forge internals.
  const importRe = /(?:import[\s\S]*?from|require\(\s*)\s*["']([^"']+)["']/g;
  for (const f of readTree(path.join(ROOT, "src", "workflow"))) {
    let mm;
    while ((mm = importRe.exec(f.content)) !== null) {
      const spec = mm[1];
      assert.ok(!/(^|\/)experimental\//.test(spec), `${f.path} must not import from experimental/ (got ${spec})`);
      assert.ok(!/\.\.\/src\//.test(spec), `${f.path} must not use the old ../src/ import prefix (got ${spec})`);
    }
  }
});

// --- R2: workflow route registered in dispatcher ---------------------------
test("R2: workflow namespace targets src/workflow and routes subcommands through it", () => {
  // Static: the NAMESPACE_SCRIPTS target resolves to a workflow dispatcher.
  const src = fs.readFileSync(SDD_FORGE, "utf8");
  const block = src.slice(src.indexOf("NAMESPACE_SCRIPTS"), src.indexOf("NAMESPACE_SCRIPTS") + 400);
  const m = block.match(/workflow\s*:\s*"([^"]+)"/);
  assert.ok(m, "NAMESPACE_SCRIPTS must include a workflow route");
  assert.equal(m[1], "workflow/index", "workflow route must target src/workflow/index.js (inside src/workflow/)");

  // Executable: invoking a workflow subcommand reaches the workflow dispatcher.
  // --help routes to the dispatcher's help (no config/board required) and lists subcommands.
  const res = runCli(["workflow", "--help"]);
  assert.equal(res.status, 0, `workflow --help must route and exit 0 (stderr: ${res.stderr})`);
  assert.match(res.stdout, /add|publish|list/, "workflow dispatcher help must list its subcommands");
});

// --- R3: enable gate removed -----------------------------------------------
test("R3: workflow --help works without an enable gate and no NOT_ENABLED path remains", () => {
  const res = runCli(["workflow", "--help"]);
  assert.equal(res.status, 0, `workflow --help must exit 0 (got ${res.status}; stderr: ${res.stderr})`);
  const files = readTree(path.join(ROOT, "src", "workflow"));
  assert.ok(files.length > 0, "src/workflow/ must contain files");
  for (const f of files) {
    assert.ok(!/NOT_ENABLED/.test(f.content), `${f.path} must not contain NOT_ENABLED`);
    assert.ok(
      !/experimental[?.]*\.?workflow[?.]*\.?enable/.test(f.content),
      `${f.path} must not gate on experimental.workflow.enable`,
    );
  }
});

// --- R4: config key migrated experimental.workflow.* → workflow.* ----------
test("R4: config schema accepts workflow.languages and rejects experimental.workflow", async () => {
  const { validate } = await import(path.join(ROOT, "src", "lib", "config.js"));
  const base = { lang: "ja", type: "node-cli", docs: { languages: ["ja"], defaultLanguage: "ja" } };
  // new key accepted
  assert.doesNotThrow(
    () => validate({ ...base, workflow: { languages: { source: "ja", publish: "en" } } }),
    "workflow.languages must be accepted by the config schema",
  );
  // old key rejected — specifically as an unknown/additional property, not some unrelated error
  assert.throws(
    () => validate({ ...base, experimental: { workflow: { enable: true } } }),
    /additional|unknown|experimental/i,
    "experimental.workflow must be rejected as an unknown property after migration",
  );
  // runtime read site uses the new key, not the old one
  const publish = path.join(ROOT, "src", "workflow", "lib", "commands", "publish.js");
  assert.ok(fs.existsSync(publish), "src/workflow/lib/commands/publish.js must exist");
  const publishSrc = fs.readFileSync(publish, "utf8");
  assert.match(publishSrc, /workflow[?.]*\.?languages/, "publish must read workflow.languages");
  assert.ok(
    !/experimental[?.]*\.?workflow/.test(publishSrc),
    "publish must not read the old experimental.workflow key",
  );
});

// --- R5: skill relocated to src/skills/ and deployed unconditionally --------
test("R5: skill source lives under src/skills/ and EXPERIMENTAL_WORKFLOW_SKILLS_DIR is gone", () => {
  assert.ok(
    fs.existsSync(path.join(ROOT, "src", "skills", "sdd-forge.exp.workflow", "SKILL.md")),
    "src/skills/sdd-forge.exp.workflow/SKILL.md must exist",
  );
  const skillsSrc = fs.readFileSync(path.join(ROOT, "src", "lib", "skills.js"), "utf8");
  assert.ok(
    !/EXPERIMENTAL_WORKFLOW_SKILLS_DIR/.test(skillsSrc),
    "EXPERIMENTAL_WORKFLOW_SKILLS_DIR must be removed from src/lib/skills.js",
  );
  const upgradeSrc = fs.readFileSync(path.join(ROOT, "src", "upgrade.js"), "utf8");
  assert.ok(
    !/experimental[?.]*\.?workflow[?.]*\.?enable/.test(upgradeSrc),
    "src/upgrade.js must not retain the enable-conditioned workflow skill placement branch",
  );
  assert.match(
    skillsSrc,
    /MAIN_SKILLS_DIR/,
    "src/lib/skills.js must derive deployable skills from MAIN_SKILLS_DIR (unconditional path)",
  );
});

// --- R6: skill body rewritten to call sdd-forge workflow --------------------
test("R6: relocated SKILL.md calls sdd-forge workflow and uses workflow.languages.source", () => {
  const skill = path.join(ROOT, "src", "skills", "sdd-forge.exp.workflow", "SKILL.md");
  assert.ok(fs.existsSync(skill), "src/skills/sdd-forge.exp.workflow/SKILL.md must exist");
  const content = fs.readFileSync(skill, "utf8");
  assert.ok(!/node\s+experimental\/workflow\.js/.test(content), "SKILL.md must not call node experimental/workflow.js");
  assert.ok(!/workflow\.js/.test(content), "SKILL.md must not reference workflow.js");
  assert.match(content, /sdd-forge workflow/, "SKILL.md must call sdd-forge workflow");
  assert.match(content, /workflow\.languages\.source/, "SKILL.md must reference workflow.languages.source");
  assert.ok(
    !/experimental\.workflow\.languages/.test(content),
    "SKILL.md must not reference the old experimental.workflow.languages key",
  );
});

// --- R7: workflow --help shows the [EXPERIMENTAL] label ---------------------
test("R7: sdd-forge workflow --help shows [EXPERIMENTAL] at the head, before the subcommand list", () => {
  const res = runCli(["workflow", "--help"]);
  assert.match(res.stdout, /\[EXPERIMENTAL\]/, "workflow --help output must contain [EXPERIMENTAL]");
  const lines = res.stdout.split("\n");
  const labelLine = lines.findIndex((l) => /\[EXPERIMENTAL\]/.test(l));
  const firstSubcmdLine = lines.findIndex((l) => /\b(add|publish|list|show|search|update)\b/.test(l));
  assert.ok(labelLine >= 0, "label must be present");
  assert.ok(
    firstSubcmdLine === -1 || labelLine < firstSubcmdLine,
    "[EXPERIMENTAL] must appear before the subcommand list",
  );
});

// --- R8: experimental notice in README.md, AGENTS.md, CLAUDE.md -------------
/** Remove {{data}}/{{text}} directive-generated regions (auto-overwritten). */
function stripGeneratedRegions(md) {
  // Drop everything between a directive open comment and its matching close comment.
  let out = md.replace(/<!--\s*\{\{(data|text)\b[\s\S]*?<!--\s*\{\{\/\1\}\}\s*-->/g, "");
  // Drop any remaining standalone directive comments.
  out = out.replace(/<!--\s*\{\{[\s\S]*?\}\}\s*-->/g, "");
  return out;
}

test("R8: README.md, AGENTS.md and CLAUDE.md note workflow is experimental in non-generated regions", () => {
  for (const name of ["README.md", "AGENTS.md", "CLAUDE.md"]) {
    const file = path.join(ROOT, name);
    assert.ok(fs.existsSync(file), `${name} must exist`);
    const content = stripGeneratedRegions(fs.readFileSync(file, "utf8"));
    // A workflow experimental notice with the usage-patterns-may-change meaning,
    // outside generated directive regions.
    assert.match(content, /workflow/i, `${name} must mention workflow outside generated regions`);
    assert.match(content, /experimental/i, `${name} must note workflow is experimental outside generated regions`);
    assert.match(
      content,
      /usage patterns may change|使い方[^。\n]*変わる|運用[^。\n]*変わる/i,
      `${name} must convey that workflow usage patterns may change (EN or JA)`,
    );
  }
});

// --- R9: graduation criteria in src/workflow/AGENTS.md ----------------------
test("R9: src/workflow/AGENTS.md documents the graduation criteria", () => {
  const file = path.join(ROOT, "src", "workflow", "AGENTS.md");
  assert.ok(fs.existsSync(file), "src/workflow/AGENTS.md must exist");
  const content = fs.readFileSync(file, "utf8");
  // The four graduation criteria concepts must each be concretely represented.
  assert.match(content, /methodology|方法論/i, "must mention methodology documentation criterion");
  assert.match(
    content,
    /status enum/i,
    "must mention the fixed subcommand/field/status-enum contract criterion",
  );
  assert.match(
    content,
    /ideas[\s\S]*publish|publish[\s\S]*flow/i,
    "must mention the stable ideas→publish usage pattern",
  );
  assert.match(content, /breaking change/i, "must mention the no-breaking-change criterion");
});

// --- R10: relocated files deleted from experimental/ and AGENTS.md rewritten -
test("R10: experimental/ no longer holds the relocated workflow files and AGENTS.md is rewritten", () => {
  // The dispatcher and every relocated dependency / command must be gone from experimental/.
  assert.ok(!fs.existsSync(path.join(ROOT, "experimental", "workflow.js")), "experimental/workflow.js must be deleted");
  const expWfDir = path.join(ROOT, "experimental", "workflow");
  for (const rel of [
    "registry.js",
    "lib/config.js", "lib/graphql.js", "lib/board-helpers.js", "lib/hash.js",
    "lib/validation.js", "lib/category.js", "lib/base-command.js",
    "lib/commands/add.js", "lib/commands/update.js", "lib/commands/show.js",
    "lib/commands/search.js", "lib/commands/list.js", "lib/commands/publish.js",
  ]) {
    assert.ok(
      !fs.existsSync(path.join(expWfDir, rel)),
      `experimental/workflow/${rel} must be removed after relocation`,
    );
  }

  // experimental/AGENTS.md must be revised: no workflow.js entrypoint claim,
  // and it must describe experimental/ as a pre-src-promotion test-code area.
  const agents = path.join(ROOT, "experimental", "AGENTS.md");
  assert.ok(fs.existsSync(agents), "experimental/AGENTS.md must exist (revised, not deleted)");
  const content = fs.readFileSync(agents, "utf8");
  assert.ok(!/workflow\.js/.test(content), "experimental/AGENTS.md must not reference workflow.js as an entry point");
  assert.match(content, /src\//, "experimental/AGENTS.md must describe promotion to src/");
  assert.match(content, /試験|昇格|promot/i, "experimental/AGENTS.md must describe the pre-src-promotion test-code role");
});

// --- R11: workflow tests moved to tests/unit/ with adjusted imports ---------
test("R11: workflow unit tests live under tests/unit/, are absent from experimental/tests/, and import from src/workflow", () => {
  const unitDir = path.join(ROOT, "tests", "unit");
  const relocated = readTree(unitDir).filter((f) => /^workflow-.*\.test\.js$/.test(path.basename(f.path)));
  assert.ok(relocated.length > 0, "tests/unit/ must contain relocated workflow-*.test.js files");

  for (const f of relocated) {
    assert.ok(
      !/from\s+["'][^"']*experimental\//.test(f.content) && !/require\(\s*["'][^"']*experimental\//.test(f.content),
      `${path.basename(f.path)} must not import from experimental/ after relocation`,
    );
    assert.match(
      f.content,
      /(src\/)?workflow\//,
      `${path.basename(f.path)} must reference the relocated src/workflow paths`,
    );
  }

  const expTestsDir = path.join(ROOT, "experimental", "tests");
  const expFiles = readTree(expTestsDir).map((f) => path.basename(f.path));
  assert.ok(
    !expFiles.some((n) => /^workflow-.*\.test\.js$/.test(n)),
    "experimental/tests/ must not retain workflow-*.test.js files",
  );
});

// --- R12: top-level help lists workflow; no user-facing workflow.js ---------
test("R12: sdd-forge help lists workflow as [EXPERIMENTAL] and all usage strings use sdd-forge workflow", () => {
  const help = runCli(["help"]);
  const workflowLine = help.stdout.split("\n").find((l) => /\bworkflow\b/.test(l));
  assert.ok(workflowLine, "sdd-forge help output must list the workflow command");
  assert.match(workflowLine, /\[EXPERIMENTAL\]/, "the workflow help line must be marked [EXPERIMENTAL]");

  // workflow --help output must not reference the old workflow.js entrypoint.
  const wfHelp = runCli(["workflow", "--help"]);
  assert.ok(!/workflow\.js/.test(wfHelp.stdout), "workflow --help usage must not reference workflow.js");

  // Sweep the whole workflow source tree (dispatcher, registry, commands):
  // no user-facing `workflow.js` usage string may remain anywhere.
  const wfFiles = readTree(path.join(ROOT, "src", "workflow"));
  assert.ok(wfFiles.length > 0, "src/workflow/ must contain files");
  for (const f of wfFiles) {
    assert.ok(
      !/workflow\.js/.test(f.content),
      `${f.path} must not contain a workflow.js usage string (use \`sdd-forge workflow\`)`,
    );
  }

  // Exercise representative subcommand help to confirm usage uses sdd-forge workflow.
  const addHelp = runCli(["workflow", "add", "--help"]);
  assert.ok(!/workflow\.js/.test(addHelp.stdout), "workflow add --help must not reference workflow.js");
  assert.match(addHelp.stdout, /sdd-forge workflow/, "subcommand help usage must use `sdd-forge workflow`");
});
