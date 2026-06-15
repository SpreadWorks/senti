#!/usr/bin/env node
/**
 * senti/setup/setup.js
 *
 * Interactive setup wizard.
 * Registers a project and generates .senti/config.json.
 *
 * Usage:
 *   senti setup
 *   senti setup --name myapp --path /path/to/src --type webapp/cakephp2
 */

import fs from "fs";
import path from "path";
import readline from "readline";
import { parseArgs } from "./lib/cli.js";
import { EXIT_ERROR } from "./lib/constants.js";
import { validate } from "./lib/config.js";
import { DEFAULT_LANG, sentiDir as sentiDirFn } from "./lib/config.js";
import { createI18n } from "./lib/i18n.js";
import { listSetupPresetCandidates, resolveMultiChains, resolvePresetCandidateChains, validatePresetCandidateChain } from "./lib/presets.js";
import { buildTreeItems, select } from "./lib/multi-select.js";
import { loadSpecDrivenDevelopmentTemplate } from "./lib/agents-md.js";
import { resolveWorkDir } from "./lib/config.js";
import { mergeAgentDefaults } from "./lib/agent-defaults.js";
import { deploySkills } from "./lib/skills.js";
import { SENTI_GITIGNORE_LINES, hasSentiGitignore, normalizeSentiGitignore } from "./lib/gitignore.js";
import { ensureSetupOfficialPresetState, resolveSetupOfficialPresetSource } from "./lib/plugin-registry.js";

// ---------------------------------------------------------------------------
// readline helpers
// ---------------------------------------------------------------------------

function ask(prompt, prefill) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
    if (prefill) rl.write(prefill);
  });
}

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseSetupArgs(argv) {
  return parseArgs(argv, {
    flags: ["--dry-run"],
    options: [
      "--name", "--path", "--work-root",
      "--type", "--purpose", "--tone",
      "--agent",
      "--lang",
    ],
    defaults: {
      name: "",
      path: "",
      workRoot: "",
      type: "",
      purpose: "",
      tone: "",
      agent: "",
      lang: "",
      dryRun: false,
    },
  });
}

// ---------------------------------------------------------------------------
// Config file I/O
// ---------------------------------------------------------------------------

