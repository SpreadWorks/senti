#!/usr/bin/env node
/**
 * sdd-forge/docs/commands/enrich.js
 *
 * AI で analysis.json の各エントリーに summary/detail/chapter/role を付与する。
 * scan 後に実行し、enriched analysis.json を生成する。
 *
 * バッチ処理: エントリーを固定サイズのバッチに分割して AI を呼び出す。
 * レジューム: 各バッチ完了後に analysis.json を保存。既に enriched なエントリーはスキップ。
 */

import fs from "fs";
import path from "path";
import { parseArgs } from "../../lib/cli.js";
import { sddOutputDir, resolveConcurrency } from "../../lib/config.js";
import { resolveWorkDir } from "../../lib/config.js";
import { minify } from "../lib/minify.js";
import { mapWithConcurrency } from "../lib/concurrency.js";
import { loadFullAnalysis } from "../lib/command-context.js";
import { resolveChaptersOrder } from "../lib/template-merger.js";
import { buildCategoryMapFromDocs, mergeChapters } from "../lib/chapter-resolver.js";
import { filterByDocsExclude } from "../lib/analysis-filter.js";
import { createLogger } from "../../lib/progress.js";
import { translate } from "../../lib/i18n.js";
import { repairJson } from "../../lib/json-parse.js";
import { iterateAnalysisCategories } from "../lib/analysis-entry.js";
import { container } from "../../lib/container.js";
import { resolveDocsContext } from "../lib/docs-context.js";
import { Command } from "../../lib/command.js";
import { PromptBuilder } from "../../lib/prompt-builder.js";

const logger = createLogger("enrich");
const DEFAULT_BATCH_TOKEN_LIMIT = 10000;


function printHelp() {
  const t = translate();
  const h = t.raw("ui:help.cmdHelp.enrich");
  const opts = h.options;
  console.log(
    [
      h.usage,
      "",
      h.desc,
      "",
      "Options:",
      `  ${opts.agent}`,
      `  ${opts.dryRun}`,
      `  ${opts.stdout}`,
      `  ${opts.help}`,
    ].join("\n"),
  );
}

/**
 * analysis からカテゴリ横断でフラットなエントリーリストを収集する。
 * 各エントリーには category と index を付与。
 *
 * @param {Object} analysis - analysis.json のデータ
 * @returns {Array<{category: string, index: number, file: string, lines: number, enriched: boolean}>}
 */
function collectEntries(analysis) {
  const entries = [];
  for (const [cat, catData] of iterateAnalysisCategories(analysis)) {
    const items = catData.entries;
    for (let i = 0; i < items.length; i++) {
      entries.push({
        category: cat,
        index: i,
        file: items[i].file || items[i].name || `${cat}.entries[${i}]`,
        lines: items[i].lines || 0,
        enriched: !!items[i].enrich?.processedAt,
      });
    }
  }
  return entries;
}


function entryKey(category, index) {
  return `${category}:${index}`;
}

/**
 * エントリーをトークン数ベースでバッチに分割する。
 * 各エントリーの essential フィールド（Essential 抽出済みテキスト）のトークン数を基準にする。
 * トークン数は Math.ceil(text.length / 4) で概算する。
 *
 * @param {Array} entries - collectEntries の結果（essential フィールド付き）
 * @param {number} maxTokens - 1バッチあたりの最大トークン数
 * @returns {Array<Array>} バッチの配列
 */
function splitIntoBatches(entries, maxTokens) {
  if (maxTokens <= 0) maxTokens = DEFAULT_BATCH_TOKEN_LIMIT;
  const batches = [];
  let current = [];
  let currentTokens = 0;

  for (const entry of entries) {
    const tokens = Math.ceil((entry.essential || "").length / 4);
    if (current.length > 0 && currentTokens + tokens > maxTokens) {
      batches.push(current);
      current = [];
      currentTokens = 0;
    }
    current.push(entry);
    currentTokens += tokens;
  }
  if (current.length > 0) {
    batches.push(current);
  }
  return batches;
}

