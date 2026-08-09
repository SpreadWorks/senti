#!/usr/bin/env node
/**
 * senrail/engine/init.js
 *
 * テンプレート継承チェーンをもとにテンプレートをマージし docs/ に出力する。
 *
 * Usage:
 *   node senrail/engine/init.js [--type php-mvc] [--force]
 */

import fs from "fs";
import path from "path";
import { parseArgs } from "../../lib/cli.js";
import { Command } from "../../lib/command.js";
import { loadPackageField } from "../../lib/config.js";
import { resolveTemplates, mergeResolved, resolveChaptersOrder, translateTemplate } from "../lib/template-merger.js";
import { summaryToText } from "../lib/forge-prompts.js";
import { createLogger } from "../../lib/progress.js";
import { translate } from "../../lib/i18n.js";
import { loadFullAnalysis, loadAnalysisData } from "../lib/command-context.js";
import { stripBlockDirectives } from "../lib/directive-parser.js";
import { container } from "../../lib/container.js";
import { PRODUCT } from "../../lib/product.js";
import { resolveDocsContext } from "../lib/docs-context.js";
import { PromptBuilder } from "../../lib/prompt-builder.js";
import { ExecutionMode, WritePlan } from "../../lib/execution-plan.js";

const logger = createLogger("init");

class InitChapterPlan {
  constructor(resolution, content) {
    if (!resolution?.fileName || typeof content !== "string") {
      throw new Error("InitChapterPlan requires a template resolution and content");
    }
    this.resolution = resolution;
    this.fileName = resolution.fileName;
    this.content = content;
    Object.freeze(this);
  }

  async render(agent, root) {
    if (this.resolution.action !== "translate" || !agent) return this.content;
    return translateTemplate(
      this.content,
      this.resolution.from,
      this.resolution.to,
      agent,
      root,
    );
  }
}

// ---------------------------------------------------------------------------
// AI 章選別
// ---------------------------------------------------------------------------

/**
 * AI エージェントで章の取捨選択を行う。
 *
 * @param {{ fileName: string, content: string }[]} chapters
 * @param {Object} analysis
 * @param {Object} agent - エージェント設定
 * @param {string} root
 * @param {string} purpose - documentStyle.purpose
 * @returns {{ fileName: string, content: string }[]}
 */
async function aiFilterChapters(chapters, analysis, agent, _root, purpose) {
  const summary = summaryToText(analysis);
  const chapterList = chapters.map((ch) => {
    // 章タイトル（最初の # 行）を抽出
    const titleMatch = ch.content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : ch.fileName;
    return `- ${ch.fileName}: ${title}`;
  }).join("\n");

  const purposeClause = purpose
    ? `\nThe documentation purpose is "${purpose}". Judge each chapter's primary audience from its title and expected content. Exclude chapters whose primary audience does not match this purpose.\n`
    : "";

  const audienceRule = purpose === "user-guide"
    ? [
      "Audience rule for user-guide:",
      "- Include only chapters primarily useful to end users or adopters of the tool.",
      "- Exclude chapters primarily intended for developers or maintainers, such as internal design, development/testing, implementation details, architecture-for-contributors, or contributor workflow.",
      "- Do not include a chapter just because the project analysis contains relevant data. Audience fit is required.",
      "- In particular, development_testing.md and internal_design.md should normally be excluded for user-guide unless the chapter is clearly written for end users.",
    ].join("\n")
    : "";

  const selectionRule = "Look at the project analysis and each chapter title. Include a chapter only if both conditions are true: (1) the analysis contains data relevant to that chapter's topic, and (2) the chapter's primary audience matches the documentation purpose. Exclude a chapter if either condition is false. When unsure about audience fit, exclude developer-oriented chapters.";

  const pb = new PromptBuilder();
  pb.setRole("Select which documentation chapters to include for this project.");

  const ruleLines = [selectionRule];
  if (purposeClause) ruleLines.unshift(purposeClause.trim());
  if (audienceRule) ruleLines.push(audienceRule);
  pb.setRules(ruleLines.join("\n"));

  pb.setJsonSchema({
    type: "array",
    items: { type: "string" },
  });
  pb.setFmtFallback('Reply with ONLY a JSON array of chapter filenames. Example: ["overview.md","commands.md"]');

  pb.addUserPrompt("## Project analysis summary", summary);
  pb.addUserPrompt("## Available chapters", chapterList);

  const initBuilt = pb.build();

  let response;
  try {
    response = await agent.call(initBuilt.userPrompt, {
      commandId: "docs.init",
      systemPrompt: initBuilt.systemPrompt,
      jsonSchema: initBuilt.jsonSchema,
      fmtFallback: initBuilt.fmtFallback,
    });
  } catch (err) {
    logger.log(`[init] WARN: AI chapter selection failed: ${err.message}`);
    return chapters;
  }

  // JSON オブジェクトをパース（コードフェンスがあれば除去）
  let cleaned = response.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
  }

  let selected;
  try {
    const parsed = JSON.parse(cleaned);
    selected = Array.isArray(parsed) ? parsed : null;
  } catch (_) {
    logger.log("[init] WARN: AI response is not valid JSON, skipping AI filter.");
    logger.log(`[init]   response: ${cleaned.slice(0, 200)}`);
    return chapters;
  }

  if (!Array.isArray(selected)) {
    logger.log("[init] WARN: AI response does not contain a chapters array, skipping AI filter.");
    return chapters;
  }

  const selectedSet = new Set(selected);
  const filtered = chapters.filter((ch) => selectedSet.has(ch.fileName));

  if (filtered.length === 0) {
    logger.log("[init] WARN: AI selected 0 chapters, ignoring AI filter.");
    return chapters;
  }

  const removed = chapters.filter((ch) => !selectedSet.has(ch.fileName));
  if (removed.length > 0) {
    logger.verbose(`AI filter removed: ${removed.map((ch) => ch.fileName).join(", ")}`);
  }

  return filtered;
}