function readConfigFile(configPath) {
  if (!fs.existsSync(configPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (_) {
    return null;
  }
}

function snapshotConfigFile(configPath) {
  return fs.existsSync(configPath)
    ? { exists: true, content: fs.readFileSync(configPath, "utf8") }
    : { exists: false, content: null };
}

function restoreConfigFile(configPath, snapshot) {
  if (snapshot.exists) {
    fs.writeFileSync(configPath, snapshot.content, "utf8");
  } else if (fs.existsSync(configPath)) {
    fs.unlinkSync(configPath);
  }
}

// ---------------------------------------------------------------------------
// Load existing config as defaults
// ---------------------------------------------------------------------------

function loadExistingDefaults(workRoot) {
  const configPath = path.join(sentiDirFn(workRoot), "config.json");
  const cfg = readConfigFile(configPath);
  if (!cfg) return null;
  const types = Array.isArray(cfg.type) ? cfg.type : cfg.type ? [cfg.type] : [];
  return {
    projectName: cfg.name || "",
    lang: cfg.lang || DEFAULT_LANG,
    type: types[0] || "",
    additionalTypes: types.slice(1),
    outputLangs: cfg.docs?.languages || [],
    outputDefault: cfg.docs?.defaultLanguage || "",
    purpose: cfg.docs?.style?.purpose || "",
    tone: cfg.docs?.style?.tone || "",
    agent: cfg.agent?.default || "",
  };
}

export const loadSetupDefaults = loadExistingDefaults;

// ---------------------------------------------------------------------------
// Project registration
// ---------------------------------------------------------------------------

function ensureProjectDirs(workRoot) {
  const sentiDir = path.join(workRoot, ".senti");
  const outputDir = path.join(sentiDir, "output");
  const docsDir = path.join(workRoot, "docs");
  const specsDir = path.join(workRoot, "specs");
  [sentiDir, outputDir, docsDir, specsDir].forEach((d) =>
    fs.mkdirSync(d, { recursive: true }),
  );
  fs.writeFileSync(path.join(outputDir, ".gitkeep"), "");
}

function ensureGitignore(workRoot) {
  const rootGitignore = path.join(workRoot, ".gitignore");
  const block = [
    ".tmp/",
    "",
    ...SENTI_GITIGNORE_LINES,
    "",
    ".agents/*",
    "!.agents/skills*",
    ".claude/*",
    "!.claude/skills*",
    ".codex",
  ];
  if (fs.existsSync(rootGitignore)) {
    const content = fs.readFileSync(rootGitignore, "utf8");
    const normalized = normalizeSentiGitignore(content, { appendIfMissing: false });
    if (normalized !== content) {
      fs.writeFileSync(rootGitignore, normalized, "utf8");
    }
    if (hasSentiGitignore(normalized)) return;
    const prefix = normalized.endsWith("\n") || normalized === "" ? "" : "\n";
    fs.appendFileSync(rootGitignore, `${prefix}${block.join("\n")}\n`);
  } else {
    fs.writeFileSync(rootGitignore, `${block.join("\n")}\n`);
  }
}

function ensureGitattributes(workRoot) {
  const gitattributesPath = path.join(workRoot, ".gitattributes");
  const entry = ".senti/output/analysis.json merge=ours";
  if (fs.existsSync(gitattributesPath)) {
    const content = fs.readFileSync(gitattributesPath, "utf8");
    if (!content.includes(entry)) {
      fs.appendFileSync(gitattributesPath, `\n${entry}\n`);
    }
  } else {
    fs.writeFileSync(gitattributesPath, `${entry}\n`);
  }
}

function registerProject(projectName, sourcePath, workRootPath, t) {
  const resolved = path.resolve(sourcePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(t("common.error.pathNotFound", { path: resolved }));
  }

  const workRoot = workRootPath ? path.resolve(workRootPath) : resolved;
  ensureProjectDirs(workRoot);
  ensureGitignore(workRoot);
  ensureGitattributes(workRoot);

  return { workRoot };
}

// ---------------------------------------------------------------------------
// Agent config file (CLAUDE.md / AGENTS.md) setup
// ---------------------------------------------------------------------------

function buildAgentContent(lang, options = {}) {
  const specDrivenDevelopmentContent = loadSpecDrivenDevelopmentTemplate(lang, options);
  const lines = [];
  lines.push('<!-- {{data("agents.senti")}} -->');
  if (specDrivenDevelopmentContent) lines.push(specDrivenDevelopmentContent.trimEnd());
  lines.push('<!-- {{/data}} -->');
  lines.push('');
  lines.push('<!-- {{data("agents.project")}} -->');
  lines.push('<!-- {{/data}} -->');
  return lines.join("\n");
}

const SENTI_DIRECTIVE_RE = /<!-- \{\{data\("agents\.senti"\)\}\} -->[\s\S]*?<!-- \{\{\/data\}\} -->/;

function ensureAgentConfigFile(filePath, lang, t, options = {}) {
  const fileName = path.basename(filePath);
  const agentContent = buildAgentContent(lang, options);

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, agentContent + "\n", "utf8");
    console.log(t("setup.messages.agentFileCreated", { file: fileName }));
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");

  if (SENTI_DIRECTIVE_RE.test(content)) {
    const sentiBlock = agentContent.match(SENTI_DIRECTIVE_RE)?.[0];
    if (sentiBlock) {
      const updated = content.replace(SENTI_DIRECTIVE_RE, sentiBlock);
      if (updated !== content) {
        fs.writeFileSync(filePath, updated, "utf8");
        console.log(t("setup.messages.agentFileUpdated", { file: fileName }));
      } else {
        console.log(t("setup.messages.agentFileUpToDate", { file: fileName }));
      }
    }
    return;
  }

  const separator = content.endsWith("\n") ? "\n" : "\n\n";
  fs.writeFileSync(filePath, content + separator + agentContent + "\n", "utf8");
  console.log(t("setup.messages.agentFileUpdated", { file: fileName }));
}

function fixClaudeMdSymlink(sourceDir) {
  const claudePath = path.join(sourceDir, "CLAUDE.md");
  try {
    const stat = fs.lstatSync(claudePath);
    if (stat.isSymbolicLink()) {
      const content = fs.readFileSync(claudePath, "utf8");
      fs.unlinkSync(claudePath);
      fs.writeFileSync(claudePath, content, "utf8");
    }
  } catch (err) { if (err.code !== "ENOENT") console.error(err); }
}

function officialPresetCandidateOptions(projectRoot, { defaultOfficialPresetSource } = {}) {
  const official = resolveSetupOfficialPresetSource(projectRoot, { defaultOfficialPresetSource });
  return {
    includeOfficialPresets: true,
    officialPresetRoot: official.root,
    officialPresetSource: official.source,
  };
}

function listInteractiveSetupPresetCandidates(projectRoot, options = {}) {
  return listSetupPresetCandidates(projectRoot, officialPresetCandidateOptions(projectRoot, options));
}

export const listSetupWizardPresetCandidates = listInteractiveSetupPresetCandidates;

// ---------------------------------------------------------------------------
// Interactive wizard (returns settings object)
// ---------------------------------------------------------------------------

async function runWizard(defaults, t, { projectRoot } = {}) {
  const s = { ...defaults };

  // --- Project name ---
  s.projectName = await ask(
    t("setup.questions.projectName", { default: s.projectName }),
    s.projectName,
  );
  if (!s.projectName) s.projectName = defaults.projectName;

  // --- Output language ---
  const outputLangList = t.raw("setup.choices.outputLang");
  const outputLangItems = outputLangList.map((item) => ({
    key: item.key,
    label: item.label,
  }));
  console.log(`\n${t("setup.questions.outputLang")}`);
  s.outputLangs = await select(outputLangItems, {
    mode: "multi",
    default: s.outputLangs,
  });
  if (s.outputLangs.length === 0) s.outputLangs = [s.lang];

  if (s.outputLangs.length === 1) {
    s.outputDefault = s.outputLangs[0];
  } else {
    const defaultChoices = t.raw("setup.choices.outputDefault");
    const defaultItems = s.outputLangs.map((lang) => ({
      key: lang,
      label: defaultChoices[lang] || lang,
    }));
    console.log(`\n${t("setup.questions.outputDefault")}`);
    s.outputDefault = await select(defaultItems, {
      mode: "single",
      default: s.outputDefault,
    });
  }

  // --- Preset selection ---
  const treeItems = buildTreeItems(listInteractiveSetupPresetCandidates(projectRoot));
  const presetDefaults = s.additionalTypes.length > 0
    ? [s.type, ...s.additionalTypes]
    : s.type ? [s.type] : [];
  console.log(`\n${t("setup.questions.fwType")}`);
  const selectedPresets = await select(treeItems, {
    mode: "multi",
    autoSelectAncestors: true,
    default: presetDefaults,
  });
  if (selectedPresets.length === 0) {
    s.type = "base";
    s.additionalTypes = [];
  } else {
    s.type = selectedPresets[0];
    s.additionalTypes = selectedPresets.slice(1);
  }

  // --- Document purpose ---
  const purposeChoices = t.raw("setup.choices.purpose");
  console.log(`\n${t("setup.questions.purpose")}`);
  s.purpose = await select([
    { key: "developer-guide", label: purposeChoices["developer-guide"] },
    { key: "user-guide", label: purposeChoices["user-guide"] },
    { key: "api-reference", label: purposeChoices["api-reference"] },
    { key: "__other__", label: purposeChoices.other },
  ], { mode: "single", default: s.purpose });
  if (s.purpose === "__other__") {
    const BUILTIN_PURPOSES = ["developer-guide", "user-guide", "api-reference", "__other__"];
    const prefill = BUILTIN_PURPOSES.includes(defaults.purpose) ? "" : defaults.purpose;
    s.purpose = await ask(t("setup.questions.purposeCustom"), prefill);
    if (!s.purpose) s.purpose = "developer-guide";
  }

  // --- Tone ---
  const toneChoices = t.raw("setup.choices.tone");
  console.log(`\n${t("setup.questions.tone")}`);
  s.tone = await select([
    { key: "polite", label: toneChoices.polite },
    { key: "formal", label: toneChoices.formal },
    { key: "casual", label: toneChoices.casual },
  ], { mode: "single", default: s.tone });

  // --- Agent ---
  const agentChoices = t.raw("setup.choices.agent");
  console.log(`\n${t("setup.questions.agent")}`);
  s.agent = await select([
    { key: "claude", label: agentChoices.claude },
    { key: "codex", label: agentChoices.codex },
  ], { mode: "single", default: s.agent });

  // --- Agent config file ---
  const agentFileName = s.agent === "claude" ? "CLAUDE.md" : "AGENTS.md";
  const agentsChoices = t.raw("setup.choices_agents");
  console.log(`\n${agentFileName}:`);
  s.agentFileMode = await select([
    { key: "generate", label: agentsChoices.rewrite },
    { key: "skip", label: agentsChoices.skip },
  ], { mode: "single", default: s.agentFileMode });

  return s;
}

// ---------------------------------------------------------------------------
// Summary display
// ---------------------------------------------------------------------------

function resolveLeafTypes(primaryType, additionalTypes, projectRoot, candidates = null) {
  const allTypes = additionalTypes.length > 0
    ? [primaryType, ...additionalTypes] : [primaryType];
  const chains = candidates
    ? resolvePresetCandidateChains(allTypes, candidates)
    : resolveMultiChains(allTypes, projectRoot);
  return chains.map((chain) => chain[chain.length - 1].key);
}

export const resolveSetupLeafTypes = resolveLeafTypes;

function buildSummaryLines(s, t, projectRoot) {
  const candidates = listSetupPresetCandidates(projectRoot, officialPresetCandidateOptions(projectRoot));
  const leafTypes = resolveLeafTypes(s.type, s.additionalTypes, projectRoot, candidates);
  const agentFile = s.agent === "claude" ? "CLAUDE.md" : "AGENTS.md";

  return [
    `  ${t("setup.messages.summary")}`,
    `    project:    ${s.projectName}`,
    `    lang:       ${s.lang}`,
    `    output:     ${s.outputLangs.join(", ")} (default: ${s.outputDefault})`,
    `    type:       ${leafTypes.join(", ")}`,
    `    purpose:    ${s.purpose}`,
    `    tone:       ${s.tone}`,
    `    agent:      ${s.agent}`,
    `    ${agentFile}: ${s.agentFileMode === "generate" ? "✓" : "skip"}`,
  ];
}

export const buildSetupSummaryLines = buildSummaryLines;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const cli = parseSetupArgs(process.argv.slice(2));

  if (cli.help) {
    const tu = createI18n(cli.lang || DEFAULT_LANG);
    const h = tu.raw("help.cmdHelp.setup");
    const o = h.options;
    console.log([
      h.usage, "", `  ${h.desc}`, "", "Options:",
      `  ${o.name}`, `  ${o.path}`, `  ${o.workRoot}`, `  ${o.type}`,
      `  ${o.purpose}`, `  ${o.tone}`, `  ${o.agent}`,
      `  ${o.lang}`, `  ${o.dryRun}`, `  ${o.help}`,
    ].join("\n"));
    return;
  }

  const defaultPath = process.cwd();
  const sourcePath = cli.path || defaultPath;
  const workRootPath = cli.workRoot || "";
  const setupRoot = path.resolve(workRootPath || sourcePath);
  const defaultName = path.basename(setupRoot);

  // Non-interactive mode: all required values provided via CLI
  const hasAllRequired = cli.name && cli.type && cli.purpose && cli.tone;

  let settings;

  if (hasAllRequired) {
    const operatingLang = cli.lang || DEFAULT_LANG;
    const types = cli.type.includes(",") ? cli.type.split(",") : [cli.type];
    settings = {
      projectName: cli.name || defaultName,
      lang: operatingLang,
      outputLangs: [operatingLang],
      outputDefault: operatingLang,
      type: types[0],
      additionalTypes: types.slice(1),
      purpose: cli.purpose,
      tone: cli.tone,
      agent: cli.agent || "",
      agentFileMode: "generate",
    };
  } else {
    // Load existing config as defaults
    const existing = loadExistingDefaults(setupRoot);

    let defaults = {
      projectName: cli.name || defaultName,
      lang: cli.lang || existing?.lang || DEFAULT_LANG,
      outputLangs: existing?.outputLangs || [],
      outputDefault: existing?.outputDefault || "",
      type: cli.type || existing?.type || "",
      additionalTypes: existing?.additionalTypes || [],
      purpose: cli.purpose || existing?.purpose || "",
      tone: cli.tone || existing?.tone || "",
      agent: cli.agent || existing?.agent || "",
      agentFileMode: "generate",
    };

    // --- Language selection (always in English first) ---
    let t = createI18n("en");
    console.log(`\n  ${t("setup.title")}`);
    console.log(`  ${t("setup.separator")}\n`);

    console.log(t("setup.questions.uiLang"));
    const langChoices = t.raw("setup.choices.uiLang");
    defaults.lang = await select([
      { key: "en", label: langChoices.en },
      { key: "ja", label: langChoices.ja },
    ], { mode: "single", default: defaults.lang });

    t = createI18n(defaults.lang);

    // --- Wizard loop with confirmation ---
    while (true) {
      settings = await runWizard(defaults, t, { projectRoot: setupRoot });

      // Show summary
      const lines = buildSummaryLines(settings, t, setupRoot);
      console.log("");
      for (const line of lines) console.log(line);

      // Confirm
      const confirmChoices = t.raw("setup.choices.confirm");
      console.log(`\n${confirmChoices?.prompt || "Save this configuration?"}`);
      const confirmed = await select([
        { key: "yes", label: confirmChoices?.yes || "OK" },
        { key: "no", label: confirmChoices?.no || "Edit" },
      ], { mode: "single" });

      if (confirmed === "yes") break;

      // Use current settings as defaults for next round
      defaults = { ...settings };
      console.log("");
    }
  }

  // --- Write phase ---
  const { workRoot } = registerProject(
    settings.projectName, sourcePath, workRootPath,
    createI18n(settings.lang),
  );
  const t = createI18n(settings.lang);

  // Build config: merge wizard values into existing config to preserve customizations
  const configPath = path.join(workRoot, ".senti", "config.json");
  let config = readConfigFile(configPath) || {};
  const selectedTypes = settings.additionalTypes.length > 0
    ? [settings.type, ...settings.additionalTypes]
    : [settings.type];

  // Wizard-managed fields (overwrite)
  config.name = settings.projectName;
  config.lang = settings.lang;
  config.type = selectedTypes.length === 1 ? selectedTypes[0] : selectedTypes;
  config.docs = {
    ...config.docs,
    languages: settings.outputLangs,
    defaultLanguage: settings.outputDefault,
    style: { ...config.docs?.style, purpose: settings.purpose, tone: settings.tone },
  };
  if (!config.flow) config.flow = { merge: "squash" };

  if (settings.agent) {
    // Normalize short names to namespaced provider keys
    const AGENT_PROVIDER_DEFAULT = { claude: "claude/sonnet", codex: "codex/gpt-5.4" };
    const resolvedDefault = AGENT_PROVIDER_DEFAULT[settings.agent] || settings.agent;
    const defaultAgent = { default: resolvedDefault, workDir: ".tmp" };

    if (config.agent) {
      // Preserve existing customizations, only update wizard-managed fields
      config.agent.default = resolvedDefault;
      if (!config.agent.workDir) config.agent.workDir = defaultAgent.workDir;
    } else {
      config.agent = defaultAgent;
    }

    // Seed default agent profiles + their referenced providers (add-only;
    // existing user values win). `useProfile` is intentionally left unset —
    // which profile to use is the user's choice.
    mergeAgentDefaults(config.agent);
  }

  validate(config);

  let officialPresetOptions = {};
  let setupCandidates = listSetupPresetCandidates(workRoot);
  const candidateKeys = new Set(setupCandidates.map((candidate) => candidate.key));
  const needsOfficialPresetState = selectedTypes.some((type) => type !== "base" && !candidateKeys.has(type));
  if (needsOfficialPresetState) {
    officialPresetOptions = officialPresetCandidateOptions(workRoot);
    setupCandidates = listSetupPresetCandidates(workRoot, officialPresetOptions);
  }
  const leafTypes = resolveLeafTypes(
    settings.type,
    settings.additionalTypes,
    workRoot,
    setupCandidates,
  );
  config.type = leafTypes.length === 1 ? leafTypes[0] : leafTypes;
  validate(config);

  validatePresetCandidateChain(config.type, setupCandidates, workRoot, {
    languages: config.docs?.languages || [],
    configChapters: config.chapters,
  });

  if (cli.dryRun) {
    console.log("[setup] DRY-RUN: config.json content:");
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  const configSnapshot = snapshotConfigFile(configPath);
  try {
    ensureSetupOfficialPresetState(workRoot, {
      selectedTypes,
      officialPresetRoot: officialPresetOptions.officialPresetRoot,
      officialPresetSource: officialPresetOptions.officialPresetSource,
    });
  } catch (err) {
    restoreConfigFile(configPath, configSnapshot);
    throw err;
  }
  const preparedConfig = readConfigFile(configPath);
  if (preparedConfig?.plugin) config.plugin = preparedConfig.plugin;

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");
  console.log(t("setup.messages.configGenerated", { path: configPath }));

  // Ensure the resolved agent work directory exists
  if (config.agent) {
    const workDir = resolveWorkDir(workRoot, config);
    fs.mkdirSync(workDir, { recursive: true });
  }

  // Agent config file
  if (settings.agentFileMode === "generate") {
    fixClaudeMdSymlink(workRoot);
    const agentConfigFile = settings.agent === "claude"
      ? path.join(workRoot, "CLAUDE.md")
      : path.join(workRoot, "AGENTS.md");
    ensureAgentConfigFile(agentConfigFile, settings.lang, t, {
      projectRoot: workRoot,
      presetTypes: config.type,
    });
  }

  // Skills
  try {
    deploySkills(workRoot);
    console.log(t("setup.messages.skillsDeployed"));
  } catch (e) {
    console.error(`skill deployment failed: ${e.message}`);
    process.exit(EXIT_ERROR);
  }

  // Final summary
  console.log(`\n  ${t("setup.messages.nextSteps")}`);
  console.log(`    ${t("setup.messages.step1")}`);
  console.log(`    ${t("setup.messages.step2")}`);
  console.log("");

  if (typeof process.stdin.unref === "function") process.stdin.unref();
}


export { main };