/**
 * バッチ用の enrich プロンプトを生成する。
 * 対象ファイルの一覧を明示し、AI にそれぞれのソースを読ませる。
 *
 * @param {string[]} chapters - Chapter file names from preset
 * @param {Array<{category: string, index: number, file: string}>} batchEntries - バッチ内のエントリー
 * @returns {string} Prompt text
 */
const ENRICH_FMT_FALLBACK = [
  "## Output format",
  "Return a JSON object with the following structure:",
  '{"<category>": [{"index": 0, "summary": "...", "detail": "...", "chapter": "...", "role": "...", "keywords": [...]}]}',
  "Return ONLY valid JSON, no markdown fences, no explanation text.",
].join("\n");

function buildEnrichPrompt(chapters, batchEntries, opts) {
  const pb = _buildEnrichPromptBuilder(chapters, batchEntries, opts);
  const built = pb.build();
  const parts = [];
  if (built.systemPrompt) parts.push(built.systemPrompt);
  if (built.fmtFallback) parts.push(built.fmtFallback);
  if (built.userPrompt) parts.push(built.userPrompt);
  return parts.join("\n\n");
}

function _buildEnrichPromptBuilder(chapters, batchEntries, opts) {
  const pb = new PromptBuilder();
  pb.setRole("Analyze the following source code extracts and add structured metadata.");

  // Target files
  const fileParts = [];
  for (const entry of batchEntries) {
    fileParts.push(`### [${entry.category}:${entry.index}] ${entry.file}`);
    if (entry.essential) {
      fileParts.push("```");
      fileParts.push(entry.essential);
      fileParts.push("```");
    }
    fileParts.push("");
  }
  pb.addUserPrompt("## Target files", fileParts.join("\n"));

  // Chapter list
  const chapterLines = ["Each entry should be assigned to one of these chapters:"];
  for (const ch of chapters) {
    if (typeof ch === "string") {
      chapterLines.push(`- ${ch.replace(/\.md$/, "")}`);
    } else {
      const name = ch.chapter.replace(/\.md$/, "");
      chapterLines.push(ch.desc ? `- ${name}: ${ch.desc}` : `- ${name}`);
    }
  }
  pb.addUserPrompt("## Available chapters", chapterLines.join("\n"));

  // Monorepo app assignment (optional)
  const monorepoApps = opts?.monorepoApps;
  if (Array.isArray(monorepoApps) && monorepoApps.length > 0) {
    const appLines = [
      "This is a monorepo. Assign each entry to one of these apps based on its file path:",
    ];
    for (const app of monorepoApps) {
      appLines.push(`- "${app.name}" (path prefix: ${app.path})`);
    }
    appLines.push('Add an `"app"` field to each entry with the app name.');
    pb.addUserPrompt("## Monorepo apps", appLines.join("\n"));
  }

  // JSON schema for structured output
  const schemaProperties = {
    index: { type: "integer" },
    summary: { type: "string" },
    detail: { type: "string" },
    chapter: { type: "string" },
    role: { type: "string", enum: ["controller", "model", "lib", "config", "cli", "middleware", "test", "migration", "route", "view", "other"] },
    keywords: { type: "array", items: { type: "string" } },
  };
  const requiredFields = ["index", "summary", "detail", "chapter", "role", "keywords"];
  if (monorepoApps) {
    schemaProperties.app = { type: "string" };
  }
  pb.setJsonSchema({
    type: "object",
    additionalProperties: {
      type: "array",
      items: {
        type: "object",
        properties: schemaProperties,
        required: requiredFields,
        additionalProperties: false,
      },
    },
  });
  pb.setFmtFallback(ENRICH_FMT_FALLBACK);

  // Rules
  const ruleLines = [
    "- Return ONLY valid JSON, no markdown fences, no explanation text.",
    "- Group entries by category in the output.",
    "- The `index` field must match the original index provided above.",
    "- `summary` should be concise (1-2 sentences).",
    "- `detail`: 3-5 sentences summarizing key implementation patterns and logic.",
    "- `chapter` must be one of the available chapter names (without .md extension).",
  ];
  if (monorepoApps) {
    ruleLines.push("- `app` must be one of the monorepo app names listed above (omit if file does not belong to any app).");
  }
  const LANG_NAMES = { en: "English", ja: "Japanese", zh: "Chinese", ko: "Korean", fr: "French", de: "German", es: "Spanish", pt: "Portuguese", it: "Italian", ru: "Russian" };
  const lang = opts?.lang || "en";
  const langName = LANG_NAMES[lang] || lang;
  ruleLines.push("- `keywords` must be in English. Include 3-10 search keywords with synonyms and related terms.");
  ruleLines.push(`- Write summary, detail, and any descriptive content strictly in ${langName}.`);
  pb.setRules(ruleLines.join("\n"));

  return pb;
}

