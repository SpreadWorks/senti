#!/usr/bin/env node
/**
 * src/docs/commands/translate.js
 *
 * Translate default-language documents to non-default languages.
 * Compares mtime of source vs target file; re-translates only when needed.
 *
 * Usage:
 *   sennel docs translate [--dry-run] [--force] [--lang <lang>]
 */

import fs from "fs";
import path from "path";
import { parseArgs } from "../../lib/cli.js";
import { resolveConcurrency } from "../../lib/config.js";
import { createLogger } from "../../lib/progress.js";
import { getChapterFiles, stripResponsePreamble } from "../lib/command-context.js";
import { mapWithConcurrency } from "../lib/concurrency.js";
import { container } from "../../lib/container.js";
import { PromptBuilder } from "../../lib/prompt-builder.js";
import { DocumentationAgent } from "../lib/documentation-agent.js";
import { resolveDocsContext } from "../lib/docs-context.js";
import { Command } from "../../lib/command.js";

const logger = createLogger("translate");

/**
 * Translate a Markdown document from one language to another via AI agent.
 *
 * @param {string} content - Source document content
 * @param {string} fromLang - Source language code
 * @param {string} toLang - Target language code
 * @param {Object} agent - Agent config
 * @param {string} root - Project root
 * @returns {Promise<string>} Translated content
 */
/**
 * Map documentStyle.tone to target-language writing style instruction.
 */
function toneInstruction(tone, toLang) {
  if (toLang !== "ja") return "";
  const map = {
    polite: "Use です/ます style (敬体).",
    formal: "Use である style (常体).",
    casual: "Use casual, conversational tone (口語的).",
  };
  return map[tone] || "";
}

async function translateDocument(content, fromLang, toLang, agent, _root, documentStyle) {
  const toneInstr = documentStyle?.tone ? toneInstruction(documentStyle.tone, toLang) : "";

  const pb = new PromptBuilder();
  pb.setRole(`You are a professional technical document translator specializing in ${toLang}.\nTranslate the following Markdown document from ${fromLang} to ${toLang}.`);

  const ruleLines = [
    "## Formatting rules",
    "- Preserve ALL Markdown formatting (headings, tables, code blocks, links)",
    "- Preserve ALL directives exactly as-is: <!-- {{data(...)}} -->, <!-- {{text(...)}} -->, <!-- {{/data}} -->, <!-- {%block%} -->, <!-- {%extends%} -->",
    "- Keep inline code (`...`), file paths, and CLI command names unchanged",
    "- DO translate: heading text, prose, table cell text (including table headers), and descriptive labels inside mermaid diagrams",
    "- DO NOT translate: code blocks (``` ... ```), variable names, function names, identifiers",
    "- Output ONLY the translated document, no commentary",
    "",
    "## Translation quality rules",
    "- Do NOT translate word-by-word. Restructure sentences to follow natural grammar and conventions of the target language.",
    "- Avoid excessive use of loanwords/katakana when the target language has natural equivalents.",
    "- Avoid verbose patterns such as chains of nominalizations or passive voice.",
    "- Respect the cultural conventions and writing customs of the target language — the result should read as if originally written in that language, not as a translation.",
  ];
  if (toneInstr) ruleLines.push(`- Writing style: ${toneInstr}`);
  if (documentStyle?.customInstruction) ruleLines.push(`- ${documentStyle.customInstruction}`);
  pb.setRules(ruleLines.join("\n"));

  pb.addUserPrompt("## Document", content);
  const built = pb.build();

  const result = await DocumentationAgent.from(agent).call(built.userPrompt, {
    commandId: "docs.translate",
    systemPrompt: built.systemPrompt,
  });

  if (!result || result.trim().length === 0) {
    throw new Error("Empty translation response");
  }

  return stripResponsePreamble(result, 5);
}

/**
 * Check if source file is newer than target file.
 */
function needsTranslation(sourcePath, targetPath) {
  if (!fs.existsSync(targetPath)) return true;
  const srcMtime = fs.statSync(sourcePath).mtimeMs;
  const tgtMtime = fs.statSync(targetPath).mtimeMs;
  return srcMtime > tgtMtime;
}

/**
 * Build a flat list of translation tasks from lang × files.
 * Filters out up-to-date files (unless force is true).
 *
 * @param {Object} opts
 * @param {string[]} opts.sourceFiles - Chapter file names
 * @param {string[]} opts.targetLangs - Target language codes
 * @param {string} opts.docsDir - Docs directory path
 * @param {string} opts.readmePath - README.md path
 * @param {boolean} opts.hasReadme - Whether README.md exists
 * @param {boolean} opts.force - Force re-translation
 * @returns {Array<{lang: string, sourcePath: string, targetPath: string, label: string}>}
 */