// ---------------------------------------------------------------------------
// メイン処理
// ---------------------------------------------------------------------------
async function runInit(ctx, rawArgs) {
  // CLI モード: 引数をパースしてコンテキストを構築
  if (!ctx) {
    const cli = parseArgs(rawArgs, {
      flags: ["--force", "--dry-run"],
      options: ["--type", "--lang", "--docs-dir"],
      defaults: { type: "", force: false, dryRun: false, lang: "", docsDir: "" },
    });
    if (cli.help) {
      const tu = translate();
      const h = tu.raw("ui:help.cmdHelp.init");
      const o = h.options;
      console.log([h.usage, "", h.desc, "", "Options:", `  ${o.type}`, `  ${o.force}`, `  ${o.dryRun}`, `  ${o.help}`].join("\n"));
      return;
    }
    ctx = resolveDocsContext(container, cli, { commandId: "docs.init" });
    ctx.force = cli.force;
    ctx.dryRun = cli.dryRun;
  }

  const { root, config, outputLang: lang, docsDir, agent, t } = ctx;

  let type = ctx.type;
  if (!type) {
    const defaults = loadPackageField(root, "docsInit") || {};
    const rawType = config?.type || defaults.defaultType;
    if (!rawType) {
      throw new Error(t("messages:init.noType"));
    }
    type = rawType;
  }

  logger.verbose(`type=${type} lang=${lang}`);

  // テンプレート解決（ボトムアップ方式）
  const projectLocalDir = path.join(root, PRODUCT.managedPath("templates", lang, "docs"));
  const docsConfig = config?.docs;
  const configLangs = docsConfig?.languages?.filter((l) => l !== lang) || [];
  // Always include "en" as ultimate fallback for presets with English-only templates
  const fallbackLangs = configLangs.includes("en") || lang === "en"
    ? configLangs
    : [...configLangs, "en"];
  const configChapters = config?.chapters;
  const chaptersOrder = resolveChaptersOrder(type, configChapters, root);

  const resolutions = resolveTemplates(type, lang, {
    projectLocalDir,
    fallbackLangs,
    chaptersOrder,
    projectRoot: root,
  });

  // Build the write plan from static template resolution. Agent-backed
  // translation and filtering belong to commit and are unreachable in dry-run.
  const plannedChapters = [];
  for (const res of resolutions) {
    if (res.fileName === "README.md") continue;
    const content = mergeResolved(res.sources, res.additive);
    if (content === null) continue;
    plannedChapters.push(new InitChapterPlan(res, content));
  }

  if (plannedChapters.length === 0) {
    throw new Error(t("messages:init.noTemplates"));
  }

  const preview = plannedChapters
    .map((chapter) => `  - ${path.join(docsDir, chapter.fileName)}`)
    .join("\n");
  const plan = new WritePlan(`initialize ${plannedChapters.length} documentation files`, {
    preview,
  });
  plan.add(`create ${docsDir} and write the selected documentation files`, async () => {
    const chapters = [];
    for (const planned of plannedChapters) {
      const content = await planned.render(agent, root);
      chapters.push({ fileName: planned.fileName, content });
    }

    // config.chapters is authoritative. Without it, the agent may select a
    // subset, but only during commit.
    let filteredChapters = chapters;
    const analysis = loadFullAnalysis(root);
    if (configChapters?.length) {
      logger.verbose("config.chapters defined — skipping AI chapter filter");
    } else if (analysis && agent) {
      logger.verbose("AI chapter selection...");
      const summaryData = loadAnalysisData(root);
      filteredChapters = await aiFilterChapters(
        filteredChapters,
        summaryData,
        agent,
        root,
        config?.docs?.style?.purpose || "",
      );
    }

    const totalFiltered = chapters.length - filteredChapters.length;
    logger.verbose(`${filteredChapters.length} template files (${totalFiltered} filtered by AI)`);

    fs.mkdirSync(docsDir, { recursive: true });
    const outputChapters = filteredChapters.map((ch) => ({ ...ch, outputName: ch.fileName }));
    const conflicts = outputChapters.filter((ch) => fs.existsSync(path.join(docsDir, ch.outputName)));
    const conflictSet = new Set(conflicts.map((ch) => ch.outputName));

    if (conflicts.length > 0 && !ctx.force) {
      logger.log(t("messages:init.conflictsExist", { count: conflicts.length }));
      for (const ch of conflicts) logger.log(`  - ${ch.outputName}`);
      logger.log(t("messages:init.useForce"));
    }
    if (conflicts.length > 0 && ctx.force) {
      logger.verbose(`--force: overwriting ${conflicts.length} existing file(s)`);
    }

    for (const chapter of outputChapters) {
      if (conflictSet.has(chapter.outputName) && !ctx.force) continue;
      const text = stripBlockDirectives(chapter.content);
      logger.verbose(`merged: ${chapter.fileName} → ${chapter.outputName}`);
      fs.writeFileSync(path.join(docsDir, chapter.outputName), text, "utf8");
    }

    logger.verbose(`done. ${outputChapters.length} files initialized in docs/`);
    return outputChapters;
  });

  return ExecutionMode.fromDryRun(ctx.dryRun).execute(plan);
}

export { aiFilterChapters };

export default class DocsInitCommand extends Command {
  static outputMode = "raw";
  async execute(ctx) {
    return runInit(ctx.docsCtx, ctx._rawArgs || []);
  }
}