/**
 * Parse the AI response and extract enrichment data.
 *
 * @param {string} response - Raw AI response
 * @returns {Object|null} Parsed enrichment data
 */
function parseEnrichResponse(response) {
  try {
    return JSON.parse(repairJson(response));
  } catch (_) {
    return null;
  }
}


/**
 * Merge enrichment data into the analysis object (mutates analysis).
 *
 * @param {Object} analysis - Original analysis data
 * @param {Object} enrichment - AI-generated enrichment data
 * @param {Object} [opts] - Merge options
 * @returns {Object} Enriched analysis (same reference)
 */
function mergeEnrichment(analysis, enrichment, opts = {}) {
  const processedAt = opts.now || new Date().toISOString();
  const attemptsByKey = opts.attemptsByKey || new Map();
  const onWarn = opts.onWarn || (() => {});
  const respondedKeys = new Set();

  for (const cat of Object.keys(enrichment)) {
    if (!analysis[cat]) continue;
    const enrichedItems = enrichment[cat];
    if (!Array.isArray(enrichedItems)) continue;

    const items = analysis[cat].entries;
    if (!Array.isArray(items)) continue;

    for (const entry of enrichedItems) {
      if (!entry || typeof entry !== "object") continue;
      const idx = entry.index;
      if (idx == null || idx < 0 || idx >= items.length) continue;
      respondedKeys.add(entryKey(cat, idx));

      // Validate chapter if validChapters set is provided
      let chapter = entry.chapter || items[idx].chapter;
      const validChapters = opts.validChapters;
      if (chapter && validChapters && !validChapters.has(chapter)) {
        onWarn(`WARN: invalid chapter "${chapter}" for ${cat}[${idx}], skipped`);
        chapter = items[idx].chapter || null;
      }

      items[idx] = {
        ...items[idx],
        summary: entry.summary || items[idx].summary,
        detail: entry.detail || items[idx].detail,
        chapter,
        role: entry.role || items[idx].role,
        enrich: {
          processedAt,
          attempts: attemptsByKey.get(entryKey(cat, idx)) ?? items[idx].enrich?.attempts ?? 1,
        },
        ...(entry.app ? { app: entry.app } : {}),
        ...(Array.isArray(entry.keywords) && entry.keywords.length > 0 ? { keywords: entry.keywords } : (items[idx].keywords ? { keywords: items[idx].keywords } : {})),
      };

      if (!entry.summary) {
        const file = items[idx].file || items[idx].name || `${cat}.entries[${idx}]`;
        onWarn(`WARN: summary missing for ${file} (category=${cat}, index=${idx})`);
      }
    }
  }

  for (const [key, attempts] of attemptsByKey.entries()) {
    if (respondedKeys.has(key)) continue;
    const [category, rawIndex] = key.split(":");
    const index = Number(rawIndex);
    const item = analysis?.[category]?.entries?.[index];
    if (!item) continue;
    item.enrich = {
      ...item.enrich,
      attempts,
    };
  }

  analysis.enrichedAt = processedAt;
  return analysis;
}

function buildAttemptsByKey(analysis, batchEntries, attemptsUsed) {
  const attempts = new Map();
  for (const entry of batchEntries) {
    const current = analysis?.[entry.category]?.entries?.[entry.index]?.enrich?.attempts ?? 0;
    attempts.set(entryKey(entry.category, entry.index), current + attemptsUsed);
  }
  return attempts;
}

function saveProgress(root, analysis, totalEnriched, ctx) {
  if (totalEnriched > 0 && !ctx.dryRun && !ctx.stdout) {
    const saved = saveAnalysis(root, analysis);
    logger.log(`saved progress (${totalEnriched} entries) to ${path.relative(root, saved)}`);
  }
}