function buildTranslationTasks({ sourceFiles, targetLangs, docsDir, readmePath, hasReadme, force }) {
  const tasks = [];
  for (const lang of targetLangs) {
    const langDir = path.join(docsDir, lang);
    for (const file of sourceFiles) {
      const sourcePath = path.join(docsDir, file);
      const targetPath = path.join(langDir, file);
      if (!force && !needsTranslation(sourcePath, targetPath)) continue;
      tasks.push({ lang, sourcePath, targetPath, label: `${file} → ${lang}/${file}` });
    }
    if (hasReadme) {
      const targetReadme = path.join(langDir, "README.md");
      if (force || needsTranslation(readmePath, targetReadme)) {
        tasks.push({ lang, sourcePath: readmePath, targetPath: targetReadme, label: `README.md → ${lang}/README.md` });
      }
    }
  }
  return tasks;
}

async function runTranslate(ctx, rawArgs) {
  if (!ctx) {
    const cli = parseArgs(rawArgs, {
      flags: ["--dry-run", "--force"],
      options: ["--lang"],
      defaults: { dryRun: false, force: false, lang: "" },
    });

    if (cli.help) {
      const { translate: tr } = await import("../../lib/i18n.js");
      const t = tr();
      const h = t.raw("ui:help.cmdHelp.translate");
      const o = h.options;
      console.log([h.usage, "", `  ${h.desc}`, "", "Options:", `  ${o.lang}`, `  ${o.force}`, `  ${o.dryRun}`, `  ${o.help}`].join("\n"));
      return;
    }

    ctx = resolveDocsContext(container, cli, { commandId: "docs.translate" });
    ctx.dryRun = cli.dryRun;
    ctx.force = cli.force;
    ctx.targetLang = cli.lang;
  }

  const { root, config: cfg, docsDir } = ctx;
  const docsCfg = cfg.docs;
  const docsMode = docsCfg.mode || "translate";

  if (docsCfg.languages.length < 2) {
    logger.log("Single language configured. Nothing to translate.");
    return;
  }

  if (docsMode !== "translate") {
    logger.log(`Output mode is '${docsMode}', not 'translate'. Use 'sennel docs build' for generate mode.`);
    return;
  }

  if (!ctx.agent) {
    throw new Error("No agent configured. Set 'defaultAgent' in config.json.");
  }
  const agent = ctx.agent;

  const defaultLang = docsCfg.defaultLanguage;
  const targetLangs = ctx.targetLang
    ? [ctx.targetLang]
    : docsCfg.languages.filter((l) => l !== defaultLang);

  if (!fs.existsSync(docsDir)) {
    throw new Error("docs/ directory not found. Run 'sennel docs init' first.");
  }

  const sourceFiles = getChapterFiles(docsDir, { type: ctx.type, configChapters: ctx.config?.chapters, projectRoot: root });
  const readmePath = path.join(root, "README.md");
  const hasReadme = fs.existsSync(readmePath);

  const tasks = buildTranslationTasks({ sourceFiles, targetLangs, docsDir, readmePath, hasReadme, force: ctx.force });

  if (ctx.dryRun) {
    for (const t of tasks) {
      logger.log(`DRY-RUN: would translate ${t.label}`);
    }
    logger.log(`Done. 0 file(s) translated, ${tasks.length} would be translated.`);
    return;
  }

  // Ensure all target language directories exist
  const langDirs = [...new Set(tasks.map((t) => t.lang))];
  for (const lang of langDirs) {
    fs.mkdirSync(path.join(docsDir, lang), { recursive: true });
  }

  const concurrency = resolveConcurrency(cfg);
  logger.log(`Translating ${tasks.length} file(s) (concurrency=${concurrency})...`);

  const results = await mapWithConcurrency(tasks, concurrency, async (task) => {
    logger.verbose(`Translating: ${task.label}`);
    const content = fs.readFileSync(task.sourcePath, "utf8");
    const translated = await translateDocument(content, defaultLang, task.lang, agent, root, cfg.docs?.style);
    fs.writeFileSync(task.targetPath, translated, "utf8");
    logger.verbose(`DONE: ${task.label}`);
    return task.label;
  });

  let totalTranslated = 0;
  let totalErrors = 0;
  for (const r of results) {
    if (r.error) {
      totalErrors++;
      logger.log(`ERROR: ${r.error.message}`);
    } else {
      totalTranslated++;
    }
  }

  const totalSkipped = (sourceFiles.length + (hasReadme ? 1 : 0)) * targetLangs.length - tasks.length;
  logger.log(`Done. ${totalTranslated} file(s) translated, ${totalSkipped} skipped${totalErrors ? `, ${totalErrors} error(s)` : ""}.`);
}

export { buildTranslationTasks };

export default class DocsTranslateCommand extends Command {
  static outputMode = "raw";
  async execute(ctx) {
    return runTranslate(ctx.docsCtx, ctx._rawArgs || []);
  }
}