function formatBatchError(err, b, batches) {
  if (err?.message === "empty response") {
    return `enrich: AI agent returned empty response at batch ${b + 1}/${batches.length}.`;
  }
  return `enrich: AI agent failed at batch ${b + 1}/${batches.length}: ${err.message}`;
}

/**
 * analysis.json をディスクに保存する。
 */
function saveAnalysis(root, analysis) {
  const outputDir = sddOutputDir(root);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  const outputPath = path.join(outputDir, "analysis.json");
  fs.writeFileSync(outputPath, JSON.stringify(analysis, null, 2) + "\n");
  return outputPath;
}

// ---------------------------------------------------------------------------
// メイン
// ---------------------------------------------------------------------------

async function runEnrich(ctx, rawArgs) {
  if (!ctx) {
    const cli = parseArgs(rawArgs, {
      flags: ["--stdout", "--dry-run"],
      defaults: { stdout: false, dryRun: false },
    });
    if (cli.help) {
      printHelp();
      return;
    }
    ctx = resolveDocsContext(container, cli, { commandId: "docs.enrich" });
    ctx.dryRun = cli.dryRun;
    ctx.stdout = cli.stdout;
  }

  const { root, srcRoot, config, type } = ctx;

  // Load analysis
  const analysis = loadFullAnalysis(root);
  if (!analysis) {
    throw new Error("enrich: analysis.json not found. Run 'sdd-forge scan' first.");
  }

  // Check for AI agent
  const agent = container.get("agent");
  if (!agent.resolve(ctx.commandId || "docs.enrich")) {
    logger.log("WARN: no agent configured, skipping enrich.");
    logger.log("Set 'defaultAgent' in config.json.");
    return;
  }

  // Get chapter list from preset
  const presetChapterNames = resolveChaptersOrder(type, undefined);
  if (presetChapterNames.length === 0) {
    logger.log("WARN: no chapters defined in preset, skipping enrich.");
    return;
  }

  // Build chapter objects with desc (preset defaults + config overrides)
  const presetChapters = presetChapterNames.map((name) => {
    // resolveChaptersOrder returns string[] from preset.json
    // If preset.json has been migrated to object format, the name is already extracted
    return typeof name === "string" ? { chapter: name } : name;
  });
  const chapters = mergeChapters(presetChapters, config?.chapters);

  // Static chapter assignment from {{data}} categories (R4)
  const { docsDir } = ctx;
  const chapterFileNames = chapters.map((c) => c.chapter);
  const categoryToChapter = buildCategoryMapFromDocs(docsDir, chapterFileNames);
  if (categoryToChapter.size > 0) {
    logger.log(`static chapter mapping: ${categoryToChapter.size} categories from {{data}} directives`);
  }

  // Collect entries and filter out already-enriched ones (resume)
  const allEntries = collectEntries(analysis);

  // Apply static chapter assignment to pending entries
  for (const entry of allEntries) {
    if (entry.enriched) continue;
    const staticChapter = categoryToChapter.get(entry.category);
    if (staticChapter) {
      // Set chapter statically; AI will still generate summary/detail
      const items = analysis[entry.category]?.entries;
      if (items && items[entry.index]) {
        items[entry.index].chapter = staticChapter;
      }
    }
  }

  // Filter by docs.exclude patterns
  const docsExclude = config?.docs?.exclude;
  const filtered = filterByDocsExclude(allEntries, docsExclude);
  const excludedCount = allEntries.length - filtered.length;
  if (excludedCount > 0) {
    logger.log(`excluded ${excludedCount} entries by docs.exclude`);
  }

  const pending = filtered.filter((e) => !e.enriched);

  if (pending.length === 0) {
    logger.log("all entries already enriched, skipping.");
    return;
  }

  const skipped = filtered.length - pending.length;
  if (skipped > 0) {
    logger.log(`resuming: ${skipped} already enriched, ${pending.length} remaining`);
  } else {
    logger.log(`enriching ${pending.length} entries with AI...`);
  }

  // Extract essential source for each entry
  const { sourceRoot } = ctx;
  for (const entry of pending) {
    try {
      const filePath = path.resolve(sourceRoot || root, entry.file);
      const code = fs.readFileSync(filePath, "utf8");
      entry.essential = minify(code, entry.file, { mode: "essential" });
    } catch (_) {
      entry.essential = "";
    }
  }

  // Split into batches (token-based)
  const maxTokens = Number(config.agent?.batchTokenLimit || 0) || DEFAULT_BATCH_TOKEN_LIMIT;
  const retryCount = Number(config?.agent?.retryCount) || 0;
  const batches = splitIntoBatches(pending, maxTokens);
  const concurrency = resolveConcurrency(config);

  let totalEnriched = 0;

  logger.log(`${batches.length} batches (token limit: ${maxTokens}, concurrency: ${concurrency})`);

  await mapWithConcurrency(batches, concurrency, async (batch) => {
    const batchIdx = batches.indexOf(batch);
    logger.log(`batch ${batchIdx + 1}/${batches.length} (${batch.length} entries)`);

    const enrichPb = _buildEnrichPromptBuilder(chapters, batch, { monorepoApps: config.monorepo?.apps, lang: config.docs?.defaultLanguage || "en" });
    const enrichBuilt = enrichPb.build();

    let response;
    try {
      response = await agent.call(enrichBuilt.userPrompt, {
        commandId: ctx.commandId || "docs.enrich",
        systemPrompt: enrichBuilt.systemPrompt,
        jsonSchema: enrichBuilt.jsonSchema,
        fmtFallback: enrichBuilt.fmtFallback,
        retryCount,
      });
    } catch (err) {
      saveProgress(root, analysis, totalEnriched, ctx);
      throw new Error(formatBatchError(err, batchIdx, batches));
    }

    const enrichment = parseEnrichResponse(response);
    if (!enrichment) {
      // Dump failed response for debugging (to workDir, not .sdd-forge/output/)
      const dumpDir = resolveWorkDir(root, config);
      fs.mkdirSync(dumpDir, { recursive: true });
      const dumpPath = path.join(dumpDir, `enrich-fail-batch${batchIdx + 1}.txt`);
      try { fs.writeFileSync(dumpPath, response); } catch (_) { /* ignore */ }
      logger.log(`response preview (${response.length} chars): ${response.slice(0, 200)}...`);
      logger.log(`full response dumped to: ${path.relative(root, dumpPath)}`);
      saveProgress(root, analysis, totalEnriched, ctx);
      throw new Error(`enrich: could not parse AI response at batch ${batchIdx + 1}/${batches.length}.`);
    }

    // Merge batch results into analysis (mutates)
    const attemptsByKey = buildAttemptsByKey(analysis, batch, 1);
    const validChapterNames = new Set(chapters.map((c) => (typeof c === "string" ? c : c.chapter).replace(/\.md$/, "")));
    mergeEnrichment(analysis, enrichment, {
      batchEntries: batch,
      attemptsByKey,
      validChapters: validChapterNames,
      onWarn: (msg) => logger.log(msg),
    });

    const batchCount = Object.values(enrichment).reduce(
      (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0,
    );
    totalEnriched += batchCount;

    // Save after each batch (resume point)
    if (!ctx.dryRun && !ctx.stdout) {
      saveAnalysis(root, analysis);
    }
  });

  logger.log(`enriched ${totalEnriched} entries in ${batches.length} batches`);

  // Final output
  if (ctx.stdout || ctx.dryRun) {
    process.stdout.write(JSON.stringify(analysis, null, 2) + "\n");
  } else {
    const outputPath = saveAnalysis(root, analysis);
    logger.log(`output: ${path.relative(root, outputPath)}`);
  }
}

export {
  buildEnrichPrompt,
  parseEnrichResponse,
  mergeEnrichment,
  collectEntries,
  filterByDocsExclude,
  splitIntoBatches,
  DEFAULT_BATCH_TOKEN_LIMIT,
};

export default class DocsEnrichCommand extends Command {
  static outputMode = "raw";
  async execute(ctx) {
    return runEnrich(ctx.docsCtx, ctx._rawArgs || []);
  }
}
